from fastapi import (
    APIRouter, HTTPException, Query, Depends
)

from typing import List, Optional, Dict, Any
import datetime
from bson import ObjectId

from app.database import (
    get_duplicate_leads, get_duplicate_leads_count, get_database
)
from app.routes.auth import get_current_user


# Initialize router with proper settings
duplicates_router = APIRouter(prefix="/api/duplicates", tags=["duplicates"])

# Helper functions for hierarchy (reused from assigned_leads2.py)
def get_user_by_id(db, user_id: str):
    """Get user by ID from database"""
    user = db.users.find_one({"user_id": user_id})
    if not user:
        user = db.users.find_one({"id": user_id})
    return user

def get_user_role_hierarchy(db, user_id: str):
    """Get user's role and hierarchy information"""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's roles
    user_roles = []
    if user.get("role_ids"):
        roles = list(db.roles.find({"id": {"$in": user["role_ids"]}}))
        user_roles = roles
    
    return user, user_roles

def get_direct_subordinates(db, user_id: str):
    """Get direct subordinates of a user based on role hierarchy"""
    user, user_roles = get_user_role_hierarchy(db, user_id)
    
    # Get all roles that report to any of the user's roles
    subordinate_role_ids = []
    for role in user_roles:
        # Find roles that report to this role
        reporting_roles = list(db.roles.find({"report_to": role["id"]}))
        subordinate_role_ids.extend([r["id"] for r in reporting_roles])
    
    # Find users with these subordinate roles
    subordinates = []
    if subordinate_role_ids:
        subordinate_users = list(db.users.find({
            "role_ids": {"$in": subordinate_role_ids},
            "is_active": True
        }))
        
        for sub_user in subordinate_users:
            # Get subordinate's roles
            sub_roles = list(db.roles.find({"id": {"$in": sub_user.get("role_ids", [])}}))
            
            subordinate_data = {
                "user_id": sub_user.get("user_id"),
                "name": sub_user.get("full_name", ""),
                "email": sub_user.get("email", ""),
                "phone": sub_user.get("phone", ""),
                "department": sub_user.get("department", ""),
                "roles": [{"id": r["id"], "name": r["name"]} for r in sub_roles],
                "can_view_duplicates": True
            }
            subordinates.append(subordinate_data)
    
    return subordinates

def get_all_subordinates_recursive(db, user_id: str):
    """Get all subordinates recursively (including subordinates of subordinates)"""
    all_subordinates = []
    direct_subordinates = get_direct_subordinates(db, user_id)
    
    for subordinate in direct_subordinates:
        all_subordinates.append(subordinate)
        # Recursively get subordinates of subordinates
        sub_subordinates = get_all_subordinates_recursive(db, subordinate["user_id"])
        all_subordinates.extend(sub_subordinates)
    
    return all_subordinates

def is_top_level_user(db, user_id: str):
    """Check if user is top-level (role with report_to = None)"""
    user, user_roles = get_user_role_hierarchy(db, user_id)
    
    for role in user_roles:
        if role.get("report_to") is None or role.get("report_to") == "null":
            return True
    return False

def can_see_all_duplicates(db, user_id: str):
    """Check if user can see all duplicate leads (only top-level users and their direct reports)"""
    # Top-level users can see all duplicates
    if is_top_level_user(db, user_id):
        return True
    
    # Check if user directly reports to a top-level user
    user, user_roles = get_user_role_hierarchy(db, user_id)
    
    for role in user_roles:
        if role.get("report_to"):
            # Check if the role they report to is a top-level role
            parent_role = db.roles.find_one({"id": role["report_to"]})
            if parent_role and (parent_role.get("report_to") is None or parent_role.get("report_to") == "null"):
                return True
    
    return False

# Utility function to make MongoDB documents JSON-serializable
def make_serializable(obj):
    """Convert MongoDB document to JSON-serializable dictionary."""
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_serializable(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime.datetime):
        return obj.isoformat()
    else:
        return obj

