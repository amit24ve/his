from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from app.database import db

logger = logging.getLogger(__name__)

def get_leads(
    page: int = 1, 
    limit: int = 100,
    source: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get leads with pagination and filtering"""
    
    # Prepare query
    query = {}
    
    # Filter by source
    if source:
        query["source"] = source
    
    # Filter by date range
    if start_date or end_date:
        date_query = {}
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_query["$gte"] = start
            except ValueError:
                logger.warning(f"Invalid start_date format: {start_date}")
                
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                date_query["$lte"] = end
            except ValueError:
                logger.warning(f"Invalid end_date format: {end_date}")
                
        if date_query:
            query["created_at"] = date_query
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    cursor = db.leads.find(
        query,
        sort=[("created_at", -1)],
        skip=skip,
        limit=limit
    )
    
    # Convert MongoDB documents to list of dicts (synchronous version)
    leads = list(cursor)
    
    # Convert _id to string
    for lead in leads:
        lead["id"] = str(lead.pop("_id"))
    
    return leads

def get_lead_sources() -> List[Dict[str, Any]]:
    """Get all lead sources"""
    
    cursor = db.lead_sources.find(sort=[("source_type", 1), ("name", 1)])
    
    # Synchronous version - convert cursor to list
    sources = list(cursor)
    
    # Convert _id to string
    for source in sources:
        source["id"] = str(source.pop("_id"))
    
    # Add lead count for each source
    for source in sources:
        source["total_leads"] = db.leads.count_documents({
            "source": source["source_type"],
            "source_id": source["integration_id"]
        })
    
    return sources