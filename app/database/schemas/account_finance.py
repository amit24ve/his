from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime

class PaymentMilestoneModel(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    dealer_id: Optional[str] = Field(None, alias="dealer_id")
    dealer: Optional[str] = Field(None, alias="dealer")
    amount: float
    status: str
    dueDate: Optional[str] = Field(None, alias="dueDate")
    date: Optional[str] = Field(None, alias="date")
    type: Optional[str] = None
    invoice_link: Optional[str] = None

    class Config:
        orm_mode = True
        allow_population_by_field_name = True
        allow_population_by_alias = True
class ExpenseModel(BaseModel):
    dealer_id: str
    amount: float
    date: date
    description: Optional[str] = None

class InvoiceItemModel(BaseModel):
    description: str
    quantity: int
    price: float

class InvoiceModel(BaseModel):
    dealer_id: str
    date: date
    items: List[InvoiceItemModel]
    total: float