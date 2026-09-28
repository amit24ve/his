# from pydantic import BaseModel, Field, HttpUrl, validator
# from typing import Dict, List, Optional, Any
# from datetime import datetime

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


# from pydantic import BaseModel, Field, HttpUrl, validator
# from typing import Dict, List, Optional, Any
# from datetime import datetime

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
    
# class LeadAssignmentUpdate(BaseModel):
#     lead_id: str
#     assigned_to: str
#     assigned_by: Optional[str] = None

# class LeadStatusUpdate(BaseModel):
#     lead_id: str
#     status: str

# class LeadSourceResponse(BaseModel):
#     id: str
#     name: str
#     source_type: str
#     total_leads: int
#     last_sync_time: Optional[datetime] = None
#     metadata: Dict[str, Any] = {}

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

# class Lead(BaseModel):
#     Lead_id: Optional[str] = None
#     full_name: Optional[str] = None
#     email: Optional[str] = None
#     phone: Optional[str] = None
#     source: Optional[str] = None
#     source_id: Optional[str] = None
#     campaign: Optional[str] = None
#     status: Optional[str] = "new"         # <-- for status
#     assigned_to: Optional[str] = None     # <-- for assignment
#     assigned_by: Optional[str] = None     # <-- who assigned
#     created_at: Optional[datetime] = None
#     updated_at: Optional[datetime] = None
#     notes: Optional[str] = None

#     class Config:
#         extra = "allow"



# def flatten_lead_data(lead: dict) -> dict:
#     result = {}
#     # Move _id to id
#     if "_id" in lead:
#         if isinstance(lead["_id"], dict) and "$oid" in lead["_id"]:
#             result["id"] = str(lead["_id"]["$oid"])
#         else:
#             result["id"] = str(lead["_id"])
#     # Copy all top-level fields except raw_data and _id
#     for key, value in lead.items():
#         if key not in ("raw_data", "_id"):
#             result[key] = value
#     # Ensure Lead_id is present if set
#     if "Lead_id" in lead:
#         result["Lead_id"] = lead["Lead_id"]
#     # Move fields from raw_data (flattened)
#     raw = lead.get("raw_data", {})
#     for k, v in raw.items():
#         py_key = k.strip().lower().replace(" ", "_")
#         if py_key not in result or not result[py_key]:
#             result[py_key] = v
#     return result


from pydantic import BaseModel, Field, HttpUrl, validator
from typing import Dict, List, Optional, Any
from datetime import datetime

# Request models
class GoogleSheetsRequest(BaseModel):
    spreadsheet_url: Optional[str] = None
    spreadsheet_id: Optional[str] = None
    sheet_name: Optional[str] = "Sheet1"
    header_row: int = 1
    mapping: Dict[str, str]
    
    @validator('mapping')
    def validate_mapping(cls, v):
        if not v:
            raise ValueError("Mapping is required")
        return v
    
    @validator('spreadsheet_id', always=True)
    def validate_spreadsheet_info(cls, v, values):
        if not v and not values.get('spreadsheet_url'):
            raise ValueError("Either spreadsheet_url or spreadsheet_id is required")
        return v

class MetaAdsRequest(BaseModel):
    access_token: str
    ad_account_id: str
    form_id: Optional[str] = None
    mapping: Dict[str, str]
    
    @validator('mapping')
    def validate_mapping(cls, v):
        if not v:
            raise ValueError("Mapping is required")
        return v
    
    @validator('ad_account_id')
    def validate_ad_account_id(cls, v):
        if not v.startswith('act_'):
            return f"act_{v}"
        return v

# Response models
class LeadResponse(BaseModel):
    status: str
    message: str
    integration_id: str
    
class LeadAssignmentUpdate(BaseModel):
    lead_id: str
    assigned_to: Optional[str] = None
    assigned_by: Optional[str] = None
    assignment_type: str  # "manager" or "executive"
    
    
    

# class LeadCreate(BaseModel):
#     name: Optional[str] = None
#     email: Optional[str] = None
#     phone: Optional[str] = None
#     source: Optional[str] = None
#     source_id: Optional[str] = None
#     campaign: Optional[str] = None
#     status: Optional[str] = "new"
#     assigned_by: Optional[str] = None
#     notes: Optional[List[str]] = None
#     form: Optional[str] = None
#     channel: Optional[str] = None
#     stage: Optional[str] = "Intake"
#     owner: Optional[str] = "Unassigned"
#     labels: Optional[str] = None
#     secondary_phone_number: Optional[str] = None
#     assigned_manager: Optional[str] = None
#     assigned_executive: Optional[str] = None

class LeadStatusUpdate(BaseModel):
    lead_id: str
    status: str

class LeadSourceResponse(BaseModel):
    id: str
    # name: str
    source_type: str
    total_leads: int
    last_sync_time: Optional[datetime] = None
    metadata: Dict[str, Any] = {}

class LeadSource(BaseModel):
    # name: str
    source_type: str  # "google_sheets" or "meta_ads"
    integration_id: str  # spreadsheet_id or ad_account_id
    mapping: Dict[str, str]
    last_sync_time: Optional[datetime] = None
    last_synced_row: Optional[int] = None  # For Google Sheets
    last_synced_lead_id: Optional[str] = None  # For Meta Ads
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class Lead(BaseModel):
    # id: Optional[str] = Field(None, description="MongoDB ObjectId string")
    lead_id: Optional[str] = Field(None, description="Custom formatted lead ID (e.g., lead001)")
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    source: Optional[str] = None
    source_id: Optional[str] = None
    location: Optional[str] = None
    district: Optional[str] = None
    campaign: Optional[str] = None
    status: Optional[str] = "new"
    assigned_to: Optional[str] = None
    assigned_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    notes: Optional[List[str]] = None
    raw_data: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"
        validate_by_name = True  # Replaces allow_population_by_field_name
        from_attributes = True   # Replaces orm_mode


def flatten_lead_data(lead: dict) -> dict:
    """
    Returns a dict with all top-level fields except '_id', 'raw_data', and 'full_name',
    and all fields from raw_data as snake_case.
    - If 'full_name' is present and 'name' is not, sets 'name' to 'full_name'
    """
    result = {}
    # Copy all top-level fields except raw_data, _id, and full_name
    for key, value in lead.items():
        if key not in ("raw_data", "_id", "full_name"):
            result[key] = value
    # Handle name logic
    if "name" not in result or not result["name"]:
        # Use full_name if present
        full_name_val = lead.get("full_name")
        if full_name_val:
            result["name"] = full_name_val
    # Ensure lead_id is present if set (accept both "lead_id" and "Lead_id")
    if "lead_id" in lead:
        result["lead_id"] = lead["lead_id"]
    if "Lead_id" in lead:
        result["lead_id"] = lead["Lead_id"]
    # Move fields from raw_data (flattened)
    raw = lead.get("raw_data", {})
    for k, v in raw.items():
        py_key = k.strip().lower().replace(" ", "_")
        # Don't overwrite name with full_name from raw_data
        if py_key == "full_name" and ("name" in result and result["name"]):
            continue
        if py_key == "full_name":
            py_key = "name"
        if py_key not in result or not result[py_key]:
            result[py_key] = v
    return result