from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
from fastapi import Depends
from app.database import roles_collection

# class UserBase(BaseModel):
#     """Base user model with common fields"""
#     username: str = Field(..., example="soheru")
#     email: EmailStr = Field(..., example="soheru@example.com")
#     full_name: str = Field(..., example="Soheru User")
#     phone: Optional[str] = Field(None, example="8686863210") 
#     department: Optional[str] = Field(None, example="Engineering")
#     is_active: bool = Field(True, example=True)


class UserBase(BaseModel):
    username: str = Field(..., example="amit")
    email: EmailStr = Field(..., example="amit@example.com")
    full_name: str = Field(..., example="Amit")
    phone: Optional[str] = Field(None, example="8686863210")
    department: Optional[str] = Field(None, example="Engineering")
    is_active: bool = Field(True, example=True)
    hospital_id: Optional[str] = Field(None, example="H-001", description="Assigned hospital ID")

# class UserCreate(UserBase):
#     """Model for creating a new user"""
#     password: str = Field(..., example="SecurePassword123!")
#     role_ids: List[str] = Field(default_factory=list, example=["6836f325c046334b0d57133d"])
    
#     class Config:
#         validate_assignment = True

class UserCreate(UserBase):
    password: str = Field(..., example="SecurePassword123!")
    role_ids: List[str] = Field(default_factory=list, example=["Ro-001"])

class UserResponse(BaseModel):
    id: str = Field(..., example="6836f325c046334b0d57133d")
    username: str = Field(..., example="johndoe")
    email: str = Field(..., example="john@example.com")
    full_name: Optional[str] = Field(None, example="John Doe")
    phone: Optional[str] = Field(None, example="8686863210")
    department: Optional[str] = Field(None, example="Engineering")
    roles: List[Dict[str, str]] = Field(default_factory=list, example=[{"id": "Ro-001", "name": "admin"}])
    is_active: bool = Field(True, example=True)
    created_at: datetime = Field(..., example="2025-05-29T09:35:57")
    updated_at: Optional[datetime] = Field(None, example="2025-05-29T09:35:57")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserInDB(UserBase):
    """Internal model for user with hashed password"""
    id: Optional[str] = Field(None, example="683817651b7f7a047e1b41d6")
    hashed_password: str = Field(..., example="$2b$12$58PKFqbj1wsINPN2mcP8SuU5ux20Wnso7pOGNolc63Z65OzqyeVEe")
    role_ids: List[str] = Field(default_factory=list, example=["6836f325c046334b0d57133d"])
    created_at: datetime = Field(default_factory=datetime.now, example="2025-05-29T09:31:24")
    last_login: Optional[datetime] = Field(None, example="2025-05-29T09:31:24")
    
    class Config:
        validate_assignment = True

class UserUpdate(BaseModel):
    """Model for updating a user (all fields optional)"""
    id: Optional[str] = Field(None, example="683817651b7f7a047e1b41d6")
    username: Optional[str] = Field(None, example="soheru_updated")
    email: Optional[EmailStr] = Field(None, example="soheru_updated@example.com")
    password: Optional[str] = Field(None, example="NewSecurePassword123!")
    full_name: Optional[str] = Field(None, example="Soheru Updated User")
    phone: Optional[str] = Field(None, example="8686863210")
    department: Optional[str] = Field(None, example="Management")
    is_active: Optional[bool] = Field(None, example=True)
    role_ids: Optional[List[str]] = Field(None, example=["6836f325c046334b0d57133d"])
    roles: Optional[Any] = Field(None, example="admin")  # Can be string or list
    reporting_user_id: Optional[str] = Field(None, example="683817651b7f7a047e1b41d6")
    hospital_id: Optional[str] = Field(None, example="H-001", description="Assigned hospital ID")
    
    class Config:
        validate_assignment = True
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# class UserResponse(UserBase):
#     id: str = Field(..., example="683817651b7f7a047e1b41d6")
#     roles: List[Dict[str, str]] = Field(default_factory=list, example=[{"id": "ro-001", "name": "Admin"}])
#     created_at: datetime = Field(..., example="2025-05-29T09:31:24")
#     updated_at: Optional[datetime] = Field(None, example="2025-05-29T09:31:24")
#     last_login: Optional[datetime] = Field(None, example="2025-05-29T09:31:24")

    
#     class Config:
#         validate_assignment = True
#         json_encoders = {
#             datetime: lambda v: v.isoformat()
#         }

