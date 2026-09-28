# from fastapi import (
#     APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form, Body, Query, Request
# )
# import logging
# from typing import List, Optional, Dict, Any
# import io
# import datetime
# import pandas as pd
# import json
# from bson import ObjectId


# from app.database import (
#     insert_lead, update_lead_source, find_duplicate_lead, get_database
# )

# from app.routes.auth import SALES_USERS
# from app.database.schemas.lead_integration import LeadAssignmentUpdate,flatten_lead_data

# # Configure logger
# logger = logging.getLogger(__name__)

# # Initialize router with proper settings
# leads_router = APIRouter(prefix="/api/lead", tags=["leads"])

# # Utility function to make MongoDB documents JSON-serializable
# def make_serializable(obj):
#     """Convert MongoDB document to JSON-serializable dictionary."""
#     if isinstance(obj, dict):
#         return {k: make_serializable(v) for k, v in obj.items()}
#     elif isinstance(obj, list):
#         return [make_serializable(item) for item in obj]
#     elif isinstance(obj, ObjectId):
#         return str(obj)
#     elif isinstance(obj, datetime.datetime):
#         return obj.isoformat()
#     else:
#         return obj

# # Helper function to handle MongoDB object serialization issues
# def safe_get(data, key, default=None):
#     """Get value from dict and handle ObjectId conversion if needed"""
#     value = data.get(key, default)
#     if isinstance(value, ObjectId):
#         return str(value)
#     return value

# # Helper function to process and insert a lead, avoiding code duplication
# async def process_and_insert_lead(lead_data: Dict, lead_id: str, idx: int, source: str = None, source_id: str = None) -> Dict:
#     """
#     Process a lead, check for duplicates, and insert if not duplicate.
#     Returns: (processed_lead, is_duplicate)
#     """
#     # Create current timestamps
#     current_time = datetime.datetime.now()
    
#     # Create lead with the exact structure needed (ensuring ObjectId is properly handled)
#     lead = {
#         "_id": ObjectId(),  # Always create a fresh ObjectId
#         "lead_id": lead_id,
#         "lead_key": f"lead{idx}",
#         "source": source or safe_get(lead_data, "source", ""),
#         "source_id": source_id or safe_get(lead_data, "source_id", ""),
#         "email": safe_get(lead_data, "email", ""),
#         "phone": safe_get(lead_data, "phone", ""),
#         "campaign": safe_get(lead_data, "campaign"),
#         "status": safe_get(lead_data, "status", "new"),
#         "assigned_to": safe_get(lead_data, "assigned_to"),
#         "assigned_by": safe_get(lead_data, "assigned_by"),
#         "created_at": lead_data.get("created_at", current_time),
#         "updated_at": lead_data.get("updated_at", current_time),
#         "notes": safe_get(lead_data, "notes"),
#         "name": safe_get(lead_data, "name", ""),
#         "created": safe_get(lead_data, "created", current_time.strftime("%m/%d/%Y %I:%M %p")),
#         "form": safe_get(lead_data, "form", ""),
#         "channel": safe_get(lead_data, "channel", ""),
#         "stage": safe_get(lead_data, "stage", "Intake"),
#         "owner": safe_get(lead_data, "owner", "Unassigned"),
#         "labels": safe_get(lead_data, "labels", ""),
#         "secondary_phone_number": safe_get(lead_data, "secondary_phone_number", "")
#     }
    
#     # Extract any additional fields from raw_data if present
#     if "raw_data" in lead_data:
#         for key, value in lead_data["raw_data"].items():
#             # Map common field names to our standard structure
#             if key.lower() in ["email", "mail"] and not lead["email"]:
#                 lead["email"] = value
#             elif key.lower() in ["phone", "mobile", "cell"] and not lead["phone"]:
#                 lead["phone"] = value
#             elif key.lower() in ["name", "full_name", "fullname"] and not lead["name"]:
#                 lead["name"] = value
    
#     # Check for duplicates by email or phone
#     email = lead.get("email")
#     phone = lead.get("phone")
    
#     if email or phone:
#         duplicate = await find_duplicate_lead(email, phone)
#         if duplicate:
#             logger.info(f"Duplicate lead found: {email or phone}")
#             return None, True
    
#     # Insert the lead directly (no need for flatten_lead_data)
#     await insert_lead(lead)
#     return lead, False

# @leads_router.post("/integrations/google-sheets", status_code=200)
# async def import_from_google_sheets(payload: Dict = Body(...)):
#     logger.info(f"Processing Google Sheets import request at {datetime.datetime.now()}")
#     try:
#         spreadsheet_url = payload.get("spreadsheet_url")
#         if not spreadsheet_url:
#             raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")

#         sheet_name = payload.get("sheet_name", "Sheet1")
#         header_row = payload.get("header_row", 1)
#         original_mapping = payload.get("mapping", {})
#         logger.info(f"Original mapping type: {type(original_mapping)}")

