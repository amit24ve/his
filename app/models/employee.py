from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime, date


class DocumentModel(BaseModel):
    name: str
    uploaded: str
    url: str


class EmployeeBase(BaseModel):
    name: str = Field(..., description="Employee full name")
    email: EmailStr = Field(..., description="Employee email address")
    phone: Optional[str] = Field(None, description="Employee phone number")
    position: Optional[str] = Field(None, description="Employee position/designation")
    salary: Optional[str] = Field("0", description="Employee salary")
    location: Optional[str] = Field(None, description="Employee work location")
    date_of_joining: Optional[str] = Field(None, description="Date of joining (YYYY-MM-DD)")
    shift: Optional[str] = Field("9am - 6pm", description="Work shift timings")
    gender: Optional[str] = Field(None, description="Employee gender")
    department: Optional[str] = Field(None, description="Employee department")
    is_active: Optional[bool] = Field(True, description="Employee active status")


class EmployeeCreate(EmployeeBase):
    password: str = Field(..., description="Password for user account")
    user_id: Optional[str] = Field(None, description="User ID (auto-generated if not provided)")
    emp_id: Optional[str] = Field(None, description="Employee ID (auto-generated if not provided)")
    username: Optional[str] = Field(None, description="Username (auto-generated if not provided)")
    role_ids: Optional[List[str]] = Field([], description="Role IDs for user")
    roles: Optional[List[str]] = Field([], description="Role names for user")
    reports_to: Optional[str] = Field(None, description="Manager user ID")
    
    # Additional employee fields
    employee_type: Optional[str] = Field("full_time", description="Employment type")
    address: Optional[str] = Field(None, description="Employee address")
    city: Optional[str] = Field(None, description="Employee city")
    state: Optional[str] = Field(None, description="Employee state")
    zip_code: Optional[str] = Field(None, description="Employee zip code")
    country: Optional[str] = Field("India", description="Employee country")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD)")
    emergency_contact_name: Optional[str] = Field(None, description="Emergency contact name")
    emergency_contact_phone: Optional[str] = Field(None, description="Emergency contact phone")
    bank_account_number: Optional[str] = Field(None, description="Bank account number")
    bank_name: Optional[str] = Field(None, description="Bank name")
    bank_ifsc: Optional[str] = Field(None, description="Bank IFSC code")


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Employee full name")
    email: Optional[EmailStr] = Field(None, description="Employee email address")
    phone: Optional[str] = Field(None, description="Employee phone number")
    position: Optional[str] = Field(None, description="Employee position/designation")
    salary: Optional[str] = Field(None, description="Employee salary")
    location: Optional[str] = Field(None, description="Employee work location")
    shift: Optional[str] = Field(None, description="Work shift timings")
    gender: Optional[str] = Field(None, description="Employee gender")
    department: Optional[str] = Field(None, description="Employee department")
    is_active: Optional[bool] = Field(None, description="Employee active status")
    
    # Employee type and additional details
    employee_type: Optional[str] = Field(None, description="Employment type (full_time, part_time, contract, etc)")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD)")
    dob: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD) alternative field")
    date_of_joining: Optional[str] = Field(None, description="Date of joining (YYYY-MM-DD)")
    doj: Optional[str] = Field(None, description="Date of joining (YYYY-MM-DD) alternative field")
    
    # Address fields
    address: Optional[str] = Field(None, description="Employee address")
    city: Optional[str] = Field(None, description="Employee city")
    state: Optional[str] = Field(None, description="Employee state")
    zip_code: Optional[str] = Field(None, description="Employee zip code")
    pincode: Optional[str] = Field(None, description="Employee pincode/zip code alternative field")
    country: Optional[str] = Field(None, description="Employee country")
    
    # Emergency contact details
    emergency_contact_name: Optional[str] = Field(None, description="Emergency contact name")
    emergency_contact_phone: Optional[str] = Field(None, description="Emergency contact phone")
    emergency_contact: Optional[Dict[str, Any]] = Field(None, description="Emergency contact as object")
    
    # Bank details
    bank_account_number: Optional[str] = Field(None, description="Bank account number")
    bank_name: Optional[str] = Field(None, description="Bank name")
    bank_ifsc: Optional[str] = Field(None, description="Bank IFSC code")
    bank_details: Optional[Dict[str, Any]] = Field(None, description="Bank details as object")
    
    # User fields that can be updated
    full_name: Optional[str] = Field(None, description="Full name (updates both collections)")
    username: Optional[str] = Field(None, description="Username")
    password: Optional[str] = Field(None, description="Password (will be hashed)")
    custom_password: Optional[bool] = Field(None, description="Flag indicating custom password")
    role: Optional[str] = Field(None, description="Primary role")
    role_ids: Optional[List[str]] = Field(None, description="Role IDs for user")
    roles: Optional[List[Any]] = Field(None, description="Role names for user")
    reports_to: Optional[str] = Field(None, description="Manager user ID")


class EmployeeResponse(EmployeeBase):
    emp_id: str = Field(..., description="Employee ID")
    employee_id: str = Field(..., description="Employee ID (alias)")
    user_id: Optional[str] = Field(None, description="Linked user ID")
    documents: List[DocumentModel] = Field([], description="Employee documents")
    created_at: datetime
    updated_at: datetime


class EmployeeCombined(BaseModel):
    """Combined response model with both user and employee data"""
    # Employee collection fields
    emp_id: Optional[str] = None
    employee_id: Optional[str] = None
    name: Optional[str] = None
    position: Optional[str] = None
    salary: Optional[str] = None
    location: Optional[str] = None
    shift: Optional[str] = None
    gender: Optional[str] = None
    date_of_joining: Optional[str] = None
    date_of_birth: Optional[str] = None
    employee_type: Optional[str] = None
    documents: List[DocumentModel] = []
    
    # Address fields
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    
    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    
    # Bank details
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    
    # User collection fields
    user_id: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    role_names: List[str] = []
    roles: List[str] = []
    reports_to: Optional[str] = None
    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    # Computed fields
    attendance_status: Optional[Dict[str, Any]] = None
    can_manage_attendance: bool = False


class EmployeeDocumentUpload(BaseModel):
    name: str = Field(..., description="Document name")
    url: str = Field(..., description="Document URL/path")


class SyncCollectionsResponse(BaseModel):
    success: bool
    message: str
    results: Dict[str, Any]


class EmployeeListResponse(BaseModel):
    success: bool
    data: List[EmployeeCombined]
    employees: List[EmployeeCombined]  # For compatibility
    page: int
    limit: int
    total: int
    pages: int
