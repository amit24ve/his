from fastapi import (
    APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form, Body, Query, Request, Depends
)
import logging
from typing import List, Optional, Dict, Any
import io
import datetime
import pandas as pd
import json
from bson import ObjectId
from app.utils.timezone_utils import (
    get_ist_now, get_ist_timestamp, get_ist_timestamp_for_db, 
    convert_to_ist, make_datetime_serializable, ensure_ist_timezone
)
from app.database import find_lead_by_id_or_lead_id

# Setup logger
logger = logging.getLogger(__name__)

# Helper function to get user's subordinates based on hierarchy
async def get_user_subordinates(user_id: str, db) -> List[str]:
    """
    Get a list of user IDs that report to the given user.
    Returns a list of subordinate user IDs.
    """
    try:
        subordinate_user_ids = []
        
        # Method 1: Check for users with reporting_user_id field pointing to this user
        direct_reports = list(db.users.find(
            {"reporting_user_id": user_id, "is_active": True}
        ).limit(100))
        
        for report in direct_reports:
            user_id_field = report.get("user_id") or report.get("id") or str(report.get("_id"))
            if user_id_field:
                subordinate_user_ids.append(user_id_field)
        
        # Method 2: For high-level roles, get ALL users they can manage
        current_user = db.users.find_one({"user_id": user_id})
        if current_user and current_user.get("role_ids"):
            current_role_id = current_user["role_ids"][0]
            current_role = db.roles.find_one({"id": current_role_id})
            
            if current_role:
                role_name = current_role.get("name", "").lower()
                
                # If user is high-level (company_manager, director, etc.), they can see more users
                high_level_roles = ["director", "company_manager", "sales_head"]
                if role_name in high_level_roles:
                    # Get all users except other high-level users
                    all_users = list(db.users.find({"is_active": True}).limit(200))
                    
                    for user in all_users:
                        user_id_field = user.get("user_id") or user.get("id") or str(user.get("_id"))
                        if user_id_field and user_id_field != user_id:  # Don't include self
                            # Check if this user has a subordinate role
                            if user.get("role_ids"):
                                user_role = db.roles.find_one({"id": user["role_ids"][0]})
                                if user_role:
                                    user_role_name = user_role.get("name", "").lower()
                                    # Don't include other high-level roles for non-directors
                                    if role_name == "director" or user_role_name not in high_level_roles:
                                        subordinate_user_ids.append(user_id_field)
                else:
                    # For other roles, use role hierarchy
                    # Find roles that report to this user's role or have higher level numbers
                    current_level = current_role.get("level", 99)
                    subordinate_roles = list(db.roles.find({"level": {"$gt": current_level}}).limit(100))
                    
                    if subordinate_roles:
                        subordinate_role_ids = [role["id"] for role in subordinate_roles]
                        
                        # Find users with these subordinate roles
                        role_users = list(db.users.find(
                            {"role_ids": {"$in": subordinate_role_ids}, "is_active": True}
                        ).limit(100))
                        
                        for role_user in role_users:
                            user_id_field = role_user.get("user_id") or role_user.get("id") or str(role_user.get("_id"))
                            if user_id_field and user_id_field not in subordinate_user_ids:
                                subordinate_user_ids.append(user_id_field)
        
        logger.info(f"Found {len(subordinate_user_ids)} subordinates for user {user_id}: {subordinate_user_ids}")
        return subordinate_user_ids
        
    except Exception as e:
        logger.warning(f"Error getting subordinates for user {user_id}: {str(e)}")
        return []

from typing import Dict, Any, List, Optional


from app.database import (
    insert_lead, update_lead_source, find_duplicate_lead, get_database, insert_duplicate_lead,
    get_duplicate_leads, get_duplicate_leads_count
)

from app.routes.auth import SALES_USERS
from app.dependencies import get_current_user, get_current_user_id
from typing import Optional
from app.database.schemas.lead_integration import flatten_lead_data

# Configure logger
logger = logging.getLogger(__name__)

# Initialize router with proper settings
leads_router = APIRouter(prefix="/api/lead", tags=["leads"])

# Utility function to make MongoDB documents JSON-serializable
def make_serializable(obj):
    """Convert MongoDB document to JSON-serializable dictionary with IST timezone handling."""
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_serializable(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime.datetime):
        # Convert to IST and return ISO format
        ist_time = ensure_ist_timezone(obj)
        return ist_time.isoformat()
    else:
        return obj

# Helper function to handle MongoDB object serialization issues
def safe_get(data, key, default=None):
    """Get value from dict and handle ObjectId conversion if needed"""
    value = data.get(key, default)
    if isinstance(value, ObjectId):
        return str(value)
    return value

# Helper function to process and insert a lead, avoiding code duplication
async def process_and_insert_lead(lead_data: Dict, lead_id: str, idx: int, source: str = None, source_id: str = None) -> Dict:
    """
    Process a lead, check for duplicates, and insert if not duplicate.
    Returns: (processed_lead, is_duplicate)
    """
    # Create current timestamps in IST
    current_time = get_ist_timestamp_for_db()
    
    # Create lead with the exact structure needed (ensuring ObjectId is properly handled)
    def ensure_note_list(val):
        if val is None:
            return []
        if isinstance(val, list):
            return [v if isinstance(v, dict) else {"content": str(v)} for v in val]
        if isinstance(val, dict):
            return [val]
        if isinstance(val, str) and val.strip():
            return [{"content": val.strip()}]
        return []

    lead = {
        "_id": ObjectId(),  # Always create a fresh ObjectId
        "lead_id": lead_id,
        "lead_key": f"lead{idx}",
        "source": source or safe_get(lead_data, "source", ""),
        "source_id": source_id or safe_get(lead_data, "source_id", ""),
        "email": safe_get(lead_data, "email", ""),
        "phone": safe_get(lead_data, "phone", ""),
        "location": safe_get(lead_data, "location", ""),
        "district": safe_get(lead_data, "district", ""),
        "campaign": safe_get(lead_data, "campaign"),
        "status": safe_get(lead_data, "status", "new"),
        "assigned_to": safe_get(lead_data, "assigned_to"),
        "assigned_by": safe_get(lead_data, "assigned_by"),
        "created_at": lead_data.get("created_at", current_time),
        "updated_at": lead_data.get("updated_at", current_time),
        "notes": ensure_note_list(safe_get(lead_data, "notes")),
        "follow_up_notes": ensure_note_list(safe_get(lead_data, "follow_up_notes")),
        "name": safe_get(lead_data, "name", ""),
        "created": safe_get(lead_data, "created", current_time.strftime("%m/%d/%Y %I:%M %p")),
        "form": safe_get(lead_data, "form", ""),
        "channel": safe_get(lead_data, "channel", ""),
        "stage": safe_get(lead_data, "stage", "Intake"),
        "owner": safe_get(lead_data, "owner", "Unassigned"),
        "labels": safe_get(lead_data, "labels", ""),
        "secondary_phone_number": safe_get(lead_data, "secondary_phone_number", "")
    }
    
    # Extract any additional fields from raw_data if present
    if "raw_data" in lead_data:
        for key, value in lead_data["raw_data"].items():
            # Map common field names to our standard structure
            if key.lower() in ["email", "mail"] and not lead["email"]:
                lead["email"] = value
            elif key.lower() in ["phone", "mobile", "cell"] and not lead["phone"]:
                lead["phone"] = value
            elif key.lower() in ["name", "full_name", "fullname"] and not lead["name"]:
                lead["name"] = value
    
    # Check for duplicates by email or phone
    email = lead.get("email")
    phone = lead.get("phone")
    
    if email or phone:
        duplicate = await find_duplicate_lead(email, phone)
        if duplicate:
            logger.info(f"Duplicate lead found: {email or phone}")
            # Get the original lead's lead_id and ObjectId
            original_lead_object_id = str(duplicate.get("_id"))
            original_lead_id = duplicate.get("lead_id")  # Get the original lead_id
            
            # Set the duplicate to have the same lead_id as the original
            lead["lead_id"] = original_lead_id
            lead["lead_key"] = duplicate.get("lead_key", original_lead_id.replace("lead", ""))
            
            # Insert the duplicate lead into the duplicate_leads collection
            duplicate_id = await insert_duplicate_lead(lead, original_lead_object_id)
            logger.info(f"Stored duplicate lead in duplicate_leads collection: {duplicate_id}")
            return None, True
    
    # Insert the lead directly (no need for flatten_lead_data)
    await insert_lead(lead)
    return lead, False