#         # Ensure mapping is a dictionary
#         if not isinstance(original_mapping, dict):
#             try:
#                 if isinstance(original_mapping, list):
#                     mapping = {}
#                     for item in original_mapping:
#                         if isinstance(item, dict) and "key" in item and "value" in item:
#                             mapping[item["key"]] = item["value"]
#                 else:
#                     mapping = dict(original_mapping) if hasattr(original_mapping, "__iter__") else {}
#                 logger.info(f"Converted mapping to: {mapping}")
#             except Exception as e:
#                 logger.error(f"Failed to convert mapping: {str(e)}")
#                 mapping = {}
#         else:
#             mapping = original_mapping

#         from app.database.integration.google_sheets import process_google_sheets

#         # Add force_resync option to reprocess all rows
#         force_resync = payload.get("force_resync", False)
#         logger.info(f"Force resync option: {force_resync}")

#         # Extract spreadsheet ID for resync logic
#         import re
#         spreadsheet_id_match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', spreadsheet_url)
#         spreadsheet_id = None
#         if spreadsheet_id_match:
#             spreadsheet_id = spreadsheet_id_match.group(1)
#         else:
#             # If URL doesn't match, maybe it's just the ID
#             spreadsheet_id = spreadsheet_url.strip()

#         # If force_resync is True, reset the last_synced_row to force reprocessing
#         if force_resync and spreadsheet_id:
#             db = get_database()
#             logger.info(f"Resetting sync for spreadsheet: {spreadsheet_id}")
#             # Reset the last_synced_row to header_row to reprocess all data
#             result = db.lead_sources.update_one(
#                 {"integration_id": spreadsheet_id},
#                 {"$set": {"last_synced_row": header_row}},
#                 upsert=True
#             )
#             logger.info(f"Reset result: modified={result.modified_count}, upserted={result.upserted_id}")

#         # Process the Google Sheets data - now returns leads with flat schema
#         result = await process_google_sheets(
#             spreadsheet_url,
#             sheet_name=sheet_name,
#             header_row=header_row,
#             mapping=mapping
#         )

#         logger.info(f"Google Sheets processing result: {result}")
        
#         # Make sure all data is JSON serializable
#         if "leads" in result:
#             result["leads"] = [make_serializable(lead) for lead in result["leads"]]
        
#         # Add any additional metadata needed for the response
#         result["imported"] = len(result.get("leads", []))
#         result["duplicates"] = result.get("duplicates", 0)
        
#         return make_serializable(result)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error processing Google Sheets request: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))


# @leads_router.post("/integrations/excel", status_code=201)
# async def import_from_excel(
#     file: UploadFile = File(...),
#     sheet_name: Optional[str] = Form("Sheet1"),
#     header_row: int = Form(0),
#     mapping: str = Form("{}")
# ):
#     try:
#         if not file.filename.endswith(('.xlsx', '.xls')):
#             logger.error(f"Invalid file type: {file.filename}")
#             raise HTTPException(status_code=400, detail="File must be an Excel spreadsheet (.xlsx or .xls)")

#         try:
#             mapping_dict = json.loads(mapping)
#             logger.info(f"Mapping parsed successfully: {mapping_dict}")
#         except json.JSONDecodeError as e:
#             logger.error(f"Invalid mapping JSON: {mapping} - Error: {str(e)}")
#             raise HTTPException(status_code=400, detail=f"Invalid mapping JSON format: {str(e)}")

#         contents = await file.read()
#         try:
#             df = pd.read_excel(
#                 io.BytesIO(contents),
#                 sheet_name=sheet_name,
#                 header=header_row
#             )
#             if df.empty:
#                 return {"message": "Excel file contains no data", "count": 0}

#             new_leads_count = 0
#             duplicate_count = 0
#             error_count = 0
#             all_leads = []
#             lead_index = 1  # For lead00X

#             for idx, (_, row) in enumerate(df.iterrows()):
#                 try:
#                     lead_id = f"lead{lead_index:03}"
#                     lead_index += 1

#                     row_data = row.to_dict()
#                     if not any(str(v).strip() for v in row_data.values() if v is not None):
#                         continue
                        
#                     # Create initial lead data with raw data
#                     lead = {
#                         "raw_data": row_data,
#                         "status": "new",
#                         "stage": "Intake",
#                         "owner": "Unassigned"
#                     }
                    
#                     # Add mapped fields from Excel
#                     for field, header in mapping_dict.items():
#                         if header in row_data:
#                             lead[field] = row_data[header]
                    
#                     # Use helper function to process and insert lead
#                     processed_lead, is_duplicate = await process_and_insert_lead(
#                         lead_data=lead,
#                         lead_id=lead_id,
#                         idx=idx,
#                         source="excel",
#                         source_id=file.filename
#                     )
                    
#                     if is_duplicate:
#                         duplicate_count += 1
#                         continue
                        
#                     if processed_lead:
#                         all_leads.append(processed_lead)
#                         new_leads_count += 1
#                 except Exception as row_error:
#                     error_count += 1
#                     logger.error(f"Error processing row {idx}: {str(row_error)}")

