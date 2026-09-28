from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

doctors_router = APIRouter(prefix="/api/doctors", tags=["doctors"])

class DoctorCreate(BaseModel):
    name: str
    registration_number: str
    department: str
    specialization: str
    qualification: str
    designation: str = "Consultant"
    gender: str = "Male"
    dob: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    emergency_phone: Optional[str] = None
    experience_years: Optional[int] = None
    joining_date: Optional[str] = None
    consulting_hours: Optional[str] = None
    availability_days: Optional[List[str]] = None
    consultation_fee: Optional[float] = None
    address: Optional[str] = None
    signature: Optional[str] = None
    status: str = "Active"  # Active, On Leave, Inactive

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    designation: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    emergency_phone: Optional[str] = None
    experience_years: Optional[int] = None
    consulting_hours: Optional[str] = None
    availability_days: Optional[List[str]] = None
    consultation_fee: Optional[float] = None
    address: Optional[str] = None
    status: Optional[str] = None

class ScheduleCreate(BaseModel):
    doctor_id: str
    doctor_name: str
    date: str
    shift: str = "Morning"  # Morning, Afternoon, Evening, Night
    start_time: str
    end_time: str
    department: str
    room: Optional[str] = None
    max_patients: Optional[int] = 20
    notes: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@doctors_router.get("")
async def list_doctors(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if department:
        query["department"] = department
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"registration_number": {"$regex": search, "$options": "i"}},
            {"specialization": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.doctors.find(query).sort("name", 1).to_list(500)
    total = await db.doctors.count_documents(query)
    return {"doctors": [serialize(d) for d in docs], "total": total}

@doctors_router.get("/stats")
async def doctor_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    total = await db.doctors.count_documents({})
    active = await db.doctors.count_documents({"status": "Active"})
    on_leave = await db.doctors.count_documents({"status": "On Leave"})
    by_dept = {}
    pipeline = [{"$group": {"_id": "$department", "count": {"$sum": 1}}}]
    async for r in db.doctors.aggregate(pipeline):
        by_dept[r["_id"] or "Unknown"] = r["count"]
    return {
        "total": total,
        "active": active,
        "on_leave": on_leave,
        "inactive": total - active - on_leave,
        "by_department": by_dept
    }

@doctors_router.get("/{doctor_id}")
async def get_doctor(doctor_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(doctor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.doctors.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return serialize(doc)

@doctors_router.post("")
async def create_doctor(
    data: DoctorCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    existing = await db.doctors.find_one({"registration_number": data.registration_number})
    if existing:
        raise HTTPException(status_code=400, detail="Registration number already exists")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    result = await db.doctors.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)

@doctors_router.patch("/{doctor_id}")
async def update_doctor(doctor_id: str, data: DoctorUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(doctor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    result = await db.doctors.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doc = await db.doctors.find_one({"_id": oid})
    return serialize(doc)

@doctors_router.delete("/{doctor_id}")
async def delete_doctor(doctor_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(doctor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.doctors.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"message": "Doctor deleted"}

# --- Doctor Schedule ---
@doctors_router.get("/schedule/list")
async def list_schedules(
    doctor_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if doctor_id:
        query["doctor_id"] = doctor_id
    if date:
        query["date"] = date
    if department:
        query["department"] = department
    docs = await db.doctor_schedules.find(query).sort("date", -1).to_list(500)
    return [serialize(d) for d in docs]

@doctors_router.post("/schedule")
async def create_schedule(data: ScheduleCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.doctor_schedules.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)

@doctors_router.delete("/schedule/{schedule_id}")
async def delete_schedule(schedule_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(schedule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.doctor_schedules.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted"}
