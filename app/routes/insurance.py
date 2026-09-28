from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Form
from bson import ObjectId
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter
import os, shutil, re

insurance_router = APIRouter(prefix="/api/insurance", tags=["insurance"])

CLAIM_DOCS_DIR = "static/insurance_docs"
os.makedirs(CLAIM_DOCS_DIR, exist_ok=True)

class InsuranceCompanyCreate(BaseModel):
    name: str
    code: str
    tpa_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    empanelment_type: str = "Cashless"  # Cashless, Reimbursement, Both
    empanelment_date: Optional[str] = None
    expiry_date: Optional[str] = None
    coverage_types: Optional[List[str]] = None
    discount_percentage: Optional[float] = 0.0
    status: str = "Active"

class InsuranceClaimCreate(BaseModel):
    patient_name: str
    mrn: Optional[str] = None
    doctor_name: Optional[str] = None
    patient_id: Optional[str] = None
    uhid: Optional[str] = None
    insurance_company: str
    tpa_name: Optional[str] = None
    policy_number: str
    bill_number: Optional[str] = None
    member_id: Optional[str] = None
    claim_type: str = "Cashless"  # Cashless, Reimbursement
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    total_bill: Optional[float] = 0.0
    claimed_amount: Optional[float] = 0.0
    approved_amount: Optional[float] = None
    copay_amount: Optional[float] = 0.0
    deduction_amount: Optional[float] = 0.0
    patient_liability: Optional[float] = 0.0
    pre_auth_number: Optional[str] = None
    pre_auth_status: str = "Pending"  # Pending, Approved, Rejected
    claim_status: str = "Submitted"  # Submitted, Under Process, Approved, Rejected, Settled
    remarks: Optional[str] = None

class ClaimUpdate(BaseModel):
    approved_amount: Optional[float] = None
    deduction_amount: Optional[float] = None
    patient_liability: Optional[float] = None
    pre_auth_number: Optional[str] = None
    pre_auth_status: Optional[str] = None
    claim_status: Optional[str] = None
    settlement_date: Optional[str] = None
    remarks: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

# --- Insurance Companies ---
@insurance_router.get("/companies")
async def list_companies(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
            {"tpa_name": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.insurance_companies.find(query).sort("name", 1).to_list(200)
    return [serialize(d) for d in docs]

@insurance_router.post("/companies")
async def create_company(data: InsuranceCompanyCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.insurance_companies.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Insurance company code already exists")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    result = await db.insurance_companies.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)

@insurance_router.patch("/companies/{company_id}")
async def update_company(company_id: str, data: dict, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(company_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    data["updated_at"] = datetime.utcnow()
    result = await db.insurance_companies.update_one({"_id": oid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    doc = await db.insurance_companies.find_one({"_id": oid})
    return serialize(doc)

@insurance_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(company_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.insurance_companies.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"message": "Deleted"}

# --- Insurance Claims ---
@insurance_router.get("/claims")
async def list_claims(
    claim_status: Optional[str] = Query(None),
    insurance_company: Optional[str] = Query(None),
    claim_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if hospital_id:
        query["hospital_id"] = hospital_id
    if claim_status:
        query["claim_status"] = claim_status
    if insurance_company:
        query["insurance_company"] = insurance_company
    if claim_type:
        query["claim_type"] = claim_type
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["claim_date"] = date_filter
    if search:
        query["$or"] = [
            {"patient_name": {"$regex": search, "$options": "i"}},
            {"policy_number": {"$regex": search, "$options": "i"}},
            {"uhid": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    docs = await db.insurance_claims.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.insurance_claims.count_documents(query)
    return {"claims": [serialize(d) for d in docs], "total": total, "page": page}

@insurance_router.get("/stats")
async def insurance_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    total = await db.insurance_claims.count_documents({})
    submitted = await db.insurance_claims.count_documents({"claim_status": "Submitted"})
    approved = await db.insurance_claims.count_documents({"claim_status": "Approved"})
    settled = await db.insurance_claims.count_documents({"claim_status": "Settled"})
    rejected = await db.insurance_claims.count_documents({"claim_status": "Rejected"})
    companies = await db.insurance_companies.count_documents({"status": "Active"})

    # Total claimed vs approved amounts
    pipeline_claimed = [{"$group": {"_id": None, "total": {"$sum": "$claimed_amount"}}}]
    pipeline_approved = [{"$group": {"_id": None, "total": {"$sum": "$approved_amount"}}}]
    
    claimed_total = 0
    approved_total = 0
    async for r in db.insurance_claims.aggregate(pipeline_claimed):
        claimed_total = r.get("total", 0)
    async for r in db.insurance_claims.aggregate(pipeline_approved):
        approved_total = r.get("total", 0)

    return {
        "total_claims": total,
        "submitted": submitted,
        "approved": approved,
        "settled": settled,
        "rejected": rejected,
        "under_process": total - submitted - approved - settled - rejected,
        "active_companies": companies,
        "total_claimed": round(claimed_total or 0, 2),
        "total_approved": round(approved_total or 0, 2),
    }

@insurance_router.post("/claims")
async def create_claim(data: InsuranceClaimCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    result = await db.insurance_claims.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)

@insurance_router.get("/claims/{claim_id}")
async def get_claim(claim_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(claim_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.insurance_claims.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Claim not found")
    return serialize(doc)


@insurance_router.post("/claims/{claim_id}/documents")
async def upload_claim_document(
    claim_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form("Other"),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    try:
        oid = ObjectId(claim_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    safe_name = re.sub(r'[^A-Za-z0-9_-]', '_', claim_id)
    ext = os.path.splitext(file.filename)[-1] or ".pdf"
    filename = f"claim_{safe_name}_{doc_type}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    file_path = os.path.join(CLAIM_DOCS_DIR, filename)
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)
    file_url = f"/{CLAIM_DOCS_DIR}/{filename}"
    doc_record = {"doc_type": doc_type, "file_url": file_url, "filename": file.filename, "uploaded_at": datetime.utcnow().isoformat()}
    await db.insurance_claims.update_one({"_id": oid}, {"$push": {"documents": doc_record}})
    return {"message": "Document uploaded", "file_url": file_url, "doc": doc_record}


@insurance_router.get("/claims/{claim_id}/documents")
async def list_claim_documents(claim_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(claim_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.insurance_claims.find_one({"_id": oid}, {"documents": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Claim not found")
    return {"documents": doc.get("documents", [])}


@insurance_router.patch("/claims/{claim_id}")
async def update_claim(claim_id: str, data: ClaimUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(claim_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    result = await db.insurance_claims.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Claim not found")
    doc = await db.insurance_claims.find_one({"_id": oid})
    return serialize(doc)

@insurance_router.delete("/claims/{claim_id}")
async def delete_claim(claim_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(claim_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.insurance_claims.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Claim not found")
    return {"message": "Claim deleted"}
