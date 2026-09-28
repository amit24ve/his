from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

nursing_router = APIRouter(prefix="/api/nursing", tags=["nursing"])

class NursingNoteCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    ward: str
    bed_number: str
    nurse_name: str
    shift: str  # Morning, Afternoon, Night
    note_type: str = "General"  # General, Medication, Vitals, Procedure
    note_text: str
    vitals: Optional[dict] = None
    intake_output: Optional[dict] = None  # {oral_intake, iv_intake, urine_output, drain_output}

class MedicationAdminCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    ward: str
    bed_number: str
    nurse_name: str
    medication_name: str
    dose: str
    route: str  # Oral, IV, IM, SC
    given_at: Optional[str] = None
    remarks: Optional[str] = None

class WardRoundCreate(BaseModel):
    ward: str
    date: Optional[str] = None
    doctor_name: str
    nurse_name: str
    patients_reviewed: int
    notes: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@nursing_router.get("/notes")
async def list_notes(
    patient_id: Optional[str] = Query(None),
    ward: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    date_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if patient_id:
        query["patient_id"] = patient_id
    if ward:
        query["ward"] = ward
    if shift:
        query["shift"] = shift
    if date_filter and date_filter != "all":
        query["note_date"] = date_filter
    elif not date_filter:
        query["note_date"] = date.today().isoformat()
    # if date_filter == "all": no date restriction
    skip = (page - 1) * limit
    cursor = db.nursing_notes.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.nursing_notes.count_documents(query)
    return {"notes": [serialize(d) for d in docs], "total": total}


@nursing_router.post("/notes", status_code=201)
async def create_note(
    data: NursingNoteCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["note_date"] = date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    result = await db.nursing_notes.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@nursing_router.post("/medications", status_code=201)
async def record_medication_admin(data: MedicationAdminCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["given_at"] = doc.get("given_at") or datetime.utcnow().strftime("%H:%M")
    doc["date"] = date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    result = await db.medication_administration.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@nursing_router.get("/medications")
async def list_medications(
    patient_id: Optional[str] = Query(None),
    ward: Optional[str] = Query(None),
    date_filter: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if ward:
        query["ward"] = ward
    query["date"] = date_filter or date.today().isoformat()
    cursor = db.medication_administration.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [serialize(d) for d in docs]


@nursing_router.get("/ward-patients")
async def get_ward_patients(
    ward: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {"status": "Admitted"}
    if ward:
        query["ward"] = ward
    cursor = db.ipd_admissions.find(query).sort("admission_date", -1)
    docs = await cursor.to_list(length=100)
    return [serialize(d) for d in docs]


@nursing_router.get("/stats")
async def nursing_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    today = date.today().isoformat()
    notes_today = await db.nursing_notes.count_documents({"note_date": today})
    meds_given = await db.medication_administration.count_documents({"date": today})
    admitted = await db.ipd_admissions.count_documents({"status": "Admitted"})
    return {"notes_today": notes_today, "medications_given": meds_given, "currently_admitted": admitted}