#             source_id = f"excel_{file.filename}_{datetime.datetime.now().isoformat()}"
#             await update_lead_source(source_id, {
#                 "name": f"Excel: {file.filename}",
#                 "source_type": "excel",
#                 "integration_id": source_id,
#                 "mapping": mapping_dict,
#                 "last_sync_time": datetime.datetime.now(),
#                 "metadata": {
#                     "filename": file.filename,
#                     "sheet_name": sheet_name,
#                     "header_row": header_row
#                 }
#             })

#             # Make sure all leads are serializable
#             serialized_leads = [make_serializable(lead) for lead in all_leads]
            
#             return {
#                 "success": True,
#                 "message": f"Successfully imported {new_leads_count} leads from Excel",
#                 "file_name": file.filename,
#                 "total_rows": len(df),
#                 "imported": new_leads_count,
#                 "duplicates": duplicate_count,
#                 "errors": error_count,
#                 "timestamp": "2025-06-05 12:32:58",
#                 "user": "soheruINFO",
#                 "leads": serialized_leads
#             }

#         except Exception as e:
#             logger.error(f"Error processing Excel data: {str(e)}", exc_info=True)
#             raise HTTPException(status_code=500, detail=f"Error processing Excel data: {str(e)}")

#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error processing Excel file: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))

# @leads_router.get("/users/sales")
# async def get_sales_users(role: Optional[str] = Query(None)):
#     """Get all sales team users, optionally filtered by role"""
#     try:
#         db = get_database()

#         def to_dict(user):
#             if hasattr(user, "model_dump"):
#                 return user.model_dump()
#             if hasattr(user, "dict"):
#                 return user.dict()
#             return user

#         users = SALES_USERS
#         if role:
#             users = [user for user in SALES_USERS if getattr(user, "role", None) == role or (isinstance(user, dict) and user.get("role") == role)]
#         return [to_dict(user) for user in users]

#     except Exception as e:
#         logger.error(f"Error getting sales users: {e}")
#         raise HTTPException(status_code=500, detail=f"Failed to get sales users: {str(e)}")

# @leads_router.get("/assignments")
# async def get_lead_assignments():
#     """Get all lead assignments"""
#     try:
#         db = get_database()
#         lead_assignments_collection = db.lead_assignments

#         assignments = list(lead_assignments_collection.find())
#         for assignment in assignments:
#             assignment["id"] = str(assignment["_id"])
#             assignment.pop("_id", None)
#         return assignments
#     except Exception as e:
#         logger.error(f"Error getting assignments: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to get assignments: {str(e)}")

# # @leads_router.post("/assignments")
# # async def create_lead_assignment(assignment: LeadAssignmentModel):
# #     """Create or update a lead assignment"""
# #     try:
# #         db = get_database()
# #         lead_assignments_collection = db.lead_assignments

# #         existing_assignment = lead_assignments_collection.find_one({"lead_id": assignment.lead_id})

# #         try:
# #             assignment_dict = assignment.model_dump()
# #         except AttributeError:
# #             assignment_dict = assignment.dict()

# #         current_time = datetime.datetime.now()

# #         if existing_assignment:
# #             assignment_dict["updated_at"] = current_time
# #             lead_assignments_collection.update_one(
# #                 {"lead_id": assignment.lead_id},
# #                 {"$set": assignment_dict}
# #             )
# #             updated_assignment = lead_assignments_collection.find_one({"lead_id": assignment.lead_id})
# #             updated_assignment["id"] = str(updated_assignment["_id"])
# #             updated_assignment.pop("_id", None)
# #             return updated_assignment
# #         else:
# #             assignment_dict["created_at"] = current_time
# #             assignment_dict["updated_at"] = current_time
# #             result = lead_assignments_collection.insert_one(assignment_dict)
# #             new_assignment = lead_assignments_collection.find_one({"_id": result.inserted_id})
# #             new_assignment["id"] = str(new_assignment["_id"])
# #             new_assignment.pop("_id", None)
# #             return new_assignment
# #     except Exception as e:
# #         logger.error(f"Error creating assignment: {str(e)}")
# #         raise HTTPException(status_code=500, detail=f"Failed to create assignment: {str(e)}")



# @leads_router.post("/assign", status_code=200)
# async def assign_lead(update: LeadAssignmentUpdate):
#     """
#     Assign/Update a lead's owner.
#     """
#     db = get_database()
#     lead_id = update.lead_id
#     assigned_to = update.assigned_to

#     # Get current lead data before update
#     current_lead = db.leads.find_one({"_id": ObjectId(lead_id)})
#     if not current_lead:
#         raise HTTPException(status_code=404, detail="Lead not found.")
    
#     old_assigned_to = current_lead.get("assigned_to", "Unassigned")
#     actual_lead_id = current_lead.get("lead_id", lead_id)

#     # Find and update the lead
#     result = db.leads.update_one(
#         {"_id": ObjectId(lead_id)},
#         {"$set": {
#             "assigned_to": assigned_to,
#             "updated_at": datetime.datetime.now(),
#             "assigned_by": update.assigned_by
#         }}
#     )
#     if result.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Lead not found.")
    
