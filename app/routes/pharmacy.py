"""
Advanced Hospital Pharmacy Management System - Multi-Hospital Edition
=====================================================================
Each hospital has its own isolated pharmacy data.
- Admin can view all hospitals or filter by hospital
- Non-admin users only see their assigned hospital's data
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Body
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
from app.database.async_db import get_db
from app.dependencies import get_current_user
from motor.motor_asyncio import AsyncIOMotorDatabase
import math

pharmacy_router = APIRouter(prefix="/api/pharmacy", tags=["pharmacy"])

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _serialize(doc: dict) -> dict:
    if doc is None:
        return {}
    doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, (datetime, date)):
            doc[k] = v.isoformat()
    return doc


def _oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=400, detail=f"Invalid id: {id_str}")
    return ObjectId(id_str)


def _paginate(page: int, limit: int) -> int:
    return (page - 1) * limit


def _is_admin(user: dict) -> bool:
    roles = user.get("roles", [])
    token_roles = user.get("token_data", {}).get("roles", [])
    if isinstance(roles, str):
        roles = [roles]
    if not isinstance(roles, list):
        roles = []
    all_roles = [r.lower() for r in (roles + (token_roles if isinstance(token_roles, list) else []))]
    return "admin" in all_roles or "superadmin" in all_roles


def _get_hospital_context(user: dict, hospital_id_override: Optional[str] = None) -> dict:
    """Returns hospital filter dict and metadata."""
    is_admin = _is_admin(user)
    # User's own hospital (if assigned)
    user_hospital_id = (
        user.get("hospital_id") or
        user.get("token_data", {}).get("hospital_id")
    )
    user_hospital_name = (
        user.get("hospital_name") or
        user.get("token_data", {}).get("hospital_name") or
        ""
    )
    if is_admin:
        # Admin can optionally filter by hospital_id
        if hospital_id_override:
            return {
                "filter": {"hospital_id": hospital_id_override},
                "hospital_id": hospital_id_override,
                "hospital_name": hospital_id_override,
                "is_admin": True,
                "show_all": False,
            }
        # Admin with no filter -> show all
        return {
            "filter": {},
            "hospital_id": None,
            "hospital_name": "All Hospitals",
            "is_admin": True,
            "show_all": True,
        }
    else:
        # Non-admin must be scoped to their hospital
        hid = hospital_id_override or user_hospital_id
        if not hid:
            # No hospital assigned - return empty filter (they'll see unscoped data)
            return {
                "filter": {},
                "hospital_id": None,
                "hospital_name": user_hospital_name or "Default",
                "is_admin": False,
                "show_all": False,
            }
        return {
            "filter": {"hospital_id": hid},
            "hospital_id": hid,
            "hospital_name": user_hospital_name,
            "is_admin": False,
            "show_all": False,
        }


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class MedicineCreate(BaseModel):
    name: str
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None
    category: str
    sub_category: Optional[str] = None
    manufacturer: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_percent: float = 0.0
    composition: Optional[str] = None
    unit: str = "Strip"
    pack_size: Optional[int] = None
    schedule: Optional[str] = None
    storage_condition: Optional[str] = None
    mrp: float
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    reorder_level: int = 10
    max_stock_level: Optional[int] = None
    is_controlled: bool = False
    is_active: bool = True
    rack_location: Optional[str] = None
    notes: Optional[str] = None
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    manufacturer: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_percent: Optional[float] = None
    composition: Optional[str] = None
    unit: Optional[str] = None
    pack_size: Optional[int] = None
    schedule: Optional[str] = None
    storage_condition: Optional[str] = None
    mrp: Optional[float] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    reorder_level: Optional[int] = None
    max_stock_level: Optional[int] = None
    is_controlled: Optional[bool] = None
    is_active: Optional[bool] = None
    rack_location: Optional[str] = None
    notes: Optional[str] = None


class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license_number: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    is_active: bool = True
    notes: Optional[str] = None
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license_number: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class POItem(BaseModel):
    medicine_id: str
    medicine_name: str
    quantity: int
    purchase_price: float
    gst_percent: float = 0.0
    discount_percent: float = 0.0


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    supplier_name: str
    po_date: Optional[str] = None
    expected_delivery: Optional[str] = None
    items: List[POItem]
    notes: Optional[str] = None
    created_by: Optional[str] = None
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None


class GRNItem(BaseModel):
    medicine_id: str
    medicine_name: str
    batch_number: str
    expiry_date: Optional[str] = None
    quantity: int
    free_quantity: int = 0
    purchase_price: float
    mrp: float
    gst_percent: float = 0.0
    discount_percent: float = 0.0
    location: str = "Main Pharmacy"


class GRNCreate(BaseModel):
    supplier_id: str
    supplier_name: str
    po_id: Optional[str] = None
    invoice_number: str
    invoice_date: str
    items: List[GRNItem]
    notes: Optional[str] = None
    received_by: Optional[str] = None
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None


class StockTransferCreate(BaseModel):
    medicine_id: str
    medicine_name: str
    batch_number: str
    from_location: str
    to_location: str
    quantity: int
    reason: Optional[str] = None
    transferred_by: Optional[str] = None
    hospital_id: Optional[str] = None


class StockAdjustmentItem(BaseModel):
    medicine_id: str
    medicine_name: str
    batch_number: str
    location: str
    system_qty: int
    physical_qty: int
    reason: str


class StockAdjustmentCreate(BaseModel):
    items: List[StockAdjustmentItem]
    adjustment_date: Optional[str] = None
    adjusted_by: Optional[str] = None
    notes: Optional[str] = None
    hospital_id: Optional[str] = None


class DispenseItem(BaseModel):
    medicine_id: str
    medicine_name: str
    batch_number: Optional[str] = None
    quantity: int
    dosage: Optional[str] = None
    duration_days: Optional[int] = None
    unit_price: Optional[float] = None


class PrescriptionDispenseCreate(BaseModel):
    patient_id: Optional[str] = None
    patient_name: str
    patient_phone: Optional[str] = None
    mrn: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    visit_type: str = "OPD"
    ipd_ward: Optional[str] = None
    opd_department: Optional[str] = None
    prescription_id: Optional[str] = None
    items: List[DispenseItem]
    discount_percent: float = 0.0
    discount_amount: Optional[float] = None
    payment_mode: str = "Cash"
    paid_amount: Optional[float] = None
    notes: Optional[str] = None
    dispensed_by: Optional[str] = None
    counter_location: str = "Main Pharmacy"
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None


class ReturnItem(BaseModel):
    medicine_id: str
    medicine_name: str
    batch_number: str
    quantity: int
    unit_price: float
    reason: str


class PatientReturnCreate(BaseModel):
    bill_id: str
    patient_name: str
    mrn: Optional[str] = None
    items: List[ReturnItem]
    return_date: Optional[str] = None
    returned_by: Optional[str] = None
    notes: Optional[str] = None
    hospital_id: Optional[str] = None


class SupplierReturnCreate(BaseModel):
    supplier_id: str
    supplier_name: str
    grn_id: Optional[str] = None
    items: List[ReturnItem]
    return_date: Optional[str] = None
    reason: str
    returned_by: Optional[str] = None
    notes: Optional[str] = None
    hospital_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_medicine(db, medicine_id: str) -> dict:
    med = await db.pharmacy_medicines.find_one({"_id": _oid(medicine_id)})
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return med


async def _pick_fefo_batch(db, medicine_id: str, location: str, required_qty: int,
                            hospital_id: Optional[str] = None):
    q: Dict[str, Any] = {"medicine_id": medicine_id, "location": location, "quantity": {"$gt": 0}}
    if hospital_id:
        q["hospital_id"] = hospital_id
    cursor = db.pharmacy_stock.find(q).sort("expiry_date", 1)
    batches = await cursor.to_list(length=100)
    for batch in batches:
        if batch["quantity"] >= required_qty:
            return batch
    return batches[0] if batches else None


async def _deduct_stock(db, medicine_id: str, batch_number: str, location: str,
                         quantity: int, by: str, reason: str = "sale",
                         hospital_id: Optional[str] = None):
    q: Dict[str, Any] = {
        "medicine_id": medicine_id,
        "batch_number": batch_number,
        "location": location
    }
    if hospital_id:
        q["hospital_id"] = hospital_id
    stock_doc = await db.pharmacy_stock.find_one(q)
    if not stock_doc or stock_doc["quantity"] < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for batch {batch_number} at {location}"
        )
    before = stock_doc["quantity"]
    after = before - quantity
    await db.pharmacy_stock.update_one(
        {"_id": stock_doc["_id"]},
        {"$set": {"quantity": after, "updated_at": datetime.utcnow()}}
    )
    log_doc: Dict[str, Any] = {
        "medicine_id": medicine_id,
        "medicine_name": stock_doc.get("medicine_name", ""),
        "batch_number": batch_number,
        "location": location,
        "transaction_type": "out",
        "reason": reason,
        "quantity": quantity,
        "before_quantity": before,
        "after_quantity": after,
        "by": by,
        "created_at": datetime.utcnow()
    }
    if hospital_id:
        log_doc["hospital_id"] = hospital_id
    await db.pharmacy_stock_logs.insert_one(log_doc)
    return after


async def _add_stock(db, medicine_id: str, medicine_name: str, batch_number: str,
                     expiry_date: str, location: str, quantity: int, purchase_price: float,
                     mrp: float, by: str, reason: str = "purchase",
                     hospital_id: Optional[str] = None):
    q: Dict[str, Any] = {
        "medicine_id": medicine_id,
        "batch_number": batch_number,
        "location": location
    }
    if hospital_id:
        q["hospital_id"] = hospital_id
    existing = await db.pharmacy_stock.find_one(q)
    now = datetime.utcnow()
    if existing:
        before = existing["quantity"]
        after = before + quantity
        await db.pharmacy_stock.update_one(
            {"_id": existing["_id"]},
            {"$set": {"quantity": after, "updated_at": now}}
        )
    else:
        before = 0
        after = quantity
        stock_doc: Dict[str, Any] = {
            "medicine_id": medicine_id,
            "medicine_name": medicine_name,
            "batch_number": batch_number,
            "expiry_date": expiry_date,
            "location": location,
            "quantity": after,
            "purchase_price": purchase_price,
            "mrp": mrp,
            "created_at": now,
            "updated_at": now
        }
        if hospital_id:
            stock_doc["hospital_id"] = hospital_id
        await db.pharmacy_stock.insert_one(stock_doc)
    log_doc: Dict[str, Any] = {
        "medicine_id": medicine_id,
        "medicine_name": medicine_name,
        "batch_number": batch_number,
        "location": location,
        "transaction_type": "in",
        "reason": reason,
        "quantity": quantity,
        "before_quantity": before,
        "after_quantity": after,
        "by": by,
        "created_at": now
    }
    if hospital_id:
        log_doc["hospital_id"] = hospital_id
    await db.pharmacy_stock_logs.insert_one(log_doc)


async def _generate_bill_number(db, hospital_id: Optional[str] = None) -> str:
    today = date.today()
    prefix = f"PH{today.strftime('%Y%m%d')}"
    q: Dict[str, Any] = {"bill_number": {"$regex": f"^{prefix}"}}
    if hospital_id:
        q["hospital_id"] = hospital_id
    count = await db.pharmacy_bills.count_documents(q)
    return f"{prefix}{count + 1:04d}"


async def _generate_po_number(db, hospital_id: Optional[str] = None) -> str:
    today = date.today()
    prefix = f"PO{today.strftime('%Y%m%d')}"
    q: Dict[str, Any] = {"po_number": {"$regex": f"^{prefix}"}}
    if hospital_id:
        q["hospital_id"] = hospital_id
    count = await db.pharmacy_purchase_orders.count_documents(q)
    return f"{prefix}{count + 1:04d}"


async def _generate_grn_number(db, hospital_id: Optional[str] = None) -> str:
    today = date.today()
    prefix = f"GRN{today.strftime('%Y%m%d')}"
    q: Dict[str, Any] = {"grn_number": {"$regex": f"^{prefix}"}}
    if hospital_id:
        q["hospital_id"] = hospital_id
    count = await db.pharmacy_grn.count_documents(q)
    return f"{prefix}{count + 1:04d}"


# ===========================================================================
# 0. HOSPITAL CONTEXT
# ===========================================================================

@pharmacy_router.get("/hospitals-list")
async def get_hospitals_list(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """List all hospitals (for admin hospital selector)."""
    hospitals = await db.hospitals.find({"is_active": True}).sort("name", 1).to_list(length=500)
    return {
        "hospitals": [{"id": str(h["_id"]), "name": h.get("name",""), "code": h.get("code",""),
                        "city": h.get("city",""), "is_active": h.get("is_active", True)}
                       for h in hospitals]
    }


@pharmacy_router.get("/admin/multi-hospital-summary")
async def multi_hospital_summary(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Admin-only: pharmacy summary for every hospital."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    hospitals = await db.hospitals.find({"is_active": True}).sort("name", 1).to_list(length=500)
    today = date.today().isoformat()
    result = []
    for h in hospitals:
        hid = str(h["_id"])
        hname = h.get("name", "Unknown")
        total_meds = await db.pharmacy_medicines.count_documents({"hospital_id": hid, "is_active": True})
        today_bills = await db.pharmacy_bills.count_documents({"hospital_id": hid, "bill_date": today})
        rev_agg = await db.pharmacy_bills.aggregate([
            {"$match": {"hospital_id": hid, "bill_date": today}},
            {"$group": {"_id": None, "total": {"$sum": "$net_payable"}}}
        ]).to_list(length=1)
        today_revenue = rev_agg[0]["total"] if rev_agg else 0
        pending_pos = await db.pharmacy_purchase_orders.count_documents({"hospital_id": hid, "status": "Ordered"})
        low_stock = await db.pharmacy_stock.count_documents({"hospital_id": hid, "quantity": {"$lte": 10, "$gt": 0}})
        out_of_stock_meds = await db.pharmacy_medicines.count_documents({"hospital_id": hid, "is_active": True})
        val_agg = await db.pharmacy_stock.aggregate([
            {"$match": {"hospital_id": hid, "quantity": {"$gt": 0}}},
            {"$group": {"_id": None,
                         "purchase_value": {"$sum": {"$multiply": ["$purchase_price", "$quantity"]}},
                         "mrp_value": {"$sum": {"$multiply": ["$mrp", "$quantity"]}}}}
        ]).to_list(length=1)
        purchase_val = val_agg[0]["purchase_value"] if val_agg else 0
        mrp_val = val_agg[0]["mrp_value"] if val_agg else 0
        result.append({
            "hospital_id": hid,
            "hospital_name": hname,
            "city": h.get("city", ""),
            "total_medicines": total_meds,
            "today_bills": today_bills,
            "today_revenue": round(today_revenue, 2),
            "pending_pos": pending_pos,
            "low_stock_batches": low_stock,
            "stock_purchase_value": round(purchase_val, 2),
            "stock_mrp_value": round(mrp_val, 2),
        })
    return {"hospitals": result, "count": len(result)}


# ===========================================================================
# 1. MEDICINE MASTER
# ===========================================================================

@pharmacy_router.get("/medicines")
async def list_medicines(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    manufacturer: Optional[str] = Query(None),
    schedule: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    out_of_stock: bool = Query(False),
    is_active: Optional[bool] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"generic_name": {"$regex": search, "$options": "i"}},
            {"composition": {"$regex": search, "$options": "i"}},
            {"brand_name": {"$regex": search, "$options": "i"}},
        ]
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    if manufacturer:
        query["manufacturer"] = {"$regex": manufacturer, "$options": "i"}
    if schedule:
        query["schedule"] = schedule
    if is_active is not None:
        query["is_active"] = is_active

    skip = _paginate(page, limit)
    cursor = db.pharmacy_medicines.find(query).sort("name", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_medicines.count_documents(query)

    result = []
    for d in docs:
        med_id = str(d["_id"])
        stock_q: Dict[str, Any] = {"medicine_id": med_id}
        if ctx["hospital_id"]:
            stock_q["hospital_id"] = ctx["hospital_id"]
        stock_agg = await db.pharmacy_stock.aggregate([
            {"$match": stock_q},
            {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
        ]).to_list(length=1)
        total_qty = stock_agg[0]["total"] if stock_agg else 0
        ser = _serialize(d)
        ser["total_stock"] = total_qty
        ser["is_low_stock"] = total_qty <= (ser.get("reorder_level") or 10)
        ser["is_out_of_stock"] = total_qty == 0
        if low_stock and not ser["is_low_stock"]:
            continue
        if out_of_stock and not ser["is_out_of_stock"]:
            continue
        result.append(ser)

    return {"medicines": result, "total": total, "page": page, "limit": limit,
            "total_pages": math.ceil(total / limit) if total else 1,
            "hospital_context": ctx["hospital_name"]}


@pharmacy_router.get("/medicines/categories/list")
async def get_medicine_categories(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    categories = await db.pharmacy_medicines.distinct("category", ctx["filter"])
    return {"categories": sorted(filter(None, categories))}


@pharmacy_router.get("/medicines/manufacturers/list")
async def get_manufacturers(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    manufacturers = await db.pharmacy_medicines.distinct("manufacturer", ctx["filter"])
    return {"manufacturers": sorted(filter(None, manufacturers))}


@pharmacy_router.get("/medicines/search")
async def search_medicines(
    q: str = Query(""),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    hospital_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"generic_name": {"$regex": q, "$options": "i"}},
            {"brand_name": {"$regex": q, "$options": "i"}},
        ]
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    docs = await db.pharmacy_medicines.find(query).limit(limit).to_list(length=limit)
    return {"medicines": [_serialize(d) for d in docs], "count": len(docs)}


@pharmacy_router.get("/medicines/{medicine_id}")
async def get_medicine(
    medicine_id: str,
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    med = await _get_medicine(db, medicine_id)
    ser = _serialize(med)
    stock_q: Dict[str, Any] = {"medicine_id": medicine_id}
    if ctx["hospital_id"]:
        stock_q["hospital_id"] = ctx["hospital_id"]
    batches = await db.pharmacy_stock.find(stock_q).to_list(length=500)
    ser["batches"] = [_serialize(b) for b in batches]
    ser["total_stock"] = sum(b["quantity"] for b in batches)
    return ser


@pharmacy_router.post("/medicines", status_code=201)
async def add_medicine(
    data: MedicineCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    q: Dict[str, Any] = {"name": {"$regex": f"^{data.name}$", "$options": "i"}}
    if ctx["hospital_id"]:
        q["hospital_id"] = ctx["hospital_id"]
    existing = await db.pharmacy_medicines.find_one(q)
    if existing:
        raise HTTPException(status_code=409, detail="Medicine with this name already exists in this hospital")
    doc = data.dict()
    doc["hospital_id"] = ctx["hospital_id"]
    doc["hospital_name"] = ctx["hospital_name"]
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    result = await db.pharmacy_medicines.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@pharmacy_router.put("/medicines/{medicine_id}")
async def update_medicine(
    medicine_id: str,
    data: MedicineUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.utcnow()
    result = await db.pharmacy_medicines.update_one(
        {"_id": _oid(medicine_id)}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine updated successfully"}


@pharmacy_router.delete("/medicines/{medicine_id}")
async def delete_medicine(
    medicine_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    result = await db.pharmacy_medicines.update_one(
        {"_id": _oid(medicine_id)},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine deactivated"}


# ===========================================================================
# 2. SUPPLIER MANAGEMENT
# ===========================================================================

@pharmacy_router.get("/suppliers")
async def list_suppliers(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"contact_person": {"$regex": search, "$options": "i"}},
        ]
    if is_active is not None:
        query["is_active"] = is_active
    skip = _paginate(page, limit)
    cursor = db.pharmacy_suppliers.find(query).sort("name", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_suppliers.count_documents(query)
    return {"suppliers": [_serialize(d) for d in docs], "total": total}


@pharmacy_router.get("/suppliers/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    sup = await db.pharmacy_suppliers.find_one({"_id": _oid(supplier_id)})
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _serialize(sup)


@pharmacy_router.post("/suppliers", status_code=201)
async def add_supplier(
    data: SupplierCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    doc = data.dict()
    doc["hospital_id"] = ctx["hospital_id"]
    doc["hospital_name"] = ctx["hospital_name"]
    doc["created_at"] = datetime.utcnow()
    result = await db.pharmacy_suppliers.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@pharmacy_router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.pharmacy_suppliers.update_one(
        {"_id": _oid(supplier_id)}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier updated"}


@pharmacy_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    result = await db.pharmacy_suppliers.update_one(
        {"_id": _oid(supplier_id)}, {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deactivated"}


# ===========================================================================
# 3. PURCHASE ORDERS
# ===========================================================================

@pharmacy_router.get("/purchase-orders")
async def list_purchase_orders(
    supplier_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if supplier_id:
        query["supplier_id"] = supplier_id
    if status:
        query["status"] = status
    if from_date or to_date:
        query["po_date"] = {}
        if from_date:
            query["po_date"]["$gte"] = from_date
        if to_date:
            query["po_date"]["$lte"] = to_date
    skip = _paginate(page, limit)
    cursor = db.pharmacy_purchase_orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_purchase_orders.count_documents(query)
    return {"purchase_orders": [_serialize(d) for d in docs], "total": total}


@pharmacy_router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    po = await db.pharmacy_purchase_orders.find_one({"_id": _oid(po_id)})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _serialize(po)


@pharmacy_router.post("/purchase-orders", status_code=201)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    po_number = await _generate_po_number(db, ctx["hospital_id"])
    total_amount = 0.0
    items = []
    for item in data.items:
        taxable = item.purchase_price * item.quantity * (1 - item.discount_percent / 100)
        gst_amount = taxable * item.gst_percent / 100
        total_amount += taxable + gst_amount
        items.append({
            **item.dict(),
            "taxable_amount": round(taxable, 2),
            "gst_amount": round(gst_amount, 2),
            "total": round(taxable + gst_amount, 2),
            "received_qty": 0,
        })
    doc = {
        "po_number": po_number,
        "supplier_id": data.supplier_id,
        "supplier_name": data.supplier_name,
        "po_date": data.po_date or date.today().isoformat(),
        "expected_delivery": data.expected_delivery,
        "items": items,
        "total_amount": round(total_amount, 2),
        "status": "Ordered",
        "notes": data.notes,
        "created_by": data.created_by,
        "hospital_id": ctx["hospital_id"],
        "hospital_name": ctx["hospital_name"],
        "created_at": datetime.utcnow(),
    }
    result = await db.pharmacy_purchase_orders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@pharmacy_router.patch("/purchase-orders/{po_id}/cancel")
async def cancel_purchase_order(
    po_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    result = await db.pharmacy_purchase_orders.update_one(
        {"_id": _oid(po_id), "status": {"$in": ["Draft", "Ordered"]}},
        {"$set": {"status": "Cancelled", "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="PO not found or cannot be cancelled")
    return {"message": "Purchase order cancelled"}


# ===========================================================================
# 4. GOODS RECEIVED NOTE (GRN)
# ===========================================================================

@pharmacy_router.get("/grn")
async def list_grn(
    supplier_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if supplier_id:
        query["supplier_id"] = supplier_id
    if from_date or to_date:
        query["invoice_date"] = {}
        if from_date:
            query["invoice_date"]["$gte"] = from_date
        if to_date:
            query["invoice_date"]["$lte"] = to_date
    skip = _paginate(page, limit)
    cursor = db.pharmacy_grn.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_grn.count_documents(query)
    return {"grns": [_serialize(d) for d in docs], "total": total}


@pharmacy_router.get("/grn/{grn_id}")
async def get_grn(
    grn_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    grn = await db.pharmacy_grn.find_one({"_id": _oid(grn_id)})
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    return _serialize(grn)


@pharmacy_router.post("/grn", status_code=201)
async def create_grn(
    data: GRNCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    hid = ctx["hospital_id"]
    grn_number = await _generate_grn_number(db, hid)
    total_amount = 0.0
    items = []

    for item in data.items:
        effective_qty = item.quantity + item.free_quantity
        taxable = item.purchase_price * item.quantity * (1 - item.discount_percent / 100)
        gst_amount = taxable * item.gst_percent / 100
        total_amount += taxable + gst_amount
        items.append({
            **item.dict(),
            "effective_qty": effective_qty,
            "taxable_amount": round(taxable, 2),
            "gst_amount": round(gst_amount, 2),
            "total": round(taxable + gst_amount, 2),
        })
        await _add_stock(
            db=db,
            medicine_id=item.medicine_id,
            medicine_name=item.medicine_name,
            batch_number=item.batch_number,
            expiry_date=item.expiry_date or "",
            location=item.location,
            quantity=effective_qty,
            purchase_price=item.purchase_price,
            mrp=item.mrp,
            by=data.received_by or "system",
            reason=f"GRN {grn_number}",
            hospital_id=hid
        )
        await db.pharmacy_medicines.update_one(
            {"_id": _oid(item.medicine_id)},
            {"$set": {"mrp": item.mrp, "purchase_price": item.purchase_price,
                      "updated_at": datetime.utcnow()}}
        )

    if data.po_id:
        po = await db.pharmacy_purchase_orders.find_one({"_id": _oid(data.po_id)})
        if po:
            po_items = po.get("items", [])
            for pi in po_items:
                for gi in data.items:
                    if pi["medicine_id"] == gi.medicine_id:
                        pi["received_qty"] = pi.get("received_qty", 0) + gi.quantity
            all_received = all(pi.get("received_qty", 0) >= pi["quantity"] for pi in po_items)
            new_status = "Received" if all_received else "Partially Received"
            await db.pharmacy_purchase_orders.update_one(
                {"_id": _oid(data.po_id)},
                {"$set": {"items": po_items, "status": new_status, "updated_at": datetime.utcnow()}}
            )

    doc: Dict[str, Any] = {
        "grn_number": grn_number,
        "supplier_id": data.supplier_id,
        "supplier_name": data.supplier_name,
        "po_id": data.po_id,
        "invoice_number": data.invoice_number,
        "invoice_date": data.invoice_date,
        "items": items,
        "total_amount": round(total_amount, 2),
        "notes": data.notes,
        "received_by": data.received_by,
        "hospital_id": hid,
        "hospital_name": ctx["hospital_name"],
        "created_at": datetime.utcnow(),
    }
    result = await db.pharmacy_grn.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


# ===========================================================================
# 5. STOCK MANAGEMENT
# ===========================================================================

@pharmacy_router.get("/stock")
async def get_stock_overview(
    medicine_id: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    batch_number: Optional[str] = Query(None),
    expiring_in_days: Optional[int] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if medicine_id:
        query["medicine_id"] = medicine_id
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if batch_number:
        query["batch_number"] = {"$regex": batch_number, "$options": "i"}
    if expiring_in_days is not None:
        cutoff = (date.today() + timedelta(days=expiring_in_days)).isoformat()
        query["expiry_date"] = {"$lte": cutoff}
        query["quantity"] = {"$gt": 0}

    skip = _paginate(page, limit)
    cursor = db.pharmacy_stock.find(query).sort(
        [("expiry_date", 1), ("medicine_name", 1)]
    ).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_stock.count_documents(query)
    return {"stock": [_serialize(d) for d in docs], "total": total}


@pharmacy_router.get("/stock/summary")
async def get_stock_summary(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    today_str = date.today().isoformat()
    near_expiry = (date.today() + timedelta(days=90)).isoformat()

    agg = await db.pharmacy_stock.aggregate([
        {"$match": ctx["filter"]},
        {"$group": {
            "_id": None,
            "total_batches": {"$sum": 1},
            "total_quantity": {"$sum": "$quantity"},
            "total_value": {"$sum": {"$multiply": ["$quantity", "$purchase_price"]}},
        }}
    ]).to_list(length=1)
    base = agg[0] if agg else {"total_batches": 0, "total_quantity": 0, "total_value": 0}

    expired_count = await db.pharmacy_stock.count_documents({**ctx["filter"], "expiry_date": {"$lt": today_str}, "quantity": {"$gt": 0}})
    near_expiry_count = await db.pharmacy_stock.count_documents({**ctx["filter"], "expiry_date": {"$gte": today_str, "$lte": near_expiry}, "quantity": {"$gt": 0}})
    out_of_stock = await db.pharmacy_stock.count_documents({**ctx["filter"], "quantity": 0})

    return {
        "total_batches": base.get("total_batches", 0),
        "total_quantity": base.get("total_quantity", 0),
        "total_purchase_value": round(base.get("total_value", 0), 2),
        "expired_batches": expired_count,
        "near_expiry_batches": near_expiry_count,
        "out_of_stock_batches": out_of_stock,
    }


@pharmacy_router.get("/stock/locations")
async def get_stock_locations(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    locations = await db.pharmacy_stock.distinct("location", ctx["filter"])
    result = []
    for loc in sorted(filter(None, locations)):
        q: Dict[str, Any] = {**ctx["filter"], "location": loc}
        agg = await db.pharmacy_stock.aggregate([
            {"$match": q},
            {"$group": {"_id": None, "total_batches": {"$sum": 1}, "total_qty": {"$sum": "$quantity"}}}
        ]).to_list(length=1)
        result.append({
            "location": loc,
            "total_batches": agg[0]["total_batches"] if agg else 0,
            "total_qty": agg[0]["total_qty"] if agg else 0,
        })
    return {"locations": result}


@pharmacy_router.post("/stock/transfer")
async def transfer_stock(
    data: StockTransferCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    hid = ctx["hospital_id"]
    await _deduct_stock(
        db=db, medicine_id=data.medicine_id, batch_number=data.batch_number,
        location=data.from_location, quantity=data.quantity,
        by=data.transferred_by or "system", reason=f"Transfer to {data.to_location}",
        hospital_id=hid
    )
    q: Dict[str, Any] = {"medicine_id": data.medicine_id, "batch_number": data.batch_number}
    if hid:
        q["hospital_id"] = hid
    src = await db.pharmacy_stock.find_one(q)
    expiry = src.get("expiry_date", "") if src else ""
    purchase_price = src.get("purchase_price", 0) if src else 0
    mrp = src.get("mrp", 0) if src else 0

    await _add_stock(
        db=db, medicine_id=data.medicine_id, medicine_name=data.medicine_name,
        batch_number=data.batch_number, expiry_date=expiry,
        location=data.to_location, quantity=data.quantity,
        purchase_price=purchase_price, mrp=mrp,
        by=data.transferred_by or "system", reason=f"Transfer from {data.from_location}",
        hospital_id=hid
    )
    transfer_doc: Dict[str, Any] = {
        "medicine_id": data.medicine_id, "medicine_name": data.medicine_name,
        "batch_number": data.batch_number, "from_location": data.from_location,
        "to_location": data.to_location, "quantity": data.quantity,
        "reason": data.reason, "transferred_by": data.transferred_by,
        "created_at": datetime.utcnow()
    }
    if hid:
        transfer_doc["hospital_id"] = hid
    await db.pharmacy_stock_transfers.insert_one(transfer_doc)
    return {"message": f"Transferred {data.quantity} units from {data.from_location} to {data.to_location}"}


@pharmacy_router.post("/stock/adjustment")
async def adjust_stock(
    data: StockAdjustmentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    hid = ctx["hospital_id"]
    adj_date = data.adjustment_date or date.today().isoformat()
    results = []
    for item in data.items:
        diff = item.physical_qty - item.system_qty
        if diff == 0:
            results.append({"medicine": item.medicine_name, "action": "no_change"})
            continue
        q: Dict[str, Any] = {
            "medicine_id": item.medicine_id,
            "batch_number": item.batch_number,
            "location": item.location
        }
        if hid:
            q["hospital_id"] = hid
        stock_doc = await db.pharmacy_stock.find_one(q)
        before = stock_doc["quantity"] if stock_doc else 0
        if stock_doc:
            await db.pharmacy_stock.update_one(
                {"_id": stock_doc["_id"]},
                {"$set": {"quantity": item.physical_qty, "updated_at": datetime.utcnow()}}
            )
        else:
            new_stock: Dict[str, Any] = {
                "medicine_id": item.medicine_id, "medicine_name": item.medicine_name,
                "batch_number": item.batch_number, "expiry_date": "",
                "location": item.location, "quantity": item.physical_qty,
                "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()
            }
            if hid:
                new_stock["hospital_id"] = hid
            await db.pharmacy_stock.insert_one(new_stock)
        log_doc: Dict[str, Any] = {
            "medicine_id": item.medicine_id, "medicine_name": item.medicine_name,
            "batch_number": item.batch_number, "location": item.location,
            "transaction_type": "adjustment", "reason": item.reason,
            "quantity": abs(diff), "before_quantity": before,
            "after_quantity": item.physical_qty, "by": data.adjusted_by or "system",
            "created_at": datetime.utcnow()
        }
        if hid:
            log_doc["hospital_id"] = hid
        await db.pharmacy_stock_logs.insert_one(log_doc)
        adj_doc: Dict[str, Any] = {
            "medicine_id": item.medicine_id, "medicine_name": item.medicine_name,
            "batch_number": item.batch_number, "location": item.location,
            "system_qty": item.system_qty, "physical_qty": item.physical_qty,
            "difference": diff, "reason": item.reason,
            "adjustment_date": adj_date, "adjusted_by": data.adjusted_by,
            "notes": data.notes, "created_at": datetime.utcnow()
        }
        if hid:
            adj_doc["hospital_id"] = hid
        await db.pharmacy_adjustments.insert_one(adj_doc)
        results.append({"medicine": item.medicine_name, "action": "adjusted", "diff": diff})
    return {"results": results}


@pharmacy_router.get("/stock/logs")
async def get_stock_logs(
    medicine_id: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if medicine_id:
        query["medicine_id"] = medicine_id
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if transaction_type:
        query["transaction_type"] = transaction_type
    if from_date:
        query.setdefault("created_at", {})["$gte"] = datetime.fromisoformat(from_date)
    if to_date:
        query.setdefault("created_at", {})["$lte"] = datetime.fromisoformat(to_date + "T23:59:59")
    skip = _paginate(page, limit)
    cursor = db.pharmacy_stock_logs.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_stock_logs.count_documents(query)
    return {"logs": [_serialize(d) for d in docs], "total": total}


# ===========================================================================
# 6. PRESCRIPTION DISPENSING AND OTC BILLING
# ===========================================================================

@pharmacy_router.get("/bills")
async def list_bills(
    patient_name: Optional[str] = Query(None),
    mrn: Optional[str] = Query(None),
    visit_type: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    counter_location: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if patient_name:
        query["patient_name"] = {"$regex": patient_name, "$options": "i"}
    if mrn:
        query["mrn"] = mrn
    if visit_type:
        query["visit_type"] = visit_type
    if counter_location:
        query["counter_location"] = counter_location
    if status:
        query["status"] = status
    if from_date or to_date:
        query["bill_date"] = {}
        if from_date:
            query["bill_date"]["$gte"] = from_date
        if to_date:
            query["bill_date"]["$lte"] = to_date
    skip = _paginate(page, limit)
    cursor = db.pharmacy_bills.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_bills.count_documents(query)
    return {"bills": [_serialize(d) for d in docs], "total": total}


@pharmacy_router.get("/bills/{bill_id}")
async def get_bill(
    bill_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    bill = await db.pharmacy_bills.find_one({"_id": _oid(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _serialize(bill)


@pharmacy_router.post("/bills", status_code=201)
async def dispense_medicines(
    data: PrescriptionDispenseCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    hid = ctx["hospital_id"]
    bill_number = await _generate_bill_number(db, hid)
    gross_amount = 0.0
    gst_amount = 0.0
    line_items = []

    for item in data.items:
        if item.batch_number:
            stock_q: Dict[str, Any] = {
                "medicine_id": item.medicine_id,
                "batch_number": item.batch_number,
                "location": data.counter_location,
                "quantity": {"$gte": item.quantity}
            }
            if hid:
                stock_q["hospital_id"] = hid
            stock_doc = await db.pharmacy_stock.find_one(stock_q)
            if not stock_doc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Batch {item.batch_number} not available at {data.counter_location}"
                )
            batch_number = item.batch_number
            expiry_date = stock_doc.get("expiry_date", "")
        else:
            batch_doc = await _pick_fefo_batch(db, item.medicine_id, data.counter_location,
                                                item.quantity, hid)
            if not batch_doc:
                raise HTTPException(
                    status_code=400,
                    detail=f"No stock available for {item.medicine_name} at {data.counter_location}"
                )
            batch_number = batch_doc["batch_number"]
            expiry_date = batch_doc.get("expiry_date", "")
            stock_doc = batch_doc

        unit_price = item.unit_price
        if unit_price is None:
            med = await db.pharmacy_medicines.find_one({"_id": _oid(item.medicine_id)})
            unit_price = (
                (med.get("selling_price") or med.get("mrp") or stock_doc.get("mrp", 0))
                if med else stock_doc.get("mrp", 0)
            )

        line_total = unit_price * item.quantity
        med_gst = 0.0
        med_doc = await db.pharmacy_medicines.find_one({"_id": _oid(item.medicine_id)})
        if med_doc:
            gst_pct = med_doc.get("gst_percent", 0)
            med_gst = round(line_total * gst_pct / 100, 2)

        gross_amount += line_total
        gst_amount += med_gst

        await _deduct_stock(
            db=db, medicine_id=item.medicine_id, batch_number=batch_number,
            location=data.counter_location, quantity=item.quantity,
            by=data.dispensed_by or "cashier", reason=f"Bill {bill_number}",
            hospital_id=hid
        )
        line_items.append({
            "medicine_id": item.medicine_id, "medicine_name": item.medicine_name,
            "batch_number": batch_number, "expiry_date": expiry_date,
            "quantity": item.quantity, "dosage": item.dosage,
            "duration_days": item.duration_days, "unit_price": unit_price,
            "line_total": round(line_total, 2), "gst_amount": med_gst,
        })

    if data.discount_amount is not None:
        disc_amount = data.discount_amount
    else:
        disc_amount = round(gross_amount * data.discount_percent / 100, 2)

    net_payable = round(gross_amount + gst_amount - disc_amount, 2)
    paid_amount = round(data.paid_amount if data.paid_amount is not None else net_payable, 2)
    due_amount = round(max(0.0, net_payable - paid_amount), 2)
    bill_status = "Paid" if due_amount <= 0 else ("Partial" if paid_amount > 0 else "Credit")

    doc: Dict[str, Any] = {
        "bill_number": bill_number, "bill_date": date.today().isoformat(),
        "patient_id": data.patient_id, "patient_name": data.patient_name,
        "patient_phone": data.patient_phone, "mrn": data.mrn,
        "doctor_id": data.doctor_id, "doctor_name": data.doctor_name,
        "visit_type": data.visit_type, "ipd_ward": data.ipd_ward,
        "opd_department": data.opd_department, "prescription_id": data.prescription_id,
        "items": line_items, "gross_amount": round(gross_amount, 2),
        "gst_amount": round(gst_amount, 2), "discount_percent": data.discount_percent,
        "discount_amount": round(disc_amount, 2), "net_payable": net_payable,
        "payment_mode": data.payment_mode, "counter_location": data.counter_location,
        "notes": data.notes, "dispensed_by": data.dispensed_by,
        "hospital_id": hid, "hospital_name": ctx["hospital_name"],
        "paid_amount": paid_amount, "due_amount": due_amount,
        "status": bill_status, "created_at": datetime.utcnow(),
    }
    result = await db.pharmacy_bills.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@pharmacy_router.get("/patient-dues")
async def patient_dues(
    search: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if search:
        query["$or"] = [
            {"patient_name": {"$regex": search, "$options": "i"}},
            {"mrn": search},
            {"patient_phone": {"$regex": search, "$options": "i"}},
        ]
    bills = await db.pharmacy_bills.find(query).sort("created_at", -1).to_list(length=500)
    patients: Dict[str, dict] = {}
    for b in bills:
        key = b.get("mrn") or b.get("patient_phone") or b.get("patient_name", "")
        if key not in patients:
            patients[key] = {
                "patient_name": b.get("patient_name", ""),
                "mrn": b.get("mrn", ""),
                "patient_phone": b.get("patient_phone", ""),
                "total_billed": 0.0, "total_paid": 0.0, "total_due": 0.0, "bills": []
            }
        p = patients[key]
        net = float(b.get("net_payable") or 0)
        paid = float(b.get("paid_amount") if b.get("paid_amount") is not None else net)
        due = float(b.get("due_amount") or 0)
        p["total_billed"] = round(p["total_billed"] + net, 2)
        p["total_paid"] = round(p["total_paid"] + paid, 2)
        p["total_due"] = round(p["total_due"] + due, 2)
        p["bills"].append(_serialize(b))
    return {"patients": list(patients.values()), "count": len(patients)}


@pharmacy_router.post("/bills/{bill_id}/collect-payment")
async def collect_bill_payment(
    bill_id: str,
    amount_paid: float = Body(...),
    payment_mode: str = Body("Cash"),
    notes: Optional[str] = Body(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    bill = await db.pharmacy_bills.find_one({"_id": _oid(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    net = float(bill.get("net_payable") or 0)
    current_paid = float(bill.get("paid_amount") if bill.get("paid_amount") is not None else net)
    new_paid = round(current_paid + amount_paid, 2)
    new_due = round(max(0.0, net - new_paid), 2)
    new_status = "Paid" if new_due <= 0 else "Partial"
    await db.pharmacy_bills.update_one(
        {"_id": _oid(bill_id)},
        {"$set": {"paid_amount": new_paid, "due_amount": new_due, "status": new_status, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Payment collected", "bill_id": bill_id, "new_paid": new_paid, "new_due": new_due, "status": new_status}


# ===========================================================================
# 7. RETURNS MANAGEMENT
# ===========================================================================

@pharmacy_router.get("/returns")
async def list_returns(
    return_type: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"]}
    if return_type:
        query["return_type"] = return_type
    if from_date or to_date:
        query["return_date"] = {}
        if from_date:
            query["return_date"]["$gte"] = from_date
        if to_date:
            query["return_date"]["$lte"] = to_date
    skip = _paginate(page, limit)
    cursor = db.pharmacy_returns.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.pharmacy_returns.count_documents(query)
    return {"returns": [_serialize(d) for d in docs], "total": total}


@pharmacy_router.post("/returns/patient", status_code=201)
async def patient_return(
    data: PatientReturnCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    hid = ctx["hospital_id"]
    total_refund = 0.0
    for item in data.items:
        total_refund += item.unit_price * item.quantity
        q: Dict[str, Any] = {"medicine_id": item.medicine_id, "batch_number": item.batch_number}
        if hid:
            q["hospital_id"] = hid
        existing = await db.pharmacy_stock.find_one(q)
        location = existing["location"] if existing else "Main Pharmacy"
        expiry = existing.get("expiry_date", "") if existing else ""
        purchase_price = existing.get("purchase_price", 0) if existing else 0
        await _add_stock(
            db=db, medicine_id=item.medicine_id, medicine_name=item.medicine_name,
            batch_number=item.batch_number, expiry_date=expiry, location=location,
            quantity=item.quantity, purchase_price=purchase_price, mrp=item.unit_price,
            by=data.returned_by or "cashier",
            reason=f"Patient return - Bill {data.bill_id}: {item.reason}",
            hospital_id=hid
        )
    await db.pharmacy_bills.update_one(
        {"_id": _oid(data.bill_id)},
        {"$set": {"status": "Partially Returned", "updated_at": datetime.utcnow()}}
    )
    doc: Dict[str, Any] = {
        "return_type": "patient", "bill_id": data.bill_id,
        "patient_name": data.patient_name, "mrn": data.mrn,
        "items": [i.dict() for i in data.items], "total_refund": round(total_refund, 2),
        "return_date": data.return_date or date.today().isoformat(),
        "returned_by": data.returned_by, "notes": data.notes,
        "hospital_id": hid, "hospital_name": ctx["hospital_name"],
        "created_at": datetime.utcnow(),
    }
    result = await db.pharmacy_returns.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@pharmacy_router.post("/returns/supplier", status_code=201)
async def supplier_return(
    data: SupplierReturnCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, data.hospital_id)
    hid = ctx["hospital_id"]
    total_credit = 0.0
    for item in data.items:
        total_credit += item.unit_price * item.quantity
        q: Dict[str, Any] = {"medicine_id": item.medicine_id, "batch_number": item.batch_number}
        if hid:
            q["hospital_id"] = hid
        stock_doc = await db.pharmacy_stock.find_one(q)
        location = stock_doc["location"] if stock_doc else "Main Pharmacy"
        await _deduct_stock(
            db=db, medicine_id=item.medicine_id, batch_number=item.batch_number,
            location=location, quantity=item.quantity,
            by=data.returned_by or "system", reason=f"Supplier return: {item.reason}",
            hospital_id=hid
        )
    doc: Dict[str, Any] = {
        "return_type": "supplier", "supplier_id": data.supplier_id,
        "supplier_name": data.supplier_name, "grn_id": data.grn_id,
        "items": [i.dict() for i in data.items], "total_credit": round(total_credit, 2),
        "reason": data.reason, "return_date": data.return_date or date.today().isoformat(),
        "returned_by": data.returned_by, "notes": data.notes,
        "hospital_id": hid, "hospital_name": ctx["hospital_name"],
        "created_at": datetime.utcnow(),
    }
    result = await db.pharmacy_returns.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


# ===========================================================================
# 8. ALERTS
# ===========================================================================

@pharmacy_router.get("/alerts/low-stock")
async def low_stock_alerts(
    location: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    match_q: Dict[str, Any] = {**ctx["filter"], "quantity": {"$gt": 0}}
    if location:
        match_q["location"] = location
    pipeline = [
        {"$match": match_q},
        {"$group": {"_id": "$medicine_id", "total_qty": {"$sum": "$quantity"}}},
    ]
    agg = await db.pharmacy_stock.aggregate(pipeline).to_list(length=10000)
    alerts = []
    for entry in agg:
        med = await db.pharmacy_medicines.find_one({"_id": _oid(entry["_id"])})
        if med:
            reorder = med.get("reorder_level", 10)
            if entry["total_qty"] <= reorder:
                alerts.append({
                    "medicine_id": entry["_id"],
                    "medicine_name": med.get("name"),
                    "category": med.get("category"),
                    "total_qty": entry["total_qty"],
                    "reorder_level": reorder,
                    "hospital_name": med.get("hospital_name"),
                })
    return {"low_stock_alerts": alerts, "count": len(alerts)}


@pharmacy_router.get("/alerts/expiry")
async def expiry_alerts(
    days: int = Query(90),
    location: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    cutoff = (date.today() + timedelta(days=days)).isoformat()
    today_str = date.today().isoformat()
    query: Dict[str, Any] = {
        **ctx["filter"],
        "expiry_date": {"$lte": cutoff, "$gte": "1900-01-01"},
        "quantity": {"$gt": 0}
    }
    if location:
        query["location"] = location
    docs = await db.pharmacy_stock.find(query).sort("expiry_date", 1).to_list(length=1000)
    expired = [_serialize(d) for d in docs if d.get("expiry_date", "") < today_str]
    near_expiry = [_serialize(d) for d in docs if today_str <= d.get("expiry_date", "") <= cutoff]
    return {
        "expired": expired, "near_expiry": near_expiry,
        "expired_count": len(expired), "near_expiry_count": len(near_expiry),
    }


@pharmacy_router.get("/alerts/out-of-stock")
async def out_of_stock_alerts(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    q: Dict[str, Any] = {**ctx["filter"], "is_active": True}
    all_meds = await db.pharmacy_medicines.find(q).to_list(length=5000)
    results = []
    for med in all_meds:
        med_id = str(med["_id"])
        stock_q: Dict[str, Any] = {"medicine_id": med_id}
        if ctx["hospital_id"]:
            stock_q["hospital_id"] = ctx["hospital_id"]
        agg = await db.pharmacy_stock.aggregate([
            {"$match": stock_q},
            {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
        ]).to_list(length=1)
        if not agg or agg[0]["total"] == 0:
            results.append({
                "medicine_id": med_id, "medicine_name": med.get("name"),
                "category": med.get("category"), "reorder_level": med.get("reorder_level", 10),
                "hospital_name": med.get("hospital_name"),
            })
    return {"out_of_stock": results, "count": len(results)}


# ===========================================================================
# 9. REPORTS
# ===========================================================================

@pharmacy_router.get("/reports/sales")
async def sales_report(
    from_date: str = Query(...),
    to_date: str = Query(...),
    visit_type: Optional[str] = Query(None),
    counter_location: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"], "bill_date": {"$gte": from_date, "$lte": to_date}}
    if visit_type:
        query["visit_type"] = visit_type
    if counter_location:
        query["counter_location"] = counter_location
    bills = await db.pharmacy_bills.find(query).to_list(length=10000)
    total_gross = sum(b.get("gross_amount", 0) for b in bills)
    total_gst = sum(b.get("gst_amount", 0) for b in bills)
    total_discount = sum(b.get("discount_amount", 0) for b in bills)
    total_net = sum(b.get("net_payable", 0) for b in bills)
    payment_modes: Dict[str, float] = {}
    for b in bills:
        mode = b.get("payment_mode", "Cash")
        payment_modes[mode] = payment_modes.get(mode, 0) + b.get("net_payable", 0)
    return {
        "from_date": from_date, "to_date": to_date,
        "total_bills": len(bills), "total_gross": round(total_gross, 2),
        "total_gst": round(total_gst, 2), "total_discount": round(total_discount, 2),
        "total_net": round(total_net, 2),
        "payment_modes": {k: round(v, 2) for k, v in payment_modes.items()},
        "hospital_context": ctx["hospital_name"],
    }


@pharmacy_router.get("/reports/purchase")
async def purchase_report(
    from_date: str = Query(...),
    to_date: str = Query(...),
    supplier_id: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"], "invoice_date": {"$gte": from_date, "$lte": to_date}}
    if supplier_id:
        query["supplier_id"] = supplier_id
    grns = await db.pharmacy_grn.find(query).to_list(length=10000)
    total = sum(g.get("total_amount", 0) for g in grns)
    return {
        "from_date": from_date, "to_date": to_date,
        "total_grns": len(grns), "total_purchase_amount": round(total, 2),
        "grns": [_serialize(g) for g in grns],
    }


@pharmacy_router.get("/reports/stock-valuation")
async def stock_valuation_report(
    location: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {**ctx["filter"], "quantity": {"$gt": 0}}
    if location:
        query["location"] = location
    docs = await db.pharmacy_stock.find(query).to_list(length=50000)
    purchase_value = sum(d.get("purchase_price", 0) * d["quantity"] for d in docs)
    mrp_value = sum(d.get("mrp", 0) * d["quantity"] for d in docs)
    return {
        "location": location or "All", "total_batches": len(docs),
        "purchase_value": round(purchase_value, 2),
        "mrp_value": round(mrp_value, 2),
        "potential_profit": round(mrp_value - purchase_value, 2),
        "hospital_context": ctx["hospital_name"],
    }


@pharmacy_router.get("/reports/medicine-consumption")
async def medicine_consumption_report(
    from_date: str = Query(...),
    to_date: str = Query(...),
    medicine_id: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    query: Dict[str, Any] = {
        **ctx["filter"],
        "transaction_type": "out",
        "created_at": {
            "$gte": datetime.fromisoformat(from_date),
            "$lte": datetime.fromisoformat(to_date + "T23:59:59")
        }
    }
    if medicine_id:
        query["medicine_id"] = medicine_id
    logs = await db.pharmacy_stock_logs.find(query).to_list(length=100000)
    consumption: Dict[str, dict] = {}
    for log in logs:
        mid = log["medicine_id"]
        if mid not in consumption:
            consumption[mid] = {
                "medicine_id": mid, "medicine_name": log.get("medicine_name", ""), "total_qty": 0
            }
        consumption[mid]["total_qty"] += log["quantity"]
    result = sorted(consumption.values(), key=lambda x: x["total_qty"], reverse=True)
    return {"from_date": from_date, "to_date": to_date, "consumption": result}


# ===========================================================================
# 10. DASHBOARD
# ===========================================================================

@pharmacy_router.get("/dashboard")
async def pharmacy_dashboard(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    ctx = _get_hospital_context(current_user, hospital_id)
    hf = ctx["filter"]  # hospital filter
    today = date.today().isoformat()
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    expiry_90 = (date.today() + timedelta(days=90)).isoformat()

    total_medicines = await db.pharmacy_medicines.count_documents({**hf, "is_active": True})
    total_suppliers = await db.pharmacy_suppliers.count_documents({**hf, "is_active": True})

    today_bills = await db.pharmacy_bills.count_documents({**hf, "bill_date": today})
    today_rev_agg = await db.pharmacy_bills.aggregate([
        {"$match": {**hf, "bill_date": today}},
        {"$group": {"_id": None, "total": {"$sum": "$net_payable"}}}
    ]).to_list(length=1)
    today_revenue = today_rev_agg[0]["total"] if today_rev_agg else 0

    monthly_agg = await db.pharmacy_bills.aggregate([
        {"$match": {**hf, "bill_date": {"$gte": thirty_days_ago, "$lte": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$net_payable"}, "count": {"$sum": 1}}}
    ]).to_list(length=1)
    monthly_revenue = monthly_agg[0]["total"] if monthly_agg else 0
    monthly_bills = monthly_agg[0]["count"] if monthly_agg else 0

    expiry_alerts = await db.pharmacy_stock.count_documents({
        **hf,
        "expiry_date": {"$lte": expiry_90, "$gte": "1900-01-01"},
        "quantity": {"$gt": 0}
    })
    expired_count = await db.pharmacy_stock.count_documents({
        **hf,
        "expiry_date": {"$lt": today, "$gte": "1900-01-01"},
        "quantity": {"$gt": 0}
    })

    all_meds = await db.pharmacy_medicines.find(
        {**hf, "is_active": True}, {"_id": 1, "reorder_level": 1}
    ).to_list(length=10000)
    low_stock_count = 0
    out_of_stock_count = 0
    for med in all_meds:
        med_id = str(med["_id"])
        stock_q: Dict[str, Any] = {"medicine_id": med_id}
        if ctx["hospital_id"]:
            stock_q["hospital_id"] = ctx["hospital_id"]
        agg = await db.pharmacy_stock.aggregate([
            {"$match": stock_q},
            {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
        ]).to_list(length=1)
        total_qty = agg[0]["total"] if agg else 0
        if total_qty == 0:
            out_of_stock_count += 1
        elif total_qty <= (med.get("reorder_level") or 10):
            low_stock_count += 1

    pending_pos = await db.pharmacy_purchase_orders.count_documents({**hf, "status": "Ordered"})

    val_agg = await db.pharmacy_stock.aggregate([
        {"$match": {**hf, "quantity": {"$gt": 0}}},
        {"$group": {
            "_id": None,
            "purchase_value": {"$sum": {"$multiply": ["$purchase_price", "$quantity"]}},
            "mrp_value": {"$sum": {"$multiply": ["$mrp", "$quantity"]}}
        }}
    ]).to_list(length=1)
    purchase_value = val_agg[0]["purchase_value"] if val_agg else 0
    mrp_value = val_agg[0]["mrp_value"] if val_agg else 0

    return {
        "today": today,
        "hospital_context": ctx["hospital_name"],
        "is_admin": ctx["is_admin"],
        "show_all": ctx.get("show_all", False),
        "medicines": {
            "total_active": total_medicines,
            "low_stock": low_stock_count,
            "out_of_stock": out_of_stock_count,
            "expiry_alerts_90d": expiry_alerts,
            "expired_in_stock": expired_count,
        },
        "today_billing": {"total_bills": today_bills, "revenue": round(today_revenue, 2)},
        "monthly_billing": {"total_bills": monthly_bills, "revenue": round(monthly_revenue, 2)},
        "suppliers": total_suppliers,
        "pending_purchase_orders": pending_pos,
        "stock_valuation": {
            "purchase_value": round(purchase_value, 2),
            "mrp_value": round(mrp_value, 2),
        },
    }


@pharmacy_router.get("/stats")
async def pharmacy_stats(
    hospital_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Backward-compatible alias for older frontend chunks."""
    return await pharmacy_dashboard(hospital_id=hospital_id, db=db, current_user=current_user)
