from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

laboratory_router = APIRouter(prefix="/api/laboratory", tags=["laboratory"])

class LabTestCreate(BaseModel):
    test_name: str
    test_code: Optional[str] = None
    category: str  # Haematology, Biochemistry, Microbiology, etc.
    price: float
    normal_range: Optional[str] = None
    unit: Optional[str] = None
    turnaround_hours: int = 24

class LabOrderCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    doctor_name: str
    department: str
    visit_type: str = "OPD"
    tests: List[str]  # list of test_ids
    urgent: bool = False
    sample_type: Optional[str] = None
    notes: Optional[str] = None

class LabResultUpdate(BaseModel):
    results: List[dict]  # [{test_name, value, unit, normal_range, flag}]
    technician_name: Optional[str] = None
    verified_by: Optional[str] = None
    remarks: Optional[str] = None
    status: str = "Completed"

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@laboratory_router.get("/tests")
async def list_tests(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"test_name": {"$regex": search, "$options": "i"}},
            {"test_code": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.lab_tests.find(query).sort("test_name", 1)
    docs = await cursor.to_list(length=200)
    return [serialize(d) for d in docs]


@laboratory_router.post("/tests", status_code=201)
async def add_test(data: LabTestCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.lab_tests.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@laboratory_router.get("/orders")
async def list_orders(
    date_filter: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    urgent: Optional[bool] = Query(None),
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
        query["order_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["order_date"] = {"$gte": date_from}
    elif date_to:
        query["order_date"] = {"$lte": date_to}
    elif date_filter and date_filter != "all":
        query["order_date"] = date_filter
    elif not date_filter and not date_from and not date_to:
        query["order_date"] = date.today().isoformat()
    if status:
        query["status"] = status
    if urgent is not None:
        query["urgent"] = urgent
    skip = (page - 1) * limit
    cursor = db.lab_orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.lab_orders.count_documents(query)
    return {"orders": [serialize(d) for d in docs], "total": total}


@laboratory_router.post("/orders", status_code=201)
async def create_lab_order(
    data: LabOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["order_date"] = date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["status"] = "Sample Pending"
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    
    count = await db.lab_orders.count_documents({})
    doc["order_number"] = f"LAB-{str(count + 1).zfill(6)}"
    
    # Calculate total amount
    total = 0.0
    for test_id in data.tests:
        test = await db.lab_tests.find_one({"_id": ObjectId(test_id)})
        if test:
            total += test["price"]
    doc["total_amount"] = total
    
    result = await db.lab_orders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@laboratory_router.patch("/orders/{order_id}/results")
async def update_results(order_id: str, data: LabResultUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = data.dict()
    update_data["result_date"] = date.today().isoformat()
    update_data["updated_at"] = datetime.utcnow()
    result = await db.lab_orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return {"message": "Results updated"}


@laboratory_router.get("/stats")
async def lab_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    today = date.today().isoformat()
    pending = await db.lab_orders.count_documents({"order_date": today, "status": "Sample Pending"})
    processing = await db.lab_orders.count_documents({"order_date": today, "status": "Processing"})
    completed = await db.lab_orders.count_documents({"order_date": today, "status": "Completed"})
    urgent = await db.lab_orders.count_documents({"order_date": today, "urgent": True, "status": {"$ne": "Completed"}})
    return {"pending": pending, "processing": processing, "completed": completed, "urgent_pending": urgent}
