# import logging
# import re
# import os
# import io
# import json
# import pandas as pd
# from typing import Dict, List, Optional, Any
# from datetime import datetime
# from bson import ObjectId

# from app.database import insert_lead, update_lead_source, find_duplicate_lead, get_database
# from app.config import settings
# from fastapi import HTTPException
# from app.database.schemas.lead_integration import Lead
# from google.oauth2.service_account import Credentials
# from googleapiclient.discovery import build
# from googleapiclient.http import MediaIoBaseDownload
# import gspread
# from gspread.exceptions import SpreadsheetNotFound, WorksheetNotFound, APIError

# # Set up logging
# logger = logging.getLogger(__name__)

# # Scope required for API access
# SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
# DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

# def ensure_dict(data: Any) -> dict:
#     """Convert data to dictionary if possible, otherwise return empty dict."""
#     if data is None:
#         return {}
        
#     if isinstance(data, dict):
#         return data
        
#     # Try to convert list to dictionary
#     if isinstance(data, list):
#         try:
#             # Try to convert list of key-value pairs to dict
#             result = {}
#             for item in data:
#                 if isinstance(item, dict) and "key" in item and "value" in item:
#                     result[item["key"]] = item["value"]
#             logger.info(f"Converted list to dictionary: {result}")
#             return result
#         except Exception as e:
#             logger.error(f"Failed to convert list to dictionary: {str(e)}")
#             return {}
    
#     # Try dictionary conversion for other types
#     try:
#         return dict(data)
#     except (TypeError, ValueError) as e:
#         logger.error(f"Cannot convert {type(data)} to dictionary: {e}")
#         return {}

# def extract_file_info(url_or_id: str) -> dict:
#     """Extract file information from URL or ID."""
#     # Check if it's a local file path
#     if os.path.exists(url_or_id):
#         return {
#             "type": "local_file",
#             "id": url_or_id
#         }
        
#     # If it's already just an ID (not a URL with http/https), assume it's a Google Sheet
#     if not url_or_id.startswith(('http://', 'https://')):
#         return {
#             "type": "google_sheet",
#             "id": url_or_id
#         }
        
#     # Google Drive file patterns
#     drive_file_patterns = [
#         r'/file/d/([a-zA-Z0-9-_]+)'  # Google Drive file URL
#     ]
    
#     for pattern in drive_file_patterns:
#         match = re.search(pattern, url_or_id)
#         if match:
#             return {
#                 "type": "google_drive",
#                 "id": match.group(1)
#             }
    
#     # Google Sheets patterns
#     sheet_patterns = [
#         r'/spreadsheets/d/([a-zA-Z0-9-_]+)',  # Standard Sheets URL
#         r'/d/([a-zA-Z0-9-_]+)'               # Shortened URL
#         r'id=([a-zA-Z0-9-_]+)'                # URL with id parameter
#     ]
    
#     for pattern in sheet_patterns:
#         match = re.search(pattern, url_or_id)
#         if match:
#             return {
#                 "type": "google_sheet",
#                 "id": match.group(1)
#             }
    
#     # If no match found, raise a clear error
#     raise ValueError(f"Invalid URL or file ID: {url_or_id}")

# def get_google_credentials(SHEETS_SCOPES):
#     """Safely load Google service account credentials with more robust fallbacks"""
#     try:
#         # Check if file exists
#         if not os.path.exists(settings.GOOGLE_SERVICE_ACCOUNT_FILE):
#             logger.error(f"Service account file not found: {settings.GOOGLE_SERVICE_ACCOUNT_FILE}")
#             raise ValueError(f"Service account file not found: {settings.GOOGLE_SERVICE_ACCOUNT_FILE}")
        
#         # Try to load and parse JSON file
#         with open(settings.GOOGLE_SERVICE_ACCOUNT_FILE, 'r') as f:
#             try:
#                 service_account_info = json.load(f)
#                 logger.debug(f"Loaded service account info type: {type(service_account_info)}")
                
#                 # Check if the loaded data is a dictionary
#                 if not isinstance(service_account_info, dict):
#                     logger.warning(f"Service account file has invalid format: dict, got {type(service_account_info)}")
                    
#                     # If it's a list with a single dictionary, try to use that
#                     if isinstance(service_account_info, list) and len(service_account_info) > 0 and isinstance(service_account_info[0], dict):
#                         logger.info("Found dictionary in list, attempting to use first element")
#                         service_account_info = service_account_info[0]
#                     else:
#                         raise ValueError(f"Service account file has invalid format: {type(service_account_info)}")
                
#                 # Check for required fields
#                 required_fields = ["token_uri", "client_email", "private_key"]
#                 missing_fields = [field for field in required_fields if field not in service_account_info]
                
#                 if missing_fields:
#                     logger.error(f"Service account info is missing required fields: {missing_fields}")
                    
#                     # Try to add default values for some fields
#                     if "token_uri" in missing_fields:
#                         service_account_info["token_uri"] = "https://oauth2.googleapis.com/token"
#                         logger.info("Added default token_uri")
                    
#                     # Re-check after adding defaults
#                     missing_fields = [field for field in required_fields if field not in service_account_info]
#                     if missing_fields:
#                         logger.error(f"Service account still missing critical fields: {missing_fields}")
#                         raise ValueError(f"Service account info was not in the expected format, missing fields {', '.join(missing_fields)}.")
                
#                 # Log available fields for debugging
#                 logger.debug(f"Available fields in service account: {sorted(service_account_info.keys())}")
                
