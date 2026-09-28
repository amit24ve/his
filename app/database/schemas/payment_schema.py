from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class PaymentMethodType(str, Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CREDIT_CARD = "credit_card"
    UPI = "upi"
    CHEQUE = "cheque"
    OTHER = "other"

class PaymentMilestoneCreate(BaseModel):
    name: str
    amount: float
    due_date: datetime
    description: Optional[str] = None


class PaymentMilestoneUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    status: Optional[PaymentStatus] = None

class PaymentTransactionCreate(BaseModel):
    milestone_id: str
    amount: float
    payment_method: PaymentMethodType
    transaction_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class PaymentMilestoneResponse(BaseModel):
    id: str
    name: str
    amount: float
    due_date: datetime
    description: Optional[str] = None
    status: PaymentStatus
    paid_amount: float = 0
    remaining_amount: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    quotation_id: str
    lead_id: str
    lead_name: Optional[str] = None

class PaymentTransactionResponse(BaseModel):
    id: str
    milestone_id: str
    amount: float
    payment_method: PaymentMethodType
    transaction_date: datetime
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime