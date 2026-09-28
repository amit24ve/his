from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class RoleBase(BaseModel):
    """Base role model with common fields"""
    name: str = Field(..., example="admin")
    description: Optional[str] = Field(None, example="Administrator with full access")
    report_to: Optional[str] = Field(None, example="sales_manager")  # New field for reporting hierarchy

class RoleCreate(RoleBase):
    """Model for creating a new role"""
    permissions: List[str] = Field(default_factory=list, example=["users:read", "users:write"])

    class Config:
        validate_assignment = True

class RoleUpdate(BaseModel):
    """Model for updating a role (all fields optional)"""
    name: Optional[str] = Field(None, example="super_admin")
    description: Optional[str] = Field(None, example="Super administrator with advanced privileges")
    report_to: Optional[str] = Field(None, example="sales_manager")  # Added report_to field
    permissions: Optional[List[str]] = Field(None, example=["users:read", "users:write"])

    class Config:
        validate_assignment = True

class RoleInDB(RoleBase):
    """Internal role model for database operations"""
    id: str = Field(..., example="Ro-001")  # Updated example
    permissions: List[str] = Field(default_factory=list, example=["users:read", "users:write"])
    created_at: datetime = Field(default_factory=datetime.now, example="2025-05-29T09:35:57")
    updated_at: Optional[datetime] = Field(None, example="2025-05-29T09:35:57")
    created_by: Optional[str] = Field(None, example="soheru")

    class Config:
        validate_assignment = True

class RoleResponse(RoleBase):
    """Response model for returning role data"""
    id: str = Field(..., example="Ro-001")  # Updated example
    permissions: List[str] = Field(default_factory=list, example=["users:read", "users:write"])
    created_at: datetime = Field(..., example="2025-05-29T09:35:57")
    updated_at: Optional[datetime] = Field(None, example="2025-05-29T09:35:57")

    class Config:
        validate_assignment = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        };

class Role(str, Enum):
    SALES_EXECUTIVE = "sales_executive"
    SALES_MANAGER = "sales_manager"
    ACCOUNT_MANAGER = "account_manager"
    SUPPORT_AGENT = "support_agent"
    ADMIN = "admin"

# User model
class User(BaseModel):
    id: str
    username: str
    name: str
    email: str
    role: Role
    active: bool = True

# Helper functions for MongoDB document conversion
# def role_entity(role) -> Dict[str, Any]:
#     """Convert a MongoDB role document to a RoleResponse-compatible dictionary"""
#     return {
#         "id": str(role["_id"]),
#         "name": role["name"],
#         "description": role.get("description"),
#         "permissions": role.get("permissions", []),
#         "created_at": role.get("created_at", datetime.now()),
#         "updated_at": role.get("updated_at")
#     }

def role_entity(role) -> Dict[str, Any]:
    """Convert a MongoDB role document to a RoleResponse-compatible dictionary"""
    return {
        "id": role.get("id", str(role.get("_id", ""))),
        "name": role["name"],
        "description": role.get("description"),
        "report_to": role.get("report_to"),
        "permissions": role.get("permissions", []),
        "created_at": role.get("created_at", datetime.now()),
        "updated_at": role.get("updated_at")
    }

def role_list_entity(roles) -> List[Dict[str, Any]]:
    """Convert a list of MongoDB role documents to RoleResponse-compatible dictionaries"""
    return [role_entity(role) for role in roles]

users = [
    User(id="1", username="alex_sales", name="Alex Johnson", email="alex@bharat.com", role=Role.SALES_EXECUTIVE),
    User(id="2", username="priya_sales", name="Priya Sharma", email="priya@bharat.com", role=Role.SALES_EXECUTIVE),
    User(id="3", username="raj_manager", name="Raj Patel", email="raj@bharat.com", role=Role.SALES_MANAGER),
    User(id="4", username="sarah_account", name="Sarah Khan", email="sarah@bharat.com", role=Role.ACCOUNT_MANAGER),
    User(id="5", username="vikram_support", name="Vikram Singh", email="vikram@bharat.com", role=Role.SUPPORT_AGENT),
    User(id="6", username="neha_sales", name="Neha Gupta", email="neha@bharat.com", role=Role.SALES_EXECUTIVE),
    User(id="7", username="soheru", name="Soher Admin", email="soheru@bharat.com", role=Role.ADMIN),
]