#                 # Create credentials from parsed JSON
#                 return Credentials.from_service_account_info(
#                     service_account_info, scopes=SHEETS_SCOPES
#                 )
#             except json.JSONDecodeError as e:
#                 logger.error(f"Failed to parse service account file as JSON: {str(e)}")
#                 raise ValueError(f"Invalid service account JSON: {str(e)}")
#     except Exception as e:
#         logger.exception(f"Failed to load Google credentials: {str(e)}")
#         raise ValueError(f"Failed to load Google credentials: {str(e)}")

# # async def process_google_sheets(
# #     spreadsheet_url_or_id: str,
# #     sheet_name: str = "Sheet1",
# #     header_row: int = 1,
# #     mapping: Dict[str, str] = {},
# # ):
# #     """Process leads from Google Sheets or local CSV file"""
# #     try:
# #         # Add extensive debugging
# #         logger.info("=" * 50)
# #         logger.info("STARTING PROCESS WITH DETAILED DEBUG")
# #         logger.info(f"URL/ID: {spreadsheet_url_or_id}")
# #         logger.info(f"Sheet name: {sheet_name}")
# #         logger.info(f"Header row: {header_row}")
# #         logger.info(f"Mapping type: {type(mapping)}")
# #         logger.info(f"Mapping: {mapping}")
        
# #         # Validate mapping parameter
# #         if mapping is None:
# #             mapping = {}
# #             logger.info("Mapping was None, set to empty dict")
# #         elif not isinstance(mapping, dict):
# #             logger.error(f"Expected mapping to be a dictionary, got {type(mapping)}: {mapping}")
# #             try:
# #                 # Try to convert to dictionary
# #                 logger.info("Attempting to convert mapping to dict")
# #                 if isinstance(mapping, list):
# #                     temp_dict = {}
# #                     for i, item in enumerate(mapping):
# #                         logger.info(f"List item {i}: {type(item)} - {item}")
# #                         if isinstance(item, dict) and "key" in item and "value" in item:
# #                             temp_dict[item["key"]] = item["value"]
# #                     mapping = temp_dict
# #                 else:
# #                     mapping = dict(mapping) if hasattr(mapping, "__iter__") else {}
# #                 logger.info(f"Conversion result: {mapping}")
# #             except Exception as e:
# #                 logger.exception(f"Conversion failed: {str(e)}")
# #                 mapping = {}
# #             logger.info(f"Final mapping after conversion: {mapping}")
        
# #         # Extract resource ID
# #         try:
# #             logger.info("Extracting resource ID")
# #             resource_id_info = extract_file_info(spreadsheet_url_or_id)
# #             logger.info(f"Extracted ID: {resource_id_info}")
# #         except ValueError as e:
# #             logger.error(f"ID extraction failed: {str(e)}")
# #             raise HTTPException(status_code=400, detail=str(e))
        
# #         # Check if it's a local file - FIX: Use the ID from the dictionary not the dictionary itself
# #         if resource_id_info["type"] == "local_file" and os.path.exists(resource_id_info["id"]):
# #             logger.info(f"This is a local file: {resource_id_info['id']}")
# #             return process_local_file(resource_id_info["id"], header_row, mapping)
        
# #         # Extract the actual ID string from the info dictionary
# #         resource_id = resource_id_info["id"]
        
# #         # Otherwise, proceed with Google Sheets processing
# #         logger.info(f"Starting Google Sheets integration for: {resource_id}")
        
# #         # Get the last processed row
# #         db = get_database()
# #         source = db.lead_sources.find_one({"integration_id": resource_id})
        
# #         last_synced_row = header_row
# #         if source and "last_synced_row" in source:
# #             last_synced_row = source["last_synced_row"]
# #         logger.info(f"Last synced row: {last_synced_row}")
            
# #         # Authenticate and get sheet data
# #         try:
# #             logger.info("Setting up credentials")
# #             try:
# #                 # Use the new helper function instead of direct call
# #                 creds = get_google_credentials(SHEETS_SCOPES)
# #                 logger.info("Successfully loaded credentials")
# #             except ValueError as e:
# #                 logger.error(f"Credentials error: {str(e)}")
# #                 raise HTTPException(status_code=500, detail=f"Google credentials error: {str(e)}")
            
# #             logger.info("Authorizing gspread client")
# #             client = gspread.authorize(creds)
            
# #             try:
# #                 logger.info(f"Opening spreadsheet with ID: {resource_id}")
# #                 spreadsheet = client.open_by_key(resource_id)
# #                 logger.info(f"Successfully opened spreadsheet: {spreadsheet.title}")
# #             except SpreadsheetNotFound:
# #                 logger.error(f"Spreadsheet not found with ID: {resource_id}")
# #                 raise HTTPException(status_code=404, detail=f"Spreadsheet not found. Please check the URL or ID")
# #             except APIError as e:
# #                 logger.error(f"API error when opening spreadsheet: {str(e)}")
# #                 if "403" in str(e):
# #                     raise HTTPException(
# #                         status_code=403, 
# #                         detail="Permission denied. Make sure your service account has access to this spreadsheet"
# #                     )
# #                 else:
# #                     raise HTTPException(status_code=500, detail=f"Google Sheets API error: {str(e)}")
                