#     # Create activity for assignment change
#     if old_assigned_to != assigned_to:
#         await create_lead_activity_internal(
#             lead_id=actual_lead_id,
#             activity_type="lead_updated",
#             description=f"Lead updated: assigned_to: '{old_assigned_to}' → '{assigned_to}'",
#             created_by=update.assigned_by or "system",
#             metadata={
#                 "old_assigned_to": old_assigned_to,
#                 "new_assigned_to": assigned_to,
#                 "assigned_by": update.assigned_by
#             }
#         )
    
#     return {"status": "success", "lead_id": lead_id, "assigned_to": assigned_to}



# @leads_router.put("/leads/{lead_id}", status_code=200)
# async def update_lead(lead_id: str, payload: Dict[str, Any]):
#     db = get_database()
    
#     # Get current lead data before update
#     current_lead = db.leads.find_one({"_id": ObjectId(lead_id)})
#     if not current_lead:
#         raise HTTPException(status_code=404, detail="Lead not found.")
    
#     actual_lead_id = current_lead.get("lead_id", lead_id)
    
#     # Track changes for activity
#     changes = []
#     metadata = {}
    
#     # Check for specific field changes we want to track
#     tracked_fields = ["status", "notes", "follow_up_date", "follow_up_notes", "stage", "assigned_to", "phone", "email", "name"]
    
#     for field in tracked_fields:
#         if field in payload:
#             old_value = current_lead.get(field)
#             new_value = payload[field]
            
#             # Only track if values are actually different
#             if str(old_value) != str(new_value):
#                 # Handle None values for display
#                 old_display = old_value if old_value is not None else "None"
#                 new_display = new_value if new_value is not None else "None"
                
#                 changes.append(f"{field}: '{old_display}' → '{new_display}'")
#                 metadata[f"old_{field}"] = old_value
#                 metadata[f"new_{field}"] = new_value
    
#     # Add update timestamp
#     payload["updated_at"] = datetime.datetime.now()
    
#     # Update the lead
#     result = db.leads.update_one(
#         {"_id": ObjectId(lead_id)},
#         {"$set": payload}
#     )
#     if result.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Lead not found.")
    
#     # Create activity if there were changes
#     if changes:
#         description = f"Lead updated: {', '.join(changes)}"
#         await create_lead_activity_internal(
#             lead_id=actual_lead_id,
#             activity_type="lead_updated", 
#             description=description,
#             created_by=payload.get("updated_by", "system"),
#             metadata=metadata
#         )
    
#     return {"status": "success", "updated": payload}

# @leads_router.get("/leads")
# async def get_leads(
#     page: int = Query(1, description="Page number"),
#     limit: int = Query(10, description="Items per page"),
#     source: Optional[str] = Query(None, description="Filter by source"),
#     status: Optional[str] = Query(None, description="Filter by status"),   # <-- NEW
#     search: Optional[str] = Query(None, description="Search by name, email, phone"),  # <-- NEW
#     start_date: Optional[str] = Query(None, description="Start date for filtering"),
#     end_date: Optional[str] = Query(None, description="End date for filtering")
# ):
#     """Get paginated leads with optional filtering"""
#     try:
#         db = get_database()
#         query = {}
#         if source and source != "all":
#             query["source"] = source

#         # Add status filter
#         if status and status != "all":
#             query["status"] = status

#         # Add search support (for name, email, phone)
#         if search:
#             search_regex = {"$regex": search, "$options": "i"}
#             query["$or"] = [
#                 {"name": search_regex},
#                 {"email": search_regex},
#                 {"phone": search_regex},
#                 {"raw_data.Name": search_regex},
#                 {"raw_data.Email": search_regex},
#                 {"raw_data.Phone": search_regex}
#             ]

#         # Date filtering
#         if start_date or end_date:
#             date_filter = {}
#             if start_date:
#                 try:
#                     date_filter["$gte"] = datetime.datetime.fromisoformat(start_date)
#                 except Exception:
#                     pass
#             if end_date:
#                 try:
#                     date_filter["$lte"] = datetime.datetime.fromisoformat(end_date)
#                 except Exception:
#                     pass
#             if date_filter:
#                 query["created_at"] = date_filter

#         skip = (page - 1) * limit
#         leads = list(db.leads.find(query).skip(skip).limit(limit))
#         total = db.leads.count_documents(query)

#         # Format leads for API response
#         formatted_leads = []
#         for lead in leads:
#             # Deep-copy the lead to avoid modifying the original
#             formatted_lead = {}
            
#             # Convert all fields, handling special types
#             for key, value in lead.items():
#                 if key == "_id" or isinstance(value, ObjectId):
#                     formatted_lead[key] = str(value)
#                 elif isinstance(value, datetime.datetime):
#                     formatted_lead[key] = value.isoformat()
#                 elif isinstance(value, dict):
#                     # Handle nested dictionaries
#                     nested_dict = {}
#                     for k, v in value.items():
#                         if isinstance(v, ObjectId):
#                             nested_dict[k] = str(v)
#                         elif isinstance(v, datetime.datetime):
#                             nested_dict[k] = v.isoformat()
#                         else:
#                             nested_dict[k] = v
#                     formatted_lead[key] = nested_dict
#                 else:
#                     formatted_lead[key] = value
                    
