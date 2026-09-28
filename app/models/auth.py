from typing import List, Optional,Dict, Any
from pydantic import BaseModel, EmailStr, validator, Field
from datetime import datetime
from app.utils.timezone_utils import get_ist_timestamp_for_db


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    roles: Optional[List[str]] = None
    reporting_user_id: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    roles: Optional[List[str]] = None
    reporting_user_id: Optional[str] = None
    
class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    roles: List[str]
    created_at: datetime
    reporting_user_id: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserList(BaseModel):
    users: List[UserResponse]
    total: int


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    roles: List[str] = []


class RefreshToken(BaseModel):
    refresh_token: str


class AccessToken(BaseModel):
    access_token: str


class UserInfo(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: str
    roles: List[str]
    reporting_user_id: Optional[str] = None
    
    def get(self, key: str, default=None):
        """
        Dictionary-like get method for backward compatibility with code
        that expects a dict-like interface.
        """
        if hasattr(self, key):
            return getattr(self, key)
        return default
    
    def __getitem__(self, key: str):
        """
        Enable dictionary-like access (user_info['key']) for backward compatibility.
        """
        if hasattr(self, key):
            return getattr(self, key)
        raise KeyError(key)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the UserInfo object to a dictionary for full backward compatibility.
        """
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "roles": self.roles,
            "reporting_user_id": self.reporting_user_id,
            # Add any additional fields that might be expected in the dict version
            "_id": self.id,  # For compatibility with MongoDB ObjectId references
            "name": self.full_name  # For compatibility with code that expects 'name' instead of 'full_name'
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UserInfo":
        """
        Create a UserInfo object from a dictionary.
        """
        # Handle roles which might be a string or list
        roles = data.get("roles", [])
        if isinstance(roles, str):
            roles = [roles]
        elif not roles:
            roles = [data.get("role", "user")] if data.get("role") else ["user"]
            
        return cls(
            id=str(data.get("_id", "")) if data.get("_id") else data.get("id", "") or data.get("user_id", ""),
            username=data.get("username", ""),
            email=data.get("email", ""),
            full_name=data.get("name", "") or data.get("full_name", ""),
            roles=roles,
            reporting_user_id=data.get("reporting_user_id", None)
        )
    
    
# User hierarchy model for reporting relationships
class UserHierarchy(BaseModel):
    id: str
    user_id: str
    reporting_user_id: Optional[str] = None
    level: int = 0  # 0 for top level, increases for each level down
    created_at: datetime = Field(default_factory=get_ist_timestamp_for_db)
    updated_at: datetime = Field(default_factory=get_ist_timestamp_for_db)


# Response models for hierarchy queries
class UserHierarchyResponse(BaseModel):
    user: UserResponse
    reporting_to: Optional[UserResponse] = None
    level: int


class TeamMembersResponse(BaseModel):
    seniors: List[UserHierarchyResponse] = []
    peers: List[UserHierarchyResponse] = []
    subordinates: List[UserHierarchyResponse] = []


# # Request models
# class GoogleSheetsRequest(BaseModel):
#     spreadsheet_url: Optional[str] = None
#     spreadsheet_id: Optional[str] = None
#     sheet_name: Optional[str] = "Sheet1"
#     header_row: int = 1
#     mapping: Dict[str, str]
    
#     @validator('mapping')
#     def validate_mapping(cls, v):
#         if not v:
#             raise ValueError("Mapping is required")
#         return v
    
#     @validator('spreadsheet_id', always=True)
#     def validate_spreadsheet_info(cls, v, values):
#         if not v and not values.get('spreadsheet_url'):
#             raise ValueError("Either spreadsheet_url or spreadsheet_id is required")
#         return v

# class MetaAdsRequest(BaseModel):
#     access_token: str
#     ad_account_id: str
#     form_id: Optional[str] = None
#     mapping: Dict[str, str]
    
#     @validator('mapping')
#     def validate_mapping(cls, v):
#         if not v:
#             raise ValueError("Mapping is required")
#         return v
    
#     @validator('ad_account_id')
#     def validate_ad_account_id(cls, v):
#         if not v.startswith('act_'):
#             return f"act_{v}"
#         return v

# # Response models
# class LeadResponse(BaseModel):
#     status: str
#     message: str
#     integration_id: str

# class LeadSourceResponse(BaseModel):
#     id: str
#     name: str
#     source_type: str
#     total_leads: int
#     last_sync_time: Optional[datetime] = None
#     metadata: Dict[str, Any] = {}

# # Database models
# class Lead(BaseModel):
#     full_name: Optional[str] = None
#     email: Optional[str] = None
#     phone: Optional[str] = None
#     source: str
#     source_id: str
#     campaign: Optional[str] = None
#     status: str = "new"
#     created_at: datetime = Field(default_factory=datetime.now)
#     updated_at: datetime = Field(default_factory=datetime.now)
#     raw_data: Dict[str, Any] = {}
#     notes: Optional[str] = None

# class LeadSource(BaseModel):
#     name: str
#     source_type: str  # "google_sheets" or "meta_ads"
#     integration_id: str  # spreadsheet_id or ad_account_id
#     mapping: Dict[str, str]
#     last_sync_time: Optional[datetime] = None
#     last_synced_row: Optional[int] = None  # For Google Sheets
#     last_synced_lead_id: Optional[str] = None  # For Meta Ads
#     metadata: Dict[str, Any] = {}
#     created_at: datetime = Field(default_factory=datetime.now)
#     updated_at: datetime = Field(default_factory=datetime.now)