# #             try:
# #                 logger.info(f"Accessing worksheet: {sheet_name}")
# #                 sheet = spreadsheet.worksheet(sheet_name)
# #                 logger.info(f"Successfully accessed worksheet: {sheet_name}")
# #             except WorksheetNotFound:
# #                 available_sheets = [ws.title for ws in spreadsheet.worksheets()]
# #                 logger.error(f"Worksheet '{sheet_name}' not found. Available sheets: {available_sheets}")
# #                 raise HTTPException(
# #                     status_code=400, 
# #                     detail=f"Sheet '{sheet_name}' not found. Available sheets: {', '.join(available_sheets)}"
# #                 )
            
# #             # Get all rows including headers
# #             logger.info("Getting all values from worksheet")
# #             all_values = sheet.get_all_values()
# #             logger.info(f"Retrieved {len(all_values)} rows of data")
            
# #             if not all_values or len(all_values) <= header_row - 1:
# #                 logger.warning(f"No data found in sheet or header row ({header_row}) is invalid")
# #                 raise HTTPException(
# #                     status_code=400, 
# #                     detail=f"No data found or header row ({header_row}) is invalid"
# #                 )
                
# #             # Get headers
# #             headers = all_values[header_row - 1]
# #             if not headers:
# #                 logger.error("Header row is empty")
# #                 raise HTTPException(status_code=400, detail="Header row is empty")
            
# #             logger.info(f"Headers found: {headers}")
            
# #             # Process rows that haven't been processed yet
# #             new_leads_count = 0
# #             logger.info("Starting to process rows")
            
# #             for i, row in enumerate(all_values[header_row:], start=header_row + 1):
# #                 try:
# #                     # Skip already processed rows
# #                     if i <= last_synced_row:
# #                         continue
                        
# #                     # Ensure row and headers have matching lengths
# #                     if len(row) < len(headers):
# #                         row = row + [""] * (len(headers) - len(row))
# #                     elif len(row) > len(headers):
# #                         row = row[:len(headers)]
                    
# #                     # Create a dictionary mapping headers to row values
# #                     row_data = {}  # Use empty dict and populate manually
# #                     for j, header in enumerate(headers):
# #                         if j < len(row):
# #                             row_data[header] = row[j]
# #                         else:
# #                             row_data[header] = ""
                    
# #                     # Skip empty rows
# #                     if not any(str(v).strip() for v in row_data.values() if v is not None):
# #                         continue
                        
# #                     # Create lead object with raw data
# #                     lead = {
# #                         "source": "google_sheets",
# #                         "source_id": resource_id,
# #                         "created_at": datetime.now(),
# #                         "raw_data": row_data,
                        
# #                         # Add these important fields at the top level too for direct access
# #                         # Handle common field names with different capitalizations
# #                         "name": row_data.get("Name", row_data.get("name", row_data.get("FULL NAME", row_data.get("Full Name", "")))),
# #                         "email": row_data.get("Email", row_data.get("email", row_data.get("EMAIL", ""))),
# #                         "phone": row_data.get("Phone", row_data.get("phone", row_data.get("PHONE", row_data.get("Mobile", row_data.get("mobile", ""))))),
# #                         # Add some other commonly useful fields
# #                         "source_details": row_data.get("Source", row_data.get("source", "")),
# #                         "notes": row_data.get("Notes", row_data.get("notes", "")),
# #                         "timestamp": row_data.get("Created", row_data.get("Date", row_data.get("Timestamp", str(datetime.now()))))
# #                     }
                    
# #                     # Apply mapping - with extra precautions
# #                     logger.info(f"Applying mapping to row {i}")
# #                     logger.info(f"Mapping type: {type(mapping)}")
                    
# #                     if isinstance(mapping, dict):  # Extra check
# #                         for field, header in mapping.items():
# #                             if header in row_data:
# #                                 lead[field] = row_data[header]
                                
# #                     # Check for duplicate leads
# #                     email = lead.get("email")
# #                     phone = lead.get("phone")
                    
# #                     if email or phone:
# #                         duplicate = await find_duplicate_lead(email, phone)
# #                         if duplicate:
# #                             logger.info(f"Duplicate lead found: {email or phone}")
# #                             continue
                    
# #                     # Insert lead into database
# #                     logger.info(f"Inserting lead for row {i}")
# #                     await insert_lead(lead)
# #                     new_leads_count += 1
                    
# #                     # Update last synced row
# #                     last_synced_row = i
# #                 except Exception as e:
# #                     logger.exception(f"Error processing row {i}: {str(e)}")
# #                     # Continue with next row
# #                     continue
            
# #             logger.info(f"Processed {new_leads_count} new leads")
            
# #             # Create safe copy of mapping for DB storage
# #             logger.info("Creating safe copy of mapping for DB storage")
# #             safe_mapping = {}
# #             if isinstance(mapping, dict):
# #                 safe_mapping = dict(mapping)
            
# #             # Update lead source info
# #             logger.info("Updating lead source info")
# #             source_update = {
# #                 "name": f"Google Sheet: {spreadsheet.title}",
# #                 "source_type": "google_sheets",
# #                 "integration_id": resource_id,
# #                 "mapping": safe_mapping,  # Use safe copy
# #                 "last_sync_time": datetime.now(),
# #                 "last_synced_row": last_synced_row,
# #                 "metadata": {
# #                     "sheet_name": sheet_name,
# #                     "header_row": header_row,
# #                     "spreadsheet_title": spreadsheet.title,
# #                 }
# #             }
            
# #             logger.info("Calling update_lead_source")
# #             update_lead_source(resource_id, source_update)
            
