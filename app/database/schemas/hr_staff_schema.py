# from pydantic import BaseModel, Field
# from typing import Optional, List
# from datetime import datetime

# class EmployeeModel(BaseModel):
#     employee_id: Optional[str] = None
#     name: str
#     email: str
#     phone:str
#     position: str
#     salary: float = Field(..., gt=0, description="salary must be positive")  # Salary must be non-negative
#     location: Optional[str] = None
#     date_of_joining: str
#     file: Optional[str] = None  # File path or URL to the employee's document

# class AttendanceModel(BaseModel):
#     attendance_id: Optional[str] = None
#     employee_id: str
#     date: str  # YYYY-MM-DD
#     status: str  # present/absent/remote/leave
#     geo_lat: Optional[float] = None
#     geo_long: Optional[float] = None
#     location: Optional[str] = None
#     timestamp: datetime = Field(default_factory=datetime.now)

# class DailyReportModel(BaseModel):
#     report_id: Optional[str] = None
#     employee_id: str
#     date: Optional[str] = None  # YYYY-MM-DD
#     content: str
#     timestamp: Optional[datetime] = Field(default_factory=datetime.now)
# class DailyReportUpdateModel(BaseModel):
#     content: str

# class LeaveRequestModel(BaseModel):
#     # leave_id: Optional[str] = Field(default=None, description="Unique identifier for the leave request")
#     employee_id: str
#     start_date: str  # YYYY-MM-DD
#     end_date: str    # YYYY-MM-DD
#     reason: Optional[str] = None
#     status: Optional[str] = Field(default="pending")
#     timestamp: Optional[datetime] = Field(default_factory=datetime.now)
#     message: Optional[str] = None  # Additional message or notes regarding the leave request

#     class Config:
#         orm_mode = True
        
# class LeaveRequestUpdateModel(BaseModel):
#     employee_id: Optional[str] = None
#     start_date: Optional[str] = None
#     end_date: Optional[str] = None
#     reason: Optional[str] = None
#     status: Optional[str] = None
#     timestamp: Optional[datetime] = None
#     message: Optional[str] = None

#     class Config:
#         orm_mode = True




from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class GeneralInfoModel(BaseModel):
    joiningDate: str
    accessRole: str
    department: str
    shift: str
    flexibility: str
    manager: str
    employment: str

class ContactInfoModel(BaseModel):
    contractType: str
    period: str

class SalaryInfoModel(BaseModel):
    ctc: Optional[str] = ""
    variable: Optional[str] = ""
    bonus: Optional[str] = ""
    lastIncrement: Optional[str] = ""
    nextIncrement: Optional[str] = ""

class DailyReportModel(BaseModel):
    report_id: Optional[str] = None
    employee_id: str
    date: Optional[str] = None  # YYYY-MM-DD
    content: str
    status:str = Field(default="pending")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
class DailyReportUpdateModel(BaseModel):
    content: str

class DocumentModel(BaseModel):
    name: str
    uploaded: str
    url: str

class AssetModel(BaseModel):
    name: str
    type: str
    issued: str
    status: str

class LeaveRequestModel(BaseModel):
    # leave_id: Optional[str] = Field(default=None, description="Unique identifier for the leave request")
    employee_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    reason: Optional[str] = None
    status: Optional[str] = Field(default="pending")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
    message: Optional[str] = None  # Additional message or notes regarding the leave request

    class Config:
        orm_mode = True
        
        
class LeaveRequestUpdateModel(BaseModel):
    employee_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    timestamp: Optional[datetime] = None
    message: Optional[str] = None

    class Config:
        orm_mode = True


class AttendanceModel(BaseModel):
    attendance_id: Optional[str] = None
    employee_id: str
    date: str  # YYYY-MM-DD
    status: str  # present/absent/remote/leave
    geo_lat: Optional[float] = None
    geo_long: Optional[float] = None
    location: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    time: Optional[str] = None  # Optional field for time string
class EmployeeModel(BaseModel):
    employee_id: Optional[str] = None
    name: str
    email: str
    phone: str
    position: str
    salary: Optional[float] = None  # Optional, since salaryInfo is now nested
    location: Optional[str] = None
    date_of_joining: Optional[str] = None
    shift: Optional[str] = None  # New field for shift
    gender: Optional[str] = None  # New field
    # New fields matching your UI/JSON
    lastActive: Optional[str] = None
    initials: Optional[str] = None
    tabs: Optional[List[str]] = None

    generalInfo: Optional[GeneralInfoModel] = None
    contactInfo: Optional[ContactInfoModel] = None
    salaryInfo: Optional[SalaryInfoModel] = None
    documents: Optional[List[DocumentModel]] = []
    assets: Optional[List[AssetModel]] = []
    leaves: Optional[List[LeaveRequestModel]] = []
    attendance: Optional[List[AttendanceModel]] = []

    class Config:
        orm_mode = True


class LeaveRequestModel(BaseModel):
    # leave_id: Optional[str] = Field(default=None, description="Unique identifier for the leave request")
    employee_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    reason: Optional[str] = None
    status: Optional[str] = Field(default="pending")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
    message: Optional[str] = None  # Additional message or notes regarding the leave request

    class Config:
        orm_mode = True
        
