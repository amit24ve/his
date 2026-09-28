# app/database/repositories/quotation_repository.py
from datetime import datetime
from typing import List, Optional, Dict
from app.database import quotations_collection, leads_collection, serialize_id, get_object_id

class QuotationRepository:
    def __init__(self):
        self.collection = quotations_collection
        
    def _generate_quotation_number(self) -> str:
        """Generate a unique quotation number in QN### format"""
        
        # Find the latest quotation
        latest = self.collection.find_one(
            {"quotation_number": {"$regex": "^QN"}},
            sort=[("quotation_number", -1)]
        )
        
        if latest and "quotation_number" in latest:
            try:
                # Extract the sequence number from QN### format
                seq_str = latest["quotation_number"][2:]  # Remove "QN" prefix
                seq_num = int(seq_str) + 1
            except:
                seq_num = 1
        else:
            seq_num = 1
            
        # Format: QN### (QN001, QN002, etc.)
        return f"QN{seq_num:03d}"
    
    def create_quotation(self, quotation_data: dict) -> dict:
        """Create a new quotation"""
        # Add timestamps and default values
        quotation_data["created_at"] = datetime.now()
        quotation_data["updated_at"] = quotation_data["created_at"]
        
        if "status" not in quotation_data:
            quotation_data["status"] = "draft"
            
        if "quotation_number" not in quotation_data:
            quotation_data["quotation_number"] = self._generate_quotation_number()
        
        # Insert the quotation
        result = self.collection.insert_one(quotation_data)
        
        # Get the created quotation
        created_quotation = self.collection.find_one({"_id": result.inserted_id})
        
        # Enhance with lead name
        if created_quotation and created_quotation.get("lead_id"):
            lead = leads_collection.find_one({"_id": get_object_id(created_quotation["lead_id"])})
            if lead:
                created_quotation["lead_name"] = lead.get("full_name", "Unknown Lead")
        
        # Serialize ID
        return serialize_id(created_quotation)
    
    def list_quotations(self, filters: Dict = None, skip: int = 0, limit: int = 100) -> List[dict]:
        """List quotations with optional filtering"""
        if filters is None:
            filters = {}
            
        # Find quotations
        quotations = list(self.collection.find(filters).skip(skip).limit(limit).sort("created_at", -1))
        
        # Enhance with lead names
        self._enhance_with_lead_names(quotations)
        
        # Serialize IDs
        return [serialize_id(quotation) for quotation in quotations]
    
    def _enhance_with_lead_names(self, quotations: List[dict]) -> None:
        """Add lead names to quotations"""
        lead_ids = []
        for quotation in quotations:
            if quotation.get("lead_id") and quotation["lead_id"] not in lead_ids:
                lead_ids.append(quotation["lead_id"])
        
        if lead_ids:
            leads = {}
            lead_objects = leads_collection.find({"_id": {"$in": [get_object_id(lid) for lid in lead_ids if lid]}})
            
            for lead in lead_objects:
                leads[str(lead["_id"])] = lead.get("full_name", "Unknown Lead")
            
            for quotation in quotations:
                lead_id = quotation.get("lead_id")
                if lead_id and lead_id in leads:
                    quotation["lead_name"] = leads[lead_id]
                else:
                    quotation["lead_name"] = "Unknown Lead"