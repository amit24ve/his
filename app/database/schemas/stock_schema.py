from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

class ProductModel(BaseModel):
    product_id: Optional[str]= None
    name: str
    sku: Optional[str] = None
    warehouseQty: int = Field(0, alias="warehouse_qty")
    depotQty: Dict[str, int] = Field(default_factory=dict, alias="depot_qty")
    lowStockThreshold: int = Field(10, alias="low_stock_threshold")
    unit: str
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    low_stock: Optional[bool] = False

    class Config:
        validate_by_name = True  # Replaces allow_population_by_field_name
        from_attributes = True   # Replaces orm_mode

class StockModel(BaseModel):
    stock_id: Optional[str] = None
    product_name: Optional[str] = None
    product_id: str
    type: Optional[str] = None
    quantity: int
    location: str
    by: Optional[str] = None
    date: Optional[datetime] = None  # <-- ADD THIS
    

    class Config:
        validate_by_name = True  # Replaces allow_population_by_field_name
        from_attributes = True   # Replaces orm_mode

class StockLogModel(BaseModel):
    log_id: Optional[str] = None
    date: datetime = Field(default_factory=datetime.now)
    product_id: str
    product_name: str
    type: str  # "in" or "out"
    quantity: int
    before_quantity: Optional[int] = None
    after_quantity: Optional[int] = None
    location: str
    by: str  # User who made the change
    status: str = Field("in", description="Action performed")  # "in", "out", "update"
    remarks: Optional[str] = None

class RequisitionModel(BaseModel):
    requisition_id: Optional[str] = None
    product_id: str
    product_name: str
    qty: int
    from_location: str
    to_location: str
    status: str  # "Pending", "Dispatched", etc.
    date: datetime = Field(default_factory=datetime.now)