#             formatted_leads.append(formatted_lead)

#         # Create a response that's guaranteed to be JSON serializable
#         response = {
#             "data": formatted_leads,
#             "page": page,
#             "limit": limit,
#             "total": total,
#             "pages": (total + limit - 1) // limit,
#             "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#             "user": "soheruINFO"
#         }
        
#         # Pass the response through our serialization function to ensure everything is serializable
#         return make_serializable(response)
#     except Exception as e:
#         logger.error(f"Error getting leads: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to get leads: {str(e)}")

# @leads_router.post("/debug/google-sheets", status_code=200)
# async def debug_google_sheets(payload: Dict = Body(...)):
#     """Debug endpoint to see what data is being pulled from Google Sheets"""
#     try:
#         spreadsheet_url = payload.get("spreadsheet_url")
#         if not spreadsheet_url:
#             raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")

#         sheet_name = payload.get("sheet_name", "Sheet1")
#         header_row = payload.get("header_row", 1)
        
#         # Import the necessary functions
#         from app.database.integration.google_sheets import extract_file_info, get_google_credentials, SHEETS_SCOPES
#         import gspread
        
#         # Extract resource ID
#         resource_id_info = extract_file_info(spreadsheet_url)
#         resource_id = resource_id_info["id"]
        
#         # Open Google Sheet
#         creds = get_google_credentials(SHEETS_SCOPES)
#         client = gspread.authorize(creds)
#         spreadsheet = client.open_by_key(resource_id)
#         sheet = spreadsheet.worksheet(sheet_name)
#         all_values = sheet.get_all_values()
        
#         # Check what's in the database for this source
#         db = get_database()
#         source = db.lead_sources.find_one({"integration_id": resource_id})
#         last_synced_row = header_row
#         if source and "last_synced_row" in source:
#             last_synced_row = source["last_synced_row"]
        
#         debug_info = {
#             "spreadsheet_title": spreadsheet.title,
#             "sheet_name": sheet_name,
#             "total_rows": len(all_values),
#             "header_row": header_row,
#             "headers": all_values[header_row - 1] if len(all_values) > header_row - 1 else [],
#             "last_synced_row": last_synced_row,
#             "rows_to_process": max(0, len(all_values) - last_synced_row),
#             "sample_data_rows": []
#         }
        
#         # Add a few sample rows for debugging
#         for i in range(header_row, min(header_row + 5, len(all_values))):
#             if i < len(all_values):
#                 debug_info["sample_data_rows"].append({
#                     "row_number": i + 1,
#                     "data": all_values[i]
#                 })
        
#         return debug_info
        
#     except Exception as e:
#         logger.error(f"Error debugging Google Sheets: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error debugging Google Sheets: {str(e)}")

# @leads_router.post("/debug/google-sheets-detailed", status_code=200)
# async def debug_google_sheets_detailed(payload: Dict = Body(...)):
#     """More detailed debug endpoint to see exactly what's happening with Google Sheets processing"""
#     try:
#         spreadsheet_url = payload.get("spreadsheet_url")
#         if not spreadsheet_url:
#             raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")

#         sheet_name = payload.get("sheet_name", "Sheet1")
#         header_row = payload.get("header_row", 1)
        
#         # Import the necessary functions
#         from app.database.integration.google_sheets import extract_file_info, get_google_credentials, SHEETS_SCOPES
#         import gspread
        
#         # Extract resource ID
#         resource_id_info = extract_file_info(spreadsheet_url)
#         resource_id = resource_id_info["id"]
        
#         # Open Google Sheet
#         creds = get_google_credentials(SHEETS_SCOPES)
#         client = gspread.authorize(creds)
#         spreadsheet = client.open_by_key(resource_id)
#         sheet = spreadsheet.worksheet(sheet_name)
#         all_values = sheet.get_all_values()
        
#         # Check what's in the database for this source
#         db = get_database()
#         source = db.lead_sources.find_one({"integration_id": resource_id})
#         last_synced_row = header_row
#         if source and "last_synced_row" in source:
#             last_synced_row = source["last_synced_row"]
        
#         # Show all data rows that would be processed
#         rows_to_process = []
#         for i, row in enumerate(all_values[header_row:], start=header_row + 1):
#             if i <= last_synced_row:
#                 status = "SKIPPED (already processed)"
#             else:
#                 status = "WILL PROCESS"
                
#             rows_to_process.append({
#                 "row_number": i,
#                 "status": status,
#                 "data": row,
#                 "has_data": any(str(v).strip() for v in row if v is not None)
#             })
        
#         debug_info = {
#             "spreadsheet_title": spreadsheet.title,
#             "sheet_name": sheet_name,
#             "total_rows": len(all_values),
#             "header_row": header_row,
#             "headers": all_values[header_row - 1] if len(all_values) > header_row - 1 else [],
#             "last_synced_row": last_synced_row,
#             "rows_after_header": len(all_values) - header_row,
#             "rows_to_process": max(0, len(all_values) - last_synced_row),
#             "source_record": source,
#             "all_rows_detail": rows_to_process[:10],  # Limit to first 10 rows for debugging
#             "recommendation": ""
#         }
        
