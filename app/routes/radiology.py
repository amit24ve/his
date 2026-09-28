from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

radiology_router = APIRouter(prefix="/api/radiology", tags=["radiology"])

class RadiologyTestCreate(BaseModel):
    test_name: str
    test_code: Optional[str] = None
    modality: str  # X-Ray, CT Scan, MRI, Ultrasound, PET Scan, etc.
    body_part: Optional[str] = None
    price: float
    preparation_instructions: Optional[str] = None
    turnaround_hours: int = 24

class RadiologyOrderCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    doctor_name: str
    department: str
    tests: List[str]
    clinical_info: Optional[str] = None
    urgent: bool = False
    notes: Optional[str] = None

class RadiologyResultUpdate(BaseModel):
    findings: str
    impression: str
    radiologist_name: str
    report_date: Optional[str] = None
    images_url: Optional[List[str]] = None
    status: str = "Reported"

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@radiology_router.get("/tests")
async def list_tests(
    modality: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if modality:
        query["modality"] = modality
    cursor = db.radiology_tests.find(query).sort("test_name", 1)
    docs = await cursor.to_list(length=200)
    return [serialize(d) for d in docs]


@radiology_router.post("/tests", status_code=201)
async def add_test(data: RadiologyTestCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.radiology_tests.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@radiology_router.get("/orders")
async def list_orders(
    date_filter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    modality: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if date_filter and date_filter != "all":
        query["order_date"] = date_filter
    elif not date_filter:
        query["order_date"] = date.today().isoformat()
    # if date_filter == "all": no date restriction
    if status:
        query["status"] = status
    if modality:
        query["modality"] = modality
    skip = (page - 1) * limit
    cursor = db.radiology_orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.radiology_orders.count_documents(query)
    return {"orders": [serialize(d) for d in docs], "total": total}


@radiology_router.post("/orders", status_code=201)
async def create_order(
    data: RadiologyOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["order_date"] = date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["status"] = "Ordered"
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    count = await db.radiology_orders.count_documents({})
    doc["order_number"] = f"RAD-{str(count + 1).zfill(6)}"
    result = await db.radiology_orders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@radiology_router.patch("/orders/{order_id}/result")
async def update_result(order_id: str, data: RadiologyResultUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = data.dict()
    update_data["report_date"] = update_data.get("report_date") or date.today().isoformat()
    update_data["updated_at"] = datetime.utcnow()
    result = await db.radiology_orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Result updated"}


@radiology_router.get("/stats")
async def radiology_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    today = date.today().isoformat()
    ordered = await db.radiology_orders.count_documents({"order_date": today, "status": "Ordered"})
    in_progress = await db.radiology_orders.count_documents({"order_date": today, "status": "In Progress"})
    reported = await db.radiology_orders.count_documents({"order_date": today, "status": "Reported"})
    urgent = await db.radiology_orders.count_documents({"order_date": today, "urgent": True, "status": {"$ne": "Reported"}})
    return {"ordered": ordered, "in_progress": in_progress, "reported": reported, "urgent_pending": urgent}
