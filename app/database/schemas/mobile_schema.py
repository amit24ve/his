from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class LeadEntry(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    source: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: Optional[datetime] = Field(default_factory=datetime.now)

class AttendanceCheckIn(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    checkin_time: Optional[datetime] = Field(default_factory=datetime.now)

class DailyReport(BaseModel):
    user_id: str
    report_date: datetime
    leads_added: int
    visits_made: int
    remarks: Optional[str] = ""

class NotificationRequest(BaseModel):
    user_ids: List[str]
    title: str
    message: str
    data: Optional[dict] = {}