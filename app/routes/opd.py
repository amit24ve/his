from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

opd_router = APIRouter(prefix="/api/opd", tags=["opd"])

class OPDVisitCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    doctor_id: Optional[str] = None
    doctor_name: str
    department: str
    chief_complaint: str
    visit_date: Optional[str] = None
    token_number: Optional[int] = None
    visit_type: str = "New"  # New, Follow-Up, Emergency
    priority: str = "Normal"  # Normal, Urgent, Emergency
    vitals: Optional[dict] = None  # BP, temperature, weight, etc.
    status: str = "Waiting"

class OPDVisitUpdate(BaseModel):
    status: Optional[str] = None
    vitals: Optional[dict] = None
    diagnosis: Optional[str] = None
    prescription: Optional[List[dict]] = None
    notes: Optional[str] = None
    lab_orders: Optional[List[str]] = None
    radiology_orders: Optional[List[str]] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@opd_router.get("/")
async def list_opd_visits(
    date_filter: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    doctor_name: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if hospital_id:
        query["hospital_id"] = hospital_id
    if date_from and date_to:
        query["visit_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["visit_date"] = {"$gte": date_from}
    elif date_to:
        query["visit_date"] = {"$lte": date_to}
    elif date_filter and date_filter != "all":
        query["visit_date"] = date_filter
    elif not date_filter and not date_from and not date_to:
        query["visit_date"] = date.today().isoformat()
    if department:
        query["department"] = department
    if status:
        query["status"] = status
    if doctor_name:
        query["doctor_name"] = {"$regex": doctor_name, "$options": "i"}

    skip = (page - 1) * limit
    cursor = db.opd_visits.find(query).sort("token_number", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.opd_visits.count_documents(query)
    return {"visits": [serialize(d) for d in docs], "total": total, "page": page}


@opd_router.post("/", status_code=201)
async def create_opd_visit(
    data: OPDVisitCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    today = date.today().isoformat()
    doc["visit_date"] = doc.get("visit_date") or today
    if not doc.get("token_number"):
        count = await db.opd_visits.count_documents({"visit_date": doc["visit_date"], "department": doc["department"]})
        doc["token_number"] = count + 1
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    result = await db.opd_visits.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@opd_router.get("/queue")
async def get_queue(
    department: Optional[str] = Query(None),
    doctor_name: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    today = date.today().isoformat()
    query = {**hospital_filter, "visit_date": today, "status": {"$in": ["Waiting", "In Consultation"]}}
    if department:
        query["department"] = department
    if doctor_name:
        query["doctor_name"] = {"$regex": doctor_name, "$options": "i"}
    cursor = db.opd_visits.find(query).sort("token_number", 1)
    docs = await cursor.to_list(length=100)
    return [serialize(d) for d in docs]


@opd_router.get("/stats")
async def opd_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    today = date.today().isoformat()
    base = {**hospital_filter, "visit_date": today}
    waiting = await db.opd_visits.count_documents({**base, "status": "Waiting"})
    consulting = await db.opd_visits.count_documents({**base, "status": "In Consultation"})
    completed = await db.opd_visits.count_documents({**base, "status": "Completed"})
    total_today = await db.opd_visits.count_documents(base)
    return {"waiting": waiting, "consulting": consulting, "completed": completed, "total_today": total_today}


@opd_router.patch("/{visit_id}")
async def update_opd_visit(visit_id: str, data: OPDVisitUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.opd_visits.update_one({"_id": ObjectId(visit_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="OPD visit not found")
    return {"message": "OPD visit updated"}


@opd_router.get("/{visit_id}")
async def get_opd_visit(visit_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.opd_visits.find_one({"_id": ObjectId(visit_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="OPD visit not found")
    return serialize(doc)