#         # Add recommendation
#         if last_synced_row >= len(all_values):
#             debug_info["recommendation"] = "All rows have been processed. Use force_resync: true to reprocess all data."
#         elif len(all_values) <= header_row:
#             debug_info["recommendation"] = "No data rows found after header row. Check if your sheet has data."
#         else:
#             debug_info["recommendation"] = f"Will process {len(all_values) - last_synced_row} new rows."
        
#         return debug_info
        
#     except Exception as e:
#         logger.error(f"Error debugging Google Sheets: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error debugging Google Sheets: {str(e)}")

# @leads_router.post("/force-reset-sync", status_code=200)
# async def force_reset_sync(payload: Dict = Body(...)):
#     """Force reset the sync status for a Google Sheet to reprocess all data"""
#     try:
#         spreadsheet_url = payload.get("spreadsheet_url")
#         if not spreadsheet_url:
#             raise HTTPException(status_code=400, detail="Missing required field: spreadsheet_url")
            
#         # Extract resource ID
#         from app.database.integration.google_sheets import extract_file_info
#         resource_id_info = extract_file_info(spreadsheet_url)
#         resource_id = resource_id_info["id"]
        
#         # Reset the sync status in database
#         db = get_database()
#         result = db.lead_sources.update_one(
#             {"integration_id": resource_id},
#             {"$set": {"last_synced_row": 1}},  # Reset to header row
#             upsert=True
#         )
        
#         return {
#             "success": True,
#             "message": f"Reset sync status for spreadsheet {resource_id}",
#             "modified_count": result.modified_count,
#             "upserted_id": str(result.upserted_id) if result.upserted_id else None
#         }
        
#     except Exception as e:
#         logger.error(f"Error resetting sync status: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error resetting sync status: {str(e)}")

# # Helper function to create lead activity
# async def create_lead_activity_internal(lead_id: str, activity_type: str, description: str, created_by: str = "system", metadata: Dict = None):
#     """Internal function to create lead activities"""
#     try:
#         db = get_database()
#         activity = {
#             "_id": ObjectId(),
#             "lead_id": lead_id,  # This should be the actual lead_id, not ObjectId
#             "activity_type": activity_type,
#             "description": description,
#             "created_at": datetime.datetime.now(),
#             "created_by": created_by,
#             "metadata": metadata or {}
#         }
#         db.lead_activities.insert_one(activity)
#         logger.info(f"Created activity for lead {lead_id}: {activity_type}")
#     except Exception as e:
#         logger.error(f"Error creating activity for lead {lead_id}: {str(e)}")

# @leads_router.post("/leads", status_code=201)
# async def create_manual_lead(payload: Dict[str, Any]):
#     """Create a new lead manually"""
#     try:
#         # Validate required fields
#         if not payload.get("name") or not payload.get("email"):
#             raise HTTPException(status_code=400, detail="Name and Email are required fields")
        
#         db = get_database()
        
#         # Get the highest existing lead_id number to ensure uniqueness
#         highest_lead = db.leads.find({
#             "lead_id": {"$regex": "^lead\\d+$"}
#         }).sort("lead_id", -1).limit(1)
        
#         # Extract the number from the highest lead_id (e.g., "lead123" -> 123)
#         next_lead_number = 1
#         for lead in highest_lead:
#             lead_id_str = lead.get("lead_id", "lead000")
#             # Extract number from lead_id (e.g., "lead123" -> "123")
#             import re
#             match = re.search(r'lead(\d+)', lead_id_str)
#             if match:
#                 next_lead_number = int(match.group(1)) + 1
#             break
        
#         # Generate unique lead_id
#         lead_id = f"lead{next_lead_number:03}"
        
#         # Check for duplicate by email or phone
#         email = payload.get("email", "").strip()
#         phone = payload.get("phone", "").strip()
        
#         if email or phone:
#             duplicate = await find_duplicate_lead(email, phone)
#             if duplicate:
#                 raise HTTPException(
#                     status_code=409, 
#                     detail=f"Duplicate lead found with email '{email}' or phone '{phone}'"
#                 )
        
#         # Create current timestamps
#         current_time = datetime.datetime.now()
        
#         # Create lead document with proper structure
#         lead_document = {
#             "_id": ObjectId(),
#             "lead_id": lead_id,
#             "lead_key": f"lead{next_lead_number}",
#             "source": payload.get("source", "manual_entry"),
#             "source_id": f"manual_{current_time.isoformat()}",
#             "email": email,
#             "phone": phone,
#             "name": payload.get("name", "").strip(),
#             "location": payload.get("location", "").strip(),
#             "campaign": payload.get("campaign", "").strip(),
#             "status": payload.get("status", "new"),
#             "stage": payload.get("stage", "Intake"),
#             "notes": payload.get("notes", ""),  # Don't strip if empty, keep as is
#             "assigned_to": payload.get("assigned_to", "Unassigned"),
#             "assigned_by": payload.get("created_by", "system"),
#             "owner": payload.get("owner", "Unassigned"),
#             "created_at": current_time,
#             "updated_at": current_time,
#             "created": current_time.strftime("%m/%d/%Y %I:%M %p"),
#             "form": "",
#             "channel": "manual",
#             "labels": payload.get("labels", ""),
#             "secondary_phone_number": payload.get("secondary_phone_number", ""),
#             "raw_data": {
#                 "manual_entry": True,
#                 "created_by": payload.get("created_by", "system"),
#                 "original_notes": payload.get("notes", "")  # Store original notes for debugging
#             }
#         }
        
