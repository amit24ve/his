from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import superadmin_required

hospitals_router = APIRouter(prefix="/api/hospitals", tags=["hospitals"])


class HospitalCreate(BaseModel):
    name: str
    code: str
    address: str
    city: str
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    total_beds: Optional[int] = None
    total_rooms: Optional[int] = None
    specialties: Optional[List[str]] = []
    registration_number: Optional[str] = None
    license_number: Optional[str] = None
    accreditation: Optional[str] = None   # NABH, JCI, etc.
    hospital_type: str = "Multi-Specialty"  # Multi-Specialty, Super-Specialty, General, Clinic
    ownership: str = "Private"  # Private, Govt, Trust
    established_year: Optional[int] = None
    contact_person: Optional[str] = None
    contact_designation: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    total_beds: Optional[int] = None
    total_rooms: Optional[int] = None
    specialties: Optional[List[str]] = None
    registration_number: Optional[str] = None
    license_number: Optional[str] = None
    accreditation: Optional[str] = None
    hospital_type: Optional[str] = None
    ownership: Optional[str] = None
    established_year: Optional[int] = None
    contact_person: Optional[str] = None
    contact_designation: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


def serialize(doc):
    result = {k: v for k, v in doc.items()}
    result["id"] = str(result.pop("_id"))
    for k, v in result.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


@hospitals_router.get("/")
async def list_hospitals(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    hospital_type: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
        ]
    if is_active is not None:
        query["is_active"] = is_active
    if hospital_type:
        query["hospital_type"] = hospital_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    skip = (page - 1) * limit
    cursor = db.hospitals.find(query).sort("name", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.hospitals.count_documents(query)
    return {"hospitals": [serialize(d) for d in docs], "total": total, "page": page}


@hospitals_router.post("/", status_code=201)
async def add_hospital(
    data: HospitalCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(superadmin_required),
):
    existing = await db.hospitals.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Hospital code already exists")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    result = await db.hospitals.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@hospitals_router.get("/stats")
async def hospital_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    total = await db.hospitals.count_documents({})
    active = await db.hospitals.count_documents({"is_active": True})
    agg = await db.hospitals.aggregate([
        {"$group": {"_id": None, "beds": {"$sum": "$total_beds"}, "rooms": {"$sum": "$total_rooms"}}}
    ]).to_list(1)
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "total_beds": agg[0]["beds"] if agg else 0,
        "total_rooms": agg[0]["rooms"] if agg else 0,
    }


@hospitals_router.get("/{hospital_id}")
async def get_hospital(hospital_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.hospitals.find_one({"_id": ObjectId(hospital_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return serialize(doc)


@hospitals_router.patch("/{hospital_id}")
async def update_hospital(
    hospital_id: str,
    data: HospitalUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(superadmin_required),
):
    # Use exclude_unset so that False and 0 are not skipped
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.hospitals.update_one({"_id": ObjectId(hospital_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hospital not found")
    updated = await db.hospitals.find_one({"_id": ObjectId(hospital_id)})
    return serialize(updated)


@hospitals_router.delete("/{hospital_id}")
async def delete_hospital(
    hospital_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(superadmin_required),
):
    result = await db.hospitals.delete_one({"_id": ObjectId(hospital_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return {"message": "Hospital deleted"}
