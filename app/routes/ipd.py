from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

ipd_router = APIRouter(prefix="/api/ipd", tags=["ipd"])

class AdmissionCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    age: Optional[int] = None
    gender: Optional[str] = None
    doctor_name: str
    department: str
    ward: str
    bed_number: str
    admission_date: Optional[str] = None
    admission_reason: str
    admission_type: str = "ELECTIVE"  # ELECTIVE, EMERGENCY, DAY_CARE
    patient_category: str = "PRIVATE"
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    attendant_name: Optional[str] = None
    attendant_mobile: Optional[str] = None
    attendant_relation: Optional[str] = None
    status: str = "Admitted"

class AdmissionUpdate(BaseModel):
    status: Optional[str] = None
    ward: Optional[str] = None
    bed_number: Optional[str] = None
    doctor_name: Optional[str] = None
    discharge_date: Optional[str] = None
    discharge_summary: Optional[str] = None
    final_diagnosis: Optional[str] = None
    notes: Optional[str] = None

class BedCreate(BaseModel):
    ward: str
    room_number: Optional[str] = None
    bed_number: str
    bed_type: str = "General"  # General, Semi-Private, Private, ICU
    floor: Optional[str] = None
    is_occupied: bool = False

class RoomCreate(BaseModel):
    room_name: str
    room_number: str
    ward: str
    floor: Optional[str] = None
    room_type: str = "General"  # General, Semi-Private, Private, ICU, NICU
    capacity: int = 4
    is_active: bool = True

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@ipd_router.get("/admissions")
async def list_admissions(
    status: Optional[str] = Query(None),
    ward: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if hospital_id:
        query["hospital_id"] = hospital_id
    if status:
        query["status"] = status
    # date range filter
    if date_from and date_to:
        query["admission_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["admission_date"] = {"$gte": date_from}
    elif date_to:
        query["admission_date"] = {"$lte": date_to}
    if ward:
        query["ward"] = ward
    if department:
        query["department"] = department
    if search:
        query["$or"] = [
            {"patient_name": {"$regex": search, "$options": "i"}},
            {"mrn": {"$regex": search, "$options": "i"}},
        ]

    skip = (page - 1) * limit
    cursor = db.ipd_admissions.find(query).sort("admission_date", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.ipd_admissions.count_documents(query)
    return {"admissions": [serialize(d) for d in docs], "total": total, "page": page}


@ipd_router.post("/admissions", status_code=201)
async def admit_patient(
    data: AdmissionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Check bed availability
    bed = await db.beds.find_one({"ward": data.ward, "bed_number": data.bed_number, "is_occupied": True})
    if bed:
        raise HTTPException(status_code=400, detail="Bed is already occupied")
    
    doc = data.dict()
    doc["admission_date"] = doc.get("admission_date") or date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    
    # Generate IPD registration number
    count = await db.ipd_admissions.count_documents({})
    year = datetime.utcnow().year % 100
    doc["ipd_reg_no"] = f"IPD-{year}-{str(count + 1).zfill(4)}"
    
    result = await db.ipd_admissions.insert_one(doc)
    
    # Mark bed as occupied
    await db.beds.update_one({"ward": data.ward, "bed_number": data.bed_number}, {"$set": {"is_occupied": True, "patient_id": data.patient_id}}, upsert=True)
    
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@ipd_router.get("/stats")
async def ipd_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    admitted = await db.ipd_admissions.count_documents({**hospital_filter, "status": "Admitted"})
    discharged_today = await db.ipd_admissions.count_documents({**hospital_filter, "status": "Discharged", "discharge_date": date.today().isoformat()})
    total_beds = await db.beds.count_documents({**hospital_filter})
    occupied_beds = await db.beds.count_documents({**hospital_filter, "is_occupied": True})
    return {
        "currently_admitted": admitted,
        "discharged_today": discharged_today,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": total_beds - occupied_beds,
        "occupancy_rate": round((occupied_beds / total_beds * 100) if total_beds else 0, 1),
    }


@ipd_router.get("/beds")
async def list_beds(
    ward: Optional[str] = Query(None),
    is_occupied: Optional[bool] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if ward:
        query["ward"] = ward
    if is_occupied is not None:
        query["is_occupied"] = is_occupied
    cursor = db.beds.find(query).sort([("ward", 1), ("bed_number", 1)])
    docs = await cursor.to_list(length=500)
    return [serialize(d) for d in docs]


@ipd_router.post("/beds", status_code=201)
async def add_bed(data: BedCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.beds.find_one({"ward": data.ward, "bed_number": data.bed_number})
    if existing:
        raise HTTPException(status_code=400, detail="Bed already exists")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.beds.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@ipd_router.patch("/admissions/{admission_id}")
async def update_admission(admission_id: str, data: AdmissionUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # If discharging, free the bed
    if update_data.get("status") == "Discharged":
        admission = await db.ipd_admissions.find_one({"_id": ObjectId(admission_id)})
        if admission:
            await db.beds.update_one(
                {"ward": admission["ward"], "bed_number": admission["bed_number"]},
                {"$set": {"is_occupied": False, "patient_id": None}}
            )
    
    result = await db.ipd_admissions.update_one({"_id": ObjectId(admission_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admission not found")
    return {"message": "Admission updated"}


@ipd_router.get("/admissions/{admission_id}")
async def get_admission(admission_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.ipd_admissions.find_one({"_id": ObjectId(admission_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Admission not found")
    return serialize(doc)


# ─────────────── Room Management ───────────────

@ipd_router.get("/rooms")
async def list_rooms(
    ward: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if ward:
        query["ward"] = ward
    cursor = db.ipd_rooms.find(query).sort([("ward", 1), ("room_number", 1)])
    docs = await cursor.to_list(length=500)
    result = []
    for d in docs:
        d["id"] = str(d.pop("_id"))
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        # Count beds for this room
        bed_count = await db.beds.count_documents({"room_number": d["room_number"], "ward": d["ward"]})
        occupied_count = await db.beds.count_documents({"room_number": d["room_number"], "ward": d["ward"], "is_occupied": True})
        d["bed_count"] = bed_count
        d["occupied_count"] = occupied_count
        result.append(d)
    return result


@ipd_router.post("/rooms", status_code=201)
async def add_room(data: RoomCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.ipd_rooms.find_one({"ward": data.ward, "room_number": data.room_number})
    if existing:
        raise HTTPException(status_code=400, detail="Room already exists in this ward")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.ipd_rooms.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@ipd_router.patch("/rooms/{room_id}")
async def update_room(room_id: str, data: dict, db: AsyncIOMotorDatabase = Depends(get_db)):
    data["updated_at"] = datetime.utcnow()
    result = await db.ipd_rooms.update_one({"_id": ObjectId(room_id)}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"message": "Room updated"}


@ipd_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    result = await db.ipd_rooms.delete_one({"_id": ObjectId(room_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"message": "Room deleted"}