# #             logger.info(f"Google Sheets integration completed successfully")
# #             return {
# #                 "success": True,
# #                 "message": f"Successfully imported {new_leads_count} new leads",
# #                 "spreadsheet_title": spreadsheet.title,
# #                 "sheet_name": sheet_name,
# #                 "timestamp": "2025-06-05 13:22:36",
# #                 "user": "soheru"
# #             }
            
# #         except Exception as e:
# #             logger.exception(f"Error accessing Google Sheets: {str(e)}")
# #             raise HTTPException(status_code=500, detail=f"Error accessing Google Sheets: {str(e)}")
            
# #     except HTTPException:
# #         # Re-raise HTTP exceptions
# #         logger.info("Re-raising HTTPException")
# #         raise 
# #     except Exception as e:
# #         logger.exception(f"Error processing Google Sheets request: {str(e)}")
# #         raise HTTPException(status_code=500, detail=f"Error processing Google Sheets request: {str(e)}")




# async def find_duplicate_lead(email: str, phone: str):
#     """Check if a lead with the given email or phone already exists"""
#     db = get_database()
#     query = {}
#     if email and phone:
#         query = {"$or": [{"email": email}, {"phone": phone}]}
#     elif email:
#         query = {"email": email}
#     elif phone:
#         query = {"phone": phone}
#     else:
#         return None
#     return db.leads.find_one(query)

# async def process_google_sheets(
#     spreadsheet_url_or_id: str,
#     sheet_name: str = "Sheet1",
#     header_row: int = 1,
#     mapping: Dict[str, str] = {},
# ):
#     try:
#         logger.info("=" * 50)
#         logger.info("STARTING PROCESS WITH DETAILED DEBUG")
#         logger.info(f"URL/ID: {spreadsheet_url_or_id}")
#         logger.info(f"Sheet name: {sheet_name}")
#         logger.info(f"Header row: {header_row}")
#         logger.info(f"Mapping: {mapping}")

#         # 1. Extract resource ID
#         resource_id_info = extract_file_info(spreadsheet_url_or_id)
#         resource_id = resource_id_info["id"]

#         # 2. Open Google Sheet
#         creds = get_google_credentials(SHEETS_SCOPES)
#         client = gspread.authorize(creds)
#         spreadsheet = client.open_by_key(resource_id)
#         sheet = spreadsheet.worksheet(sheet_name)
#         all_values = sheet.get_all_values()
#         if not all_values or len(all_values) <= header_row - 1:
#             raise HTTPException(
#                 status_code=400, 
#                 detail=f"No data found or header row ({header_row}) is invalid"
#             )
#         headers = all_values[header_row - 1]

#         # 3. Get last synced row from lead_sources
#         db = get_database()
#         source = db.lead_sources.find_one({"integration_id": resource_id})
#         last_synced_row = header_row
#         if source and "last_synced_row" in source:
#             last_synced_row = source["last_synced_row"]

#         new_leads_count = 0
#         processed_leads = []
#         current_time = datetime.now()
        
#         # Get the highest existing lead_id number to ensure uniqueness
#         db = get_database()
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
        
#         for i, row in enumerate(all_values[header_row:], start=header_row + 1):
#             try:
#                 if i <= last_synced_row:
#                     continue
                    
#                 # Normalize row length to match headers
#                 if len(row) < len(headers):
#                     row = row + [""] * (len(headers) - len(row))
#                 elif len(row) > len(headers):
#                     row = row[:len(headers)]
                    
#                 # Create row_data dictionary for mapping
#                 row_data = {header: row[j] if j < len(row) else "" for j, header in enumerate(headers)}
#                 if not any(str(v).strip() for v in row_data.values() if v is not None):
#                     continue

#                 # Build lead dict using the exact flat schema required
#                 # Initialize with required fields and default values
#                 lead_dict = {
#                     "_id": ObjectId(),  # Create a fresh ObjectId
#                     "lead_id": f"lead{next_lead_number:03}",
#                     "lead_key": f"lead{next_lead_number}",
#                     "source": "google_sheets",
#                     "source_id": resource_id,
#                     "email": "",
#                     "phone": "",
#                     "status": "new",
#                     "name": "",
#                     "created_at": current_time,
#                     "updated_at": current_time,
#                     "created": current_time.strftime("%m/%d/%Y %I:%M %p"),
#                     "form": "",
#                     "channel": "",
#                     "stage": "Intake",
#                     "owner": "Unassigned",
#                     "labels": "",
#                     "secondary_phone_number": "",
#                     "notes": "",
#                     "campaign": None,
#                     "assigned_to": None,
#                     "assigned_by": None
#                 }

#                 # Apply mapping from Google Sheets
#                 for target_field, source_header in mapping.items():
#                     if source_header in row_data and row_data[source_header]:
#                         lead_dict[target_field] = row_data[source_header]