@leads_router.post("/integrations/google-sheets", status_code=200)
async def import_from_google_sheets(payload: Dict = Body(...)):
    logger.info(f"Processing Google Sheets import request at {get_ist_now().isoformat()}")
    try:
        spreadsheet_url = payload.get("spreadsheet_url")
        if not spreadsheet_url:
            raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")

        sheet_name = payload.get("sheet_name", "Sheet1")
        header_row = payload.get("header_row", 1)
        original_mapping = payload.get("mapping", {})
        logger.info(f"Original mapping type: {type(original_mapping)}")

        # Ensure mapping is a dictionary
        if not isinstance(original_mapping, dict):
            try:
                if isinstance(original_mapping, list):
                    mapping = {}
                    for item in original_mapping:
                        if isinstance(item, dict) and "key" in item and "value" in item:
                            mapping[item["key"]] = item["value"]
                else:
                    mapping = dict(original_mapping) if hasattr(original_mapping, "__iter__") else {}
                logger.info(f"Converted mapping to: {mapping}")
            except Exception as e:
                logger.error(f"Failed to convert mapping: {str(e)}")
                mapping = {}
        else:
            mapping = original_mapping

        from app.database.integration.google_sheets import process_google_sheets

        # Add force_resync option to reprocess all rows
        force_resync = payload.get("force_resync", False)
        logger.info(f"Force resync option: {force_resync}")

        # Extract spreadsheet ID for resync logic
        import re
        spreadsheet_id_match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', spreadsheet_url)
        spreadsheet_id = None
        if spreadsheet_id_match:
            spreadsheet_id = spreadsheet_id_match.group(1)
        else:
            # If URL doesn't match, maybe it's just the ID
            spreadsheet_id = spreadsheet_url.strip()

        # If force_resync is True, reset the last_synced_row to force reprocessing
        if force_resync and spreadsheet_id:
            db = get_database()
            logger.info(f"Resetting sync for spreadsheet: {spreadsheet_id}")
            # Reset the last_synced_row to header_row to reprocess all data
            result = db.lead_sources.update_one(
                {"integration_id": spreadsheet_id},
                {"$set": {"last_synced_row": header_row}},
                upsert=True
            )
            logger.info(f"Reset result: modified={result.modified_count}, upserted={result.upserted_id}")

        # Process the Google Sheets data - now returns leads with flat schema
        result = await process_google_sheets(
            spreadsheet_url,
            sheet_name=sheet_name,
            header_row=header_row,
            mapping=mapping
        )

        logger.info(f"Google Sheets processing result: {result}")
        
        # Make sure all data is JSON serializable
        if "leads" in result:
            result["leads"] = [make_serializable(lead) for lead in result["leads"]]
        
        # Add any additional metadata needed for the response
        result["imported"] = len(result.get("leads", []))
        result["duplicates"] = result.get("duplicates", 0)
        
        return make_serializable(result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Google Sheets request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@leads_router.post("/integrations/excel", status_code=201)
async def import_from_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form("Sheet1"),
    header_row: int = Form(0),
    mapping: str = Form("{}")
):
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            logger.error(f"Invalid file type: {file.filename}")
            raise HTTPException(status_code=400, detail="File must be an Excel spreadsheet (.xlsx or .xls)")

        try:
            mapping_dict = json.loads(mapping)
            logger.info(f"Mapping parsed successfully: {mapping_dict}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid mapping JSON: {mapping} - Error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid mapping JSON format: {str(e)}")

        contents = await file.read()
        try:
            df = pd.read_excel(
                io.BytesIO(contents),
                sheet_name=sheet_name,
                header=header_row
            )
            if df.empty:
                return {"message": "Excel file contains no data", "count": 0}

            new_leads_count = 0
            duplicate_count = 0
            error_count = 0
            all_leads = []
            lead_index = 1  # For lead00X

            for idx, (_, row) in enumerate(df.iterrows()):
                try:
                    lead_id = f"lead{lead_index:03}"
                    lead_index += 1

                    row_data = row.to_dict()
                    if not any(str(v).strip() for v in row_data.values() if v is not None):
                        continue
                        
                    # Create initial lead data with raw data
                    lead = {
                        "raw_data": row_data,
                        "status": "new",
                        "stage": "Intake",
                        "owner": "Unassigned"
                    }
                    
                    # Add mapped fields from Excel
                    for field, header in mapping_dict.items():
                        if header in row_data:
                            lead[field] = row_data[header]
                    
                    # Use helper function to process and insert lead
                    processed_lead, is_duplicate = await process_and_insert_lead(
                        lead_data=lead,
                        lead_id=lead_id,
                        idx=idx,
                        source="excel",
                        source_id=file.filename
                    )
                    
                    if is_duplicate:
                        duplicate_count += 1
                        continue
                        
                    if processed_lead:
                        all_leads.append(processed_lead)
                        new_leads_count += 1
                except Exception as row_error:
                    error_count += 1
                    logger.error(f"Error processing row {idx}: {str(row_error)}")

            source_id = f"excel_{file.filename}_{get_ist_timestamp_for_db().isoformat()}"
            await update_lead_source(source_id, {
                "name": f"Excel: {file.filename}",
                "source_type": "excel",
                "integration_id": source_id,
                "mapping": mapping_dict,
                "last_sync_time": get_ist_timestamp_for_db(),
                "metadata": {
                    "filename": file.filename,
                    "sheet_name": sheet_name,
                    "header_row": header_row
                }
            })

            # Make sure all leads are serializable
            serialized_leads = [make_serializable(lead) for lead in all_leads]
            
            return {
                "success": True,
                "message": f"Successfully imported {new_leads_count} leads from Excel",
                "file_name": file.filename,
                "total_rows": len(df),
                "imported": new_leads_count,
                "duplicates": duplicate_count,
                "errors": error_count,
                "timestamp": "2025-06-05 12:32:58",
                "user": "soheruINFO",
                "leads": serialized_leads
            }

        except Exception as e:
            logger.error(f"Error processing Excel data: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error processing Excel data: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Excel file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@leads_router.get("/users/sales")
async def get_sales_users(role: Optional[str] = Query(None)):
    """Get all sales team users, optionally filtered by role"""
    try:
        db = get_database()

        def to_dict(user):
            if hasattr(user, "model_dump"):
                return user.model_dump()
            if hasattr(user, "dict"):
                return user.dict()
            return user

        users = SALES_USERS
        if role:
            users = [user for user in SALES_USERS if getattr(user, "role", None) == role or (isinstance(user, dict) and user.get("role") == role)]
        return [to_dict(user) for user in users]

    except Exception as e:
        logger.error(f"Error getting sales users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get sales users: {str(e)}")

@leads_router.get("/assignments")
async def get_lead_assignments(current_user: dict = Depends(get_current_user)):
    """Get lead assignments with hierarchy-based filtering"""
    try:
        db = get_database()
        lead_assignments_collection = db.lead_assignments

        # Apply hierarchy-based filtering
        user_id = current_user.get("user_id") or current_user.get("id")
        user_roles = current_user.get("roles", [])
        
        # Check if user is admin - admins can see all assignments
        is_admin = "admin" in user_roles or "admin" in current_user.get("token_data", {}).get("roles", [])
        
        query = {}
        if not is_admin:
            # For non-admin users, filter assignments based on hierarchy
            try:
                accessible_user_ids = [user_id]  # Always include the user's own ID
                
                # Add subordinates' user IDs to accessible list
                subordinate_user_ids = await get_user_subordinates(user_id, db)
                accessible_user_ids.extend(subordinate_user_ids)
                
                # Filter assignments by assigned_to or assigned_by matching accessible user IDs
                query = {
                    "$or": [
                        {"assigned_to": {"$in": accessible_user_ids}},
                        {"assigned_by": {"$in": accessible_user_ids}},
                        {"assigned_to": user_id},
                        {"assigned_by": user_id}
                    ]
                }
                
            except Exception as hierarchy_error:
                logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
                # Fall back to user's own assignments only
                query = {
                    "$or": [
                        {"assigned_to": user_id},
                        {"assigned_by": user_id}
                    ]
                }

        assignments = list(lead_assignments_collection.find(query))
        for assignment in assignments:
            assignment["id"] = str(assignment["_id"])
            assignment.pop("_id", None)
        return assignments
    except Exception as e:
        logger.error(f"Error getting assignments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get assignments: {str(e)}")


@leads_router.post("/assign", status_code=200)
async def assign_lead(update: dict):
    """
    Assign/Update a lead's owner (supports both ObjectId and lead_id). Enforces hierarchy: Admin → Manager → Team.
    """
    db = get_database()
    lead_id = update.get("lead_id")
    assigned_to = update.get("assigned_to")
    assigned_by = update.get("assigned_by", "system")

    if not lead_id or not assigned_to:
        raise HTTPException(status_code=422, detail="lead_id and assigned_to are required.")

    # Get current lead data before update using the new helper function
    current_lead = find_lead_by_id_or_lead_id(lead_id)
    if not current_lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    old_assigned_to = current_lead.get("assigned_to", "Unassigned")
    actual_lead_id = current_lead.get("lead_id", lead_id)

    # Helper function to resolve user ID to name for display
    def resolve_user_display_name(user_identifier):
        """Resolve user ID or name to display format: 'Name - Role'"""
        if not user_identifier or user_identifier in ['Unassigned', 'unassigned']:
            return 'Unassigned'
        
        # Try to find user by user_id first
        user = db.users.find_one({"user_id": user_identifier})
        if not user:
            # Try to find by username as fallback
            user = db.users.find_one({"username": user_identifier})
        if not user:
            # Try to find by full_name as fallback
            user = db.users.find_one({"full_name": user_identifier})
        
        if user:
            # Get role name
            role_name = 'Unknown Role'
            if user.get('role_ids') and len(user['role_ids']) > 0:
                role = db.roles.find_one({"id": user['role_ids'][0]})
                if role:
                    role_name = role.get('name', 'Unknown Role')
            elif user.get('roles'):
                role_name = user['roles'][0] if isinstance(user['roles'], list) else user['roles']
            
            return f"{user.get('full_name', user.get('username', 'Unknown User'))} - {role_name}"
        
        # If user not found, return the identifier as-is
        return user_identifier

    def extract_user_id(user_identifier):
        """Extract actual user ID from any user identifier (ID, username, full_name, or display name)"""
        if not user_identifier or user_identifier in ['Unassigned', 'unassigned']:
            return None
        
        # If it's a display name format like "checkl - Checl", extract the username part
        if " - " in user_identifier:
            username_part = user_identifier.split(" - ")[0].strip()
            # Try to find user by the extracted username
            user = db.users.find_one({"username": username_part})
            if user:
                return user.get("user_id") or user.get("username")
        
        # Try to find user by user_id first
        user = db.users.find_one({"user_id": user_identifier})
        if user:
            return user.get("user_id")
        
        # Try to find by username as fallback
        user = db.users.find_one({"username": user_identifier})
        if user:
            return user.get("user_id") or user.get("username")
        
        # Try to find by full_name as fallback
        user = db.users.find_one({"full_name": user_identifier})
        if user:
            return user.get("user_id") or user.get("username")
        
        # If user not found, return the identifier as-is (might be a valid user_id we didn't find)
        return user_identifier

    # Extract actual user ID for storage
    actual_user_id = extract_user_id(assigned_to)
    # Resolve assigned_to to user display name for storage
    display_assigned_to = resolve_user_display_name(actual_user_id or assigned_to)

    # --- Hierarchy enforcement logic ---
    # Fetch all roles for hierarchy lookup
    roles = list(db.roles.find())
    # Build lookup by name and id
    name_to_role = {r.get("name"): r for r in roles}
    id_to_role = {r.get("id"): r for r in roles}

    # Find assigned_by and assigned_to role objects
    assigned_by_role = None
    assigned_to_role = None
    # Try to match by name or id
    for r in roles:
        if (r.get("name") == assigned_by) or (str(r.get("id")) == str(assigned_by)):
            assigned_by_role = r
        if (r.get("name") == assigned_to) or (str(r.get("id")) == str(assigned_to)):
            assigned_to_role = r
    # Fallback: if not found by name, try by id
    if not assigned_by_role:
        assigned_by_role = name_to_role.get(assigned_by)
    if not assigned_to_role:
        assigned_to_role = name_to_role.get(assigned_to)

    # If still not found, try matching by id
    if not assigned_by_role:
        assigned_by_role = id_to_role.get(assigned_by)
    if not assigned_to_role:
        assigned_to_role = id_to_role.get(assigned_to)

    # If still not found, allow (for legacy data), but warn
    if not assigned_by_role or not assigned_to_role:
        pass  # Allow, but could log a warning
    else:
        # Relaxed hierarchy validation: allow managers to assign their leads to subordinates
        # Admin can assign to: Manager, Sales_manager
        if assigned_by_role["name"].lower() == "admin":
            allowed_roles = ["manager", "sales_manager"]
            if assigned_to_role["name"].lower() not in allowed_roles:
                raise HTTPException(status_code=403, detail=f"Admin can only assign to {', '.join(allowed_roles)}.")
        
        # Manager can assign to: Executive (any executive)
        elif assigned_by_role["name"].lower() == "manager":
            if assigned_to_role["name"].lower() != "executive":
                raise HTTPException(status_code=403, detail="Manager can only assign to executives.")
        
        # Sales_manager can assign to: Team Member (any team member)
        elif assigned_by_role["name"].lower() == "sales_manager":
            allowed_roles = ["team member", "team_member", "team"]
            if assigned_to_role["name"].lower() not in allowed_roles:
                raise HTTPException(status_code=403, detail="Sales_manager can only assign to team members.")
        
        # Executive and Team cannot assign leads (keep strict)
        elif assigned_by_role["name"].lower() in ["executive", "team", "team_member"]:
            raise HTTPException(status_code=403, detail=f"{assigned_by_role['name']} cannot assign leads.")

    # Find and update the lead using the ObjectId from the found lead
    result = db.leads.update_one(
        {"_id": current_lead["_id"]},  # Use ObjectId from the found lead
        {"$set": {
            "assigned_to": actual_user_id or assigned_to,  # Store actual user ID as primary reference
            "assigned_to_display": display_assigned_to,  # Store display name for UI
            "assigned_user_id": actual_user_id or assigned_to,    # Keep this for backward compatibility (use actual user ID)
            "updated_at": get_ist_timestamp_for_db(),
            "assigned_by": assigned_by
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found.")

    # Create activity for assignment change
    if old_assigned_to != (actual_user_id or assigned_to):  # Compare IDs for actual change detection
        await create_lead_activity_internal(
            lead_id=actual_lead_id,
            activity_type="lead_updated",
            description=f"Lead updated: assigned_to: '{old_assigned_to}' → '{display_assigned_to}'",
            created_by=assigned_by or "system",
            metadata={
                "old_assigned_to": old_assigned_to,
                "new_assigned_to": actual_user_id or assigned_to,           # Store actual ID in metadata
                "new_assigned_to_display": display_assigned_to,  # Store display name in metadata
                "assigned_by": assigned_by,
                "assigned_user_id": actual_user_id or assigned_to           # Keep this for backward compatibility (use actual user ID)
            }
        )

    return {"status": "success", "lead_id": lead_id, "assigned_to": actual_user_id or assigned_to, "assigned_to_display": display_assigned_to, "assigned_user_id": actual_user_id or assigned_to}



@leads_router.put("/leads/{lead_id}", status_code=200)
async def update_lead(lead_id: str, payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """Update a lead (supports both ObjectId and lead_id)"""
    db = get_database()
    
    # Get current lead data before update using the new helper function
    current_lead = find_lead_by_id_or_lead_id(lead_id)
    if not current_lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    
    actual_lead_id = current_lead.get("lead_id", lead_id)
    
    # Track changes for activity
    changes = []
    metadata = {}
    
    # Check for specific field changes we want to track
    tracked_fields = ["status", "notes", "follow_up_date", "follow_up_notes", "stage", "assigned_to", "phone", "alternate_phone", "email", "name", "location", "district"]

    def ensure_note_list(val):
        if val is None:
            return []
        if isinstance(val, list):
            return [v if isinstance(v, dict) else {"content": str(v)} for v in val]
        if isinstance(val, dict):
            return [val]
        if isinstance(val, str) and val.strip():
            return [{"content": val.strip()}]
        return []

    # Convert notes, follow_up_notes to list[dict] if present
    for field in ["notes", "follow_up_notes"]:
        if field in payload:
            payload[field] = ensure_note_list(payload[field])
    
    # Validate that notes (general notes) is not empty
    if "notes" in payload:
        notes_content = ""
        if isinstance(payload["notes"], list) and len(payload["notes"]) > 0:
            if isinstance(payload["notes"][0], dict):
                notes_content = payload["notes"][0].get("content", "").strip()
            else:
                notes_content = str(payload["notes"][0]).strip()
        elif isinstance(payload["notes"], str):
            notes_content = payload["notes"].strip()
        
        if not notes_content:
            raise HTTPException(status_code=400, detail="General notes cannot be empty")

    for field in tracked_fields:
        if field in payload:
            old_value = current_lead.get(field)
            new_value = payload[field]
            # Only track if values are actually different
            if str(old_value) != str(new_value):
                old_display = old_value if old_value is not None else "None"
                new_display = new_value if new_value is not None else "None"
                changes.append(f"{field}: '{old_display}' → '{new_display}'")
                metadata[f"old_{field}"] = old_value
                metadata[f"new_{field}"] = new_value
    
    # Add update timestamp in IST
    current_time_ist = get_ist_timestamp_for_db()

    payload["updated_at"] = datetime.datetime.strftime(current_time_ist, "%Y-%m-%d %H:%M:%S")

    # Check if follow-up data has changed and add follow_up_updated_at timestamp
    follow_up_changed = False
    old_follow_up_date = current_lead.get("follow_up_date")
    old_follow_up_notes = current_lead.get("follow_up_notes")
    
    # If follow_up_notes or follow_up_date is present in payload, update them as well
    follow_up_notes = payload.get("follow_up_notes")
    follow_up_date = payload.get("follow_up_date")
    update_fields = dict(payload)
    
    if follow_up_notes is not None:
        update_fields["follow_up_notes"] = follow_up_notes
        # Check if follow-up notes changed
        if str(old_follow_up_notes) != str(follow_up_notes):
            follow_up_changed = True
    
    if follow_up_date is not None:
        # Parse datetime string if provided
        if isinstance(follow_up_date, str):
            try:
                follow_up_date = datetime.datetime.fromisoformat(follow_up_date.replace('Z', '+00:00'))
            except ValueError:
                # If it's not a valid ISO format, try parsing as date only
                try:
                    follow_up_date = datetime.datetime.strptime(follow_up_date, '%Y-%m-%d')
                except ValueError:
                    pass  # Keep original value if parsing fails
        update_fields["follow_up_date"] = follow_up_date
        # Check if follow-up date changed
        if str(old_follow_up_date) != str(follow_up_date):
            follow_up_changed = True
    
    # Add follow_up_updated_at timestamp if follow-up data changed
    if follow_up_changed:
        update_fields["follow_up_updated_at"] = current_time_ist
    elif "follow_up_updated_at" in payload:
        # Use the provided timestamp from frontend, convert to IST if needed
        if payload["follow_up_updated_at"]:
            try:
                provided_time = datetime.datetime.fromisoformat(payload["follow_up_updated_at"].replace('Z', '+00:00'))
                if provided_time.tzinfo is None:
                    # If timezone naive, assume it's already IST
                    update_fields["follow_up_updated_at"] = ensure_ist_timezone(provided_time)
                else:
                    # Convert to IST
                    update_fields["follow_up_updated_at"] = convert_to_ist(provided_time)
            except (ValueError, AttributeError):
                pass  # Keep existing timestamp if parsing fails

    # Update the lead using the ObjectId from the found lead
    result = db.leads.update_one(
        {"_id": current_lead["_id"]},  # Use ObjectId from the found lead
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found.")

    # Create activity if there were changes
    if changes:
        description = f"Lead updated: {', '.join(changes)}"
        # Get current user's display name
        user_display_name = current_user.get("full_name") or current_user.get("username") or current_user.get("user_id", "Unknown User")
        await create_lead_activity_internal(
            lead_id=actual_lead_id,
            activity_type="lead_updated", 
            description=description,
            created_by=user_display_name,
            metadata=metadata
        )

    return {"status": "success", "updated": update_fields}

@leads_router.get("/leads")
async def get_leads(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    source: Optional[str] = Query(None, description="Filter by source"),
    status: Optional[str] = Query(None, description="Filter by status"),   # <-- NEW
    search: Optional[str] = Query(None, description="Search by name, email, phone"),  # <-- NEW
    start_date: Optional[str] = Query(None, description="Start date for filtering"),
    end_date: Optional[str] = Query(None, description="End date for filtering"),
    current_user: dict = Depends(get_current_user)  # Require proper authentication
):
    """Get paginated leads with optional filtering and organizational hierarchy-based access"""
    try:
        db = get_database()
        query = {}
        if source and source != "all":
            query["source"] = source

        # Add status filter
        if status and status != "all":
            query["status"] = status

        # Add search support (for name, email, phone)
        search_conditions = []
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            search_conditions = [
                {"name": search_regex},
                {"email": search_regex},
                {"phone": search_regex},
                {"raw_data.Name": search_regex},
                {"raw_data.Email": search_regex},
                {"raw_data.Phone": search_regex}
            ]

        # Date filtering
        if start_date or end_date:
            date_filter = {}
            if start_date:
                try:
                    date_filter["$gte"] = datetime.datetime.fromisoformat(start_date)
                except Exception:
                    pass
            if end_date:
                try:
                    date_filter["$lte"] = datetime.datetime.fromisoformat(end_date)
                except Exception:
                    pass
            if date_filter:
                query["created_at"] = date_filter

        # Apply organizational hierarchy-based filtering
        user_id = current_user.get("user_id") or current_user.get("id")
        user_roles = current_user.get("roles", [])
        
        # Debug current user
        logger.info(f"Debug - Current user: {user_id}, roles: {user_roles}, full user data: {current_user}")
        
        # Check if user is admin or high-level manager - they can see all leads
        is_admin = "admin" in user_roles or "admin" in current_user.get("token_data", {}).get("roles", [])
        
        # Also check if user has a high-level role (company_manager, director, etc.)
        is_high_level = False
        try:
            db_user = db.users.find_one({"user_id": user_id})
            if db_user and db_user.get("role_ids"):
                user_role = db.roles.find_one({"id": db_user["role_ids"][0]})
                if user_role:
                    role_name = user_role.get("name", "").lower()
                    # High-level roles that can see all leads
                    high_level_roles = ["admin", "director", "company_manager", "sales_head"]
                    is_high_level = role_name in high_level_roles
                    logger.info(f"User {user_id} has role {role_name}, is_high_level: {is_high_level}")
        except Exception as role_check_error:
            logger.warning(f"Error checking user role for {user_id}: {str(role_check_error)}")
        
        logger.info(f"Debug - Is admin: {is_admin}, Is high level: {is_high_level}")
        
        hierarchy_conditions = []
        if not (is_admin or is_high_level):
            # For non-admin users, get their team structure to determine accessible leads
            try:
                accessible_user_ids = [user_id]  # Always include the user's own ID
                logger.info(f"Debug - Initial accessible IDs: {accessible_user_ids}")
                
                # Add subordinates' user IDs to accessible list
                subordinate_user_ids = await get_user_subordinates(user_id, db)
                accessible_user_ids.extend(subordinate_user_ids)
                
                # Create hierarchy conditions - Check both assigned_to and assigned_user_id fields
                hierarchy_conditions = [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}},
                    {"assigned_to": user_id},  # Direct assignment
                    {"assigned_user_id": user_id},  # Also check assigned_user_id
                    {"created_by": user_id}    # Created by user
                ]
                
                logger.info(f"Debug - Hierarchy conditions: {hierarchy_conditions}")
                logger.info(f"Hierarchy filtering applied for user {user_id}: accessible_user_ids={accessible_user_ids}")
                
            except Exception as hierarchy_error:
                # If hierarchy service fails, fall back to user's own leads only
                logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
                hierarchy_conditions = [
                    {"assigned_to": user_id},
                    {"assigned_user_id": user_id},  # Also check assigned_user_id
                    {"created_by": user_id}
                ]

        # Combine search and hierarchy conditions
        combined_conditions = []
        
        # If we have both search and hierarchy conditions, we need to combine them
        if search_conditions and hierarchy_conditions:
            # Each search condition must be combined with hierarchy conditions
            for search_cond in search_conditions:
                for hierarchy_cond in hierarchy_conditions:
                    combined_conditions.append({"$and": [search_cond, hierarchy_cond]})
            query["$or"] = combined_conditions
        elif search_conditions:
            # Only search conditions (admin users or no hierarchy filtering)
            query["$or"] = search_conditions
        elif hierarchy_conditions:
            # Only hierarchy conditions (no search)
            query["$or"] = hierarchy_conditions

        skip = (page - 1) * limit
        leads = list(db.leads.find(query).skip(skip).limit(limit))
        total = db.leads.count_documents(query)

        # Format leads for API response
        formatted_leads = []
        for lead in leads:
            # Deep-copy the lead to avoid modifying the original
            formatted_lead = {}
            
            # Convert all fields, handling special types
            for key, value in lead.items():
                if key == "_id" or isinstance(value, ObjectId):
                    formatted_lead[key] = str(value)
                elif isinstance(value, datetime.datetime):
                    formatted_lead[key] = value.isoformat()
                elif isinstance(value, dict):
                    # Handle nested dictionaries
                    nested_dict = {}
                    for k, v in value.items():
                        if isinstance(v, ObjectId):
                            nested_dict[k] = str(v)
                        elif isinstance(v, datetime.datetime):
                            nested_dict[k] = v.isoformat()
                        else:
                            nested_dict[k] = v
                    formatted_lead[key] = nested_dict
                else:
                    formatted_lead[key] = value
                    
            formatted_leads.append(formatted_lead)

        # Create a response that's guaranteed to be JSON serializable
        response = {
            "data": formatted_leads,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "timestamp": get_ist_timestamp_for_db().strftime("%Y-%m-%d %H:%M:%S"),
            "user": "soheruINFO"
        }
        
        # Pass the response through our serialization function to ensure everything is serializable
        return make_serializable(response)
    except Exception as e:
        logger.error(f"Error getting leads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get leads: {str(e)}")

@leads_router.post("/debug/google-sheets", status_code=200)
async def debug_google_sheets(payload: Dict = Body(...)):
    """Debug endpoint to see what data is being pulled from Google Sheets"""
    try:
        spreadsheet_url = payload.get("spreadsheet_url")
        if not spreadsheet_url:
            raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")

        sheet_name = payload.get("sheet_name", "Sheet1")
        header_row = payload.get("header_row", 1)
        
        # Import the necessary functions
        from app.database.integration.google_sheets import extract_file_info, get_google_credentials, SHEETS_SCOPES
        import gspread
        
        # Extract resource ID
        resource_id_info = extract_file_info(spreadsheet_url)
        resource_id = resource_id_info["id"]
        
        # Open Google Sheet
        creds = get_google_credentials(SHEETS_SCOPES)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(resource_id)
        sheet = spreadsheet.worksheet(sheet_name)
        all_values = sheet.get_all_values()
        
        # Check what's in the database for this source
        db = get_database()
        source = db.lead_sources.find_one({"integration_id": resource_id})
        last_synced_row = header_row
        if source and "last_synced_row" in source:
            last_synced_row = source["last_synced_row"]
        
        debug_info = {
            "spreadsheet_title": spreadsheet.title,
            "sheet_name": sheet_name,
            "total_rows": len(all_values),
            "header_row": header_row,
            "headers": all_values[header_row - 1] if len(all_values) > header_row - 1 else [],
            "last_synced_row": last_synced_row,
            "rows_to_process": max(0, len(all_values) - last_synced_row),
            "sample_data_rows": []
        }
        
        # Add a few sample rows for debugging
        for i in range(header_row, min(header_row + 5, len(all_values))):
            if i < len(all_values):
                debug_info["sample_data_rows"].append({
                    "row_number": i + 1,
                    "data": all_values[i]
                })
        
        return debug_info
        
    except Exception as e:
        logger.error(f"Error debugging Google Sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error debugging Google Sheets: {str(e)}")

@leads_router.post("/debug/google-sheets-detailed", status_code=200)
async def debug_google_sheets_detailed(payload: Dict = Body(...)):
    """More detailed debug endpoint to see exactly what's happening with Google Sheets processing"""
    try:
        spreadsheet_url = payload.get("spreadsheet_url")
        if not spreadsheet_url:
            raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")

        sheet_name = payload.get("sheet_name", "Sheet1")
        header_row = payload.get("header_row", 1)
        
        # Import the necessary functions
        from app.database.integration.google_sheets import extract_file_info, get_google_credentials, SHEETS_SCOPES
        import gspread
        
        # Extract resource ID
        resource_id_info = extract_file_info(spreadsheet_url)
        resource_id = resource_id_info["id"]
        
        # Open Google Sheet
        creds = get_google_credentials(SHEETS_SCOPES)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(resource_id)
        sheet = spreadsheet.worksheet(sheet_name)
        all_values = sheet.get_all_values()
        
        # Check what's in the database for this source
        db = get_database()
        source = db.lead_sources.find_one({"integration_id": resource_id})
        last_synced_row = header_row
        if source and "last_synced_row" in source:
            last_synced_row = source["last_synced_row"]
        
        # Show all data rows that would be processed
        rows_to_process = []
        for i, row in enumerate(all_values[header_row:], start=header_row + 1):
            if i <= last_synced_row:
                status = "SKIPPED (already processed)"
            else:
                status = "WILL PROCESS"
                
            rows_to_process.append({
                "row_number": i,
                "status": status,
                "data": row,
                "has_data": any(str(v).strip() for v in row if v is not None)
            })
        
        debug_info = {
            "spreadsheet_title": spreadsheet.title,
            "sheet_name": sheet_name,
            "total_rows": len(all_values),
            "header_row": header_row,
            "headers": all_values[header_row - 1] if len(all_values) > header_row - 1 else [],
            "last_synced_row": last_synced_row,
            "rows_after_header": len(all_values) - header_row,
            "rows_to_process": max(0, len(all_values) - last_synced_row),
            "source_record": source,
            "all_rows_detail": rows_to_process[:10],  # Limit to first 10 rows for debugging
            "recommendation": ""
        }
        
        # Add recommendation
        if last_synced_row >= len(all_values):
            debug_info["recommendation"] = "All rows have been processed. Use force_resync: true to reprocess all data."
        elif len(all_values) <= header_row:
            debug_info["recommendation"] = "No data rows found after header row. Check if your sheet has data."
        else:
            debug_info["recommendation"] = f"Will process {len(all_values) - last_synced_row} new rows."
        
        return debug_info
        
    except Exception as e:
        logger.error(f"Error debugging Google Sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error debugging Google Sheets: {str(e)}")

@leads_router.post("/force-reset-sync", status_code=200)
async def force_reset_sync(payload: Dict = Body(...)):
    """Force reset the sync status for a Google Sheet to reprocess all data"""
    try:
        spreadsheet_url = payload.get("spreadsheet_url")
        if not spreadsheet_url:
            raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")
            
        # Extract resource ID
        from app.database.integration.google_sheets import extract_file_info
        resource_id_info = extract_file_info(spreadsheet_url)
        resource_id = resource_id_info["id"]
        
        # Reset the sync status in database
        db = get_database()
        result = db.lead_sources.update_one(
            {"integration_id": resource_id},
            {"$set": {"last_synced_row": 1}},  # Reset to header row
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Reset sync status for spreadsheet {resource_id}",
            "modified_count": result.modified_count,
            "upserted_id": str(result.upserted_id) if result.upserted_id else None
        }
        
    except Exception as e:
        logger.error(f"Error resetting sync status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error resetting sync status: {str(e)}")

# Helper function to create lead activity
async def create_lead_activity_internal(lead_id: str, activity_type: str, description: str, created_by: str = "system", metadata: Dict = None):
    """Internal function to create lead activities with IST timestamps"""
    try:
        db = get_database()
        activity = {
            "_id": ObjectId(),
            "lead_id": lead_id,  # This should be the actual lead_id, not ObjectId
            "activity_type": activity_type,
            "description": description,
            "created_at": get_ist_timestamp_for_db(),
            "created_by": created_by,
            "metadata": metadata or {}
        }
        db.lead_activities.insert_one(activity)
        logger.info(f"Created activity for lead {lead_id}: {activity_type}")
    except Exception as e:
        logger.error(f"Error creating activity for lead {lead_id}: {str(e)}")

@leads_router.post("/leads", status_code=201)
async def create_manual_lead(payload: Dict[str, Any]):
    """Create a new lead manually"""
    try:
        # Validate required fields
        if not payload.get("name") or not payload.get("email"):
            raise HTTPException(status_code=400, detail="Name and Email are required fields")
        
        db = get_database()
        
        # Get the highest existing lead_id number to ensure uniqueness
        highest_lead = db.leads.find({
            "lead_id": {"$regex": "^lead\\d+$"}
        }).sort("lead_id", -1).limit(1)
        
        # Extract the number from the highest lead_id (e.g., "LEAD123" -> 123)
        next_lead_number = 1
        for lead in highest_lead:
            lead_id_str = lead.get("lead_id", "lead000")
            # Extract number from lead_id (e.g., "lead123" -> "123")
            import re
            match = re.search(r'lead(\d+)', lead_id_str)
            if match:
                next_lead_number = int(match.group(1)) + 1
            break

        # Generate unique lead_id in lead### format (lead001, lead002, etc.)
        lead_id = f"lead{next_lead_number:03d}"
        
        # Check for duplicate by email or phone
        email = payload.get("email", "").strip()
        phone = payload.get("phone", "").strip()
        
        if email or phone:
            duplicate = await find_duplicate_lead(email, phone)
            if duplicate:
                # Create lead document that would be inserted (for storing in duplicate_leads)
                current_time = get_ist_timestamp_for_db()
                
                # Get the original lead's lead_id and ObjectId
                original_lead_object_id = str(duplicate.get("_id"))
                original_lead_id = duplicate.get("lead_id")  # Get the original lead_id
                
                def ensure_note_list(val):
                    if val is None:
                        return []
                    if isinstance(val, list):
                        return [v if isinstance(v, dict) else {"content": str(v)} for v in val]
                    if isinstance(val, dict):
                        return [val]
                    if isinstance(val, str) and val.strip():
                        return [{"content": val.strip()}]
                    return []
                
                lead_document = {
                    "_id": ObjectId(),
                    "lead_id": original_lead_id,  # Use same lead_id as original
                    "lead_key": duplicate.get("lead_key", original_lead_id.replace("lead", "")),  # Use same lead_key as original
                    "source": payload.get("source", "manual_entry"),
                    "source_id": f"manual_{current_time.isoformat()}",
                    "email": email,
                    "phone": phone,
                    "name": payload.get("name", "").strip(),
                    "location": payload.get("location", "").strip(),
                    "district": payload.get("district", "").strip(),
                    "campaign": payload.get("campaign", "").strip(),
                    "status": payload.get("status", "new"),
                    "notes": ensure_note_list(payload.get("notes", "")),
                    "follow_up_notes": ensure_note_list(payload.get("follow_up_notes", "")),
                    "assigned_to": payload.get("assigned_to", "Unassigned"),
                    "assigned_by": payload.get("created_by", "system"),
                    "owner": payload.get("owner", "Unassigned"),
                    "created_at": current_time,
                    "updated_at": current_time,
                    "created": current_time.strftime("%m/%d/%Y %I:%M %p"),
                    "form": "",
                    "channel": "manual",
                    "labels": payload.get("labels", ""),
                    "secondary_phone_number": payload.get("secondary_phone_number", ""),
                    "alternate_phone": payload.get("alternate_phone", ""),
                    "raw_data": {
                        "manual_entry": True,
                        "created_by": payload.get("created_by", "system"),
                        "original_notes": payload.get("notes", "")
                    }
                }
                
                # Store in duplicate_leads collection
                duplicate_id = await insert_duplicate_lead(lead_document, original_lead_object_id)
                logger.info(f"Stored manual duplicate lead in duplicate_leads collection: {duplicate_id}")
                
                # Return a more informative error message
                raise HTTPException(
                    status_code=409, 
                    detail=f"Duplicate lead found with email '{email}' or phone '{phone}'. The lead has been saved in the duplicates collection."
                )
        
        # Create current timestamps
        current_time = get_ist_timestamp_for_db()
        
        # Create lead document with proper structure
        def ensure_note_list(val):
            if val is None:
                return []
            if isinstance(val, list):
                return [v if isinstance(v, dict) else {"content": str(v)} for v in val]
            if isinstance(val, dict):
                return [val]
            if isinstance(val, str) and val.strip():
                return [{"content": val.strip()}]
            return []

        lead_document = {
            "_id": ObjectId(),
            "lead_id": lead_id,
            "lead_key": f"lead{next_lead_number}",
            "source": payload.get("source", "manual_entry"),
            "source_id": f"manual_{current_time.isoformat()}",
            "email": email,
            "phone": phone,
            "name": payload.get("name", "").strip(),
            "location": payload.get("location", "").strip(),
            "district": payload.get("district", "").strip(),
            "campaign": payload.get("campaign", "").strip(),
            "status": payload.get("status", "new"),
            # "stage": payload.get("stage", "Intake"),
            "notes": ensure_note_list(payload.get("notes", "")),
            "follow_up_notes": ensure_note_list(payload.get("follow_up_notes", "")),
            "assigned_to": payload.get("assigned_to", "Unassigned"),
            "assigned_by": payload.get("created_by", "system"),
            "owner": payload.get("owner", "Unassigned"),
            "created_at": current_time,
            "updated_at": current_time,
            "created": current_time.strftime("%m/%d/%Y %I:%M %p"),
            "form": "",
            "channel": "manual",
            "labels": payload.get("labels", ""),
            "secondary_phone_number": payload.get("secondary_phone_number", ""),
            "alternate_phone": payload.get("alternate_phone", ""),
            "raw_data": {
                "manual_entry": True,
                "created_by": payload.get("created_by", "system"),
                "original_notes": payload.get("notes", "")  # Store original notes for debugging
            }
        }
        
        # Insert the lead
        await insert_lead(lead_document)
        logger.info(f"Manual lead created successfully: {lead_id}")
        logger.info(f"Lead notes stored: '{lead_document.get('notes', 'NO NOTES FIELD')}'")
        
        # Create activity for manual lead creation
        await create_lead_activity_internal(
            lead_id=lead_id,
            activity_type="lead_created",
            description=f"Lead manually created by {payload.get('created_by', 'system')}",
            created_by=payload.get("created_by", "system"),
            metadata={
                "source": "manual_entry",
                "name": lead_document["name"],
                "email": lead_document["email"],
                "phone": lead_document["phone"],
                "notes": lead_document.get("notes", "")
            }
        )
        
        # Format response
        response_lead = make_serializable(lead_document)
        
        return {
            "success": True,
            "message": "Lead created successfully",
            "lead": response_lead,
            "lead_id": lead_id,
            "created_at": current_time.isoformat(),
            "debug_notes": lead_document.get("notes", "NO_NOTES_IN_DOCUMENT")  # Debug field
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating manual lead: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")

@leads_router.get("/leads/{lead_id}", status_code=200)
async def get_lead_by_id(lead_id: str, current_user: Optional[dict] = Depends(lambda: None)):
    """Get a specific lead by ID (supports both ObjectId and lead_id) with hierarchy-based access control"""
    try:
        db = get_database()
        
        # Find the lead by either ObjectId or lead_id
        lead = find_lead_by_id_or_lead_id(lead_id)
        
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Apply hierarchy-based access control
        if current_user is None:
            # No authentication provided, skip hierarchy filtering (allow access for debugging)
            logger.info("No authentication provided for lead access, skipping hierarchy filtering")
        else:
            user_id = current_user.get("user_id") or current_user.get("id")
            user_roles = current_user.get("roles", [])
            
            # Check if user is admin - admins can see all leads
            is_admin = "admin" in user_roles or "admin" in current_user.get("token_data", {}).get("roles", [])
            
            if not is_admin:
                # For non-admin users, check if they have access to this lead
                lead_assigned_to = lead.get("assigned_to")
                lead_assigned_user_id = lead.get("assigned_user_id")
                lead_created_by = lead.get("created_by")
                
                has_access = False
                
                # Check if user is directly assigned or created the lead
                if lead_assigned_to == user_id or lead_assigned_user_id == user_id or lead_created_by == user_id:
                    has_access = True
                else:
                    # Check hierarchy - see if lead is assigned to/created by a subordinate
                    try:
                        subordinate_user_ids = await get_user_subordinates(user_id, db)
                        
                        if lead_assigned_to in subordinate_user_ids or lead_assigned_user_id in subordinate_user_ids or lead_created_by in subordinate_user_ids:
                            has_access = True
                            
                    except Exception as hierarchy_error:
                        logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
                
                if not has_access:
                    raise HTTPException(status_code=403, detail="Access denied: You don't have permission to view this lead")
        
        # Format the lead for API response
        formatted_lead = {}
        for key, value in lead.items():
            if key == "_id" or isinstance(value, ObjectId):
                formatted_lead[key] = str(value)
            elif isinstance(value, datetime.datetime):
                formatted_lead[key] = value.isoformat()
            elif isinstance(value, dict):
                # Handle nested dictionaries
                nested_dict = {}
                for k, v in value.items():
                    if isinstance(v, ObjectId):
                        nested_dict[k] = str(v)
                    elif isinstance(v, datetime.datetime):
                        nested_dict[k] = v.isoformat()
                    else:
                        nested_dict[k] = v
                formatted_lead[key] = nested_dict
            else:
                formatted_lead[key] = value
        
        return make_serializable(formatted_lead)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lead {lead_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get lead: {str(e)}")

@leads_router.get("/notes")
async def get_lead_notes(
    lead_id: Optional[str] = Query(None, description="Filter notes by lead ID"),
    created_by_me: Optional[bool] = Query(False, description="Filter notes created by current user only"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    current_user: dict = Depends(get_current_user)
):
    """Get lead notes with optional filtering by lead ID, creator, and hierarchy-based access control"""
    try:
        db = get_database()
        query = {}
        
        # Filter by lead_id if provided
        if lead_id:
            lead = find_lead_by_id_or_lead_id(lead_id)
            if lead:
                query["_id"] = lead["_id"]
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get notes from leads collection (assuming notes are stored in the lead documents)
        if lead_id:
            # If specific lead_id is provided, get notes from that lead
            lead = find_lead_by_id_or_lead_id(lead_id)
            if not lead:
                raise HTTPException(status_code=404, detail="Lead not found")
            
            # Apply hierarchy-based access control for the specific lead
            user_id = current_user.get("user_id") or current_user.get("id")
            logger.info(f"Notes requested by user: {user_id} for lead: {lead_id}")
            
            # Import HierarchyHelper
            from app.services.hierarchy_helper import HierarchyHelper
            
            # Check if user is admin - admins can see all lead notes
            is_admin = await HierarchyHelper.is_user_admin(user_id)
            
            if not is_admin:
                # For non-admin users, check if they have access to this lead
                lead_assigned_to = lead.get("assigned_to")
                lead_assigned_user_id = lead.get("assigned_user_id")
                lead_created_by = lead.get("created_by")
                
                has_access = False
                
                # Check if user is directly assigned or created the lead
                if lead_assigned_to == user_id or lead_assigned_user_id == user_id or lead_created_by == user_id:
                    has_access = True
                else:
                    # Check hierarchy - see if lead is assigned to/created by a subordinate
                    try:
                        can_access = await HierarchyHelper.can_access_resource(user_id, lead_assigned_to or lead_assigned_user_id or lead_created_by)
                        if can_access:
                            has_access = True
                            
                    except Exception as hierarchy_error:
                        logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
                
                # if not has_access:
                #     raise HTTPException(status_code=403, detail="Access denied: You don't have permission to view notes for this lead")
            
            notes = lead.get("notes", "")
            notes_list = []
            if notes:
                notes_list = [{
                    "id": str(lead["_id"]),
                    "lead_id": lead.get("lead_id", str(lead["_id"])),
                    "content": notes,
                    "created_at": lead.get("created_at", get_ist_timestamp_for_db()).isoformat(),
                    "updated_at": lead.get("updated_at", get_ist_timestamp_for_db()).isoformat()
                }]
            
            return make_serializable({
                "data": notes_list,
                "page": page,
                "limit": limit,
                "total": len(notes_list),
                "pages": 1
            })
        else:
            # Get all leads that have either notes or notes_array
            user_id = current_user.get("user_id") or current_user.get("id")
            logger.info(f"Notes requested by user: {user_id}")
            
            # Get user details to help with access control
            from app.database import find_user_by_id_or_user_id
            current_user_doc = find_user_by_id_or_user_id(user_id)
            current_user_name = current_user_doc.get("full_name") if current_user_doc else None
            current_user_username = current_user_doc.get("username") if current_user_doc else None
            
            # Import HierarchyHelper
            from app.services.hierarchy_helper import HierarchyHelper
            
            # Check if user is admin - admins can see all lead notes
            is_admin = await HierarchyHelper.is_user_admin(user_id)
            
            # Query for leads that have either notes or notes_array
            notes_query = {
                "$or": [
                    {"notes": {"$exists": True, "$ne": ""}},
                    {"notes_array": {"$exists": True, "$ne": []}}
                ]
            }
            
            if not is_admin:
                # For non-admin users, apply hierarchy filtering using HierarchyHelper
                try:
                    accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
                    logger.info(f"User {user_id} can access notes for users: {accessible_user_ids}")
                    
                    # Get user details for accessible users to create name mappings
                    accessible_user_names = []
                    accessible_user_usernames = []
                    
                    for acc_user_id in accessible_user_ids:
                        acc_user_doc = find_user_by_id_or_user_id(acc_user_id)
                        if acc_user_doc:
                            if acc_user_doc.get("name"):
                                accessible_user_names.append(acc_user_doc["name"])
                            if acc_user_doc.get("username"):
                                accessible_user_usernames.append(acc_user_doc["username"])
                    
                    # Combine notes filter with hierarchy filter - include user_id, username, and name matching
                    notes_query["$and"] = [
                        {
                            "$or": [
                                {"assigned_to": {"$in": accessible_user_ids + accessible_user_usernames}},
                                {"assigned_user_id": {"$in": accessible_user_ids + accessible_user_usernames}},
                                {"created_by": {"$in": accessible_user_ids + accessible_user_usernames}},
                                # Also check in notes_array for created_by names
                                {"notes_array.created_by": {"$in": accessible_user_names + accessible_user_ids + accessible_user_usernames}}
                            ]
                        }
                    ]
                    
                except Exception as hierarchy_error:
                    logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
                    # Fall back to user's own leads only - include name and username matching
                    user_identifiers = [user_id]
                    if current_user_name:
                        user_identifiers.append(current_user_name)
                    if current_user_username:
                        user_identifiers.append(current_user_username)
                    
                    notes_query["$and"] = [
                        {
                            "$or": [
                                {"assigned_to": {"$in": user_identifiers}},
                                {"assigned_user_id": {"$in": user_identifiers}},
                                {"created_by": {"$in": user_identifiers}},
                                {"notes_array.created_by": {"$in": user_identifiers}}
                            ]
                        }
                    ]
            
            leads_with_notes = list(db.leads.find(
                notes_query,
                {"_id": 1, "lead_id": 1, "notes": 1, "notes_array": 1, "created_at": 1, "updated_at": 1, "assigned_to": 1, "created_by": 1}
            ).skip(skip).limit(limit))
            
            total = db.leads.count_documents(notes_query)
            
            notes_list = []
            
            # Helper function to safely format datetime
            def safe_isoformat(dt_value):
                """Safely convert datetime to ISO format string"""
                if dt_value is None:
                    return get_ist_timestamp_for_db().isoformat()
                
                if isinstance(dt_value, str):
                    # Already a string, return as is or parse if needed
                    return dt_value
                
                if hasattr(dt_value, 'isoformat'):
                    # It's a datetime object
                    return dt_value.isoformat()
                
                # Fallback
                return str(dt_value)
            
            for lead in leads_with_notes:
                lead_id = lead.get("lead_id", str(lead["_id"]))
                
                # Add legacy notes if they exist
                notes = lead.get("notes", "")
                if notes:
                    notes_list.append({
                        "id": f"{str(lead['_id'])}_legacy",
                        "lead_id": lead_id,
                        "content": notes,
                        "created_by": lead.get("assigned_to", "System"),
                        "created_at": safe_isoformat(lead.get("created_at")),
                        "updated_at": safe_isoformat(lead.get("updated_at")),
                        "note_type": "legacy"
                    })
                
                # Add array-style notes if they exist
                notes_array = lead.get("notes_array", [])
                for note in notes_array:
                    notes_list.append({
                        "id": note.get("_id", str(ObjectId())),
                        "lead_id": lead_id,
                        "content": note.get("content", ""),
                        "created_by": note.get("created_by", lead.get("created_by", "System")),
                        "created_at": safe_isoformat(note.get("created_at")),
                        "updated_at": safe_isoformat(note.get("updated_at", note.get("created_at"))),
                        "note_type": "array"
                    })
            
            # Apply created_by_me filter if requested
            if created_by_me:
                # Get current user identifiers for filtering
                user_identifiers = [user_id]
                if current_user_name:
                    user_identifiers.append(current_user_name)
                if current_user_username:
                    user_identifiers.append(current_user_username)
                
                # Filter notes to only those created by current user
                notes_list = [note for note in notes_list 
                            if note.get("created_by") in user_identifiers]
                
                logger.info(f"Filtered to {len(notes_list)} notes created by user {user_id} (identifiers: {user_identifiers})")
            
            # Sort all notes by created_at in descending order (newest first)
            notes_list.sort(key=lambda x: x.get("created_at"), reverse=True)
            
            return make_serializable({
                "data": notes_list,
                "page": page,
                "limit": limit,
                "total": len(notes_list),  # Total notes returned (not total leads)
                "total_leads_with_notes": total,  # Total leads that have notes
                "pages": (total + limit - 1) // limit
            })
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lead notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get lead notes: {str(e)}")

@leads_router.post("/notes")
async def create_lead_note(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """Create or update a note for a lead"""
    try:
        lead_id = payload.get("lead_id")
        content = payload.get("content", "")
        created_by = current_user.get("full_name") or current_user.get("username") or current_user.get("user_id", "Unknown User")
        
        if not lead_id:
            raise HTTPException(status_code=400, detail="lead_id is required")
        
        db = get_database()
        
        # Get current lead to check if note exists
        current_lead = find_lead_by_id_or_lead_id(lead_id)
        if not current_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get the actual lead_id field from the document
        actual_lead_id = current_lead.get("lead_id", lead_id)
        previous_notes = current_lead.get("notes", "")
        
        # Update the lead with the new note
        result = db.leads.update_one(
            {"_id": current_lead["_id"]},
            {
                "$set": {
                    "notes": content,
                    "updated_at": get_ist_timestamp_for_db()
                }
            }
        )
        
        # Create activity for note update
        if previous_notes != content:
            description = f"Lead updated: notes: '{previous_notes or 'None'}' → '{content or 'None'}'"
            
            await create_lead_activity_internal(
                lead_id=actual_lead_id,  # Use actual lead_id field, not ObjectId
                activity_type="lead_updated",
                description=description,
                created_by=created_by,
                metadata={
                    "old_notes": previous_notes,
                    "new_notes": content
                }
            )
        return make_serializable({
            "success": True,
            "message": "Note updated successfully",
            "lead_id": lead_id,
            "content": content,
            "updated_at": get_ist_timestamp_for_db().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating/updating lead note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create/update note: {str(e)}")

@leads_router.post("/lead-notes", status_code=201)
async def create_lead_note(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """Create a new note for a lead as an array element"""
    try:
        lead_id = payload.get("lead_id")
        content = payload.get("content", "")
        created_by = current_user.get("full_name") or current_user.get("username") or current_user.get("user_id", "Unknown User")
        
        if not lead_id:
            raise HTTPException(status_code=400, detail="lead_id is required")
        if not content:
            raise HTTPException(status_code=400, detail="content is required")
        
        db = get_database()
        
        # Get current lead
        current_lead = find_lead_by_id_or_lead_id(lead_id)
        if not current_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Prepare the new note object with IST timestamp
        new_note = {
            "_id": str(ObjectId()),  # Generate a unique ID for the note
            "content": content,
            "created_by": created_by,
            "created_at": get_ist_timestamp_for_db(),
        }
        
        # Update the lead's notes array with IST timestamps
        result = db.leads.update_one(
            {"_id": current_lead["_id"]},
            {
                "$push": {
                    "notes_array": new_note  # Add to notes_array instead of replacing notes field
                },
                "$set": {
                    "updated_at": get_ist_timestamp_for_db()
                }
            }
        )
        
        # Create activity for note creation
        actual_lead_id = current_lead.get("lead_id", lead_id)
        await create_lead_activity_internal(
            lead_id=actual_lead_id,
            activity_type="note_added",
            description=f"Note added by {created_by}",
            created_by=created_by,
            metadata={
                "note_id": new_note["_id"],
                "content": content[:100] + "..." if len(content) > 100 else content
            }
        )
        
        return make_serializable({
            "success": True,
            "message": "Note added successfully",
            "lead_id": lead_id,
            "note": new_note
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding lead note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add note: {str(e)}")

@leads_router.get("/lead-notes/{lead_id}", status_code=200)
async def get_lead_notes(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for a specific lead with hierarchy-based access control (supports both ObjectId and lead_id)"""
    try:
        db = get_database()
        
        # Find the lead by either ObjectId or lead_id
        lead = find_lead_by_id_or_lead_id(lead_id)
        
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Apply hierarchy-based access control
        user_id = current_user.get("user_id") or current_user.get("id")
        logger.info(f"Lead notes requested by user: {user_id} for lead: {lead_id}")
        
        # Import HierarchyHelper
        from app.services.hierarchy_helper import HierarchyHelper
        
        # Check if user is admin - admins can see all lead notes
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if not is_admin:
            # For non-admin users, check if they have access to this lead
            lead_assigned_to = lead.get("assigned_to")
            lead_assigned_user_id = lead.get("assigned_user_id")
            lead_created_by = lead.get("created_by")
            
            has_access = False
            
            # Check if user is directly assigned or created the lead
            if lead_assigned_to == user_id or lead_assigned_user_id == user_id or lead_created_by == user_id:
                has_access = True
            else:
                # Check hierarchy - see if lead is assigned to/created by a subordinate
                try:
                    can_access = await HierarchyHelper.can_access_resource(user_id, lead_assigned_to or lead_assigned_user_id or lead_created_by)
                    if can_access:
                        has_access = True
                        
                except Exception as hierarchy_error:
                    logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
            
            # if not has_access:
            #     raise HTTPException(status_code=403, detail="Access denied: You don't have permission to view notes for this lead")
        
        # Get the notes array or return empty list if not found
        notes = lead.get("notes_array", [])
        
        # Sort notes by created_at in descending order (newest first)
        if notes:
            notes.sort(key=lambda x: x.get("created_at", datetime.datetime.min), reverse=True)
        
        # Format and return the notes
        return make_serializable({
            "lead_id": lead_id,
            "notes": notes
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lead notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get lead notes: {str(e)}")

# Modify the existing /notes endpoint to also return notes from the notes_array field
@leads_router.get("/notes")
async def get_lead_notes_legacy(
    lead_id: Optional[str] = Query(None, description="Filter notes by lead ID"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page")
):
    """Get lead notes with optional filtering by lead ID"""
    try:
        db = get_database()
        query = {}
        
        # Filter by lead_id if provided
        if lead_id:
            lead = find_lead_by_id_or_lead_id(lead_id)
            if lead:
                query["_id"] = lead["_id"]
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get notes from leads collection
        if lead_id:
            # If specific lead_id is provided, get notes from that lead
            lead = find_lead_by_id_or_lead_id(lead_id)
            if not lead:
                raise HTTPException(status_code=404, detail="Lead not found")
            
            # Check for both legacy notes and array-style notes
            notes = lead.get("notes", "")
            notes_array = lead.get("notes_array", [])
            
            notes_list = []
            
            # Add legacy notes if they exist
            if notes:
                notes_list.append({
                    "id": str(lead["_id"]),
                    "lead_id": lead.get("lead_id", str(lead["_id"])),
                    "content": notes,
                    "created_by": lead.get("assigned_to", "System"),
                    "created_at": lead.get("created_at", get_ist_timestamp_for_db()).isoformat(),
                    "updated_at": lead.get("updated_at", get_ist_timestamp_for_db()).isoformat()
                })
            
            # Add array-style notes if they exist
            if notes_array:
                for note in notes_array:
                    notes_list.append({
                        "id": note.get("_id", str(ObjectId())),
                        "lead_id": lead.get("lead_id", str(lead["_id"])),
                        "content": note.get("content", ""),
                        "created_by": note.get("created_by", "System"),
                        "created_at": note.get("created_at", get_ist_timestamp_for_db()).isoformat(),
                        "updated_at": note.get("updated_at", note.get("created_at", get_ist_timestamp_for_db())).isoformat()
                    })
            
            # Sort by created_at in descending order
            notes_list.sort(key=lambda x: x.get("created_at"), reverse=True)
            
            return make_serializable({
                "data": notes_list,
                "page": page,
                "limit": limit,
                "total": len(notes_list),
                "pages": 1
            })
        else:
            # Get all leads that have notes or notes_array
            leads_with_notes = list(db.leads.find(
                {
                    "$or": [
                        {"notes": {"$exists": True, "$ne": ""}},
                        {"notes_array": {"$exists": True, "$ne": []}}
                    ]
                },
                {
                    "_id": 1, 
                    "lead_id": 1, 
                    "notes": 1, 
                    "notes_array": 1, 
                    "created_at": 1, 
                    "updated_at": 1,
                    "assigned_to": 1
                }
            ).skip(skip).limit(limit))
            
            total = db.leads.count_documents({
                "$or": [
                    {"notes": {"$exists": True, "$ne": ""}},
                    {"notes_array": {"$exists": True, "$ne": []}}
                ]
            })
            
            notes_list = []
            for lead in leads_with_notes:
                # Add legacy notes
                if lead.get("notes"):
                    notes_list.append({
                        "id": str(lead["_id"]),
                        "lead_id": lead.get("lead_id", str(lead["_id"])),
                        "content": lead.get("notes", ""),
                        "created_by": lead.get("assigned_to", "System"),
                        "created_at": lead.get("created_at", get_ist_timestamp_for_db()).isoformat(),
                        "updated_at": lead.get("updated_at", get_ist_timestamp_for_db()).isoformat()
                    })
                
                # Add array notes
                for note in lead.get("notes_array", []):
                    notes_list.append({
                        "id": note.get("_id", str(ObjectId())),
                        "lead_id": lead.get("lead_id", str(lead["_id"])),
                        "content": note.get("content", ""),
                        "created_by": note.get("created_by", lead.get("assigned_to", "System")),
                        "created_at": note.get("created_at", get_ist_timestamp_for_db()).isoformat(),
                        "updated_at": note.get("updated_at", note.get("created_at", get_ist_timestamp_for_db())).isoformat()
                    })
            
            # Sort by created_at in descending order
            notes_list.sort(key=lambda x: x.get("created_at"), reverse=True)
            
            return make_serializable({
                "data": notes_list,
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            })
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lead notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get lead notes: {str(e)}")

# Update the existing notes POST endpoint to support both legacy and array notes
@leads_router.post("/notes")
async def create_lead_note_legacy(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """Create or update a note for a lead - supports both legacy and array notes"""
    try:
        lead_id = payload.get("lead_id")
        content = payload.get("content", "")
        created_by = current_user.get("full_name") or current_user.get("username") or current_user.get("user_id", "Unknown User")
        use_array = payload.get("use_array", True)  # Default to array style
        
        if not lead_id:
            raise HTTPException(status_code=400, detail="lead_id is required")
        
        db = get_database()
        
        # Get current lead to check if note exists
        current_lead = find_lead_by_id_or_lead_id(lead_id)
        if not current_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get the actual lead_id field from the document
        actual_lead_id = current_lead.get("lead_id", lead_id)
        
        if use_array:
            # Use the new array style notes
            new_note = {
                "_id": str(ObjectId()),
                "content": content,
                "created_by": created_by,
                "created_at": get_ist_timestamp_for_db(),
            }
            result = db.leads.update_one(
                {"_id": current_lead["_id"]},
                {
                    "$push": {"notes_array": new_note},
                    "$set": {"updated_at": get_ist_timestamp_for_db()}
                }
            )
            await create_lead_activity_internal(
                lead_id=actual_lead_id,
                activity_type="note_added",
                description=f"Note added by {created_by}",
                created_by=created_by,
                metadata={
                    "note_id": new_note["_id"],
                    "content": content[:100] + "..." if len(content) > 100 else content
                }
            )
            return make_serializable({
                "success": True,
                "message": "Note added successfully",
                "lead_id": lead_id,
                "note": new_note,
                "updated_at": get_ist_timestamp_for_db().isoformat()
            })
        else:
            previous_notes = current_lead.get("notes", "")
            try:
                result = db.leads.update_one(
                    {"_id": current_lead["_id"]},
                    {
                        "$set": {
                            "notes": content,
                            "updated_at": get_ist_timestamp_for_db()
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Error updating lead notes: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to update notes: {str(e)}")
            if previous_notes != content:
                description = f"Lead updated: notes: '{previous_notes or 'None'}' → '{content or 'None'}'"
                await create_lead_activity_internal(
                    lead_id=actual_lead_id,
                    activity_type="lead_updated",
                    description=description,
                    created_by=created_by,
                    metadata={
                        "old_notes": previous_notes,
                        "new_notes": content
                    }
                )
            return make_serializable({
                "success": True,
                "message": "Note updated successfully (legacy mode)",
                "lead_id": lead_id,
                "content": content,
                "updated_at": get_ist_timestamp_for_db().isoformat()
            })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating/updating lead note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create/update note: {str(e)}")


# Endpoint: Get paginated lead activities (optionally exclude import activities)
@leads_router.get("/lead-activities", status_code=200)
async def get_lead_activities(
    page: int = Query(1, description="Page number"),
    limit: int = Query(20, description="Items per page"),
    exclude_imports: bool = Query(False, description="Exclude import activities")
):
    """Get paginated lead activities, optionally excluding import activities"""
    try:
        db = get_database()
        query = {}
        if exclude_imports:
            query["activity_type"] = {"$ne": "import"}
        skip = (page - 1) * limit
        total = db.lead_activities.count_documents(query)
        activities = list(db.lead_activities.find(query).sort("created_at", -1).skip(skip).limit(limit))
        serializable_activities = [make_serializable(a) for a in activities]
        return {
            "data": serializable_activities,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error getting lead activities: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get lead activities: {str(e)}")



# Endpoint: Upload follow-ups to database, set follow_up_date accordingly
@leads_router.post("/followups/upload", status_code=201)
async def upload_followups(followups: List[Dict[str, Any]] = Body(...)):
    """Upload a list of follow-ups and update each lead's follow_up_notes and follow_up_date."""
    try:
        db = get_database()
        updated = 0
        errors = []
        for item in followups:
            lead_id = item.get("lead_id")
            follow_up_notes = item.get("follow_up_notes", [])
            follow_up_date = item.get("follow_up_date")
            # Parse date if string
            if isinstance(follow_up_date, str):
                try:
                    follow_up_date = datetime.datetime.fromisoformat(follow_up_date)
                except Exception:
                    errors.append({"lead_id": lead_id, "error": "Invalid follow_up_date format"})
                    continue
            # Find lead using helper function
            lead = find_lead_by_id_or_lead_id(lead_id)
            if lead:
                try:
                    result = db.leads.update_one(
                        {"_id": lead["_id"]},
                        {"$set": {
                            "follow_up_notes": follow_up_notes,
                            "follow_up_date": follow_up_date,
                            "updated_at": get_ist_timestamp_for_db()
                        }}
                    )
                    if result.matched_count:
                        updated += 1
                    else:
                        errors.append({"lead_id": lead_id, "error": "Lead not found"})
                except Exception as e:
                    errors.append({"lead_id": lead_id, "error": str(e)})
            else:
                errors.append({"lead_id": lead_id, "error": "Lead not found"})
        return {"updated": updated, "errors": errors}
    except Exception as e:
        logger.error(f"Error uploading followups: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload followups: {str(e)}")
    
# Bulk assign endpoint: assign multiple leads at once, enforcing hierarchy
@leads_router.post("/bulk-assign", status_code=200)
async def bulk_assign_leads(payload: List[Dict[str, Any]] = Body(...)):
    """
    Bulk assign leads. Each item in the payload should have lead_id, assigned_to, assigned_by.
    Enforces the same hierarchy as single assignment.
    """
    db = get_database()
    results = []
    for item in payload:
        lead_id = item.get("lead_id")
        assigned_to = item.get("assigned_to")
        assigned_by = item.get("assigned_by", "system")
        if not lead_id or not assigned_to:
            results.append({"lead_id": lead_id, "status": "error", "detail": "lead_id and assigned_to are required."})
            continue
        # Get current lead data before update
        current_lead = find_lead_by_id_or_lead_id(lead_id)
        if not current_lead:
            results.append({"lead_id": lead_id, "status": "error", "detail": "Lead not found."})
            continue
        old_assigned_to = current_lead.get("assigned_to", "Unassigned")
        actual_lead_id = current_lead.get("lead_id", lead_id)

        # Helper function to resolve user ID to name for display
        def resolve_user_display_name(user_identifier):
            """Resolve user ID or name to display format: 'Name - Role'"""
            if not user_identifier or user_identifier in ['Unassigned', 'unassigned']:
                return 'Unassigned'
            
            # Try to find user by user_id first
            user = db.users.find_one({"user_id": user_identifier})
            if not user:
                # Try to find by username as fallback
                user = db.users.find_one({"username": user_identifier})
            if not user:
                # Try to find by full_name as fallback
                user = db.users.find_one({"full_name": user_identifier})
            
            if user:
                # Get role name
                role_name = 'Unknown Role'
                if user.get('role_ids') and len(user['role_ids']) > 0:
                    role = db.roles.find_one({"id": user['role_ids'][0]})
                    if role:
                        role_name = role.get('name', 'Unknown Role')
                elif user.get('roles'):
                    role_name = user['roles'][0] if isinstance(user['roles'], list) else user['roles']
                
                return f"{user.get('full_name', user.get('username', 'Unknown User'))} - {role_name}"
            
            # If user not found, return the identifier as-is
            return user_identifier

        # Resolve assigned_to to user display name for storage
        display_assigned_to = resolve_user_display_name(assigned_to)

        # --- Hierarchy enforcement logic (same as /assign) ---
        roles = list(db.roles.find())
        name_to_role = {r.get("name"): r for r in roles}
        id_to_role = {r.get("id"): r for r in roles}
        assigned_by_role = None
        assigned_to_role = None
        for r in roles:
            if (r.get("name") == assigned_by) or (str(r.get("id")) == str(assigned_by)):
                assigned_by_role = r
            if (r.get("name") == assigned_to) or (str(r.get("id")) == str(assigned_to)):
                assigned_to_role = r
        if not assigned_by_role:
            assigned_by_role = name_to_role.get(assigned_by)
        if not assigned_to_role:
            assigned_to_role = name_to_role.get(assigned_to)
        if not assigned_by_role:
            assigned_by_role = id_to_role.get(assigned_by)
        if not assigned_to_role:
            assigned_to_role = id_to_role.get(assigned_to)
        # If still not found, allow (legacy), but warn
        if not assigned_by_role or not assigned_to_role:
            pass
        else:
            # Apply relaxed hierarchy rules: allow managers to assign their leads to subordinates
            if assigned_by_role["name"].lower() == "admin":
                allowed_roles = ["manager", "sales_manager"]
                if assigned_to_role["name"].lower() not in allowed_roles:
                    results.append({"lead_id": lead_id, "status": "error", "detail": f"Admin can only assign to {', '.join(allowed_roles)}."})
                    continue
            elif assigned_by_role["name"].lower() == "manager":
                if assigned_to_role["name"].lower() != "executive":
                    results.append({"lead_id": lead_id, "status": "error", "detail": "Manager can only assign to executives."})
                    continue
            elif assigned_by_role["name"].lower() == "sales_manager":
                allowed_roles = ["team member", "team_member", "team"]
                if assigned_to_role["name"].lower() not in allowed_roles:
                    results.append({"lead_id": lead_id, "status": "error", "detail": "Sales_manager can only assign to team members."})
                    continue
            elif assigned_by_role["name"].lower() in ["executive", "team", "team_member"]:
                results.append({"lead_id": lead_id, "status": "error", "detail": f"{assigned_by_role['name']} cannot assign leads."})
                continue

        # Update the lead - Store ID in assigned_to, display name in assigned_to_display
        update_query = {"$set": {
            "assigned_to": assigned_to,           # Store ID as primary reference
            "assigned_to_display": display_assigned_to,  # Store display name for UI
            "assigned_user_id": assigned_to,      # Keep this for backward compatibility
            "updated_at": get_ist_timestamp_for_db(),
            "assigned_by": assigned_by
        }}
        
        # Use both _id and lead_id to find the lead for update
        result = None
        if current_lead.get("_id"):
            result = db.leads.update_one({"_id": current_lead["_id"]}, update_query)
        elif current_lead.get("lead_id"):
            result = db.leads.update_one({"lead_id": current_lead["lead_id"]}, update_query)
        
        if not result or result.matched_count == 0:
            results.append({"lead_id": lead_id, "status": "error", "detail": "Lead not found after update."})
            continue
        # Create activity for assignment change
        if old_assigned_to != assigned_to:  # Compare IDs for actual change detection
            await create_lead_activity_internal(
                lead_id=actual_lead_id,
                activity_type="lead_updated",
                description=f"Lead updated: assigned_to: '{old_assigned_to}' → '{display_assigned_to}'",
                created_by=assigned_by or "system",
                metadata={
                    "old_assigned_to": old_assigned_to,
                    "new_assigned_to": assigned_to,           # Store ID in metadata
                    "new_assigned_to_display": display_assigned_to,  # Store display name in metadata
                    "assigned_by": assigned_by,
                    "assigned_user_id": assigned_to           # Keep this for backward compatibility
                }
            )
        results.append({
            "lead_id": lead_id, 
            "status": "success", 
            "assigned_to": assigned_to,               # ID for backend reference
            "assigned_to_display": display_assigned_to, # Display name for UI
            "assigned_user_id": assigned_to           # Keep for backward compatibility
        })
    return {"results": results, "count": len(results)}




# Helper function to access the duplicate leads collection
def duplicate_leads_collection():
    db = get_database()
    return db.duplicate_leads

@leads_router.get("/duplicate-leads", status_code=200)
async def get_duplicate_leads(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    original_lead_id: Optional[str] = Query(None, description="Filter by original lead ID")
):
    """Get paginated duplicate leads with optional filtering by original lead ID"""
    try:
        query = {}
        
        # Filter by original_lead_id if provided
        if original_lead_id:
            query["original_lead_id"] = original_lead_id
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get duplicate leads using the helper function
        duplicate_leads = list(duplicate_leads_collection().find(query).skip(skip).limit(limit).sort("duplicate_created_at", -1))
        total = duplicate_leads_collection().count_documents(query)
        
        # Format leads for API response
        formatted_leads = []
        for lead in duplicate_leads:
            # Deep-copy the lead to avoid modifying the original
            formatted_lead = {}
            
            # Convert all fields, handling special types
            for key, value in lead.items():
                if key == "_id" or isinstance(value, ObjectId):
                    formatted_lead[key] = str(value)
                elif isinstance(value, datetime.datetime):
                    formatted_lead[key] = value.isoformat()
                elif isinstance(value, dict):
                    # Handle nested dictionaries
                    nested_dict = {}
                    for k, v in value.items():
                        if isinstance(v, ObjectId):
                            nested_dict[k] = str(v)
                        elif isinstance(v, datetime.datetime):
                            nested_dict[k] = v.isoformat()
                        else:
                            nested_dict[k] = v
                    formatted_lead[key] = nested_dict
                else:
                    formatted_lead[key] = value
                    
            formatted_leads.append(formatted_lead)
        
        # Create a response that's guaranteed to be JSON serializable
        response = {
            "data": formatted_leads,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "timestamp": get_ist_timestamp_for_db().strftime("%Y-%m-%d %H:%M:%S"),
            "user": "soheruINFO"
        }
        
        return make_serializable(response)
    except Exception as e:
        logger.error(f"Error getting duplicate leads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get duplicate leads: {str(e)}")

@leads_router.get("/duplicate-leads/all", status_code=200)
async def get_all_duplicate_leads(current_user: dict = Depends(get_current_user)):
    """Get all duplicate leads with hierarchy-based access control (same as regular leads)"""
    try:
        from app.database import find_user_by_id_or_user_id
        
        db = get_database()
        query = {}
        
        # Apply organizational hierarchy-based filtering (same logic as regular leads)
        user_id = current_user.get("user_id") or current_user.get("id")
        user_roles = current_user.get("roles", [])
        
        # Debug current user
        logger.info(f"Debug - Duplicate leads for user: {user_id}, roles: {user_roles}")
        
        # Check if user is admin or high-level manager - they can see all duplicate leads
        is_admin = "admin" in user_roles or "admin" in current_user.get("token_data", {}).get("roles", [])
        
        # Also check if user has a high-level role (company_manager, director, etc.)
        is_high_level = False
        try:
            db_user = db.users.find_one({"user_id": user_id})
            if db_user and db_user.get("role_ids"):
                user_role = db.roles.find_one({"id": db_user["role_ids"][0]})
                if user_role:
                    role_name = user_role.get("name", "").lower()
                    # High-level roles that can see all duplicate leads
                    high_level_roles = ["admin", "director", "company_manager", "sales_head"]
                    is_high_level = role_name in high_level_roles
                    logger.info(f"User {user_id} has role {role_name}, is_high_level: {is_high_level}")
        except Exception as role_check_error:
            logger.warning(f"Error checking user role for {user_id}: {str(role_check_error)}")
        
        logger.info(f"Debug - Is admin: {is_admin}, Is high level: {is_high_level}")
        
        if not (is_admin or is_high_level):
            # For non-admin users, get their team structure to determine accessible duplicate leads
            try:
                accessible_user_ids = [user_id]  # Always include the user's own ID
                logger.info(f"Debug - Initial accessible IDs: {accessible_user_ids}")
                
                # Add subordinates' user IDs to accessible list
                subordinate_user_ids = await get_user_subordinates(user_id, db)
                accessible_user_ids.extend(subordinate_user_ids)
                
                # Create hierarchy conditions - Check both assigned_to and assigned_user_id fields
                hierarchy_conditions = [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}},
                    {"assigned_to": user_id},  # Direct assignment
                    {"assigned_user_id": user_id},  # Direct assignment (alternate field)
                    # Also check import-related fields for duplicate leads
                    {"import_user": {"$in": accessible_user_ids}},
                    {"import_user_id": {"$in": accessible_user_ids}}
                ]
                
                query["$or"] = hierarchy_conditions
                logger.info(f"Debug - Applied hierarchy filter with {len(accessible_user_ids)} accessible users")
                
            except Exception as hierarchy_error:
                logger.warning(f"Hierarchy service failed for user {user_id}: {str(hierarchy_error)}")
                # Fall back to user's own duplicate leads only
                query["$or"] = [
                    {"assigned_to": user_id},
                    {"assigned_user_id": user_id},
                    {"created_by": user_id},
                    {"import_user": user_id}
                ]
        else:
            logger.info(f"User {user_id} is admin/high-level, can see all duplicate leads")

        # Get duplicate leads using the query with hierarchy filtering
        duplicate_leads = list(duplicate_leads_collection().find(query).sort("duplicate_created_at", -1))
        
        # Format leads for API response
        formatted_leads = []
        for lead in duplicate_leads:
            formatted_lead = {}
            
            # Convert all fields, handling special types
            for key, value in lead.items():
                if key == "_id" or isinstance(value, ObjectId):
                    formatted_lead[key] = str(value)
                elif isinstance(value, datetime.datetime):
                    formatted_lead[key] = value.isoformat()
                elif isinstance(value, dict):
                    # Handle nested dictionaries
                    nested_dict = {}
                    for k, v in value.items():
                        if isinstance(v, ObjectId):
                            nested_dict[k] = str(v)
                        elif isinstance(v, datetime.datetime):
                            nested_dict[k] = v.isoformat()
                        else:
                            nested_dict[k] = v
                    formatted_lead[key] = nested_dict
                else:
                    formatted_lead[key] = value
                    
            formatted_leads.append(formatted_lead)
        
        # Create a response
        response = {
            "data": formatted_leads,
            "total": len(formatted_leads),
            "timestamp": get_ist_timestamp_for_db().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        return make_serializable(response)
    except Exception as e:
        logger.error(f"Error getting all duplicate leads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get all duplicate leads: {str(e)}")

@leads_router.post("/duplicate-leads", status_code=201)
async def create_duplicate_lead(payload: Dict[str, Any] = Body(...)):
    """Create a new duplicate lead entry"""
    try:
        # Validate required fields
        if not payload.get("original_lead_id") or not payload.get("duplicate_lead_id"):
            raise HTTPException(status_code=400, detail="original_lead_id and duplicate_lead_id are required")
        
        # Create the duplicate lead document
        current_time = get_ist_timestamp_for_db()
        
        duplicate_lead_document = {
            "_id": ObjectId(),
            "original_lead_id": payload.get("original_lead_id"),
            "duplicate_lead_id": payload.get("duplicate_lead_id"),
            "duplicate_created_at": current_time,
            "duplicate_created_by": payload.get("created_by", "system"),
            "duplicate_reason": payload.get("reason", "Duplicate detected"),
            "duplicate_details": payload.get("details", {}),
            "duplicate_status": payload.get("status", "detected"),
            "merge_status": payload.get("merge_status", "pending"),
            "metadata": payload.get("metadata", {})
        }
        
        # Insert the duplicate lead
        result = duplicate_leads_collection().insert_one(duplicate_lead_document)
        
        # Format response
        response_data = {
            "success": True,
            "message": "Duplicate lead created successfully",
            "duplicate_id": str(result.inserted_id),
            "original_lead_id": payload.get("original_lead_id"),
            "duplicate_lead_id": payload.get("duplicate_lead_id"),
            "created_at": current_time.isoformat()
        }
        
        return make_serializable(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating duplicate lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create duplicate lead: {str(e)}")
