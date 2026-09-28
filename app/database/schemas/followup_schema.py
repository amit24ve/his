from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class FollowUpType(str, Enum):
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    SITE_VISIT = "site_visit"
    SOCIAL = "social"
    OTHER = "other"

class FollowUpStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"

class FollowUpCreate(BaseModel):
    lead_id: str
    type: FollowUpType = FollowUpType.CALL
    status: FollowUpStatus = FollowUpStatus.PENDING
    scheduled_date: datetime
    remarks: Optional[str] = None
    assigned_to: str  # Make this required as per your document structure
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    sent: Optional[bool] = False  # Add sent field to creation schema



class FollowupCreate(BaseModel):
    lead_id: str
    assigned_to: str
    note: str
    reminder_time: Optional[datetime] = None

class Followup(FollowupCreate):
    id: str = Field(default_factory=str)
    created_at: datetime
    sent: bool = False
    
class FollowUpUpdate(BaseModel):
    type: Optional[FollowUpType] = None
    status: Optional[FollowUpStatus] = None
    scheduled_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    remarks: Optional[str] = None
    feedback: Optional[str] = None
    assigned_to: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    sent: Optional[bool] = None
    
class FollowUpResponse(BaseModel):
    id: str
    lead_id: str
    lead_name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    type: FollowUpType
    status: FollowUpStatus
    scheduled_date: datetime
    actual_date: Optional[datetime] = None
    remarks: Optional[str] = None
    feedback: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    
