from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PermissionBase(BaseModel):
    """Base permission schema"""
    code: str = Field(..., description="Permission code (e.g., 'users:read')")
    name: str = Field(..., description="Human-readable permission name")
    description: Optional[str] = Field(None, description="Permission description")
    resource: str = Field(..., description="Resource this permission applies to")

class PermissionCreate(PermissionBase):
    """Schema for creating a new permission"""
    pass

class PermissionUpdate(BaseModel):
    """Schema for updating a permission"""
    name: Optional[str] = None
    description: Optional[str] = None
    resource: Optional[str] = None

class PermissionResponse(PermissionBase):
    """Schema for permission response"""
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True   # Replaces orm_mode