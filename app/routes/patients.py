from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user
from typing import Dict, Any

patients_router = APIRouter(prefix="/api/patients", tags=["patients"])

# ─────────────── Models ───────────────

class PatientCreate(BaseModel):
    # Personal
    full_name: str
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: str = "Male"
    marital_status: Optional[str] = None
    blood_group: Optional[str] = None
    nationality: Optional[str] = "Indian"
    religion: Optional[str] = None
    occupation: Optional[str] = None
    # Contact
    mobile: str
    alt_mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    # Identity
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None
    passport_number: Optional[str] = None
    # Emergency
    emergency_contact_name: Optional[str] = None
    emergency_contact_mobile: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    # Clinical
    patient_category: str = "CASH"
    department: Optional[str] = None
    doctor_name: Optional[str] = None
    referred_by: Optional[str] = None
    chief_complaint: Optional[str] = None
    known_allergies: Optional[str] = None
    past_history: Optional[str] = None
    # Insurance
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_validity: Optional[str] = None
    # Visit
    visit_type: Optional[str] = "Consultation"
    payment_mode: Optional[str] = "Cash"
    admit_date: Optional[str] = None
    exit_date: Optional[str] = None
    # Legacy
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    blood_group: Optional[str] = None
    nationality: Optional[str] = None
    religion: Optional[str] = None
    occupation: Optional[str] = None
    mobile: Optional[str] = None
    alt_mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None
    passport_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_mobile: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    patient_category: Optional[str] = None
    department: Optional[str] = None
    doctor_name: Optional[str] = None
    referred_by: Optional[str] = None
    chief_complaint: Optional[str] = None
    known_allergies: Optional[str] = None
    past_history: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_validity: Optional[str] = None
    visit_type: Optional[str] = None
    payment_mode: Optional[str] = None
    admit_date: Optional[str] = None
    exit_date: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None

class VisitCreate(BaseModel):
    patient_id: str
    mrn: str
    patient_name: str
    visit_date: Optional[str] = None
    admit_date: Optional[str] = None
    exit_date: Optional[str] = None
    department: Optional[str] = None
    doctor_name: Optional[str] = None
    visit_type: Optional[str] = "Consultation"
    payment_mode: Optional[str] = "Cash"
    patient_category: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    status: str = "Waiting"

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

async def generate_mrn(db: AsyncIOMotorDatabase) -> str:
    year = datetime.utcnow().year
    count = await db.patients.count_documents({})
    return f"MRN-{year}{str(count + 1).zfill(6)}"

async def generate_token_number(db: AsyncIOMotorDatabase) -> str:
    today = date.today().isoformat()
    count = await db.patient_visits.count_documents({"visit_date": today})
    return f"T-{str(count + 1).zfill(3)}"

# ─────────────── Routes ───────────────

@patients_router.get("/")
async def list_patients(
    search: Optional[str] = Query(None),
    blood_group: Optional[str] = Query(None),
    patient_category: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
            {"mrn": {"$regex": search, "$options": "i"}},
        ]
    if blood_group:
        query["blood_group"] = blood_group
    if patient_category:
        query["patient_category"] = patient_category
    if gender:
        query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}

    skip = (page - 1) * limit
    cursor = db.patients.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.patients.count_documents(query)
    return {"patients": [serialize(d) for d in docs], "total": total, "page": page, "limit": limit}