#                 # Look for common field names if not already mapped
#                 field_mappings = {
#                     "name": ["Name", "name", "FULL NAME", "Full Name", "full_name", "CUSTOMER NAME", "Customer Name", "CLIENT NAME", "Client Name"],
#                     "email": ["Email", "email", "EMAIL", "E-mail", "E-MAIL", "e-mail", "customer_email", "client_email"],
#                     "phone": ["Phone", "phone", "PHONE", "Mobile", "mobile", "MOBILE", "CONTACT", "Contact", "Phone Number", "primary_phone", "customer_phone"],
#                     "secondary_phone_number": ["Secondary Phone", "secondary phone", "Alternate Phone", "alternate_phone", "Other Phone", "other_phone"],
#                     "status": ["Status", "status", "STATUS", "Lead Status", "lead_status"],
#                     "stage": ["Stage", "stage", "STAGE", "Lead Stage", "lead_stage"],
#                     "notes": ["Notes", "notes", "NOTES", "Comments", "comments", "Description", "description"],
#                     "campaign": ["Campaign", "campaign", "CAMPAIGN", "Marketing Campaign", "Source Campaign"],
#                     "channel": ["Channel", "channel", "CHANNEL", "Source", "source", "Lead Source", "lead_source"],
#                     "labels": ["Labels", "labels", "LABELS", "Tags", "tags", "TAGS", "Categories", "categories"],
#                     "owner": ["Owner", "owner", "OWNER", "Assigned To", "assigned_to", "ASSIGNED TO", "Agent", "agent"]
#                 }

#                 # Fill in fields using common header names
#                 for field, possible_headers in field_mappings.items():
#                     if not lead_dict[field]:  # Only if not already set
#                         for header in possible_headers:
#                             if header in row_data and row_data[header]:
#                                 lead_dict[field] = row_data[header]
#                                 break

#                 # --- DUPLICATE CHECK ---
#                 email = lead_dict.get("email")
#                 phone = lead_dict.get("phone")
#                 if email or phone:
#                     duplicate = await find_duplicate_lead(email, phone)
#                     if duplicate:
#                         logger.info(f"Duplicate lead found (email: {email}, phone: {phone}), skipping.")
#                         continue

#                 # Insert into DB 
#                 await insert_lead(lead_dict)
#                 processed_leads.append(lead_dict)
#                 new_leads_count += 1
#                 last_synced_row = i
#                 next_lead_number += 1  # Increment for next unique lead_id
#             except Exception as e:
#                 logger.exception(f"Error processing row {i}: {str(e)}")
#                 continue

#         # Update lead_sources with sync info
#         safe_mapping = dict(mapping) if isinstance(mapping, dict) else {}
#         source_update = {
#             "name": f"Google Sheet: {spreadsheet.title}",
#             "source_type": "google_sheets",
#             "integration_id": resource_id,
#             "mapping": safe_mapping,
#             "last_sync_time": datetime.now(),
#             "last_synced_row": last_synced_row,
#             "metadata": {
#                 "sheet_name": sheet_name,
#                 "header_row": header_row,
#                 "spreadsheet_title": spreadsheet.title,
#             }
#         }
#         await update_lead_source(resource_id, source_update)

#         return {
#             "success": True,
#             "message": f"Successfully imported {new_leads_count} new leads",
#             "spreadsheet_title": spreadsheet.title,
#             "sheet_name": sheet_name,
#             "timestamp": datetime.now().isoformat(),
#             "user": "soheru",
#             "leads": processed_leads
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.exception(f"Error processing Google Sheets request: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error processing Google Sheets request: {str(e)}")

# # async def process_google_sheets(
# #     spreadsheet_url_or_id: str,
# #     sheet_name: str = "Sheet1",
# #     header_row: int = 1,
# #     mapping: Dict[str, str] = {},
# # ):
# #     """Process leads from Google Sheets or local CSV file and store in Lead model format"""
# #     try:
# #         logger.info("=" * 50)
# #         logger.info("STARTING PROCESS WITH DETAILED DEBUG")
# #         logger.info(f"URL/ID: {spreadsheet_url_or_id}")
# #         logger.info(f"Sheet name: {sheet_name}")
# #         logger.info(f"Header row: {header_row}")
# #         logger.info(f"Mapping type: {type(mapping)}")
# #         logger.info(f"Mapping: {mapping}")
        
# #         # Validate mapping parameter
# #         if mapping is None:
# #             mapping = {}
# #             logger.info("Mapping was None, set to empty dict")
# #         elif not isinstance(mapping, dict):
# #             logger.error(f"Expected mapping to be a dictionary, got {type(mapping)}: {mapping}")
# #             try:
# #                 logger.info("Attempting to convert mapping to dict")
# #                 if isinstance(mapping, list):
# #                     temp_dict = {}
# #                     for i, item in enumerate(mapping):
# #                         logger.info(f"List item {i}: {type(item)} - {item}")
# #                         if isinstance(item, dict) and "key" in item and "value" in item:
# #                             temp_dict[item["key"]] = item["value"]
# #                     mapping = temp_dict
# #                 else:
# #                     mapping = dict(mapping) if hasattr(mapping, "__iter__") else {}
# #                 logger.info(f"Conversion result: {mapping}")
# #             except Exception as e:
# #                 logger.exception(f"Conversion failed: {str(e)}")
# #                 mapping = {}
# #             logger.info(f"Final mapping after conversion: {mapping}")
        
# #         try:
# #             logger.info("Extracting resource ID")
# #             resource_id_info = extract_file_info(spreadsheet_url_or_id)
# #             logger.info(f"Extracted ID: {resource_id_info}")
# #         except ValueError as e:
# #             logger.error(f"ID extraction failed: {str(e)}")
# #             raise HTTPException(status_code=400, detail=str(e))
        
# #         if resource_id_info["type"] == "local_file" and os.path.exists(resource_id_info["id"]):
# #             logger.info(f"This is a local file: {resource_id_info['id']}")
# #             return process_local_file(resource_id_info["id"], header_row, mapping)
        
