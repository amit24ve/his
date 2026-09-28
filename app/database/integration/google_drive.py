import io
import logging
import pandas as pd
import re
from typing import Dict, Optional
from datetime import datetime
from fastapi import HTTPException
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from app.config import settings
from app.database import insert_lead, update_lead_source, find_duplicate_lead

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def extract_file_id(url: str) -> str:
    """Extract file ID from Google Drive URL"""
    patterns = [
        r'/file/d/([a-zA-Z0-9-_]+)',  # Standard Drive URL
        r'id=([a-zA-Z0-9-_]+)',       # URL with id parameter
        r'open\?id=([a-zA-Z0-9-_]+)'  # Alternative Drive URL format
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValueError(f"Could not extract file ID from URL: {url}")

async def process_google_drive(
    drive_url: str, 
    sheet_name: Optional[str] = None, 
    header_row: int = 1,
    mapping: Dict[str, str] = {}
):
    """Process leads from Google Drive file"""
    try:
        # Extract file ID
        file_id = extract_file_id(drive_url)
        logger.info(f"Extracted file ID: {file_id}")
        
        # Set up credentials
        creds = Credentials.from_service_account_file(
            settings.GOOGLE_SERVICE_ACCOUNT_FILE, scopes=SCOPES
        )
        
        # Build Google Drive API client
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Get file metadata to determine type
        try:
            file_metadata = drive_service.files().get(
                fileId=file_id, 
                fields='name,mimeType'
            ).execute()
            
            file_name = file_metadata.get('name', 'Unknown')
            mime_type = file_metadata.get('mimeType', '')
            
            logger.info(f"Found file: {file_name}, type: {mime_type}")
        except Exception as e:
            logger.error(f"Error getting file metadata: {str(e)}")
            raise HTTPException(
                status_code=404, 
                detail=f"File not found or not accessible. Make sure the file exists and your service account has access."
            )
        
        # Download file content
        request = drive_service.files().get_media(fileId=file_id)
        file_content = io.BytesIO()
        
        downloader = MediaIoBaseDownload(file_content, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
            
        file_content.seek(0)
        logger.info(f"Successfully downloaded file: {file_name}")
        
        # Read file based on type
        try:
            if 'spreadsheet' in mime_type or file_name.endswith(('.xlsx', '.xls')):
                # Excel file
                df = pd.read_excel(file_content, sheet_name=sheet_name, header=header_row-1)
            elif 'csv' in mime_type or file_name.endswith('.csv'):
                # CSV file
                df = pd.read_csv(file_content, header=header_row-1)
            else:
                logger.warning(f"Unsupported file type: {mime_type}. Attempting to read as CSV.")
                df = pd.read_csv(file_content, header=header_row-1)
                
            logger.info(f"Successfully read file with {len(df)} rows and columns: {df.columns.tolist()}")
            
            # Process rows
            new_leads_count = 0
            for _, row in df.iterrows():
                # Convert row to dictionary
                row_data = row.to_dict()
                
                # Skip empty rows
                if not any(str(v).strip() for v in row_data.values() if v is not None):
                    continue
                    
                # Create lead object
                lead = {
                    "source": "google_drive",
                    "source_id": file_id,
                    "created_at": datetime.now(),
                    "raw_data": row_data
                }
                
                # Apply mapping
                for field, header in mapping.items():
                    if header in row_data:
                        lead[field] = row_data[header]
                        
                # Check for duplicate leads
                email = lead.get("email")
                phone = lead.get("phone")
                
                if email or phone:
                    duplicate = await find_duplicate_lead(email, phone)
                    if duplicate:
                        logger.info(f"Duplicate lead found: {email or phone}")
                        continue
                        
                # Insert lead into database
                await insert_lead(lead)
                new_leads_count += 1
                
            # Update lead source
            await update_lead_source(file_id, {
                "name": f"Google Drive: {file_name}",
                "source_type": "google_drive",
                "integration_id": file_id,
                "mapping": mapping,
                "last_sync_time": datetime.now(),
                "metadata": {
                    "file_name": file_name,
                    "total_rows": len(df)
                }
            })
            
            return {
                "success": True,
                "message": f"Successfully imported {new_leads_count} new leads",
                "file_name": file_name,
                "total_rows": len(df),
                "columns": df.columns.tolist()
            }
            
        except Exception as e:
            logger.error(f"Error reading file content: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
            
    except ValueError as e:
        logger.error(f"Error extracting file ID: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error accessing Google Drive file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error accessing file: {str(e)}")