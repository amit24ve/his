# app/database/repositories/lead_repository.py
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.database import leads_collection, users_collection, serialize_id, get_object_id, find_lead_by_id_or_lead_id
from bson.objectid import ObjectId
import re

class LeadRepository:
    def __init__(self):
        self.collection = leads_collection
        
    def create_lead(self, lead_data: dict) -> dict:
        """Create a new lead with detailed logging"""
        try:
            # Add timestamps
            current_time = datetime.now()
            lead_data["created_at"] = current_time
            lead_data["updated_at"] = current_time
            
            print(f"[DEBUG] Attempting to insert lead: {lead_data}")
            
            # Ensure ID fields are ObjectID
            for field in ["assigned_to", "created_by"]:
                if field in lead_data and lead_data[field] and isinstance(lead_data[field], str):
                    try:
                        lead_data[field] = ObjectId(lead_data[field])
                    except Exception as e:
                        print(f"[WARN] Could not convert {field} to ObjectId: {str(e)}")
            
            # Insert into database with explicit write concern
            result = self.collection.insert_one(lead_data, write_concern={"w": 1})
            
            if not result.acknowledged:
                print("[ERROR] MongoDB insert was not acknowledged")
                return None
                
            inserted_id = result.inserted_id
            print(f"[DEBUG] Lead inserted with ID: {inserted_id}")
            
            # Retrieve the created lead to verify storage
            created_lead = self.collection.find_one({"_id": inserted_id})
            
            if not created_lead:
                print(f"[ERROR] Could not retrieve newly created lead with ID {inserted_id}")
                return None
                
            print(f"[SUCCESS] Lead successfully retrieved after creation: {created_lead['_id']}")
            
            # Return serialized lead
            return serialize_id(created_lead)
            
        except Exception as e:
            print(f"[ERROR] Exception while creating lead: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_lead_by_id(self, lead_id: str) -> Optional[dict]:
        """Get a lead by ID - supports both ObjectId and lead_id"""
        # Use the new helper function to find by either _id or lead_id
        lead = find_lead_by_id_or_lead_id(lead_id)
        
        if lead:
            # Get assigned user's name if there is one
            if lead.get("assigned_to"):
                user = users_collection.find_one({"_id": get_object_id(lead["assigned_to"])})
                if user:
                    lead["assigned_to_name"] = user.get("username")
        
        return serialize_id(lead) if lead else None
    
    def get_lead_by_email(self, email: str) -> Optional[dict]:
        """Find lead by email with case insensitive matching"""
        if not email:
            return None
        try:    
            # Use case insensitive regex for matching
            lead = self.collection.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
            if lead:
                return serialize_id(lead)
            return None
        except Exception as e:
            print(f"[ERROR] Error finding lead by email: {str(e)}")
            return None
        
    def get_lead_by_phone(self, phone: str) -> Optional[dict]:
        """Find lead by phone with formatting cleanup"""
        if not phone:
            return None
        try:
            # Remove non-digit characters for comparison
            clean_phone = re.sub(r'\D', '', phone)
            if not clean_phone:
                return None
                
            # Find leads and clean their phone numbers for comparison
            leads = self.collection.find({
                "$or": [
                    {"phone": {"$exists": True}},
                    {"alternate_phone": {"$exists": True}}
                ]
            })
            for lead in leads:
                lead_phone = re.sub(r'\D', '', lead.get("phone", ""))
                alternate_phone = re.sub(r'\D', '', lead.get("alternate_phone", ""))
                if clean_phone == lead_phone or clean_phone == alternate_phone:
                    return serialize_id(lead)
            return None
        except Exception as e:
            print(f"[ERROR] Error finding lead by phone: {str(e)}")
            return None
    
    def list_leads(self, filters: dict = None, skip: int = 0, limit: int = 100) -> List[dict]:
        """List leads with optional filtering and duplicate prevention"""
        if filters is None:
            filters = {}
        
        # Get leads
        cursor = self.collection.find(filters).skip(skip).limit(limit).sort("created_at", -1)
        leads = list(cursor)
        
        # Use dictionary to ensure unique leads by ID
        unique_leads = {}
        for lead in leads:
            # Use lead _id as key to prevent duplicates
            lead_id = str(lead.get("_id"))
            if lead_id not in unique_leads:
                unique_leads[lead_id] = lead
        
        # Convert back to list
        leads = list(unique_leads.values())
        
        # Get assigned users' names
        user_ids = []
        for lead in leads:
            if lead.get("assigned_to") and lead["assigned_to"] not in user_ids:
                user_ids.append(lead["assigned_to"])
        
        # Get users in one query if there are any assigned leads
        users = {}
        if user_ids:
            valid_user_ids = [get_object_id(uid) for uid in user_ids if uid]
            if valid_user_ids:
                user_objects = list(users_collection.find({"_id": {"$in": valid_user_ids}}))
                for user in user_objects:
                    users[str(user["_id"])] = user.get("username")
        
        # Add assigned_to_name to leads
        for lead in leads:
            if lead.get("assigned_to") and lead["assigned_to"] in users:
                lead["assigned_to_name"] = users[lead["assigned_to"]]
            else:
                lead["assigned_to_name"] = None
        
        # Serialize IDs
        return [serialize_id(lead) for lead in leads]
    
    def update_lead(self, lead_id: str, update_data: dict) -> bool:
        """Update a lead - supports both ObjectId and lead_id"""
        # Use the new helper function to find by either _id or lead_id
        lead = find_lead_by_id_or_lead_id(lead_id)
        if not lead:
            return False
        
        # Get the actual ObjectId for the update
        object_id = lead["_id"]
        
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.now()
        
        # Update the lead using the ObjectId
        result = self.collection.update_one(
            {"_id": object_id},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    def update_lead_status(self, lead_id: str, status: str) -> bool:
        """Update lead status"""
        return self.update_lead(lead_id, {"status": status})
    
    def delete_lead(self, lead_id: str) -> bool:
        """Delete a lead - supports both ObjectId and lead_id"""
        # Use the new helper function to find by either _id or lead_id
        lead = find_lead_by_id_or_lead_id(lead_id)
        if not lead:
            return False
        
        # Get the actual ObjectId for the deletion
        object_id = lead["_id"]
        
        result = self.collection.delete_one({"_id": object_id})
        return result.deleted_count > 0