from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

ot_router = APIRouter(prefix="/api/ot", tags=["ot"])

class SurgeryCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    age: Optional[int] = None
    gender: Optional[str] = None
    surgeon_name: str
    anaesthetist_name: Optional[str] = None
    department: str
    ot_number: str
    surgery_name: str
    surgery_type: str = "Elective"  # Elective, Emergency, Day Care
    surgery_date: str
    surgery_time: str
    duration_minutes: Optional[int] = None
    anaesthesia_type: Optional[str] = None  # General, Spinal, Local, Epidural
    pre_op_diagnosis: str
    post_op_diagnosis: Optional[str] = None
    surgical_team: Optional[List[str]] = None
    pre_op_instructions: Optional[str] = None
    status: str = "Scheduled"

class SurgeryUpdate(BaseModel):
    status: Optional[str] = None
    post_op_diagnosis: Optional[str] = None
    operative_notes: Optional[str] = None
    blood_transfused: Optional[bool] = None
    complications: Optional[str] = None
    duration_minutes: Optional[int] = None

class OTCreate(BaseModel):
    ot_number: str
    ot_name: str
    ot_type: str = "Major"  # Major, Minor, Emergency
    floor: Optional[str] = None
    is_available: bool = True

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@ot_router.get("/schedule")
async def get_ot_schedule(
    date_filter: Optional[str] = Query(None),
    ot_number: Optional[str] = Query(None),
    surgeon_name: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if date_filter and date_filter != "all":
        query["surgery_date"] = date_filter
    elif not date_filter:
        query["surgery_date"] = date.today().isoformat()
    # if date_filter == "all": no date restriction
    if ot_number:
        query["ot_number"] = ot_number
    if surgeon_name:
        query["surgeon_name"] = {"$regex": surgeon_name, "$options": "i"}
    cursor = db.ot_surgeries.find(query).sort("surgery_time", 1)
    docs = await cursor.to_list(length=100)
    return [serialize(d) for d in docs]


@ot_router.post("/schedule", status_code=201)
async def schedule_surgery(
    data: SurgeryCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Check OT availability
    conflict = await db.ot_surgeries.find_one({
        "ot_number": data.ot_number,
        "surgery_date": data.surgery_date,
        "surgery_time": data.surgery_time,
        "status": {"$ne": "Cancelled"}
    })
    if conflict:
        raise HTTPException(status_code=400, detail="OT already booked at this time")
    
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    count = await db.ot_surgeries.count_documents({})
    doc["surgery_number"] = f"OT-{date.today().strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"
    
    result = await db.ot_surgeries.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@ot_router.get("/rooms")
async def list_ots(db: AsyncIOMotorDatabase = Depends(get_db)):
    cursor = db.ot_rooms.find({}).sort("ot_number", 1)
    docs = await cursor.to_list(length=50)
    return [serialize(d) for d in docs]


@ot_router.post("/rooms", status_code=201)
async def add_ot(data: OTCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.ot_rooms.find_one({"ot_number": data.ot_number})
    if existing:
        raise HTTPException(status_code=400, detail="OT number already exists")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.ot_rooms.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@ot_router.patch("/schedule/{surgery_id}")
async def update_surgery(surgery_id: str, data: SurgeryUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.ot_surgeries.update_one({"_id": ObjectId(surgery_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Surgery not found")
    return {"message": "Surgery updated"}


@ot_router.get("/stats")
async def ot_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    today = date.today().isoformat()
    scheduled = await db.ot_surgeries.count_documents({"surgery_date": today, "status": "Scheduled"})
    completed = await db.ot_surgeries.count_documents({"surgery_date": today, "status": "Completed"})
    in_progress = await db.ot_surgeries.count_documents({"surgery_date": today, "status": "In Progress"})
    emergency = await db.ot_surgeries.count_documents({"surgery_date": today, "surgery_type": "Emergency"})
    return {"scheduled": scheduled, "completed": completed, "in_progress": in_progress, "emergency": emergency}