#         # Insert the lead
#         await insert_lead(lead_document)
#         logger.info(f"Manual lead created successfully: {lead_id}")
#         logger.info(f"Lead notes stored: '{lead_document.get('notes', 'NO NOTES FIELD')}'")
        
#         # Create activity for manual lead creation
#         await create_lead_activity_internal(
#             lead_id=lead_id,
#             activity_type="lead_created",
#             description=f"Lead manually created by {payload.get('created_by', 'system')}",
#             created_by=payload.get("created_by", "system"),
#             metadata={
#                 "source": "manual_entry",
#                 "name": lead_document["name"],
#                 "email": lead_document["email"],
#                 "phone": lead_document["phone"],
#                 "notes": lead_document.get("notes", "")
#             }
#         )
        
#         # Format response
#         response_lead = make_serializable(lead_document)
        
#         return {
#             "success": True,
#             "message": "Lead created successfully",
#             "lead": response_lead,
#             "lead_id": lead_id,
#             "created_at": current_time.isoformat(),
#             "debug_notes": lead_document.get("notes", "NO_NOTES_IN_DOCUMENT")  # Debug field
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creating manual lead: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")

# @leads_router.get("/leads/{lead_id}", status_code=200)
# async def get_lead_by_id(lead_id: str):
#     """Get a specific lead by ID"""
#     try:
#         db = get_database()
        
#         # Find the lead by ObjectId
#         lead = db.leads.find_one({"_id": ObjectId(lead_id)})
        
#         if not lead:
#             raise HTTPException(status_code=404, detail="Lead not found")
        
#         # Format the lead for API response
#         formatted_lead = {}
#         for key, value in lead.items():
#             if key == "_id" or isinstance(value, ObjectId):
#                 formatted_lead[key] = str(value)
#             elif isinstance(value, datetime.datetime):
#                 formatted_lead[key] = value.isoformat()
#             elif isinstance(value, dict):
#                 # Handle nested dictionaries
#                 nested_dict = {}
#                 for k, v in value.items():
#                     if isinstance(v, ObjectId):
#                         nested_dict[k] = str(v)
#                     elif isinstance(v, datetime.datetime):
#                         nested_dict[k] = v.isoformat()
#                     else:
#                         nested_dict[k] = v
#                 formatted_lead[key] = nested_dict
#             else:
#                 formatted_lead[key] = value
        
#         return make_serializable(formatted_lead)
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting lead {lead_id}: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to get lead: {str(e)}")

# @leads_router.get("/notes")
# async def get_lead_notes(
#     lead_id: Optional[str] = Query(None, description="Filter notes by lead ID"),
#     page: int = Query(1, description="Page number"),
#     limit: int = Query(10, description="Items per page")
# ):
#     """Get lead notes with optional filtering by lead ID"""
#     try:
#         db = get_database()
#         query = {}
        
#         # Filter by lead_id if provided
#         if lead_id:
#             query["_id"] = ObjectId(lead_id)
        
#         # Calculate pagination
#         skip = (page - 1) * limit
        
#         # Get notes from leads collection (assuming notes are stored in the lead documents)
#         if lead_id:
#             # If specific lead_id is provided, get notes from that lead
#             lead = db.leads.find_one({"_id": ObjectId(lead_id)})
#             if not lead:
#                 raise HTTPException(status_code=404, detail="Lead not found")
            
#             notes = lead.get("notes", "")
#             notes_list = []
#             if notes:
#                 notes_list = [{
#                     "id": str(lead["_id"]),
#                     "lead_id": lead.get("lead_id", str(lead["_id"])),
#                     "content": notes,
#                     "created_at": lead.get("created_at", datetime.datetime.now()).isoformat(),
#                     "updated_at": lead.get("updated_at", datetime.datetime.now()).isoformat()
#                 }]
            
#             return make_serializable({
#                 "data": notes_list,
#                 "page": page,
#                 "limit": limit,
#                 "total": len(notes_list),
#                 "pages": 1
#             })
#         else:
#             # Get all leads that have notes
#             leads_with_notes = list(db.leads.find(
#                 {"notes": {"$exists": True, "$ne": ""}},
#                 {"_id": 1, "lead_id": 1, "notes": 1, "created_at": 1, "updated_at": 1}
#             ).skip(skip).limit(limit))
            
#             total = db.leads.count_documents({"notes": {"$exists": True, "$ne": ""}})
            
