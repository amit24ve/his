from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query, Body, Form
from datetime import datetime, date, timedelta
from typing import List, Optional
from app.database.schemas.franchies_schema import (
    Franchise, KycDocument, CommissionLog,
    ApproveFranchiseRequest, RejectFranchiseRequest, Enquiry
)
from app.database import franchises_collection, enquiries_collection
import os
from uuid import uuid4
from bson import ObjectId

franchise_router = APIRouter(prefix="/api/franchises", tags=["franchises"])

FRANCHISE_DOCS_DIR = "static/franchise_docs"
KYC_DOCUMENT = "static/kyc_document"


# --- UTILS ---
def save_uploaded_file(file: UploadFile, franchise_id: str):
    os.makedirs(FRANCHISE_DOCS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[-1]
    fname = f"{franchise_id}_{uuid4().hex}{ext}"
    file_path = os.path.join(FRANCHISE_DOCS_DIR, fname)
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    return f"/static/franchise_docs/{fname}"


# ------------------ ENQUIRY ENDPOINTS ------------------

def get_next_enquiry_id(enquiries_collection):
    counter = enquiries_collection.database["enquiry_counters"].find_one_and_update(
        {"_id": "enquiryid"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq_num = counter["seq"]
    return f"ENQ-{seq_num:05d}"

# @franchise_router.post("/enquiries", response_model=Enquiry)
# def add_enquiry(enquiry: Enquiry, enquiries_collection=Depends(enquiries_collection)):
#     data = enquiry.dict(by_alias=True, exclude_unset=True)
#     data['enquiry_id'] = get_next_enquiry_id(enquiries_collection)
#     data['date'] = data.get('date') or datetime.now().date().isoformat()
#     data['status'] = data.get('status') or "pending"
#     result = enquiries_collection.insert_one(data)
#     data['id'] = str(result.inserted_id)
#     data.pop('_id', None)
#     return Enquiry(**data)


@franchise_router.post("/enquiries", response_model=Enquiry)
def add_enquiry(enquiry: Enquiry, enquiries_collection=Depends(enquiries_collection)):
    # Check for duplicate by cell_number
    existing = enquiries_collection.find_one({"cell_number": enquiry.cell_number})
    if existing:
        raise HTTPException(status_code=400, detail="An enquiry with this phone number already exists.")

    data = enquiry.dict(by_alias=True, exclude_unset=True)
    data['enquiry_id'] = get_next_enquiry_id(enquiries_collection)
    data['date'] = data.get('date') or datetime.now().date().isoformat()
    data['status'] = data.get('status') or "pending"
    result = enquiries_collection.insert_one(data)
    data['id'] = str(result.inserted_id)
    data.pop('_id', None)
    return Enquiry(**data)


@franchise_router.get("/enquiries", response_model=List[Enquiry])
def list_enquiries(enquiries_collection=Depends(enquiries_collection)):
    result = []
    for doc in enquiries_collection.find():
        doc['id'] = str(doc['_id']) if '_id' in doc else None
        doc.pop('_id', None)
        # Ensure kyc_docs is always present (even if no docs yet)
        doc['kyc_docs'] = doc.get('kyc_docs', [])
        result.append(Enquiry(**doc))
    return result

@franchise_router.patch("/enquiries/{enquiry_id}/approve", response_model=Enquiry)
async def approve_enquiry(
    enquiry_id: str,
    enquiries_collection=Depends(enquiries_collection)
):
    update = {"status": "approved", "approved_at": datetime.now()}
    result = enquiries_collection.update_one(
        {"enquiry_id": enquiry_id},
        {"$set": update}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    doc = enquiries_collection.find_one({"enquiry_id": enquiry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    doc['id'] = str(doc['_id'])
    doc.pop('_id', None)
    return Enquiry(**doc)

@franchise_router.patch("/enquiries/{enquiry_id}/reject", response_model=Enquiry)
async def reject_enquiry(
    enquiry_id: str,
    notes: str = Body(None),
    enquiries_collection=Depends(enquiries_collection)
):
    update = {"status": "rejected", "rejected_at": datetime.now()}
    if notes:
        update["notes"] = notes
    result = enquiries_collection.update_one(
        {"enquiry_id": enquiry_id},
        {"$set": update}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    doc = enquiries_collection.find_one({"enquiry_id": enquiry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    doc['id'] = str(doc['_id'])
    doc.pop('_id', None)
    return Enquiry(**doc)


@franchise_router.get("/enquiries/{enquiry_id}", response_model=Enquiry)
def get_enquiry(enquiry_id: str, enquiries_collection=Depends(enquiries_collection)):
    # Defensive: If enquiry_id is 'undefined' or empty, return 400
    if not enquiry_id or enquiry_id.lower() == "undefined":
        raise HTTPException(status_code=400, detail="Invalid enquiry_id provided.")
    doc = enquiries_collection.find_one({"enquiry_id": enquiry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return Enquiry(**doc)

# ------------------ FRANCHISE ENDPOINTS ------------------

@franchise_router.post("/", response_model=Franchise)
async def create_franchise(franchise: Franchise):
    if not franchise.status:
        franchise.status = "pending"
    if not franchise.created_at:
        franchise.created_at = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    result = franchises_collection.insert_one(franchise.dict(by_alias=True, exclude_none=True))
    franchise.id = str(result.inserted_id)
    return franchise

@franchise_router.get("/", response_model=List[Franchise])
async def list_franchises(
    region: Optional[str] = Query(None), 
    status: Optional[str] = Query(None),
    expires_before: Optional[date] = Query(None),
    franchises_collection = Depends(franchises_collection)
):
    query = {}
    if region:
        query["region"] = region
    if status:
        query["status"] = status
    if expires_before:
        query["expiry_date"] = {"$lte": expires_before}
    cursor = franchises_collection.find(query)
    result = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        for field in ["approved_at", "rejected_at"]:
            if field in doc and doc[field] is not None:
                doc[field] = doc[field].date()
        result.append(Franchise(**doc))
    return result

def save_uploaded_file(file: UploadFile, enquiry_id: str, upload_dir: str = KYC_DOCUMENT):
    folder_path = os.path.join(upload_dir, enquiry_id)
    os.makedirs(folder_path, exist_ok=True)
    file_path = os.path.join(folder_path, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())
    url = f"/kyc_document/{enquiry_id}/{file.filename}"
    return url

@franchise_router.post("/enquiries/{enquiry_id}/upload-kyc", response_model=KycDocument)
async def upload_kyc(
    enquiry_id: str,
    file: UploadFile = File(...),
    docType: str = Form(...),  # Accept docType as form field!
    enquiries_collection=Depends(enquiries_collection)
):
    url = save_uploaded_file(file, enquiry_id)
    doc = KycDocument(name=file.filename, url=url, docType=docType, status="pending")
    # Remove any old doc with same docType
    enquiries_collection.update_one(
        {"enquiry_id": enquiry_id},
        {"$pull": {"kyc_docs": {"docType": docType}}}
    )
    # Add the new doc using .dict(by_alias=True) to ensure 'docType' is used
    result = enquiries_collection.update_one(
        {"enquiry_id": enquiry_id},
        {"$push": {"kyc_docs": doc.dict(by_alias=True)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return doc



@franchise_router.get("/enquiries/{enquiry_id}/kyc-docs", response_model=list[KycDocument])
async def get_kyc_docs(enquiry_id: str, enquiries_collection=Depends(enquiries_collection)):
    doc = enquiries_collection.find_one({"enquiry_id": enquiry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    kyc_docs = doc.get("kyc_docs", [])
    # Convert each raw dict to KycDocument to ensure aliasing
    return [KycDocument(**d) for d in kyc_docs]


@franchise_router.post("/{franchise_id}/commission")
async def add_commission(franchise_id: str, month: str = Body(...), amount: float = Body(...)):
    log = CommissionLog(month=month, amount=amount, franchise_id=franchise_id)
    result = await franchises_collection.update_one(
        {"_id": ObjectId(franchise_id)},
        {"$push": {"commission_logs": log.dict()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Franchise not found")
    return log



@franchise_router.get("/map", response_model=List[dict])
async def map_data():
    cursor = franchises_collection.find({"latitude": {"$ne": None}, "longitude": {"$ne": None}})
    return [
        {
            "franchise_id": str(doc["_id"]),
            "name": doc["name"],
            "latitude": doc["latitude"],
            "longitude": doc["longitude"],
            "region": doc.get("region", ""),
            "status": doc.get("status", "")
        }
        for doc in cursor
    ]

@franchise_router.get("/expiring-soon", response_model=List[Franchise])
async def expiring_soon(days: int = 30):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    soon = today + timedelta(days=days)
    cursor = franchises_collection.find({"expiry_date": {"$gte": today, "$lte": soon}})
    result = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        if "expiry_date" in doc and isinstance(doc["expiry_date"], datetime):
            doc["expiry_date"] = doc["expiry_date"].date()
        for field in ["approved_at", "rejected_at"]:
            if field in doc and isinstance(doc[field], datetime):
                doc[field] = doc[field].date()
        result.append(Franchise(**doc))
    return result

@franchise_router.get("/enquiry-monthly-counts")
def enquiry_monthly_counts(year: int = datetime.now().year, enquiries_collection=Depends(enquiries_collection)):
    pipeline = [
        {
            "$match": {
                "date": {
                    "$regex": f"^{year}-"
                }
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$date", 5, 2]},
                "count": {"$sum": 1}
            }
        }
    ]
    data = list(enquiries_collection.aggregate(pipeline))
    result = {str(int(d["_id"])).zfill(2): d["count"] for d in data}
    return result

from fastapi import Body, HTTPException, Depends

@franchise_router.patch("/enquiries/{enquiry_id}/kyc-doc-status")
async def update_kyc_doc_status(
    enquiry_id: str,
    payload: dict = Body(...),  # expects { "docType": "...", "status": "yes"/"no" }
    enquiries_collection=Depends(enquiries_collection)
):
    docType = payload.get("docType")
    status = payload.get("status")
    if not docType or status not in ["Approved", "Rejected"]:
        raise HTTPException(status_code=400, detail="Invalid docType or status")
    result = enquiries_collection.update_one(
        {
            "enquiry_id": enquiry_id,
            "kyc_docs.docType": docType
        },
        {
            "$set": {
                "kyc_docs.$.status": status
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}


@franchise_router.post("/enquiries/{enquiry_id}/notes")
def add_note_to_enquiry(
    enquiry_id: str,
    content: str = Body(..., embed=True),
    author: Optional[str] = Body(None),
    enquiries_collection=Depends(enquiries_collection)
):
    note = {
        "id": str(uuid4()),
        "content": content,
        "created_at": datetime.now().isoformat(),
        "author": author or "anonymous"
    }
    result = enquiries_collection.update_one(
        {"enquiry_id": enquiry_id},
        {"$push": {"notes": note}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return note

@franchise_router.get("/enquiries/{enquiry_id}/notes")
def get_notes_for_enquiry(
    enquiry_id: str,
    enquiries_collection=Depends(enquiries_collection)
):
    doc = enquiries_collection.find_one({"enquiry_id": enquiry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return doc.get("notes", [])