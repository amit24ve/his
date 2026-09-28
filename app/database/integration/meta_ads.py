import requests
import hmac
import hashlib
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from app.utils.timezone_utils import get_ist_timestamp_for_db

from app.database import insert_lead, update_lead_source, find_duplicate_lead
from app.config import settings

# Set up logging
logger = logging.getLogger(__name__)

# Meta Graph API endpoints
API_VERSION = "v17.0"
GRAPH_API_URL = f"https://graph.facebook.com/{API_VERSION}"

async def process_meta_ads(
    access_token: str,
    ad_account_id: str,
    form_id: Optional[str] = None,
    mapping: Dict[str, str] = {},
):
    """Process leads from Meta Ads Lead Forms"""
    try:
        logger.info(f"Starting Meta Ads integration for account: {ad_account_id}")
        
        # Get the last processed lead ID
        from app.database import get_database
        db = get_database()
        source = await db.lead_sources.find_one({"integration_id": ad_account_id})
        
        last_synced_lead_id = None
        if source and "last_synced_lead_id" in source:
            last_synced_lead_id = source["last_synced_lead_id"]
            
        # Fetch form information if specific form_id is provided
        forms = []
        if form_id:
            forms = [await get_form_details(access_token, form_id)]
        else:
            # Get all forms for the ad account
            forms = await get_all_forms(access_token, ad_account_id)
            
        if not forms:
            logger.warning(f"No lead forms found for account: {ad_account_id}")
            return
            
        # Process leads from each form
        total_new_leads = 0
        newest_lead_id = last_synced_lead_id
        
        for form in forms:
            form_id = form["id"]
            form_name = form.get("name", "Unknown Form")
            
            logger.info(f"Processing leads for form: {form_name} (ID: {form_id})")
            
            # Get leads for this form
            leads = await get_form_leads(access_token, form_id, last_synced_lead_id)
            
            if not leads:
                logger.info(f"No new leads found for form: {form_name}")
                continue
                
            logger.info(f"Found {len(leads)} new leads for form: {form_name}")
            
            # Process each lead
            for lead in leads:
                lead_id = lead.get("id")
                
                # Keep track of newest lead ID for this sync
                if newest_lead_id is None or lead_id > newest_lead_id:
                    newest_lead_id = lead_id
                
                # Get lead field data
                field_data = lead.get("field_data", [])
                raw_data = {item["name"]: item["values"][0] for item in field_data if item.get("values")}
                
                # Create lead object
                lead_obj = {
                    "source": "meta_ads",
                    "source_id": ad_account_id,
                    "campaign": lead.get("campaign_name"),
                    "created_at": datetime.fromisoformat(lead.get("created_time").replace("Z", "+00:00")),
                    "raw_data": {**raw_data, **lead}
                }
                
                # Apply mapping
                for field, meta_field in mapping.items():
                    if meta_field in raw_data:
                        lead_obj[field] = raw_data[meta_field]
                
                # Check for duplicate leads
                # First check for duplicate by lead_id  
                lead_id = lead_obj.get("lead_id")
                if lead_id:
                    from app.database import get_database
                    db = get_database()
                    existing_lead = db.leads.find_one({"lead_id": lead_id})
                    if existing_lead:
                        logger.info(f"Lead with lead_id '{lead_id}' already exists, skipping.")
                        continue
                
                # Secondary check for duplicates by email or phone
                email = lead_obj.get("email")
                phone = lead_obj.get("phone")
                
                if email or phone:
                    duplicate = await find_duplicate_lead(email, phone)
                    if duplicate:
                        logger.info(f"Duplicate lead found: {email or phone}")
                        continue
                
                # Insert lead into database
                await insert_lead(lead_obj)
                total_new_leads += 1
        
        # Update lead source info
        await update_lead_source(ad_account_id, {
            "name": f"Meta Ads: {ad_account_id}",
            "source_type": "meta_ads",
            "mapping": mapping,
            "last_sync_time": get_ist_timestamp_for_db(),
            "last_synced_lead_id": newest_lead_id,
            "metadata": {
                "forms_count": len(forms),
                "form_ids": [form["id"] for form in forms]
            }
        })
        
        logger.info(f"Meta Ads integration completed. Added {total_new_leads} new leads.")
        
    except Exception as e:
        logger.error(f"Error processing Meta Ads data: {str(e)}")
        raise

async def get_all_forms(access_token: str, ad_account_id: str) -> List[Dict]:
    """Get all lead forms for an ad account"""
    try:
        url = f"{GRAPH_API_URL}/{ad_account_id}/leadgen_forms"
        params = {
            "access_token": access_token,
            "fields": "id,name,status,page,created_time"
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        return data.get("data", [])
    except Exception as e:
        logger.error(f"Error getting lead forms: {str(e)}")
        return []

async def get_form_details(access_token: str, form_id: str) -> Dict:
    """Get details for a specific form"""
    try:
        url = f"{GRAPH_API_URL}/{form_id}"
        params = {
            "access_token": access_token,
            "fields": "id,name,status,page,created_time,questions"
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error getting form details: {str(e)}")
        return {}

async def get_form_leads(access_token: str, form_id: str, last_synced_lead_id: Optional[str] = None) -> List[Dict]:
    """Get leads for a specific form, optionally filtering by date"""
    try:
        url = f"{GRAPH_API_URL}/{form_id}/leads"
        params = {
            "access_token": access_token,
            "fields": "id,created_time,field_data,campaign_name,ad_id,ad_name,adset_id,adset_name"
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        leads = data.get("data", [])
        
        # If last_synced_lead_id is provided, filter out already processed leads
        if last_synced_lead_id and leads:
            leads = [lead for lead in leads if lead["id"] > last_synced_lead_id]
            
        # Sort leads by ID to maintain chronological order
        leads.sort(key=lambda x: x["id"])
        
        return leads
    except Exception as e:
        logger.error(f"Error getting form leads: {str(e)}")
        return []

def verify_meta_webhook(payload: Dict[str, Any]) -> bool:
    """Verify Meta webhook signature"""
    try:
        # This is a simplified example, actual implementation depends on Meta's webhook format
        # For Lead Gen webhooks, Meta usually includes a signature in headers
        signature = payload.get("signature", "")
        if not signature or not settings.META_APP_SECRET:
            return False
            
        expected_signature = hmac.new(
            settings.META_APP_SECRET.encode(),
            msg=payload.get("data", "").encode(),
            digestmod=hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {str(e)}")
        return False