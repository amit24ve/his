from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

emr_router = APIRouter(prefix="/api/emr", tags=["emr"])

class PrescriptionCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    doctor_name: str
    department: str
    visit_date: Optional[str] = None
    chief_complaint: str
    history_of_illness: Optional[str] = None
    examination_findings: Optional[str] = None
    diagnosis: str
    icd_code: Optional[str] = None
    medications: List[dict]  # [{name, dose, frequency, duration, route, instructions}]
    investigations: Optional[List[str]] = None
    radiology_orders: Optional[List[str]] = None
    advice: Optional[str] = None
    follow_up_date: Optional[str] = None
    vitals: Optional[dict] = None  # {bp, pulse, temp, spo2, weight, height}
    clinical_notes: Optional[str] = None

class EMRSummaryCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    allergy_list: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    surgical_history: Optional[List[str]] = None
    family_history: Optional[str] = None
    social_history: Optional[str] = None
    immunizations: Optional[List[str]] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@emr_router.get("/prescriptions")
async def list_prescriptions(
    patient_id: Optional[str] = Query(None),
    mrn: Optional[str] = Query(None),
    doctor_name: Optional[str] = Query(None),
    date_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if patient_id:
        query["patient_id"] = patient_id
    if mrn:
        query["mrn"] = mrn
    if doctor_name:
        query["doctor_name"] = {"$regex": doctor_name, "$options": "i"}
    if date_filter:
        query["visit_date"] = date_filter
    skip = (page - 1) * limit
    cursor = db.prescriptions.find(query).sort("visit_date", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.prescriptions.count_documents(query)
    return {"prescriptions": [serialize(d) for d in docs], "total": total}


@emr_router.post("/prescriptions", status_code=201)
async def create_prescription(
    data: PrescriptionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["visit_date"] = doc.get("visit_date") or date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    
    count = await db.prescriptions.count_documents({})
    doc["rx_number"] = f"RX-{str(count + 1).zfill(8)}"
    
    result = await db.prescriptions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@emr_router.get("/patient/{patient_id}/history")
async def get_patient_history(patient_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    prescriptions_cursor = db.prescriptions.find({"patient_id": patient_id}).sort("visit_date", -1).limit(20)
    prescriptions = await prescriptions_cursor.to_list(length=20)

    lab_cursor = db.lab_orders.find({"patient_id": patient_id}).sort("order_date", -1).limit(20)
    lab_orders = await lab_cursor.to_list(length=20)

    ipd_cursor = db.ipd_admissions.find({"patient_id": patient_id}).sort("admission_date", -1).limit(10)
    ipd_history = await ipd_cursor.to_list(length=10)

    # OPD visits from patient_visits collection
    opd_cursor = db.patient_visits.find({"patient_id": patient_id}).sort("visit_date", -1).limit(30)
    opd_visits = await opd_cursor.to_list(length=30)

    # Appointments
    appt_cursor = db.appointments.find({"$or": [{"patient_id": patient_id}]}).sort("appointment_date", -1).limit(20)
    appointments = await appt_cursor.to_list(length=20)

    summary = await db.emr_summaries.find_one({"patient_id": patient_id})

    def s(docs):
        out = []
        for d in docs:
            d["id"] = str(d.pop("_id"))
            for k, v in d.items():
                if isinstance(v, datetime):
                    d[k] = v.isoformat()
            out.append(d)
        return out

    return {
        "prescriptions": s(prescriptions),
        "lab_orders": s(lab_orders),
        "ipd_admissions": s(ipd_history),
        "opd_visits": s(opd_visits),
        "appointments": s(appointments),
        "summary": serialize(summary) if summary else None,
    }


@emr_router.post("/summary", status_code=201)
async def create_or_update_summary(data: EMRSummaryCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["updated_at"] = datetime.utcnow()
    existing = await db.emr_summaries.find_one({"patient_id": data.patient_id})
    if existing:
        await db.emr_summaries.update_one({"patient_id": data.patient_id}, {"$set": doc})
        doc["id"] = str(existing["_id"])
    else:
        doc["created_at"] = datetime.utcnow()
        result = await db.emr_summaries.insert_one(doc)
        doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@emr_router.get("/prescriptions/{prescription_id}")
async def get_prescription(prescription_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.prescriptions.find_one({"_id": ObjectId(prescription_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return serialize(doc)
