from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

appointments_router = APIRouter(prefix="/api/appointments", tags=["appointments"])

# ─────────────── Models ───────────────

class AppointmentCreate(BaseModel):
    patient_name: str
    patient_mobile: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    doctor_name: str
    department: str
    appointment_date: str  # YYYY-MM-DD
    appointment_time: str  # HH:MM
    appointment_type: str = "OPD"  # OPD, IPD, Teleconsult
    notes: Optional[str] = None
    status: str = "Scheduled"
    mrn: Optional[str] = None  # MRN from existing patient or will be auto-generated

class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    doctor_name: Optional[str] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

# ─────────────── Routes ───────────────

@appointments_router.get("/")
async def list_appointments(
    date_filter: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    # Date range takes priority over single date filter
    if date_from and date_to:
        query["appointment_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["appointment_date"] = {"$gte": date_from}
    elif date_to:
        query["appointment_date"] = {"$lte": date_to}
    elif date_filter:
        query["appointment_date"] = date_filter
    if status:
        query["status"] = status
    if department:
        query["department"] = department
    # Admin can additionally filter by a specific hospital
    if hospital_id and "hospital_id" not in query:
        query["hospital_id"] = hospital_id

    skip = (page - 1) * limit
    cursor = db.appointments.find(query).sort("appointment_date", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.appointments.count_documents(query)
    return {"appointments": [serialize(d) for d in docs], "total": total, "page": page, "limit": limit}


async def _generate_mrn(db: AsyncIOMotorDatabase) -> str:
    """Generate an MRN using the same counter as patients collection."""
    year = datetime.utcnow().year
    count = await db.patients.count_documents({})
    return f"MRN-{year}{str(count + 1).zfill(6)}"


@appointments_router.post("/", status_code=201)
async def create_appointment(
    data: AppointmentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["token_number"] = await db.appointments.count_documents({"appointment_date": data.appointment_date}) + 1
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    # Assign or auto-generate MRN
    if not doc.get("mrn"):
        doc["mrn"] = await _generate_mrn(db)
    result = await db.appointments.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@appointments_router.get("/stats")
async def appointment_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    today = date.today().isoformat()
    base = {**hospital_filter, "appointment_date": today}
    total_today = await db.appointments.count_documents(base)
    scheduled = await db.appointments.count_documents({**base, "status": "Scheduled"})
    completed = await db.appointments.count_documents({**base, "status": "Completed"})
    cancelled = await db.appointments.count_documents({**base, "status": "Cancelled"})
    total_all = await db.appointments.count_documents({**hospital_filter})
    return {
        "today_total": total_today,
        "today_scheduled": scheduled,
        "today_completed": completed,
        "today_cancelled": cancelled,
        "total_all_time": total_all,
    }


@appointments_router.get("/departments")
async def get_departments(db: AsyncIOMotorDatabase = Depends(get_db)):
    depts = await db.appointments.distinct("department")
    return {"departments": depts}


@appointments_router.get("/{appointment_id}")
async def get_appointment(appointment_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.appointments.find_one({"_id": ObjectId(appointment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return serialize(doc)


@appointments_router.patch("/{appointment_id}")
async def update_appointment(appointment_id: str, data: AppointmentUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.appointments.update_one({"_id": ObjectId(appointment_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Appointment updated"}


@appointments_router.delete("/{appointment_id}")
async def delete_appointment(appointment_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    result = await db.appointments.delete_one({"_id": ObjectId(appointment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Appointment deleted"}