@duplicates_router.get("/")
async def get_all_duplicate_leads(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    lead_id: Optional[str] = Query(None, description="Filter by original lead ID"),
    source: Optional[str] = Query(None, description="Filter by source"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    # current_user: dict = Depends(get_current_user)
):
    """Get paginated duplicate leads with filtering options."""
    try:
        # Get duplicates with filtering
        duplicates = get_duplicate_leads(
            page=page, 
            limit=limit, 
            original_lead_id=lead_id,
            source=source,
            start_date=start_date,
            end_date=end_date
        )
        
        # Get total count for pagination
        total = get_duplicate_leads_count(original_lead_id=lead_id, source=source)
        
        # Format results for response
        formatted_duplicates = []
        for dup in duplicates:
            # Create a formatted version of the lead
            formatted_lead = {}
            for key, value in dup.items():
                if isinstance(value, ObjectId):
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
                    
            formatted_duplicates.append(formatted_lead)
        
        # Create a response that's guaranteed to be JSON serializable
        response = {
            "data": formatted_duplicates,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        
        return make_serializable(response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get duplicate leads: {str(e)}")

@duplicates_router.get("/count")
async def get_duplicate_count(
    lead_id: Optional[str] = Query(None, description="Filter by original lead ID"),
    source: Optional[str] = Query(None, description="Filter by source"),
    current_user: dict = Depends(get_current_user)
):
    """Get count of duplicate leads with filtering options."""
    try:
        # Get count with filtering
        count = get_duplicate_leads_count(original_lead_id=lead_id, source=source)
        
        return {
            "count": count,
            "lead_id": lead_id,
            "source": source
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get duplicate count: {str(e)}")

# Hierarchy endpoints for duplicate leads
@duplicates_router.get("/hierarchy/{user_id}")
async def get_user_duplicates_hierarchy(user_id: str):
    """Get duplicate leads hierarchy for a specific user"""
    try:
        db = get_database()
        
        # Get user and their roles
        user, user_roles = get_user_role_hierarchy(db, user_id)
        
        # Build hierarchy structure
        hierarchy = {
            "user_id": user.get("user_id"),
            "name": user.get("full_name", ""),
            "email": user.get("email", ""),
            "roles": [{"id": r["id"], "name": r["name"], "report_to": r.get("report_to")} for r in user_roles],
            "is_top_level": is_top_level_user(db, user_id),
            "can_see_all_duplicates": can_see_all_duplicates(db, user_id),
            "direct_subordinates": get_direct_subordinates(db, user_id),
            "all_subordinates": get_all_subordinates_recursive(db, user_id)
        }
        
        return make_serializable({
            "success": True,
            "hierarchy": hierarchy
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get duplicates hierarchy: {str(e)}")

@duplicates_router.get("/subordinate-duplicates/{manager_id}")
async def get_subordinate_duplicate_leads(
    manager_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    source: Optional[str] = Query(None, description="Filter by source"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)")
):
    """Get all duplicate leads from subordinates of a manager"""
    try:
        db = get_database()
        
        # Get all subordinates
        subordinates = get_all_subordinates_recursive(db, manager_id)
        subordinate_ids = [sub["user_id"] for sub in subordinates]
        
        if not subordinate_ids:
            return make_serializable({
                "success": True,
                "duplicates": [],
                "total": 0,
                "subordinates": []
            })
        
        # Get leads assigned to subordinates to find their lead_ids
        leads_query = {"assigned_to": {"$in": subordinate_ids}}
        subordinate_leads = list(db.leads.find(leads_query, {"lead_id": 1, "assigned_to": 1}))
        subordinate_lead_ids = [lead.get("lead_id") for lead in subordinate_leads if lead.get("lead_id")]
        
        if not subordinate_lead_ids:
            return make_serializable({
                "success": True,
                "duplicates": [],
                "total": 0,
                "subordinates": subordinates
            })
        
        # Get duplicate leads that reference these subordinate leads
        duplicates = get_duplicate_leads(
            page=page,
            limit=limit,
            original_lead_id=None,  # We'll filter manually below
            source=source,
            start_date=start_date,
            end_date=end_date
        )
        
        # Filter duplicates to only include those related to subordinate leads
        filtered_duplicates = []
        for duplicate in duplicates:
            if (duplicate.get("original_lead_id") in subordinate_lead_ids or 
                duplicate.get("lead_id") in subordinate_lead_ids):
                
                # Add assigned user info if available
                if duplicate.get("original_lead_id"):
                    related_lead = next((lead for lead in subordinate_leads 
                                       if lead.get("lead_id") == duplicate["original_lead_id"]), None)
                    if related_lead and related_lead.get("assigned_to"):
                        assigned_user = get_user_by_id(db, related_lead["assigned_to"])
                        if assigned_user:
                            duplicate["assigned_user_info"] = {
                                "user_id": assigned_user.get("user_id"),
                                "name": assigned_user.get("full_name", ""),
                                "email": assigned_user.get("email", "")
                            }
                
                filtered_duplicates.append(duplicate)
        
        return make_serializable({
            "success": True,
            "duplicates": filtered_duplicates,
            "total": len(filtered_duplicates),
            "subordinates": subordinates,
            "page": page,
            "limit": limit
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subordinate duplicate leads: {str(e)}")

@duplicates_router.get("/organization-hierarchy")
async def get_duplicates_organization_hierarchy():
    """Get complete organization hierarchy with duplicate leads statistics"""
    try:
        db = get_database()
        
        # Get all roles and users
        roles = list(db.roles.find())
        users = list(db.users.find({"is_active": True}))
        
        # Build role hierarchy
        def build_role_hierarchy(parent_role_id=None):
            hierarchy = []
            
            # Find roles that report to the parent role
            if parent_role_id is None:
                # Top-level roles (report_to is None or null)
                child_roles = [r for r in roles if r.get("report_to") in [None, "null"]]
            else:
                child_roles = [r for r in roles if r.get("report_to") == parent_role_id]
            
            for role in child_roles:
                # Find users with this role
                role_users = []
                for user in users:
                    if user.get("role_ids") and role["id"] in user["role_ids"]:
                        # Count duplicate leads for leads assigned to this user
                        user_leads = list(db.leads.find({"assigned_to": user.get("user_id")}, {"lead_id": 1}))
                        user_lead_ids = [lead.get("lead_id") for lead in user_leads if lead.get("lead_id")]
                        
                        # Count duplicates related to this user's leads
                        duplicates_count = 0
                        if user_lead_ids:
                            # Get duplicate leads where original_lead_id is in user's leads
                            duplicates_count = get_duplicate_leads_count(original_lead_id=None)  # Get all, then filter
                            # Note: The get_duplicate_leads_count function would need modification to accept a list of lead_ids
                            # For now, we'll use a simplified count
                            try:
                                all_duplicates = get_duplicate_leads(page=1, limit=1000)  # Get a large batch
                                duplicates_count = len([d for d in all_duplicates 
                                                      if d.get("original_lead_id") in user_lead_ids])
                            except:
                                duplicates_count = 0
                        
                        user_data = {
                            "user_id": user.get("user_id"),
                            "name": user.get("full_name", ""),
                            "email": user.get("email", ""),
                            "phone": user.get("phone", ""),
                            "department": user.get("department", ""),
                            "duplicates_count": duplicates_count,
                            "subordinates": []
                        }
                        role_users.append(user_data)
                
                # Build subordinate hierarchy
                subordinate_hierarchy = build_role_hierarchy(role["id"])
                
                # Add subordinates to each user in this role
                for user_data in role_users:
                    user_data["subordinates"] = subordinate_hierarchy
                
                role_data = {
                    "role_id": role["id"],
                    "role_name": role["name"],
                    "role_description": role.get("description", ""),
                    "report_to": role.get("report_to"),
                    "users": role_users
                }
                hierarchy.append(role_data)
            
            return hierarchy
        
        hierarchy = build_role_hierarchy()
        
        return make_serializable({
            "success": True,
            "hierarchy": hierarchy
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get duplicates organization hierarchy: {str(e)}")