#             notes_list = []
#             for lead in leads_with_notes:
#                 notes_list.append({
#                     "id": str(lead["_id"]),
#                     "lead_id": lead.get("lead_id", str(lead["_id"])),
#                     "content": lead.get("notes", ""),
#                     "created_at": lead.get("created_at", datetime.datetime.now()).isoformat(),
#                     "updated_at": lead.get("updated_at", datetime.datetime.now()).isoformat()
#                 })
            
#             return make_serializable({
#                 "data": notes_list,
#                 "page": page,
#                 "limit": limit,
#                 "total": total,
#                 "pages": (total + limit - 1) // limit
#             })
            
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting lead notes: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to get lead notes: {str(e)}")

# @leads_router.post("/notes")
# async def create_lead_note(payload: Dict[str, Any]):
#     """Create or update a note for a lead"""
#     try:
#         lead_id = payload.get("lead_id")
#         content = payload.get("content", "")
#         created_by = payload.get("created_by", "system")
        
#         if not lead_id:
#             raise HTTPException(status_code=400, detail="lead_id is required")
        
#         db = get_database()
        
#         # Get current lead to check if note exists
#         current_lead = db.leads.find_one({"_id": ObjectId(lead_id)})
#         if not current_lead:
#             raise HTTPException(status_code=404, detail="Lead not found")
        
#         # Get the actual lead_id field from the document
#         actual_lead_id = current_lead.get("lead_id", lead_id)
#         previous_notes = current_lead.get("notes", "")
        
#         # Update the lead with the new note
#         result = db.leads.update_one(
#             {"_id": ObjectId(lead_id)},
#             {
#                 "$set": {
#                     "notes": content,
#                     "updated_at": datetime.datetime.now()
#                 }
#             }
#         )
        
#         # Create activity for note update
#         if previous_notes != content:
#             description = f"Lead updated: notes: '{previous_notes or 'None'}' → '{content or 'None'}'"
            
#             await create_lead_activity_internal(
#                 lead_id=actual_lead_id,  # Use actual lead_id field, not ObjectId
#                 activity_type="lead_updated",
#                 description=description,
#                 created_by=created_by,
#                 metadata={
#                     "old_notes": previous_notes,
#                     "new_notes": content
#                 }
#             )
#         return make_serializable({
#             "success": True,
#             "message": "Note updated successfully",
#             "lead_id": lead_id,
#             "content": content,
#             "updated_at": datetime.datetime.now().isoformat()
#         })
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creating/updating lead note: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to create/update note: {str(e)}")

# @leads_router.get("/lead-activities", status_code=200)
# async def get_lead_activities(
#     lead_id: Optional[str] = Query(None, description="Filter activities by lead ID"),
#     activity_type: Optional[str] = Query(None, description="Filter activities by type"),
#     page: int = Query(1, description="Page number"),
#     limit: int = Query(50, description="Items per page"),
#     exclude_imports: bool = Query(False, description="Exclude import-related activities")
# ):
#     """Get lead activities with optional filtering"""
#     try:
#         db = get_database()
#         query = {}
        
#         # Filter by lead_id if provided
#         if lead_id:
#             query["lead_id"] = lead_id
        
#         # Filter by activity_type if provided
#         if activity_type:
#             query["activity_type"] = activity_type
        
#         # Exclude import activities if requested
#         if exclude_imports:
#             query["activity_type"] = {"$nin": ["lead_imported", "import_batch"]}
        
#         # Calculate pagination
#         skip = (page - 1) * limit
        
#         # Get activities from lead_activities collection
#         activities_cursor = db.lead_activities.find(query).sort("created_at", -1).skip(skip).limit(limit)
#         activities = list(activities_cursor)
        
#         # Get total count for pagination
#         total = db.lead_activities.count_documents(query)
        
#         # Format activities for API response
#         formatted_activities = []
#         for activity in activities:
#             formatted_activity = {}
#             for key, value in activity.items():
#                 if key == "_id" or isinstance(value, ObjectId):
#                     formatted_activity[key] = str(value)
#                 elif isinstance(value, datetime.datetime):
#                     formatted_activity[key] = value.isoformat()
#                 elif isinstance(value, dict):
#                     # Handle nested metadata dictionaries
#                     nested_dict = {}
#                     for k, v in value.items():
#                         if isinstance(v, ObjectId):
#                             nested_dict[k] = str(v)
#                         elif isinstance(v, datetime.datetime):
#                             nested_dict[k] = v.isoformat()
#                         else:
#                             nested_dict[k] = v
#                     formatted_activity[key] = nested_dict
#                 else:
#                     formatted_activity[key] = value
#             formatted_activities.append(formatted_activity)
        
#         logger.info(f"Retrieved {len(formatted_activities)} activities for lead_id={lead_id}, activity_type={activity_type}")
        
#         return make_serializable({
#             "data": formatted_activities,
#             "page": page,
#             "limit": limit,
#             "total": total,
#             "pages": (total + limit - 1) // limit,
#             "filters": {
#                 "lead_id": lead_id,
#                 "activity_type": activity_type,
#                 "exclude_imports": exclude_imports
#             }
#         })
        
#     except Exception as e:
#         logger.error(f"Error getting lead activities: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to get activities: {str(e)}")

