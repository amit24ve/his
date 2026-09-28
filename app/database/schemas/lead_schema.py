from typing import Optional, Annotated, List
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId
from pydantic import BeforeValidator

# Define enums
class LeadSource(str, Enum):
    website = "website"
    whatsapp = "whatsapp"
    facebook = "facebook"
    instagram = "instagram"
    email = "email"
    phone = "phone"
    referral = "referral"
    other = "other"

class LeadStatus(str, Enum):
    new = "new"
    cold = "cold"
    warm = "warm"
    hot = "hot" 
    converted = "converted"
    lost = "lost"

# Base model
class LeadBase(BaseModel):
    full_name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    source: LeadSource = LeadSource.website
    status: LeadStatus = LeadStatus.new
    requirements: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    
    class Config:
        use_enum_values = True

# Create and update models
class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    source: Optional[LeadSource] = None
    status: Optional[LeadStatus] = None
    requirements: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    next_followup_date: Optional[datetime] = None
    
    class Config:
        use_enum_values = True

# Response model
class LeadResponse(LeadBase):
    id: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    next_followup_date: Optional[datetime] = None

# Function to validate and convert to ObjectId
def validate_object_id(v) -> ObjectId:
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str) and ObjectId.is_valid(v):
        return ObjectId(v)
    raise ValueError("Invalid ObjectId")

# Type for annotating fields - Pydantic v2 compatible
PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

# User model
class User(BaseModel):
    id: str
    name: str
    email: str
    role: str
    active: bool = True
    
    class Config:
        from_attributes = True

# Lead assignment models
class LeadAssignmentModel(BaseModel):
    lead_id: str
    user_id: str
    user_name: str
    role: str
    notes: Optional[str] = None
    assigned_by: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_encoders = {ObjectId: str}

class LeadAssignmentInDB(LeadAssignmentModel):
    id: Optional[PyObjectId] = None
    
    class Config:
        from_attributes = True
        json_encoders = {ObjectId: str}
        
        
        
class Milestone(BaseModel):
    title: str
    amount: float
    paid: bool = False


class Quotation(BaseModel):
    lead_id: str
    client_name: str
    amount: float
    milestones: List[Milestone]
    pdf_url: Optional[str] = None
    quotation_number: Optional[str] = None
    status: Optional[str]=None
    paid_amount: float = 0
    created_at: datetime = Field(default_factory=datetime.now)
    expiry_date: Optional[datetime] = None

    @property
    def remaining_amount(self):
        return max(self.amount - self.paid_amount, 0)
    
class QuotationsSummary(BaseModel):
    quotations: List[Quotation]
    acceptance_rate: float
    
class UpdateMilestonePaid(BaseModel):
    paid: bool
    
