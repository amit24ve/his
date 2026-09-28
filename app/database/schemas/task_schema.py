# from pydantic import BaseModel, Field
# from typing import Optional, Literal
# from datetime import date, datetime


# class TaskStatusUpdate(BaseModel):
#     status: str= Field(..., description="New status of the task", example="completed")
#     approved_by: Optional[str] = None
#     remarks: Optional[str] = None

# class TaskModel(BaseModel):
#     title: str
#     assigned_to: str
#     due_date: date
#     status: str = Field(default="pending")
#     linked_type: Optional[str] = None  # e.g., "lead", "franchise"
#     linked_id: Optional[str] = None
#     created_by: Optional[str] = None
#     approved_by: Optional[str] = None
#     created_at: Optional[datetime] = None
#     approved_at: Optional[date] = None
#     remarks: Optional[str] = None



from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime

class TaskStatusUpdate(BaseModel):
    status: str = Field(..., description="New status of the task", example="completed")
    approved_by: Optional[str] = None
    remarks: Optional[str] = None

class TaskModel(BaseModel):
    id: Optional[str] = Field(None, description="Custom Task ID e.g. tsk-01")
    title: str
    assigned_to: str
    due_date: date
    status: str = Field(default="pending")
    linked_type: Optional[str] = None
    linked_id: Optional[str] = None
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: Optional[datetime] = None
    approved_at: Optional[date] = None
    remarks: Optional[str] = None