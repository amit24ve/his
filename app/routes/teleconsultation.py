from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

teleconsult_router = APIRouter(prefix="/api/teleconsult", tags=["teleconsultation"])

class TeleconsultCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: Optional[str] = None
    patient_mobile: str
    doctor_name: str
    department: str
    scheduled_date: str
    scheduled_time: str
    platform: str = "Video Call"  # Video Call, Phone, WhatsApp
    chief_complaint: str
    notes: Optional[str] = None
    status: str = "Scheduled"

class TeleconsultUpdate(BaseModel):
    status: Optional[str] = None
    join_url: Optional[str] = None
    diagnosis: Optional[str] = None
    prescription_id: Optional[str] = None
    call_duration_minutes: Optional[int] = None
    doctor_notes: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@teleconsult_router.get("/")
async def list_consultations(
    date_filter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    doctor_name: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if date_filter:
        query["scheduled_date"] = date_filter
    if status:
        query["status"] = status
    if doctor_name:
        query["doctor_name"] = {"$regex": doctor_name, "$options": "i"}
    skip = (page - 1) * limit
    cursor = db.teleconsults.find(query).sort("scheduled_date", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.teleconsults.count_documents(query)
    return {"consultations": [serialize(d) for d in docs], "total": total}


@teleconsult_router.post("/", status_code=201)
async def create_consultation(
    data: TeleconsultCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    count = await db.teleconsults.count_documents({})
    doc["consult_number"] = f"TC-{str(count + 1).zfill(6)}"
    result = await db.teleconsults.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@teleconsult_router.patch("/{consult_id}")
async def update_consultation(consult_id: str, data: TeleconsultUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.teleconsults.update_one({"_id": ObjectId(consult_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return {"message": "Consultation updated"}


@teleconsult_router.get("/stats")
async def teleconsult_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    today = date.today().isoformat()
    scheduled = await db.teleconsults.count_documents({"scheduled_date": today, "status": "Scheduled"})
    completed = await db.teleconsults.count_documents({"scheduled_date": today, "status": "Completed"})
    cancelled = await db.teleconsults.count_documents({"scheduled_date": today, "status": "Cancelled"})
    total = await db.teleconsults.count_documents({})
    return {"today_scheduled": scheduled, "today_completed": completed, "today_cancelled": cancelled, "total_all_time": total}
