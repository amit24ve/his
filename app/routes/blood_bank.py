from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

blood_bank_router = APIRouter(prefix="/api/blood-bank", tags=["blood-bank"])

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

class BloodUnitCreate(BaseModel):
    blood_group: str
    component: str = "Whole Blood"  # Whole Blood, Plasma, Platelets, RBC
    donor_name: str
    donor_id: Optional[str] = None
    collection_date: str
    expiry_date: str
    units: int = 1
    bag_number: str
    cross_match_done: bool = False
    hiv_status: str = "Non-Reactive"
    hbsag_status: str = "Non-Reactive"
    hcv_status: str = "Non-Reactive"
    vdrl_status: str = "Non-Reactive"
    status: str = "Available"

class BloodIssueCreate(BaseModel):
    patient_id: str
    patient_name: str
    mrn: str
    blood_group: str
    component: str
    units_required: int
    doctor_name: str
    ward: Optional[str] = None
    cross_match_number: Optional[str] = None
    urgency: str = "Routine"
    indication: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@blood_bank_router.get("/inventory")
async def get_inventory(db: AsyncIOMotorDatabase = Depends(get_db)):
    pipeline = [
        {"$match": {"status": "Available"}},
        {"$group": {"_id": {"blood_group": "$blood_group", "component": "$component"}, "units": {"$sum": "$units"}}},
        {"$sort": {"_id.blood_group": 1}}
    ]
    agg = await db.blood_bank_inventory.aggregate(pipeline).to_list(length=100)
    inventory = {}
    for bg in BLOOD_GROUPS:
        inventory[bg] = {"Whole Blood": 0, "Plasma": 0, "Platelets": 0, "RBC": 0}
    for item in agg:
        bg = item["_id"]["blood_group"]
        comp = item["_id"]["component"]
        if bg in inventory:
            inventory[bg][comp] = item["units"]
    return inventory


@blood_bank_router.get("/units")
async def list_units(
    blood_group: Optional[str] = Query(None),
    component: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if blood_group:
        query["blood_group"] = blood_group
    if component:
        query["component"] = component
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    cursor = db.blood_bank_inventory.find(query).sort("expiry_date", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.blood_bank_inventory.count_documents(query)
    return {"units": [serialize(d) for d in docs], "total": total}


@blood_bank_router.post("/units", status_code=201)
async def add_blood_unit(
    data: BloodUnitCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    result = await db.blood_bank_inventory.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@blood_bank_router.post("/issue", status_code=201)
async def issue_blood(data: BloodIssueCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    available = await db.blood_bank_inventory.count_documents({"blood_group": data.blood_group, "component": data.component, "status": "Available"})
    if available < data.units_required:
        raise HTTPException(status_code=400, detail=f"Only {available} units available")
    
    doc = data.dict()
    doc["issue_date"] = date.today().isoformat()
    doc["created_at"] = datetime.utcnow()
    doc["status"] = "Issued"
    
    # Mark units as issued
    cursor = db.blood_bank_inventory.find({"blood_group": data.blood_group, "component": data.component, "status": "Available"}).limit(data.units_required)
    units = await cursor.to_list(length=data.units_required)
    unit_ids = [str(u["_id"]) for u in units]
    await db.blood_bank_inventory.update_many(
        {"_id": {"$in": [ObjectId(uid) for uid in unit_ids]}},
        {"$set": {"status": "Issued", "issued_to": data.patient_name, "issued_date": date.today().isoformat()}}
    )
    doc["issued_unit_ids"] = unit_ids
    
    result = await db.blood_issues.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@blood_bank_router.get("/stats")
async def blood_bank_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    total_available = await db.blood_bank_inventory.count_documents({"status": "Available"})
    today_issues = await db.blood_issues.count_documents({"issue_date": date.today().isoformat()})
    expiring_soon = await db.blood_bank_inventory.count_documents({"status": "Available", "expiry_date": {"$lte": date.today().isoformat()}})
    
    return {
        "total_available_units": total_available,
        "today_issues": today_issues,
        "expired_units": expiring_soon,
    }