# #         resource_id = resource_id_info["id"]
# #         logger.info(f"Starting Google Sheets integration for: {resource_id}")
        
# #         db = get_database()
# #         source = db.lead_sources.find_one({"integration_id": resource_id})
# #         last_synced_row = header_row
# #         if source and "last_synced_row" in source:
# #             last_synced_row = source["last_synced_row"]
# #         logger.info(f"Last synced row: {last_synced_row}")
            
# #         try:
# #             logger.info("Setting up credentials")
# #             creds = get_google_credentials(SHEETS_SCOPES)
# #             logger.info("Successfully loaded credentials")
            
# #             logger.info("Authorizing gspread client")
# #             client = gspread.authorize(creds)
            
# #             logger.info(f"Opening spreadsheet with ID: {resource_id}")
# #             spreadsheet = client.open_by_key(resource_id)
# #             logger.info(f"Successfully opened spreadsheet: {spreadsheet.title}")
            
# #             logger.info(f"Accessing worksheet: {sheet_name}")
# #             sheet = spreadsheet.worksheet(sheet_name)
# #             logger.info(f"Successfully accessed worksheet: {sheet_name}")
            
# #             logger.info("Getting all values from worksheet")
# #             all_values = sheet.get_all_values()
# #             logger.info(f"Retrieved {len(all_values)} rows of data")
            
# #             if not all_values or len(all_values) <= header_row - 1:
# #                 logger.warning(f"No data found in sheet or header row ({header_row}) is invalid")
# #                 raise HTTPException(
# #                     status_code=400, 
# #                     detail=f"No data found or header row ({header_row}) is invalid"
# #                 )
# #             headers = all_values[header_row - 1]
# #             if not headers:
# #                 logger.error("Header row is empty")
# #                 raise HTTPException(status_code=400, detail="Header row is empty")
# #             logger.info(f"Headers found: {headers}")
            
# #             new_leads_count = 0
# #             processed_leads = []
# #             logger.info("Starting to process rows")
            
# #             for i, row in enumerate(all_values[header_row:], start=header_row + 1):
# #                 try:
# #                     if i <= last_synced_row:
# #                         continue
# #                     if len(row) < len(headers):
# #                         row = row + [""] * (len(headers) - len(row))
# #                     elif len(row) > len(headers):
# #                         row = row[:len(headers)]
                    
# #                     row_data = {header: row[j] if j < len(row) else "" for j, header in enumerate(headers)}
# #                     if not any(str(v).strip() for v in row_data.values() if v is not None):
# #                         continue

# #                     # ---- Lead model mapping ----
# #                     lead_dict = {
# #                         "source": "google_sheets",
# #                         "source_id": resource_id,
# #                         "created_at": datetime.now(),
# #                         "updated_at": datetime.now(),
# #                         "raw_data": row_data,
# #                         # Model fields - try to use mapping if provided, fallback to header names
# #                         "full_name": None,
# #                         "email": None,
# #                         "phone": None,
# #                         "status": "new",
# #                         "assigned_to": None,
# #                         "assigned_by": None,
# #                         "campaign": None,
# #                         "notes": None,
# #                     }
# #                     # Fill mapped fields
# #                     for model_field in ["full_name", "email", "phone", "status", "assigned_to", "assigned_by", "campaign", "notes"]:
# #                         mapped_header = mapping.get(model_field)
# #                         if mapped_header and mapped_header in row_data:
# #                             lead_dict[model_field] = row_data[mapped_header]

# #                     # Fallbacks for common headers if mapping not provided
# #                     if not lead_dict["full_name"]:
# #                         for k in ["Name", "name", "FULL NAME", "Full Name"]:
# #                             if k in row_data and row_data[k]:
# #                                 lead_dict["full_name"] = row_data[k]
# #                                 break
# #                     if not lead_dict["email"]:
# #                         for k in ["Email", "email", "EMAIL"]:
# #                             if k in row_data and row_data[k]:
# #                                 lead_dict["email"] = row_data[k]
# #                                 break
# #                     if not lead_dict["phone"]:
# #                         for k in ["Phone", "phone", "PHONE", "Mobile", "mobile"]:
# #                             if k in row_data and row_data[k]:
# #                                 lead_dict["phone"] = row_data[k]
# #                                 break
# #                     if not lead_dict["status"]:
# #                         for k in ["Status", "status", "Stage", "stage"]:
# #                             if k in row_data and row_data[k]:
# #                                 lead_dict["status"] = row_data[k]
# #                                 break
# #                     if not lead_dict["notes"]:
# #                         for k in ["Notes", "notes"]:
# #                             if k in row_data and row_data[k]:
# #                                 lead_dict["notes"] = row_data[k]
# #                                 break

# #                     # Check for duplicate leads
# #                     email = lead_dict.get("email")
# #                     phone = lead_dict.get("phone")
# #                     if email or phone:
# #                         duplicate = await find_duplicate_lead(email, phone)
# #                         if duplicate:
# #                             logger.info(f"Duplicate lead found: {email or phone}")
# #                             continue

# #                     # Insert into DB using insert_lead (should use Lead model validation)
# #                     await insert_lead(lead_dict)
# #                     processed_leads.append(lead_dict)
# #                     new_leads_count += 1
# #                     last_synced_row = i
# #                 except Exception as e:
# #                     logger.exception(f"Error processing row {i}: {str(e)}")
# #                     continue

