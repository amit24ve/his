from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.database.async_db import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.dependencies import get_hospital_filter, get_current_user

departments_router = APIRouter(prefix="/api/departments", tags=["departments"])

class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    type: str = "Clinical"  # Clinical, Diagnostic, Administrative, Support
    head_of_department: Optional[str] = None
    location: Optional[str] = None
    floor: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    beds_allocated: Optional[int] = 0
    opd_available: bool = True
    ipd_available: bool = False
    emergency_available: bool = False
    description: Optional[str] = None
    services: Optional[List[str]] = None
    status: str = "Active"

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    head_of_department: Optional[str] = None
    location: Optional[str] = None
    floor: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    beds_allocated: Optional[int] = None
    opd_available: Optional[bool] = None
    ipd_available: Optional[bool] = None
    emergency_available: Optional[bool] = None
    description: Optional[str] = None
    services: Optional[List[str]] = None
    status: Optional[str] = None

def serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

@departments_router.get("")
async def list_departments(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    hospital_filter: dict = Depends(get_hospital_filter)
):
    query = {**hospital_filter}
    if type:
        query["type"] = type
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.departments.find(query).sort("name", 1).to_list(200)
    total = await db.departments.count_documents(query)
    return {"departments": [serialize(d) for d in docs], "total": total}

@departments_router.get("/stats")
async def department_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    total = await db.departments.count_documents({})
    active = await db.departments.count_documents({"status": "Active"})
    clinical = await db.departments.count_documents({"type": "Clinical"})
    diagnostic = await db.departments.count_documents({"type": "Diagnostic"})
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "clinical": clinical,
        "diagnostic": diagnostic,
    }

@departments_router.get("/{dept_id}")
async def get_department(dept_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(dept_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.departments.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Department not found")
    return serialize(doc)

@departments_router.post("")
async def create_department(
    data: DepartmentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    existing = await db.departments.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Department name already exists")
    doc = data.dict()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    doc["hospital_id"] = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id", "")
    result = await db.departments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)

@departments_router.patch("/{dept_id}")
async def update_department(dept_id: str, data: DepartmentUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(dept_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    result = await db.departments.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    doc = await db.departments.find_one({"_id": oid})
    return serialize(doc)

@departments_router.delete("/{dept_id}")
async def delete_department(dept_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(dept_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.departments.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"message": "Department deleted"}
