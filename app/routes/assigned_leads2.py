from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import List, Optional, Dict, Any
from bson import ObjectId
import datetime
from app.database import get_database
from app.database.schemas.lead_integration import flatten_lead_data
from app.core.security import get_current_user


# Initialize router
assigned_leads2_router = APIRouter(prefix="/api/assigned-leads2", tags=["assigned-leads2"])

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
            
            # Count assigned leads for this subordinate
            assigned_leads_count = db.leads.count_documents({"assigned_to": sub_user.get("user_id")})
            
            subordinate_data = {
                "user_id": sub_user.get("user_id"),
                "name": sub_user.get("full_name", ""),
                "email": sub_user.get("email", ""),
                "phone": sub_user.get("phone", ""),
                "department": sub_user.get("department", ""),
                "roles": [{"id": r["id"], "name": r["name"]} for r in sub_roles],
                "assigned_leads_count": assigned_leads_count,
                "can_assign_leads": True
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

def can_see_unassigned_leads(db, user_id: str):
    """Check if user can see unassigned leads (only top-level users and their direct reports)"""
    # Top-level users can see unassigned leads
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

@assigned_leads2_router.get("/hierarchy/{user_id}")
async def get_user_hierarchy(user_id: str):
    """Get user hierarchy for a specific user"""
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
            "can_see_unassigned": can_see_unassigned_leads(db, user_id),
            "direct_subordinates": get_direct_subordinates(db, user_id),
            "all_subordinates": get_all_subordinates_recursive(db, user_id)
        }
        
        return make_serializable({
            "success": True,
            "hierarchy": hierarchy
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get hierarchy: {str(e)}")

@assigned_leads2_router.get("/subordinates/{user_id}")
async def get_subordinates(user_id: str):
    """Get direct subordinates for a user"""
    try:
        db = get_database()
        subordinates = get_direct_subordinates(db, user_id)
        
        return make_serializable({
            "success": True,
            "subordinates": subordinates,
            "total": len(subordinates)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subordinates: {str(e)}")

@assigned_leads2_router.get("/leads/{user_id}")
async def get_user_leads(
    user_id: str,
    status: Optional[str] = Query(None, description="Filter by lead status"),
    source: Optional[str] = Query(None, description="Filter by lead source"),
    date_range: Optional[str] = Query(None, description="Filter by date range"),
    limit: int = Query(50, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get leads assigned to a specific user"""
    try:
        db = get_database()
        
        # Build query
        query = {"assigned_to": user_id}
        
        if status:
            query["status"] = status
        if source:
            query["source"] = source
        if date_range:
            # Add date range logic here
            pass
        
        # Get leads
        leads = list(db.leads.find(query).skip(skip).limit(limit))
        total = db.leads.count_documents(query)
        
        # Enrich leads with user info
        for lead in leads:
            if lead.get("assigned_to"):
                assigned_user = get_user_by_id(db, lead["assigned_to"])
                if assigned_user:
                    lead["assigned_user_info"] = {
                        "user_id": assigned_user.get("user_id"),
                        "name": assigned_user.get("full_name", ""),
                        "email": assigned_user.get("email", "")
                    }
        
        return make_serializable({
            "success": True,
            "leads": leads,
            "total": total,
            "limit": limit,
            "skip": skip
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get leads: {str(e)}")

@assigned_leads2_router.get("/subordinate-leads/{manager_id}")
async def get_subordinate_leads(
    manager_id: str,
    status: Optional[str] = Query(None, description="Filter by lead status"),
    source: Optional[str] = Query(None, description="Filter by lead source"),
    date_range: Optional[str] = Query(None, description="Filter by date range"),
    limit: int = Query(100, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get all leads assigned to subordinates of a manager"""
    try:
        db = get_database()
        
        # Get all subordinates
        subordinates = get_all_subordinates_recursive(db, manager_id)
        subordinate_ids = [sub["user_id"] for sub in subordinates]
        
        if not subordinate_ids:
            return make_serializable({
                "success": True,
                "leads": [],
                "total": 0,
                "subordinates": []
            })
        
        # Build query
        query = {"assigned_to": {"$in": subordinate_ids}}
        
        if status:
            query["status"] = status
        if source:
            query["source"] = source
        if date_range:
            # Add date range logic here
            pass
        
        # Get leads
        leads = list(db.leads.find(query).skip(skip).limit(limit))
        total = db.leads.count_documents(query)
        
        # Enrich leads with user info
        for lead in leads:
            if lead.get("assigned_to"):
                assigned_user = get_user_by_id(db, lead["assigned_to"])
                if assigned_user:
                    lead["assigned_user_info"] = {
                        "user_id": assigned_user.get("user_id"),
                        "name": assigned_user.get("full_name", ""),
                        "email": assigned_user.get("email", "")
                    }
        
        return make_serializable({
            "success": True,
            "leads": leads,
            "total": total,
            "subordinates": subordinates,
            "limit": limit,
            "skip": skip
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subordinate leads: {str(e)}")

@assigned_leads2_router.get("/unassigned-leads/{user_id}")
async def get_unassigned_leads(
    user_id: str,
    status: Optional[str] = Query(None, description="Filter by lead status"),
    source: Optional[str] = Query(None, description="Filter by lead source"),
    date_range: Optional[str] = Query(None, description="Filter by date range"),
    limit: int = Query(50, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get unassigned leads (only visible to top-level users and their direct reports)"""
    try:
        db = get_database()
        
        # Check if user can see unassigned leads
        if not can_see_unassigned_leads(db, user_id):
            raise HTTPException(status_code=403, detail="You are not authorized to view unassigned leads")
        
        # Build query for unassigned leads
        query = {"$or": [{"assigned_to": {"$exists": False}}, {"assigned_to": None}, {"assigned_to": ""}]}
        
        if status:
            query["status"] = status
        if source:
            query["source"] = source
        if date_range:
            # Add date range logic here
            pass
        
        # Get leads
        leads = list(db.leads.find(query).skip(skip).limit(limit))
        total = db.leads.count_documents(query)
        
        return make_serializable({
            "success": True,
            "leads": leads,
            "total": total,
            "limit": limit,
            "skip": skip
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get unassigned leads: {str(e)}")

@assigned_leads2_router.post("/auto-assign/{user_id}")
async def auto_assign_leads(
    user_id: str,
    body: Dict[str, Any] = Body(...)
):
    """Auto-assign unassigned leads equally to level 1 subordinates"""
    try:
        db = get_database()
        
        # Check if user can see unassigned leads
        if not can_see_unassigned_leads(db, user_id):
            raise HTTPException(status_code=403, detail="You are not authorized to assign leads")
        
        # Get direct subordinates (level 1)
        subordinates = get_direct_subordinates(db, user_id)
        
        if not subordinates:
            raise HTTPException(status_code=400, detail="No subordinates found to assign leads to")
        
        # Get unassigned leads
        unassigned_leads = list(db.leads.find({
            "$or": [{"assigned_to": {"$exists": False}}, {"assigned_to": None}, {"assigned_to": ""}]
        }))
        
        if not unassigned_leads:
            return make_serializable({
                "success": True,
                "message": "No unassigned leads found",
                "assigned_count": 0,
                "subordinates": subordinates
            })
        
        # Distribute leads equally
        subordinate_count = len(subordinates)
        assigned_count = 0
        
        for i, lead in enumerate(unassigned_leads):
            subordinate_index = i % subordinate_count
            subordinate = subordinates[subordinate_index]
            
            # Assign lead to subordinate
            db.leads.update_one(
                {"_id": lead["_id"]},
                {
                    "$set": {
                        "assigned_to": subordinate["user_id"],
                        "assigned_at": datetime.datetime.now(),
                        "assigned_by": user_id
                    }
                }
            )
            assigned_count += 1
        
        return make_serializable({
            "success": True,
            "message": f"Successfully assigned {assigned_count} leads to {subordinate_count} subordinates",
            "assigned_count": assigned_count,
            "subordinates": subordinates
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-assign leads: {str(e)}")

@assigned_leads2_router.post("/manual-assign/{user_id}")
async def manual_assign_leads(
    user_id: str,
    body: Dict[str, Any] = Body(...)
):
    """Manually assign leads to a subordinate"""
    try:
        db = get_database()
        
        lead_ids = body.get("lead_ids", [])
        assigned_to = body.get("assigned_to")
        
        if not lead_ids or not assigned_to:
            raise HTTPException(status_code=400, detail="lead_ids and assigned_to are required")
        
        # Check if the person being assigned to is a subordinate of the user
        subordinates = get_direct_subordinates(db, user_id)
        subordinate_ids = [sub["user_id"] for sub in subordinates]
        
        if assigned_to not in subordinate_ids:
            raise HTTPException(status_code=403, detail="You can only assign leads to your direct subordinates")
        
        # Convert lead_ids to ObjectId if needed
        lead_object_ids = []
        for lead_id in lead_ids:
            if isinstance(lead_id, str):
                try:
                    lead_object_ids.append(ObjectId(lead_id))
                except:
                    # If not a valid ObjectId, use as string
                    lead_object_ids.append(lead_id)
            else:
                lead_object_ids.append(lead_id)
        
        # Assign leads
        result = db.leads.update_many(
            {"_id": {"$in": lead_object_ids}},
            {
                "$set": {
                    "assigned_to": assigned_to,
                    "assigned_at": datetime.datetime.now(),
                    "assigned_by": user_id
                }
            }
        )
        
        return make_serializable({
            "success": True,
            "message": f"Successfully assigned {result.modified_count} leads",
            "assigned_count": result.modified_count
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to manually assign leads: {str(e)}")

@assigned_leads2_router.get("/statistics/{user_id}")
async def get_user_statistics(user_id: str):
    """Get statistics for a user and their subordinates"""
    try:
        db = get_database()
        
        # Get user info
        user, user_roles = get_user_role_hierarchy(db, user_id)
        
        # Get subordinates
        subordinates = get_all_subordinates_recursive(db, user_id)
        subordinate_ids = [sub["user_id"] for sub in subordinates]
        
        # Get statistics
        stats = {
            "user_info": {
                "user_id": user.get("user_id"),
                "name": user.get("full_name", ""),
                "roles": [r["name"] for r in user_roles],
                "is_top_level": is_top_level_user(db, user_id),
                "can_see_unassigned": can_see_unassigned_leads(db, user_id)
            },
            "subordinates_count": len(subordinates),
            "total_leads_assigned_to_subordinates": db.leads.count_documents({"assigned_to": {"$in": subordinate_ids}}) if subordinate_ids else 0,
            "unassigned_leads_count": db.leads.count_documents({
                "$or": [{"assigned_to": {"$exists": False}}, {"assigned_to": None}, {"assigned_to": ""}]
            }) if can_see_unassigned_leads(db, user_id) else 0,
            "subordinates_stats": []
        }
        
        # Get individual subordinate stats
        for subordinate in subordinates:
            subordinate_leads = db.leads.count_documents({"assigned_to": subordinate["user_id"]})
            subordinate_stats = {
                "user_id": subordinate["user_id"],
                "name": subordinate["name"],
                "assigned_leads_count": subordinate_leads,
                "roles": [r["name"] for r in subordinate["roles"]]
            }
            stats["subordinates_stats"].append(subordinate_stats)
        
        return make_serializable({
            "success": True,
            "statistics": stats
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

@assigned_leads2_router.get("/organization-hierarchy")
async def get_organization_hierarchy():
    """Get complete organization hierarchy starting from top-level roles"""
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
                        # Count assigned leads for this user
                        assigned_leads_count = db.leads.count_documents({"assigned_to": user.get("user_id")})
                        
                        user_data = {
                            "user_id": user.get("user_id"),
                            "name": user.get("full_name", ""),
                            "email": user.get("email", ""),
                            "phone": user.get("phone", ""),
                            "department": user.get("department", ""),
                            "assigned_leads_count": assigned_leads_count,
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
        raise HTTPException(status_code=500, detail=f"Failed to get organization hierarchy: {str(e)}")