# #             logger.info(f"Processed {new_leads_count} new leads")
# #             safe_mapping = dict(mapping) if isinstance(mapping, dict) else {}
# #             logger.info("Updating lead source info")
# #             source_update = {
# #                 "name": f"Google Sheet: {spreadsheet.title}",
# #                 "source_type": "google_sheets",
# #                 "integration_id": resource_id,
# #                 "mapping": safe_mapping,
# #                 "last_sync_time": datetime.now(),
# #                 "last_synced_row": last_synced_row,
# #                 "metadata": {
# #                     "sheet_name": sheet_name,
# #                     "header_row": header_row,
# #                     "spreadsheet_title": spreadsheet.title,
# #                 }
# #             }
# #             update_lead_source(resource_id, source_update)
# #             logger.info(f"Google Sheets integration completed successfully")
# #             return {
# #                 "success": True,
# #                 "message": f"Successfully imported {new_leads_count} new leads",
# #                 "spreadsheet_title": spreadsheet.title,
# #                 "sheet_name": sheet_name,
# #                 "timestamp": datetime.now().isoformat(),
# #                 "user": "soheru",
# #                 "leads": processed_leads
# #             }
# #         except Exception as e:
# #             logger.exception(f"Error accessing Google Sheets: {str(e)}")
# #             raise HTTPException(status_code=500, detail=f"Error accessing Google Sheets: {str(e)}")
# #     except HTTPException:
# #         logger.info("Re-raising HTTPException")
# #         raise 
# #     except Exception as e:
# #         logger.exception(f"Error processing Google Sheets request: {str(e)}")
# #         raise HTTPException(status_code=500, detail=f"Error processing Google Sheets request: {str(e)}")

# async def process_drive_file(
#     file_id: str,
#     header_row: int,
#     mapping: dict,
#     sheet_name: Optional[str] = None
# ):
#     """Process leads from Google Drive file (Excel, CSV, etc.)"""
#     try:
#         # Get the last processed row
#         db = get_database()
#         source = db.lead_sources.find_one({"integration_id": file_id})
        
#         last_synced_row = 0
#         if source and "last_synced_row" in source:
#             last_synced_row = source["last_synced_row"]
            
#         # Authenticate with Google Drive
#         try:
#             creds = get_google_credentials(DRIVE_SCOPES)
#         except ValueError as e:
#             logger.error(f"Credentials error: {str(e)}")
#             raise HTTPException(status_code=500, detail=f"Google credentials error: {str(e)}")
        
#         # Build Google Drive API client
#         drive_service = build('drive', 'v3', credentials=creds)
        
#         # Get file metadata to determine type
#         try:
#             file_metadata = drive_service.files().get(
#                 fileId=file_id, 
#                 fields='name,mimeType'
#             ).execute()
            
#             file_name = file_metadata.get('name', 'Unknown')
#             mime_type = file_metadata.get('mimeType', '')
            
#             logger.info(f"Found Google Drive file: {file_name}, type: {mime_type}")
#         except Exception as e:
#             logger.error(f"Error getting file metadata: {str(e)}")
#             raise HTTPException(
#                 status_code=404, 
#                 detail=f"File not found or not accessible. Make sure the file exists and your service account has access."
#             )
        
#         # Download file content
#         request = drive_service.files().get_media(fileId=file_id)
#         file_content = io.BytesIO()
        
#         downloader = MediaIoBaseDownload(file_content, request)
#         done = False
#         while not done:
#             _, done = downloader.next_chunk()
            
#         file_content.seek(0)
#         logger.info(f"Successfully downloaded file: {file_name}")
        
#         # Read file based on type
#         try:
#             if 'spreadsheet' in mime_type or file_name.endswith(('.xlsx', '.xls')):
#                 # Excel file
#                 logger.info(f"Reading as Excel file. Sheet name: {sheet_name}")
#                 df = pd.read_excel(file_content, sheet_name=sheet_name, header=header_row-1)
#             elif 'csv' in mime_type or file_name.endswith('.csv'):
#                 # CSV file
#                 logger.info("Reading as CSV file")
#                 df = pd.read_csv(file_content, header=header_row-1)
#             else:
#                 logger.warning(f"Unsupported file type: {mime_type}. Attempting to read as CSV.")
#                 try:
#                     df = pd.read_csv(file_content, header=header_row-1)
#                 except:
#                     # Try Excel if CSV fails
#                     file_content.seek(0)  # Reset stream position
#                     df = pd.read_excel(file_content, header=header_row-1)
                
#             logger.info(f"Successfully read file with {len(df)} rows and columns: {df.columns.tolist()}")
            
#             # Process rows
#             new_leads_count = 0
#             for i, (_, row) in enumerate(df.iterrows(), start=1):
#                 try:
#                     # Skip already processed rows
#                     if i <= last_synced_row:
#                         continue
                        
#                     # Convert row to dictionary - handle NaN values
#                     row_data = {}
#                     for col in df.columns:
#                         value = row[col]
#                         # Convert NaN to None for better MongoDB compatibility
#                         if pd.isna(value):
#                             row_data[col] = None
#                         else:
#                             row_data[col] = value
                    
#                     # Skip empty rows
#                     if not any(str(v).strip() for v in row_data.values() if v is not None):
#                         continue
                        
#                     # Create lead object
#                     lead = {
#                         "source": "google_drive",
#                         "source_id": file_id,
#                         "created_at": datetime.now(),
#                         "raw_data": row_data
#                     }
                    
