"""
Meta (Facebook) Leads Integration
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import requests
import asyncio
from datetime import datetime, timedelta
from app.database import get_database
from app.dependencies import get_current_user

# Create router
meta_leads_router = APIRouter(prefix="/api/meta-leads", tags=["meta-leads"])

# Pydantic models
class MetaAccessToken(BaseModel):
    access_token: str

class MetaForm(BaseModel):
    form_id: str
    form_name: Optional[str] = None
    is_enabled: bool = True

class MetaFormUpdate(BaseModel):
    form_name: Optional[str] = None
    is_enabled: Optional[bool] = None

class ManualImportRequest(BaseModel):
    form_id: str

class MetaLeadData(BaseModel):
    full_name: str
    phone_number: str
    city: str
    email: str
    form_id: str
    meta_lead_id: str

def generate_lead_id(db) -> str:
    """Generate next lead ID in format LEAD001, LEAD002, etc."""
    try:
        # Get the highest lead ID number
        leads = list(db.leads.find(
            {"lead_id": {"$regex": "^lead\\d+$"}}, 
            {"lead_id": 1}
        ).sort("lead_id", -1).limit(1))
        
        if leads:
            last_id = leads[0]["lead_id"]
            # Extract number from LEAD001 format
            number = int(last_id.replace("lead", ""))
            next_number = number + 1
        else:
            next_number = 1
        
        return f"lead{next_number:03d}"
    except Exception as e:
        # Fallback to timestamp-based ID
        return f"lead{int(datetime.now().timestamp())}"

def get_common_access_token():
    """Get a working access token with failover support"""
    try:
        from app.routes.meta_tokens import get_working_access_token
        db = get_database()
        
        # Try to get a working token from the new token management system
        working_token = get_working_access_token(db)
        if working_token:
            return working_token
        
        # Fallback to old system if new system has no tokens
        meta_settings = db.meta_settings.find_one()
        if meta_settings and 'common_access_token' in meta_settings:
            return meta_settings['common_access_token']
        else:
            return None
    except Exception as e:
        return None

def fetch_leads_from_meta_form(form_id: str, access_token: str, since_timestamp: Optional[int] = None) -> List[Dict]:
    """Fetch leads from Meta form using Graph API"""
    try:
        url = f"https://graph.facebook.com/v23.0/{form_id}/leads"
        params = {
            "access_token": access_token,
            "limit": 100  # Max allowed by Meta
        }
        
        # Add since parameter for incremental fetching
        if since_timestamp:
            params["since"] = since_timestamp
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        leads = data.get("data", [])
        
        # Process Meta lead format
        processed_leads = []
        for lead in leads:
            # Meta leads come with field_data array, convert to flat dict
            processed_lead = {
                'id': lead.get('id'),
                'created_time': lead.get('created_time')
            }
            
            # Extract field data
            if 'field_data' in lead:
                for field in lead['field_data']:
                    field_name = field.get('name', '')
                    field_values = field.get('values', [])
                    if field_values:
                        processed_lead[field_name] = field_values[0]  # Take first value
            
            processed_leads.append(processed_lead)
        
        return processed_leads
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch leads from Meta: {str(e)}")

def process_meta_lead(lead_data: Dict, form_id: str, db) -> Dict:
    """Process Meta lead data with case-insensitive field mapping"""
    
    processed_lead = {
        "source": "meta_ads",
        "form_id": form_id,
        "created_at": datetime.now(),
        "raw_data": lead_data
    }
    
    # Create a case-insensitive lookup dictionary
    case_insensitive_data = {}
    for key, value in lead_data.items():
        if key and value:  # Only process non-empty keys and values
            case_insensitive_data[key.lower()] = {"original_key": key, "value": value}
    
    
    # Simple field mappings - check each possibility
    field_mappings = {
        'full_name': ['full_name', 'name', 'fullname', 'customer_name', 'client_name', 'first_name', 'last_name'],
        'email': ['email', 'email_address', 'emailaddress'],
        'phone_number': ['phone_number', 'phone', 'phonenumber', 'mobile', 'contact_number'],
        'notes': ['message', 'notes', 'comment', 'comments', 'description']
    }
    
    # Map standard fields
    for target_field, possible_keys in field_mappings.items():
        for key in possible_keys:
            if key.lower() in case_insensitive_data:
                processed_lead[target_field] = case_insensitive_data[key.lower()]["value"]
                break
    
    # Handle location fields - combine multiple location-related fields
    location_keys = ['city', 'state', 'district', 'location', 'address', 'area', 'region', 'locality']
    location_parts = []
    
    for key in location_keys:
        if key.lower() in case_insensitive_data:
            value = str(case_insensitive_data[key.lower()]["value"]).strip()
            if value and value not in location_parts:
                location_parts.append(value)
    
    # Set combined location
    if location_parts:
        processed_lead['location'] = ', '.join(location_parts)
    
    # Handle product fields
    product_keys = ['product', 'service', 'category', 'product_type', 'service_type']
    for key in product_keys:
        if key.lower() in case_insensitive_data:
            processed_lead['product'] = case_insensitive_data[key.lower()]["value"]
            break
    
    # Handle campaign fields
    campaign_keys = ['campaign', 'campaign_name', 'utm_campaign', 'source_campaign']
    for key in campaign_keys:
        if key.lower() in case_insensitive_data:
            processed_lead['campaign'] = case_insensitive_data[key.lower()]["value"]
            break
    
    # Generate lead ID
    processed_lead['lead_id'] = generate_lead_id(db)
    
    return processed_lead

def check_duplicate_lead(db, email: str, phone: str) -> bool:
    """Check if lead already exists based on email or phone"""
    if not email and not phone:
        return False
    
    query = {"$or": []}
    if email:
        query["$or"].append({"email": email})
    if phone:
        query["$or"].append({"phone": phone})
        query["$or"].append({"alternate_phone": phone})
    
    existing_lead = db.leads.find_one(query)
    return existing_lead is not None

def import_meta_lead(db, processed_lead: Dict, current_user_id: str) -> Dict:
    """Import processed lead into database (ignore duplicates)"""
    try:
        email = processed_lead.get("email", "")
        phone = processed_lead.get("phone_number", "")
        
        # Check for duplicates
        is_duplicate = check_duplicate_lead(db, email, phone)
        
        if is_duplicate:
            # Skip duplicate completely
            return {"status": "skipped", "reason": "duplicate", "lead_id": None}
        
        # Prepare lead document for new leads only
        lead_doc = {
            "lead_id": generate_lead_id(db),
            "name": processed_lead.get("full_name", ""),
            "phone": processed_lead.get("phone_number", ""),  # Fixed: use phone_number field
            "email": processed_lead.get("email", ""),
            "location": processed_lead.get("location", ""),  # Location field (combines city, state, district etc.)
            "source": processed_lead.get("source", "meta_ads"),
            "status": "new",
            "meta_form_id": processed_lead.get("form_id", ""),
            "meta_lead_id": processed_lead.get("meta_lead_id", ""),
            "meta_created_time": processed_lead.get("created_time", ""),
            "assigned_to": current_user_id,
            "created_by": current_user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "is_active": True,
            "notes": processed_lead.get("notes", ""),
            "product": processed_lead.get("product", ""),
            "campaign": processed_lead.get("campaign", ""),
            "raw_data": processed_lead.get("raw_data", {})
        }
        
        # Insert into regular leads collection
        db.leads.insert_one(lead_doc)
        return {"status": "imported", "lead_id": lead_doc["lead_id"]}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import lead: {str(e)}")

@meta_leads_router.post("/access-token")
async def update_access_token(
    token_data: MetaAccessToken,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update the common access token for all Meta forms"""
    try:
        db = get_database()
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        
        # Test the access token by trying to fetch from a test endpoint
        try:
            test_url = "https://graph.facebook.com/v23.0/me"
            test_response = requests.get(test_url, params={"access_token": token_data.access_token})
            test_response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid access token: {str(e)}")
        
        # Update or insert the common access token
        db.meta_settings.update_one(
            {"setting_name": "common_access_token"},
            {
                "$set": {
                    "setting_name": "common_access_token",
                    "access_token": token_data.access_token,
                    "updated_by": user_id,
                    "updated_at": datetime.now(),
                    "created_at": datetime.now()
                }
            },
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Access token updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update access token: {str(e)}")

@meta_leads_router.get("/access-token")
async def get_access_token_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get access token status (masked for security)"""
    try:
        db = get_database()
        token = get_common_access_token()
        
        return {
            "success": True,
            "has_token": bool(token),
            "token_preview": f"{token[:20]}..." if token else None,
            "last_updated": None  # You can add timestamp tracking if needed
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get access token status: {str(e)}")

@meta_leads_router.post("/forms")
async def add_meta_form(
    form: MetaForm,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Add a new Meta form for lead import"""
    try:
        db = get_database()
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        
        # Get common access token
        access_token = get_common_access_token()
        if not access_token:
            raise HTTPException(status_code=400, detail="Common access token not set. Please update access token first.")
        
        # Validate the form by testing API call
        try:
            test_leads = fetch_leads_from_meta_form(form.form_id, access_token)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid form ID: {str(e)}")
        
        # Check if form already exists
        existing_form = db.meta_forms.find_one({"form_id": form.form_id})
        if existing_form:
            raise HTTPException(status_code=400, detail="Form already exists")
        
        # Insert form (without access token - using common one)
        form_doc = {
            "form_id": form.form_id,
            "form_name": form.form_name or f"Form {form.form_id}",
            "is_enabled": form.is_enabled,
            "created_by": user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "last_fetch_time": None,
            "total_imported": 0,
            "total_skipped": 0
        }
        
        result = db.meta_forms.insert_one(form_doc)
        
        return {
            "success": True,
            "message": "Meta form added successfully",
            "form_id": form.form_id,
            "id": str(result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add form: {str(e)}")

@meta_leads_router.get("/forms")
async def get_meta_forms(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get all Meta forms for management"""
    try:
        db = get_database()
        
        forms = list(db.meta_forms.find({}, {"_id": 0}).sort("created_at", -1))
        
        return {
            "success": True,
            "forms": forms
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get forms: {str(e)}")

@meta_leads_router.put("/forms/{form_id}")
async def update_meta_form(
    form_id: str,
    form_update: MetaFormUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update Meta form"""
    try:
        db = get_database()
        
        update_data = {"updated_at": datetime.now()}
        
        if form_update.form_name is not None:
            update_data["form_name"] = form_update.form_name
        
        if form_update.is_enabled is not None:
            update_data["is_enabled"] = form_update.is_enabled
        
        result = db.meta_forms.update_one(
            {"form_id": form_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Form not found")
        
        status_msg = ""
        if form_update.is_enabled is not None:
            status_msg = f" and {'enabled' if form_update.is_enabled else 'disabled'}"
        
        return {
            "success": True,
            "message": f"Form updated{status_msg} successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update form: {str(e)}")

@meta_leads_router.delete("/forms/{form_id}")
async def delete_meta_form(
    form_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete Meta form"""
    try:
        db = get_database()
        
        result = db.meta_forms.delete_one({"form_id": form_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Form not found")
        
        return {
            "success": True,
            "message": "Form deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete form: {str(e)}")

@meta_leads_router.post("/import/{form_id}")
async def manual_import_from_form(
    form_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Manually import leads from specific Meta form"""
    try:
        db = get_database()
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        
        # Get form details
        form = db.meta_forms.find_one({"form_id": form_id})
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        # Get common access token
        access_token = get_common_access_token()
        if not access_token:
            raise HTTPException(status_code=400, detail="Common access token not set")
        
        # Fetch leads from Meta
        leads_data = fetch_leads_from_meta_form(form["form_id"], access_token)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for lead_data in leads_data:
            try:
                # Process lead
                processed_lead = process_meta_lead(lead_data, form_id, db)
                if processed_lead:
                    # Import lead
                    result = import_meta_lead(db, processed_lead, user_id)
                    if result["status"] == "imported":
                        imported_count += 1
                    elif result["status"] == "skipped":
                        skipped_count += 1
                        
            except Exception as e:
                error_msg = f"Error processing lead {lead_data.get('id', 'unknown')}: {str(e)}"
                errors.append(error_msg)
        
        # Update form statistics
        db.meta_forms.update_one(
            {"form_id": form_id},
            {
                "$set": {"last_fetch_time": datetime.now()},
                "$inc": {
                    "total_imported": imported_count,
                    "total_skipped": skipped_count
                }
            }
        )
        
        return {
            "success": True,
            "message": "Import completed",
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "total_processed": len(leads_data),
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import: {str(e)}")

async def scheduled_meta_import():
    """Scheduled task to import leads from all enabled Meta forms"""
    try:
        db = get_database()
        
        # Get all enabled forms
        enabled_forms = list(db.meta_forms.find({"is_enabled": True}))
        
        for form in enabled_forms:
            try:
                # Calculate since timestamp (last fetch time or 3 hours ago)
                since_timestamp = None
                if form.get("last_fetch_time"):
                    since_timestamp = int(form["last_fetch_time"].timestamp())
                else:
                    # First fetch - get leads from last 3 hours
                    since_timestamp = int((datetime.now() - timedelta(hours=3)).timestamp())
                
                # Get common access token
                access_token = get_common_access_token()
                if not access_token:
                    continue
                
                # Fetch leads
                leads_data = fetch_leads_from_meta_form(
                    form["form_id"], 
                    access_token, 
                    since_timestamp
                )
                
                imported_count = 0
                skipped_count = 0
                
                for lead_data in leads_data:
                    try:
                        processed_lead = process_meta_lead(lead_data, form["form_id"], db)
                        if processed_lead:
                            # Use form creator as assigned user for scheduled imports
                            result = import_meta_lead(db, processed_lead, form["created_by"])
                            if result["status"] == "imported":
                                imported_count += 1
                            elif result["status"] == "skipped":
                                skipped_count += 1
                                
                    except Exception as e:
                        pass
                
                # Update form statistics
                db.meta_forms.update_one(
                    {"form_id": form["form_id"]},
                    {
                        "$set": {"last_fetch_time": datetime.now()},
                        "$inc": {
                            "total_imported": imported_count,
                            "total_skipped": skipped_count
                        }
                    }
                )
                
            except Exception as e:
                pass
        
    except Exception as e:
        pass

@meta_leads_router.post("/start-scheduler")
async def start_meta_scheduler(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Start the Meta leads import scheduler (every 3 hours)"""
    try:
        from app.services.meta_scheduler import start_meta_scheduler
        await start_meta_scheduler()
        return {"success": True, "message": "Meta leads scheduler started - will import every 3 hours"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start scheduler: {str(e)}")

@meta_leads_router.post("/stop-scheduler")
async def stop_meta_scheduler_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Stop the Meta leads import scheduler"""
    try:
        from app.services.meta_scheduler import stop_meta_scheduler
        await stop_meta_scheduler()
        return {"success": True, "message": "Meta leads scheduler stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop scheduler: {str(e)}")

@meta_leads_router.get("/scheduler-status")
async def get_scheduler_status(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Meta leads import scheduler status"""
    try:
        from app.services.meta_scheduler import get_scheduler_status
        status = await get_scheduler_status()
        return {"success": True, "status": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler status: {str(e)}")

@meta_leads_router.post("/stop-scheduler")
async def stop_meta_scheduler_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Stop the Meta leads import scheduler"""
    try:
        from app.services.meta_scheduler import stop_meta_scheduler
        await stop_meta_scheduler()
        return {"success": True, "message": "Meta leads scheduler stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop scheduler: {str(e)}")

@meta_leads_router.get("/scheduler-status")
async def get_scheduler_status_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get the status of the Meta leads scheduler"""
    try:
        from app.services.meta_scheduler import get_scheduler_status
        status = get_scheduler_status()
        return {"success": True, "scheduler": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler status: {str(e)}")

@meta_leads_router.get("/duplicates")
async def get_meta_duplicate_leads(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(50, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get duplicate leads from Meta import"""
    try:
        db = get_database()
        
        # Get duplicate leads from Meta import
        query = {"original_source": "Meta Import"}
        
        duplicates = list(db.duplicate_leads.find(query).skip(skip).limit(limit).sort("created_at", -1))
        total = db.duplicate_leads.count_documents(query)
        
        # Process duplicates for JSON serialization
        for duplicate in duplicates:
            if "_id" in duplicate:
                duplicate["_id"] = str(duplicate["_id"])
            if "created_at" in duplicate and hasattr(duplicate["created_at"], "isoformat"):
                duplicate["created_at"] = duplicate["created_at"].isoformat()
            if "updated_at" in duplicate and hasattr(duplicate["updated_at"], "isoformat"):
                duplicate["updated_at"] = duplicate["updated_at"].isoformat()
        
        return {
            "success": True,
            "duplicates": duplicates,
            "total": total,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get duplicates: {str(e)}")

@meta_leads_router.post("/duplicates/{duplicate_id}/approve")
async def approve_meta_duplicate_lead(
    duplicate_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Approve a Meta duplicate lead and move it to main leads collection"""
    try:
        db = get_database()
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        
        # Find the duplicate lead
        duplicate = db.duplicate_leads.find_one({"lead_id": duplicate_id})
        if not duplicate:
            raise HTTPException(status_code=404, detail="Duplicate lead not found")
        
        # Create new lead document
        lead_doc = duplicate.copy()
        lead_doc.pop("_id", None)  # Remove the _id field
        lead_doc.pop("duplicate_reason", None)  # Remove duplicate-specific fields
        lead_doc["approved_by"] = user_id
        lead_doc["approved_at"] = datetime.now()
        lead_doc["updated_at"] = datetime.now()
        
        # Insert into main leads collection
        result = db.leads.insert_one(lead_doc)
        
        # Remove from duplicates collection
        db.duplicate_leads.delete_one({"lead_id": duplicate_id})
        
        return {
            "success": True,
            "message": "Duplicate lead approved and moved to main leads",
            "lead_id": duplicate_id,
            "new_id": str(result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve duplicate: {str(e)}")

@meta_leads_router.delete("/duplicates/{duplicate_id}")
async def delete_meta_duplicate_lead(
    duplicate_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a Meta duplicate lead permanently"""
    try:
        db = get_database()
        
        result = db.duplicate_leads.delete_one({"lead_id": duplicate_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Duplicate lead not found")
        
        return {
            "success": True,
            "message": "Duplicate lead deleted permanently"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete duplicate: {str(e)}")
@meta_leads_router.get("/statistics")
async def get_meta_import_stats(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get Meta import statistics"""
    try:
        db = get_database()
        
        # Get form statistics
        forms = list(db.meta_forms.find({}, {"_id": 0}))
        total_forms = len(forms)
        enabled_forms = len([f for f in forms if f.get("is_enabled", True)])
        
        # Get import statistics
        total_imported = sum([f.get("total_imported", 0) for f in forms])
        total_skipped = sum([f.get("total_skipped", 0) for f in forms])
        
        # Get recent imports (last 24 hours)
        yesterday = datetime.now() - timedelta(hours=24)
        recent_leads = db.leads.count_documents({
            "source": "Meta (Facebook)",
            "created_at": {"$gte": yesterday}
        })
        
        return {
            "success": True,
            "stats": {
                "total_forms": total_forms,
                "enabled_forms": enabled_forms,
                "total_imported": total_imported,
                "total_skipped": total_skipped,
                "recent_imports_24h": recent_leads,
                "forms": forms
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

class ManualImportRequest(BaseModel):
    form_id: str

@meta_leads_router.post("/import-manual")
async def manual_meta_import(
    request: ManualImportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Manual import from Meta using form ID (uses common access token)"""
    try:
        db = get_database()
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        
        # Get common access token
        access_token = get_common_access_token()
        if not access_token:
            raise HTTPException(status_code=400, detail="Common access token not set. Please update access token first.")
        
        # Fetch leads from Meta
        leads_data = fetch_leads_from_meta_form(request.form_id, access_token)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for lead_data in leads_data:
            try:
                # Process lead
                processed_lead = process_meta_lead(lead_data, request.form_id, db)
                if processed_lead:
                    # Import lead
                    result = import_meta_lead(db, processed_lead, user_id)
                    if result["status"] == "imported":
                        imported_count += 1
                    elif result["status"] == "skipped":
                        skipped_count += 1
                        
            except Exception as e:
                errors.append(f"Error processing lead {lead_data.get('id', 'unknown')}: {str(e)}")
        
        return {
            "success": True,
            "message": "Import completed",
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "total_processed": len(leads_data),
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import: {str(e)}")
