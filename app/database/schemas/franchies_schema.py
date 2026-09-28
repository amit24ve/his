from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime

class Enquiry(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    enquiry_id: Optional[str] = None
    title: str
    first_name: str
    middle_name: Optional[str] = ""
    last_name: str
    age: str
    email: str
    cell_number: str
    location: str
    total_cash: str
    num_stores: str
    type: str
    status: str
    date: str

class KycDocument(BaseModel):
    name: str
    url: str
    # docType: str
    docType: Optional[str] = None
    status:str="pending"
    rejected_reason: Optional[str] = None

    class Config:
            populate_by_name = True
            extra = "allow"


class Investment(BaseModel):
    amount: float
    date: str
    notes: Optional[str] = None
    
class CommissionLog(BaseModel):
    month: str  # format "2025-06"
    amount: float
    franchise_id: str


class Franchise(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    owner_name: str
    email: str
    phone: Optional[str]
    address: str
    region: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    # kyc_docs: List[KycDocument] = []
    kyc_docs: List[KycDocument] = Field(default_factory=list)
    investment_amount: float
    commission_logs: List[CommissionLog] = []
    status: str = "pending"
    expiry_date: Optional[date] = None
    created_at: Optional[date] = None
    approved_at: Optional[date] = None
    rejected_at: Optional[date] = None
    notes: Optional[str] = None
    
    
class ApproveFranchiseRequest(BaseModel):
    expiry_date: Optional[datetime] = None
    
    
class RejectFranchiseRequest(BaseModel):
    notes: Optional[str] = None