#                     # Apply mapping
#                     for field, header in mapping.items():
#                         if header in row_data:
#                             lead[field] = row_data[header]
                            
#                     # Check for duplicate leads
#                     email = lead.get("email")
#                     phone = lead.get("phone")
                    
#                     if email or phone:
#                         duplicate = await find_duplicate_lead(email, phone)
#                         if duplicate:
#                             logger.info(f"Duplicate lead found: {email or phone}")
#                             continue
                            
#                     # Insert lead into database
#                     await insert_lead(lead)
#                     new_leads_count += 1
                    
#                     # Update last synced row
#                     last_synced_row = i
#                 except Exception as e:
#                     logger.error(f"Error processing row {i}: {str(e)}")
#                     # Continue with next row
#                     continue
            
#             # Update lead source
#             await update_lead_source(file_id, {
#                 "name": f"Google Drive: {file_name}",
#                 "source_type": "google_drive",
#                 "integration_id": file_id,
#                 "mapping": dict(mapping) if isinstance(mapping, dict) else {},  # Safe copy
#                 "last_sync_time": datetime.now(),
#                 "last_synced_row": last_synced_row,
#                 "metadata": {
#                     "file_name": file_name,
#                     "total_rows": len(df)
#                 }
#             })
            
#             return {
#                 "success": True,
#                 "message": f"Successfully imported {new_leads_count} new leads",
#                 "file_name": file_name,
#                 "total_rows": len(df)
#             }
            
#         except Exception as e:
#             logger.error(f"Error reading file content: {str(e)}")
#             raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
            
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error processing Google Drive file: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error processing Google Drive file: {str(e)}")


# async def process_local_file(file_path: str, header_row: int, mapping: Dict[str, str]):
#     """Process leads from a local CSV or Excel file"""
#     try:
#         # Check if file exists
#         if not os.path.exists(file_path):
#             raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
            
#         # Determine file type
#         file_ext = os.path.splitext(file_path)[1].lower()
        
#         # Read file based on extension
#         try:
#             if file_ext == '.csv':
#                 df = pd.read_csv(file_path, header=header_row-1)
#                 logger.info(f"Successfully read CSV file: {file_path}")
#             elif file_ext in ['.xlsx', '.xls']:
#                 df = pd.read_excel(file_path, header=header_row-1)
#                 logger.info(f"Successfully read Excel file: {file_path}")
#             else:
#                 raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}. Use .csv, .xlsx, or .xls")
#         except Exception as e:
#             logger.error(f"Error reading file: {str(e)}")
#             raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
        
#         # Get the last processed row
#         source_id = file_path
#         db = get_database()
#         source = db.lead_sources.find_one({"integration_id": source_id})
        
#         last_synced_row = 0  # For files, start from the beginning by default
#         if source and "last_synced_row" in source:
#             last_synced_row = source["last_synced_row"]
            
#         # Process rows that haven't been processed yet
#         new_leads_count = 0
#         for i, (_, row) in enumerate(df.iterrows(), start=1):
#             try:
#                 # Skip already processed rows
#                 if i <= last_synced_row:
#                     continue
                    
#                 # Convert row to dictionary - handle NaN values
#                 row_data = {}
#                 for col in df.columns:
#                     value = row[col]
#                     # Convert NaN to None for better MongoDB compatibility
#                     if pd.isna(value):
#                         row_data[col] = None
#                     else:
#                         row_data[col] = value
                
#                 # Skip empty rows
#                 if not any(str(v).strip() for v in row_data.values() if v is not None):
#                     continue
                    
#                 # Create lead object
#                 lead = {
#                     "source": "local_file",
#                     "source_id": source_id,
#                     "created_at": datetime.now(),
#                     "raw_data": row_data
#                 }
                
#                 # Apply mapping
#                 if isinstance(mapping, dict):  # Extra check
#                     for field, header in mapping.items():
#                         if header in row_data:
#                             lead[field] = row_data[header]
                        
#                 # Check for duplicate leads
#                 email = lead.get("email")
#                 phone = lead.get("phone")
                
#                 if email or phone:
#                     duplicate = await find_duplicate_lead(email, phone)
#                     if duplicate:
#                         logger.info(f"Duplicate lead found: {email or phone}")
#                         continue
                        
#                 # Insert lead into database
#                 await insert_lead(lead)
#                 new_leads_count += 1
                
#                 # Update last synced row
#                 last_synced_row = i
#             except Exception as e:
#                 logger.error(f"Error processing row {i}: {str(e)}")
#                 # Continue processing other rows even if one fails
#                 continue
            
#         # Update lead source info
#         file_name = os.path.basename(file_path)
#         await update_lead_source(source_id, {
#             "name": f"Local File: {file_name}",
#             "source_type": "local_file",
#             "integration_id": source_id,
#             "mapping": ensure_dict(mapping),  # Use ensure_dict here too
#             "last_sync_time": datetime.now(),
#             "last_synced_row": last_synced_row,
#             "metadata": {
#                 "file_path": file_path,
#                 "file_name": file_name,
#                 "header_row": header_row,
#                 "total_rows": len(df)
#             }
#         })
        
#         logger.info(f"Local file integration completed. Added {new_leads_count} new leads.")
#         return {
#             "success": True,
#             "message": f"Successfully imported {new_leads_count} new leads",
#             "file_name": file_name,
#             "total_rows": len(df)
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error processing local file: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error processing local file: {str(e)}")