@patients_router.post("/", status_code=201)
async def register_patient(
    data: PatientCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["mrn"] = await generate_mrn(db)
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    doc["visit_count"] = 1
    # Tag with the user's hospital
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    result = await db.patients.insert_one(doc)
    patient_id = str(result.inserted_id)
    doc["id"] = patient_id
    doc.pop("_id", None)
    # Auto-create first visit record
    token_number = await generate_token_number(db)
    visit = {
        "patient_id": patient_id,
        "mrn": doc["mrn"],
        "patient_name": doc["full_name"],
        "visit_date": doc.get("admit_date") or date.today().isoformat(),
        "admit_date": doc.get("admit_date") or date.today().isoformat(),
        "exit_date": doc.get("exit_date"),
        "department": doc.get("department"),
        "doctor_name": doc.get("doctor_name"),
        "visit_type": doc.get("visit_type", "Consultation"),
        "payment_mode": doc.get("payment_mode", "Cash"),
        "patient_category": doc.get("patient_category"),
        "chief_complaint": doc.get("chief_complaint"),
        "status": "Waiting",
        "token_number": token_number,
        "created_at": datetime.utcnow(),
    }
    await db.patient_visits.insert_one(visit)
    doc["token_number"] = token_number
    return doc


@patients_router.post("/visits", status_code=201)
async def add_visit(data: VisitCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Record a new visit for an existing patient (same MRN, new date)."""
    doc = data.dict()
    doc["visit_date"] = doc.get("visit_date") or date.today().isoformat()
    doc["admit_date"] = doc.get("admit_date") or doc["visit_date"]
    doc["created_at"] = datetime.utcnow()
    doc["token_number"] = await generate_token_number(db)
    # Increment visit count
    await db.patients.update_one(
        {"_id": ObjectId(data.patient_id)},
        {"$inc": {"visit_count": 1}, "$set": {"updated_at": datetime.utcnow()}}
    )
    result = await db.patient_visits.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@patients_router.get("/visits")
async def list_visits(
    patient_id: Optional[str] = Query(None),
    mrn: Optional[str] = Query(None),
    visit_date: Optional[str] = Query(None),
    date: Optional[str] = Query(None),       # alias used by Reception page
    department: Optional[str] = Query(None),
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
    # support both ?visit_date= and ?date= (Reception uses ?date=)
    effective_date = visit_date or date
    if effective_date:
        query["visit_date"] = effective_date
    if department:
        query["department"] = department
    skip = (page - 1) * limit
    cursor = db.patient_visits.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.patient_visits.count_documents(query)
    for d in docs:
        d["id"] = str(d.pop("_id"))
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
    return {"visits": docs, "total": total}


@patients_router.get("/today")
async def today_visits(
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    today = date.today().isoformat()
    query = {**hospital_filter, "visit_date": today}
    cursor = db.patient_visits.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=500)
    for d in docs:
        d["id"] = str(d.pop("_id"))
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
    return {"visits": docs, "total": len(docs), "date": today}


@patients_router.get("/next-token")
async def get_next_token(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Return the next token number that will be assigned for today's visits."""
    token = await generate_token_number(db)
    return {"token_number": token}


@patients_router.get("/stats")
async def patient_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    f = hospital_filter
    total = await db.patients.count_documents(f)
    male = await db.patients.count_documents({**f, "gender": {"$regex": "^male$", "$options": "i"}})
    female = await db.patients.count_documents({**f, "gender": {"$regex": "^female$", "$options": "i"}})
    private = await db.patients.count_documents({**f, "patient_category": "PRIVATE"})
    insurance = await db.patients.count_documents({**f, "patient_category": "INSURANCE"})
    return {
        "total_patients": total,
        "male": male,
        "female": female,
        "private": private,
        "insurance": insurance,
    }


@patients_router.get("/search")
async def search_patients(q: str = Query(..., min_length=2), db: AsyncIOMotorDatabase = Depends(get_db)):
    query = {"$or": [
        {"full_name": {"$regex": q, "$options": "i"}},
        {"mobile": {"$regex": q, "$options": "i"}},
        {"mrn": {"$regex": q, "$options": "i"}},
    ]}
    cursor = db.patients.find(query).limit(10)
    docs = await cursor.to_list(length=10)
    return [serialize(d) for d in docs]


@patients_router.get("/family/by-mobile")
async def family_by_mobile(mobile: str = Query(..., min_length=5), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Return all patients registered with this mobile number, with their visit counts."""
    cursor = db.patients.find({"mobile": mobile})
    docs = await cursor.to_list(length=50)
    result = []
    for d in docs:
        patient_id = str(d["_id"])
        visit_count = await db.patient_visits.count_documents({"patient_id": patient_id})
        d["visit_count"] = visit_count or d.get("visit_count", 0)
        result.append(serialize(d))
    return {"family": result, "total": len(result), "mobile": mobile}


@patients_router.get("/{patient_id}")
async def get_patient(patient_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    return serialize(doc)


@patients_router.patch("/{patient_id}")
async def update_patient(patient_id: str, data: PatientUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.patients.update_one({"_id": ObjectId(patient_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Patient updated"}


@patients_router.delete("/{patient_id}")
async def delete_patient(patient_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    result = await db.patients.delete_one({"_id": ObjectId(patient_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Patient deleted"}
