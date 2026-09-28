from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.database import get_database
from app.dependencies import get_current_user
from app.permission_utils import MODULE_PERMISSIONS, clean_module_permissions
from app.services.auth_service import AuthService


super_admin_router = APIRouter(prefix="/api/super-admin", tags=["super-admin"])


class AdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    department: Optional[str] = "Administration"
    hospital_id: str
    admin_permissions: List[str] = []
    is_active: bool = True


class AdminUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    hospital_id: Optional[str] = None
    admin_permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class HospitalWithAdminCreate(BaseModel):
    hospital: Dict[str, Any]
    admin: Dict[str, Any]


def _roles_from_user(user: Dict[str, Any]) -> List[str]:
    roles = []
    for source in (user.get("roles"), user.get("token_data", {}).get("roles")):
        if isinstance(source, str):
            roles.append(source)
        elif isinstance(source, list):
            for item in source:
                if isinstance(item, str):
                    roles.append(item)
                elif isinstance(item, dict):
                    roles.append(item.get("name") or item.get("id") or "")
    return [r.lower() for r in roles if r]


async def superadmin_required(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    roles = _roles_from_user(current_user)
    if "superadmin" not in roles and "super_admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    data = dict(doc)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    for key, value in list(data.items()):
        if isinstance(value, ObjectId):
            data[key] = str(value)
        elif isinstance(value, datetime):
            data[key] = value.isoformat()
    data.pop("password", None)
    data.pop("hashed_password", None)
    return data


def _find_hospital(db, hospital_id: str) -> Optional[Dict[str, Any]]:
    if ObjectId.is_valid(hospital_id):
        hospital = db.hospitals.find_one({"_id": ObjectId(hospital_id)})
        if hospital:
            return hospital
    return db.hospitals.find_one({"$or": [{"id": hospital_id}, {"code": hospital_id}]})


def _admin_role_id(db) -> str:
    role = db.roles.find_one({"name": "admin"})
    if role:
        return role.get("id") or str(role["_id"])
    role_id = "Ro-001"
    db.roles.insert_one({
        "id": role_id,
        "name": "admin",
        "description": "Hospital administrator",
        "permissions": [],
        "report_to": None,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    })
    return role_id


def _clean_permissions(permissions: Optional[List[str]]) -> List[str]:
    return clean_module_permissions(permissions or [])


def _admin_query() -> Dict[str, Any]:
    return {
        "$or": [
            {"roles": "admin"},
            {"roles": {"$in": ["admin"]}},
            {"admin_permissions": {"$exists": True}},
        ],
        "is_system": {"$ne": True},
    }


def _admin_response(db, user: Dict[str, Any]) -> Dict[str, Any]:
    data = _serialize(user)
    hospital_id = data.get("hospital_id")
    if hospital_id and not data.get("hospital_name"):
        hospital = _find_hospital(db, hospital_id)
        if hospital:
            data["hospital_name"] = hospital.get("name", "")
    data["admin_permissions"] = data.get("admin_permissions", [])
    return data


@super_admin_router.get("/permissions")
async def get_available_permissions(_: Dict[str, Any] = Depends(superadmin_required)):
    return {"permissions": MODULE_PERMISSIONS}


@super_admin_router.get("/overview")
async def get_super_admin_overview(_: Dict[str, Any] = Depends(superadmin_required)):
    db = get_database()
    hospitals_total = db.hospitals.count_documents({})
    admins_total = db.users.count_documents(_admin_query())
    active_admins = db.users.count_documents({**_admin_query(), "is_active": True})
    return {
        "hospitals": hospitals_total,
        "admins": admins_total,
        "active_admins": active_admins,
        "inactive_admins": max(admins_total - active_admins, 0),
    }


@super_admin_router.get("/admins")
async def list_hospital_admins(_: Dict[str, Any] = Depends(superadmin_required)):
    db = get_database()
    admins = list(db.users.find(_admin_query()).sort("created_at", -1))
    return {"admins": [_admin_response(db, user) for user in admins]}


@super_admin_router.post("/admins", status_code=201)
async def create_hospital_admin(
    data: AdminCreate,
    current_user: Dict[str, Any] = Depends(superadmin_required),
):
    db = get_database()
    hospital = _find_hospital(db, data.hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already exists")

    auth_service = AuthService()
    now = datetime.now()
    admin_role_id = _admin_role_id(db)
    user_doc = {
        "username": data.username,
        "email": data.email,
        "password": auth_service.get_password_hash(data.password),
        "full_name": data.full_name,
        "phone": data.phone,
        "department": data.department,
        "role_ids": [admin_role_id],
        "roles": ["admin"],
        "hospital_id": str(hospital["_id"]),
        "hospital_name": hospital.get("name", ""),
        "admin_permissions": _clean_permissions(data.admin_permissions),
        "created_by_superadmin": current_user.get("id") or current_user.get("user_id"),
        "is_active": data.is_active,
        "created_at": now,
        "updated_at": now,
    }
    result = db.users.insert_one(user_doc)
    created = db.users.find_one({"_id": result.inserted_id})
    return {"admin": _admin_response(db, created)}


@super_admin_router.patch("/admins/{user_id}")
async def update_hospital_admin(
    user_id: str,
    data: AdminUpdate,
    _: Dict[str, Any] = Depends(superadmin_required),
):
    db = get_database()
    query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"$or": [{"id": user_id}, {"user_id": user_id}]}
    user = db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found")

    update: Dict[str, Any] = {}
    raw = data.dict(exclude_unset=True)
    if "hospital_id" in raw and raw["hospital_id"]:
        hospital = _find_hospital(db, raw["hospital_id"])
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        update["hospital_id"] = str(hospital["_id"])
        update["hospital_name"] = hospital.get("name", "")
    for field in ["username", "email", "full_name", "phone", "department", "is_active"]:
        if field in raw:
            update[field] = raw[field]
    if "admin_permissions" in raw:
        update["admin_permissions"] = _clean_permissions(raw["admin_permissions"])
    if raw.get("password"):
        update["password"] = AuthService().get_password_hash(raw["password"])
    update["updated_at"] = datetime.now()

    if "username" in update:
        existing = db.users.find_one({"username": update["username"], "_id": {"$ne": user["_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
    if "email" in update:
        existing = db.users.find_one({"email": update["email"], "_id": {"$ne": user["_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

    db.users.update_one({"_id": user["_id"]}, {"$set": update})
    updated = db.users.find_one({"_id": user["_id"]})
    return {"admin": _admin_response(db, updated)}


@super_admin_router.post("/hospitals-with-admin", status_code=201)
async def create_hospital_with_admin(
    payload: HospitalWithAdminCreate,
    current_user: Dict[str, Any] = Depends(superadmin_required),
):
    db = get_database()
    hospital_data = dict(payload.hospital or {})
    admin_data = dict(payload.admin or {})
    if not hospital_data.get("name") or not hospital_data.get("code") or not hospital_data.get("address") or not hospital_data.get("city"):
        raise HTTPException(status_code=400, detail="Hospital name, code, address and city are required")
    if not admin_data.get("username") or not admin_data.get("email") or not admin_data.get("password") or not admin_data.get("full_name"):
        raise HTTPException(status_code=400, detail="Admin username, email, password and full name are required")
    if db.hospitals.find_one({"code": hospital_data["code"]}):
        raise HTTPException(status_code=400, detail="Hospital code already exists")
    if db.users.find_one({"username": admin_data["username"]}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.users.find_one({"email": admin_data["email"]}):
        raise HTTPException(status_code=400, detail="Email already exists")

    now = datetime.now()
    hospital_data["created_at"] = now
    hospital_data["updated_at"] = now
    hospital_result = db.hospitals.insert_one(hospital_data)
    hospital_id = str(hospital_result.inserted_id)

    admin_payload = AdminCreate(
        username=admin_data.get("username", ""),
        email=admin_data.get("email", ""),
        password=admin_data.get("password", ""),
        full_name=admin_data.get("full_name", ""),
        phone=admin_data.get("phone"),
        department=admin_data.get("department") or "Administration",
        hospital_id=hospital_id,
        admin_permissions=admin_data.get("admin_permissions") or [],
        is_active=admin_data.get("is_active", True),
    )
    admin_result = await create_hospital_admin(admin_payload, current_user)
    hospital = db.hospitals.find_one({"_id": hospital_result.inserted_id})
    return {"hospital": _serialize(hospital), "admin": admin_result["admin"]}


@super_admin_router.delete("/admins/{user_id}")
async def deactivate_hospital_admin(
    user_id: str,
    _: Dict[str, Any] = Depends(superadmin_required),
):
    db = get_database()
    query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"$or": [{"id": user_id}, {"user_id": user_id}]}
    result = db.users.update_one(query, {"$set": {"is_active": False, "updated_at": datetime.now()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": "Admin deactivated"}
