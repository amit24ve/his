from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TicketBase(BaseModel):
    title: str
    priority: str  # e.g., 'low', 'medium', 'high'
    category: str  # e.g., 'technical', 'billing', etc.
    user_id: str
    status: str = "open"
    resolution_log: Optional[List[str]] = []

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    resolution_log: Optional[List[str]] = None
    closed_at: Optional[str] = None
    feedback: Optional[str] = None
    
    


class TicketModel(TicketBase):
    id: str = Field(..., alias="id")
    ticket_number: str
    created_at: datetime
    closed_at: Optional[datetime]
    feedback: Optional[str] = None

    class Config:
        validate_by_name = True  # Replaces allow_population_by_field_name
        from_attributes = True   # Replaces orm_mode