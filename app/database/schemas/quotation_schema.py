from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum

class QuotationStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"

class QuotationItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    quantity: float = 1
    unit_price: float
    tax_percentage: Optional[float] = 0
    discount_percentage: Optional[float] = 0

class QuotationCreate(BaseModel):
    lead_id: str
    items: List[QuotationItemCreate]
    valid_until: Optional[datetime] = None  # Default to +30 days in API
    notes: Optional[str] = None
    terms: Optional[str] = None
    
class QuotationUpdate(BaseModel):
    items: Optional[List[QuotationItemCreate]] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    status: Optional[QuotationStatus] = None

class QuotationItemResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    quantity: float
    unit_price: float
    tax_percentage: float = 0
    discount_percentage: float = 0
    total: float

class QuotationResponse(BaseModel):
    id: str
    quotation_number: str
    lead_id: str
    lead_name: str
    items: List[QuotationItemResponse]
    subtotal: float
    tax_total: float
    discount_total: float
    total: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    valid_until: datetime
    status: QuotationStatus
    notes: Optional[str] = None
    terms: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None