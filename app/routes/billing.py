from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

billing_router = APIRouter(prefix="/api/billing", tags=["billing"])

class BillCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    visit_type: str = "OPD"  # OPD, IPD, Emergency
    department: Optional[str] = None
    doctor_name: Optional[str] = None
    ipd_reg_no: Optional[str] = None
    items: List[dict]  # [{service_name, quantity, unit_price, gst_percent}]
    patient_category: str = "PRIVATE"
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    discount_percent: float = 0
    discount_reason: Optional[str] = None
    advance_paid: float = 0
    payment_mode: str = "Cash"  # Cash, Card, UPI, Insurance, NEFT
    notes: Optional[str] = None

class ServiceCreate(BaseModel):
    service_name: str
    service_code: Optional[str] = None
    category: str  # Consultation, Procedure, Diagnostic, Room Charges, etc.
    price: float
    gst_percent: float = 0
    is_active: bool = True

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

def calculate_bill_totals(items: List[dict], discount_percent: float, advance_paid: float):
    subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    gst_amount = sum(item.get("quantity", 1) * item.get("unit_price", 0) * item.get("gst_percent", 0) / 100 for item in items)
    gross_total = subtotal + gst_amount
    discount_amount = round(gross_total * discount_percent / 100, 2)
    net_amount = round(gross_total - discount_amount, 2)
    balance_due = round(net_amount - advance_paid, 2)
    return {
        "subtotal": round(subtotal, 2),
        "gst_amount": round(gst_amount, 2),
        "gross_total": round(gross_total, 2),
        "discount_amount": discount_amount,
        "net_amount": net_amount,
        "advance_paid": advance_paid,
        "balance_due": balance_due,
    }

@billing_router.get("/bills")
async def list_bills(
    date_filter: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    visit_type: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if hospital_id:
        query["hospital_id"] = hospital_id
    if date_from and date_to:
        query["bill_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["bill_date"] = {"$gte": date_from}
    elif date_to:
        query["bill_date"] = {"$lte": date_to}
    elif date_filter:
        query["bill_date"] = date_filter
    if visit_type:
        query["visit_type"] = visit_type
    if payment_status:
        query["payment_status"] = payment_status
    if search:
        query["$or"] = [
            {"patient_name": {"$regex": search, "$options": "i"}},
            {"mrn": {"$regex": search, "$options": "i"}},
            {"bill_number": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    cursor = db.hospital_bills.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.hospital_bills.count_documents(query)
    return {"bills": [serialize(d) for d in docs], "total": total, "page": page}


@billing_router.post("/bills", status_code=201)
async def create_bill(
    data: BillCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["bill_date"] = date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    
    totals = calculate_bill_totals(data.items, data.discount_percent, data.advance_paid)
    doc.update(totals)
    doc["payment_status"] = "Paid" if totals["balance_due"] <= 0 else "Partial" if data.advance_paid > 0 else "Pending"
    
    count = await db.hospital_bills.count_documents({})
    year = datetime.utcnow().year % 100
    doc["bill_number"] = f"BILL-{year}-{str(count + 1).zfill(6)}"
    
    result = await db.hospital_bills.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@billing_router.get("/services")
async def list_services(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {"is_active": True}
    if category:
        query["category"] = category
    if search:
        query["service_name"] = {"$regex": search, "$options": "i"}
    cursor = db.billing_services.find(query).sort("service_name", 1)
    docs = await cursor.to_list(length=500)
    return [serialize(d) for d in docs]


@billing_router.post("/services", status_code=201)
async def add_service(data: ServiceCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.billing_services.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@billing_router.get("/stats")
async def billing_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    today = date.today().isoformat()
    today_bills = await db.hospital_bills.count_documents({**hospital_filter, "bill_date": today})
    
    pipeline = [
        {"$match": {**hospital_filter, "bill_date": today}},
        {"$group": {"_id": None, "total": {"$sum": "$net_amount"}, "collected": {"$sum": "$advance_paid"}}}
    ]
    agg = await db.hospital_bills.aggregate(pipeline).to_list(length=1)
    today_revenue = agg[0]["total"] if agg else 0
    today_collected = agg[0]["collected"] if agg else 0
    pending_dues = await db.hospital_bills.count_documents({**hospital_filter, "payment_status": {"$in": ["Pending", "Partial"]}})
    
    return {
        "today_bills": today_bills,
        "today_revenue": round(today_revenue, 2),
        "today_collected": round(today_collected, 2),
        "pending_dues_count": pending_dues,
    }


@billing_router.patch("/bills/{bill_id}/payment")
async def record_payment(
    bill_id: str,
    amount: float = Query(...),
    payment_mode: str = Query("Cash"),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    bill = await db.hospital_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    new_advance = bill.get("advance_paid", 0) + amount
    new_balance = bill.get("net_amount", 0) - new_advance
    payment_status = "Paid" if new_balance <= 0 else "Partial"
    
    await db.hospital_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": {"advance_paid": new_advance, "balance_due": new_balance, "payment_status": payment_status, "payment_mode": payment_mode}}
    )
    return {"message": "Payment recorded", "balance_due": max(0, new_balance), "payment_status": payment_status}


@billing_router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.hospital_bills.find_one({"_id": ObjectId(bill_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Bill not found")
    return serialize(doc)