class UserResponse(UserBase):
    id: str = Field(..., example="6836f325c046334b0d57133d")
    roles: List[Dict[str, str]] = Field(default_factory=list, example=[{"id": "Ro-001", "name": "admin"}])
    is_active: bool = Field(True, example=True)
    created_at: datetime = Field(..., example="2025-05-29T09:35:57")
    updated_at: Optional[datetime] = Field(None, example="2025-05-29T09:35:57")
    last_login: Optional[datetime] = Field(None, example="2025-05-29T09:35:57")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class PasswordReset(BaseModel):
    """Model for password reset request"""
    email: EmailStr = Field(..., example="soheru@example.com")

class PasswordChange(BaseModel):
    """Model for changing user password"""
    old_password: str = Field(..., example="OldPassword123!")
    new_password: str = Field(..., example="NewPassword123!")

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# def map_roles(role_ids, roles_collection):
#     """
#     Map a list of role_ids to a list of {id, name} dicts using the roles collection.
#     """
#     # Handle both single string and list input
#     if isinstance(role_ids, str):
#         role_ids = [role_ids]
#     elif not role_ids:
#         return []
#     result = []
#     for rid in role_ids:
#         # Try to find role by custom id (e.g., "Ro-001")
#         role = roles_collection.find_one({"id": rid})
#         if role:
#             result.append({"id": role["id"], "name": role["name"]})
#         else:
#             # fallback: just show the id
#             result.append({"id": rid, "name": rid})
#     return result

# def user_entity(user, roles_collection):
#     return {
#         "id": str(user.get("_id", "")),
#         "username": user.get("username", ""),
#         "email": user.get("email", ""),
#         "full_name": user.get("full_name", ""),
#         "phone": user.get("phone", ""),
#         "department": user.get("department", ""),
#         "is_active": user.get("is_active", True),
#         "roles": map_roles(user.get("role_ids", []), roles_collection),
#         "created_at": user.get("created_at"),
#         "updated_at": user.get("updated_at"),
#         "last_login": user.get("last_login", None),
#     }


def map_roles(role_ids, roles_collection):
    """
    Map a list of role_ids to a list of {id, name} dicts using the roles collection.
    """
    if isinstance(role_ids, str):
        role_ids = [role_ids]
    if not role_ids:
        return []
    result = []
    for rid in role_ids:
        role = roles_collection.find_one({"id": rid})
        if role:
            result.append({"id": role["id"], "name": role["name"]})
        else:
            result.append({"id": rid, "name": rid})
    return result

def user_entity(user, roles_collection):
    return {
        "id": str(user.get("_id", "")),
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "full_name": user.get("full_name", ""),
        "phone": user.get("phone", ""),
        "department": user.get("department", ""),
        "is_active": user.get("is_active", True),
        "roles": map_roles(user.get("role_ids", []), roles_collection),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "last_login": user.get("last_login", None),
    }

def user_list_entity(users) -> List[Dict[str, Any]]:
    """Convert a list of MongoDB user documents to UserResponse-compatible dictionaries"""
    return [user_entity(user) for user in users]

# Helper function to convert role_ids to role names (implement based on your role repository)
# def _get_roles_from_role_ids(role_ids: List[str]) -> List[str]:
#     """Convert role_ids to role names"""
#     # This is a placeholder - implement based on your role repository
#     # For now, just return a default admin role for testing
#     if role_ids:
#         return ["admin"]  # Replace with actual role lookup
#     return ["user"]


# def _get_roles_from_role_ids(role_ids: List[str]) -> List[Dict[str, str]]:
#     """
#     Convert role_ids like 'ro-001' to a dict with both id and name.
#     This assumes you have a roles collection with role_id and name fields.
#     """
#     from app.database import roles_collection
#     roles = []
#     for rid in role_ids:
#         role = roles_collection.find_one({"role_id": rid})
#         if role:
#             roles.append({"id": role["role_id"], "name": role["name"]})
#         else:
#             roles.append({"id": rid, "name": rid})  # fallback
#     return roles



def _get_roles_from_role_ids(role_ids: List[str]) -> List[Dict[str, str]]:
    roles = []
    seen = set()
    for rid in role_ids or []:
        if rid in seen:
            continue
        seen.add(rid)
        doc = (
            roles_collection.find_one({"id": rid})
            or roles_collection.find_one({"role_id": rid})
        )
        if doc:
            roles.append({
                "id": doc.get("id", doc.get("role_id", rid)),
                "name": doc.get("name", rid)
            })
        else:
            roles.append({"id": rid, "name": rid})
    return roles