
from fastapi import APIRouter, HTTPException, status, Query, Depends, Body
from typing import List
from bson import ObjectId
import datetime
from datetime import datetime
from app.database.repositories.followup_repository import (
    add_followup, 
    fetch_upcoming_reminders, 
    fetch_followups_for_lead, 
    update_followup )
from app.database.schemas.followup_schema import FollowUpUpdate, FollowUpCreate, FollowUpType, FollowUpStatus
from app.database import followups_collection
from app.utils.timezone_utils import (
    get_ist_now, get_ist_timestamp_for_db, convert_to_ist, 
    make_datetime_serializable, ensure_ist_timezone
)
from app.services.hierarchy_helper import HierarchyHelper
from app.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)
followup_router = APIRouter(prefix="/api/followups", tags=["followups"])

@followup_router.post("/", response_model=dict, status_code=201)
async def api_add_followup(followup: FollowUpCreate, current_user: dict = Depends(get_current_user)):
    """
    Add a new followup with hierarchy-based access control
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Followup creation requested by user: {user_id}")
        
        followup_data = followup.dict()
        
        # Check if user can create followup for the specified lead
        if followup_data.get("lead_id"):
            from app.database import db
            lead = db.leads.find_one({"lead_id": followup_data["lead_id"]})
            if lead:
                lead_owner = lead.get("assigned_to") or lead.get("assigned_user_id") or lead.get("created_by")
                is_admin = await HierarchyHelper.is_user_admin(user_id)
                
                if not is_admin and lead_owner and not await HierarchyHelper.can_access_resource(user_id, lead_owner):
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied: You don't have permission to create followups for this lead"
                    )
        
        # Add creator information
        followup_data["created_by"] = user_id
        followup_data["created_at"] = get_ist_now()
        
        result = await add_followup(followup_data)
        return {"success": True, "followup": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in api_add_followup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add followup: {str(e)}")


@followup_router.get("/reminders/{user_id}", response_model=List[dict])
async def api_get_upcoming_reminders(user_id: str, window_minutes: int = 10, current_user: dict = Depends(get_current_user)):
    """
    Get upcoming reminders for a user with hierarchy-based access control
    """
    try:
        current_user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Reminders requested by user: {current_user_id} for user: {user_id}")
        
        # Check if current user can access reminders for the specified user
        is_admin = await HierarchyHelper.is_user_admin(current_user_id)
        
        if not is_admin and current_user_id != user_id:
            can_access = await HierarchyHelper.can_access_resource(current_user_id, user_id)
            if not can_access:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You can only view your own reminders or those of your subordinates"
                )
        
        reminders = await fetch_upcoming_reminders(user_id, window_minutes=window_minutes)
        return reminders or []
    except HTTPException:
        raise
    except Exception as e:
        print("ERROR in fetch_upcoming_reminders:", e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch reminders: {str(e)}")

@followup_router.get("/reminders/all/admin", response_model=List[dict])
async def api_get_all_upcoming_reminders(window_minutes: int = 10, current_user: dict = Depends(get_current_user)):
    """
    Get all upcoming reminders with hierarchy-based filtering
    Admin users see all reminders, non-admin users see only their team's reminders
    """
    try:
        current_user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"All reminders requested by user: {current_user_id}")
        
        is_admin = await HierarchyHelper.is_user_admin(current_user_id)
        
        if is_admin:
            # Admin users can see all reminders
            from app.database.repositories.followup_repository import fetch_all_upcoming_reminders
            reminders = await fetch_all_upcoming_reminders(window_minutes=window_minutes)
        else:
            # Non-admin users see reminders for accessible users only
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(current_user_id)
            logger.info(f"Non-admin user {current_user_id} can access users: {accessible_user_ids}")
            
            # Fetch reminders for all accessible users
            all_reminders = []
            for user_id in accessible_user_ids:
                user_reminders = await fetch_upcoming_reminders(user_id, window_minutes=window_minutes)
                if user_reminders:
                    all_reminders.extend(user_reminders)
            reminders = all_reminders
        
        return reminders or []
        return reminders or []
    except Exception as e:
        print("ERROR in fetch_all_upcoming_reminders:", e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch all reminders: {str(e)}")

@followup_router.get("/collection", response_model=List[dict])
async def api_get_followups_collection(current_user: dict = Depends(get_current_user)):
    """
    Get follow-ups with hierarchy-based access control
    Only shows follow-ups for leads assigned to user or their subordinates, or follow-ups created by them
    """
    try:
        from app.database import followups_collection, db
        
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Followups collection requested by user: {user_id}")
        
        # Check if user is admin - admins can see all followups
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if is_admin:
            # Admin users can see all followups
            collection = followups_collection()
            cursor = collection.find({})
        else:
            # Non-admin users: get accessible user IDs for hierarchy filtering
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            logger.info(f"User {user_id} can access follow-ups for users: {accessible_user_ids}")
            
            # Create filter for hierarchy-based access:
            # 1. Follow-ups assigned to user or their subordinates
            # 2. Follow-ups created by user
            # 3. Follow-ups for leads assigned to user or their subordinates
            
            # Get all leads that user can access
            leads_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}}
                ]
            }
            
            from app.database import async_db
            if async_db is not None:
                accessible_leads = await async_db.leads.find(leads_query, {"lead_id": 1}).to_list(length=None)
            else:
                # Fallback to sync collection
                from app.database import leads_collection
                accessible_leads = list(leads_collection().find(leads_query, {"lead_id": 1}))
            accessible_lead_ids = [lead.get("lead_id") for lead in accessible_leads if lead.get("lead_id")]
            
            # Filter followups by:
            # - Assigned to accessible users
            # - Created by accessible users  
            # - For accessible leads
            followup_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}},
                    {"lead_id": {"$in": accessible_lead_ids}}
                ]
            }
            
            collection = followups_collection()
            cursor = collection.find(followup_query)
        
        followups = []
        # Use regular for loop since this is synchronous cursor
        for doc in cursor:
            # Simple serialization
            doc["_id"] = str(doc["_id"])
            
            # Handle datetime fields
            for field in ["created_at", "updated_at", "scheduled_date"]:
                if field in doc and isinstance(doc[field], datetime):
                    doc[field] = doc[field].isoformat()
            
            followups.append(doc)
        
        logger.info(f"Returning {len(followups)} followups for user {user_id}")
        return followups
    except Exception as e:
        logger.error(f"ERROR in api_get_followups_collection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch followups collection: {str(e)}")

@followup_router.get("/all", response_model=List[dict])
async def api_get_all_followups(current_user: dict = Depends(get_current_user)):
    """
    Get all follow-ups with hierarchy-based access control
    Only shows follow-ups for leads assigned to user or their subordinates, or follow-ups created by them
    """
    try:
        from app.database import followups_collection
        
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"All followups requested by user: {user_id}")
        
        # Check if user is admin - admins can see all followups
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if is_admin:
            # Admin users can see all followups
            collection = followups_collection()
            followups = list(collection.find({}).sort("created_at", -1))
        else:
            # Non-admin users: get accessible user IDs for hierarchy filtering
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            logger.info(f"User {user_id} can access follow-ups for users: {accessible_user_ids}")
            
            # Get all leads that user can access
            leads_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}}
                ]
            }
            
            from app.database import leads_collection
            accessible_leads = list(leads_collection().find(leads_query, {"lead_id": 1}))
            accessible_lead_ids = [lead.get("lead_id") for lead in accessible_leads if lead.get("lead_id")]
            
            # Filter followups by hierarchy
            followup_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}},
                    {"lead_id": {"$in": accessible_lead_ids}}
                ]
            }
            
            collection = followups_collection()
            followups = list(collection.find(followup_query).sort("created_at", -1))
        
        # Process followups for JSON serialization
        processed_followups = []
        for followup in followups:
            # Convert ObjectId and datetime fields for JSON serialization
            if isinstance(followup.get("_id"), ObjectId):
                followup["_id"] = str(followup["_id"])
            
            # Handle datetime fields
            for field in ["created_at", "updated_at", "scheduled_date"]:
                if field in followup and isinstance(followup[field], datetime):
                    followup[field] = followup[field].isoformat()
            
            processed_followups.append(followup)
        
        logger.info(f"Retrieved {len(processed_followups)} followups from collection for user {user_id}")
        return processed_followups
    except Exception as e:
        logger.error(f"ERROR in api_get_all_followups: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch all follow-ups: {str(e)}")

@followup_router.get("/user/{user_id}", response_model=List[dict])
async def api_get_user_followups(
    user_id: str, 
    date: str = Query(None, description="Filter by date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all follow-ups for a specific user with hierarchy-based access control
    """
    try:
        current_user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"User followups requested by {current_user_id} for user {user_id}, date filter: {date}")
        
        # Check if current user can access the requested user's followups
        is_admin = await HierarchyHelper.is_user_admin(current_user_id)
        
        if not is_admin and current_user_id != user_id:
            can_access = await HierarchyHelper.can_access_resource(current_user_id, user_id)
            if not can_access:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You can only view your own follow-ups or those of your subordinates"
                )
        
        # Build query with optional date filter
        from app.database import followups_collection
        from datetime import datetime
        
        collection = followups_collection()
        query = {"assigned_to": user_id}
        
        # Add date filter if provided
        if date:
            try:
                date_obj = datetime.strptime(date, "%Y-%m-%d")
                query["scheduled_date"] = {
                    "$gte": date_obj,
                    "$lt": date_obj.replace(hour=23, minute=59, second=59)
                }
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        followups = list(collection.find(query).sort("scheduled_date", -1))
        
        # Process followups for JSON serialization
        processed_followups = []
        for followup in followups:
            # Convert ObjectId and datetime fields for JSON serialization
            if isinstance(followup.get("_id"), ObjectId):
                followup["_id"] = str(followup["_id"])
            
            # Handle datetime fields
            for field in ["created_at", "updated_at", "scheduled_date"]:
                if field in followup and isinstance(followup[field], datetime):
                    followup[field] = followup[field].isoformat()
            
            processed_followups.append(followup)
        
        logger.info(f"Retrieved {len(processed_followups)} followups for user {user_id}")
        return processed_followups
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in fetch_user_followups for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user follow-ups: {str(e)}")

@followup_router.get("/debug/count", response_model=dict)
async def api_get_followup_count():
    """
    Debug endpoint to check total follow-up count
    """
    try:
        from app.database import followups_collection
        
        # Get the collection object - note followups_collection is a function
        collection = followups_collection()
        total = collection.count_documents({})  # Remove await since this is synchronous
        
        # Get a sample document
        sample = collection.find_one({})  # Remove await since this is synchronous
        
        # Convert sample document for JSON serialization
        if sample:
            sample["_id"] = str(sample["_id"])
            # Handle datetime fields
            for field in ["created_at", "updated_at", "scheduled_date"]:
                if field in sample and isinstance(sample[field], datetime):
                    sample[field] = sample[field].isoformat()
        
        return {
            "total_followups": total,
            "sample_document": sample if sample else None
        }
    except Exception as e:
        print(f"ERROR in debug count:", e)
        raise HTTPException(status_code=500, detail=f"Failed to get count: {str(e)}")

@followup_router.patch("/{followup_id}/mark-sent", response_model=dict)
async def api_mark_reminder_sent(followup_id: str):
    """
    Mark a reminder as sent
    """
    try:
        from app.database.repositories.followup_repository import mark_reminder_sent
        await mark_reminder_sent(followup_id)
        return {"success": True, "message": "Reminder marked as sent"}
    except Exception as e:
        print(f"ERROR in mark_reminder_sent: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark reminder as sent: {str(e)}")
    
    
@followup_router.patch("/{followup_id}", response_model=dict)
async def api_update_followup(followup_id: str, followup: FollowUpUpdate):
    try:
        update_data = followup.dict(exclude_unset=True)
        result = await update_followup(followup_id, update_data)
        return {"success": True, "followup": result}
    except Exception as e:
        print(f"ERROR in api_update_followup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update followup: {str(e)}")

@followup_router.put("/{followup_id}/status", response_model=dict)
async def api_update_followup_status(followup_id: str, status_data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update followup status - compatibility endpoint for frontend"""
    try:
        # Extract status from the request body
        new_status = status_data.get("status")
        if not new_status:
            raise HTTPException(status_code=400, detail="Status is required")
        
        # Create update data with status and user info
        update_data = {
            "status": new_status,
            "updated_by": status_data.get("updated_by", "system"),
            "updated_at": status_data.get("updated_at")
        }
        
        # Use existing update function
        result = await update_followup(followup_id, update_data, current_user)
        return {"success": True, "followup": result}
    except Exception as e:
        print(f"ERROR in api_update_followup_status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update followup status: {str(e)}")

# @followup_router.get("/reminders/{user_id}", response_model=List[dict])
# async def api_get_upcoming_reminders(user_id: str, window_minutes: int = 60):
#     if not user_id or user_id.lower() in ("user_id", "none", "null"):
#         raise HTTPException(status_code=400, detail="Invalid user_id in URL")
#     try:
#         reminders = fetch_upcoming_reminders(user_id, window_minutes=window_minutes)
#         return reminders or []
#     except Exception as e:
#         print("ERROR in fetch_upcoming_reminders:", e)
#         raise HTTPException(status_code=500, detail=f"Failed to fetch reminders: {str(e)}")

@followup_router.get("/lead/{lead_id}", response_model=List[dict])
async def api_get_lead_followups(lead_id: str):
    try:
        followups = await fetch_followups_for_lead(lead_id)
        return followups
    except Exception as e:
        print(f"ERROR in api_get_lead_followups: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch followups for lead: {str(e)}")
    

@followup_router.get("/follow-ups", response_model=List[dict])
async def get_follow_ups(
    lead_id: str = Query(None, description="Filter by lead id"),
    assigned_to: str = Query(None, description="Assigned to"),
    status: str = Query(None, description="Status"),  # "COMPLETED", "PENDING", etc
    due_date: str = Query(None, description="Due date YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get follow-ups with optional filters and hierarchy-based access control
    """
    try:
        from app.database import followups_collection, db
        from datetime import datetime
        
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Follow-ups requested by user: {user_id}")
        
        # Check if user is admin
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        # Get the collection object
        collection = followups_collection()
        
        # Build base query from filters
        query = {}
        if lead_id:
            query["lead_id"] = lead_id
        if assigned_to:
            query["assigned_to"] = assigned_to
        if status:
            query["status"] = status
        if due_date:
            # Convert due_date string to datetime for comparison
            try:
                due_date_obj = datetime.strptime(due_date, "%Y-%m-%d")
                query["scheduled_date"] = {
                    "$gte": due_date_obj,
                    "$lt": due_date_obj.replace(hour=23, minute=59, second=59)
                }
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid due_date format. Use YYYY-MM-DD")
        
        # Apply hierarchy-based filtering for non-admin users
        if not is_admin:
            # Get accessible user IDs for hierarchy filtering
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            logger.info(f"User {user_id} can access follow-ups for users: {accessible_user_ids}")
            
            # Get all leads that user can access
            from app.database import async_db
            leads_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}}
                ]
            }
            
            if async_db is not None:
                accessible_leads = await async_db.leads.find(leads_query, {"lead_id": 1}).to_list(length=None)
            else:
                # Fallback to sync collection
                from app.database import leads_collection
                accessible_leads = list(leads_collection().find(leads_query, {"lead_id": 1}))
                
            accessible_lead_ids = [lead.get("lead_id") for lead in accessible_leads if lead.get("lead_id")]
            
            # Add hierarchy conditions to the query
            hierarchy_conditions = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}},
                    {"lead_id": {"$in": accessible_lead_ids}}
                ]
            }
            
            # Combine base query with hierarchy conditions
            if query:
                # If there are other filters, combine them with hierarchy conditions
                final_query = {"$and": [query, hierarchy_conditions]}
            else:
                # If no other filters, use only hierarchy conditions
                final_query = hierarchy_conditions
                
            query = final_query
        
        cursor = collection.find(query).sort("scheduled_date", -1)
        results = []
        
        # Use regular for loop since this is synchronous cursor
        for f in cursor:
            # Convert ObjectId and datetime for frontend
            if isinstance(f.get("_id"), ObjectId):
                f["_id"] = str(f["_id"])
            
            # Handle datetime fields
            for field in ["created_at", "updated_at", "scheduled_date"]:
                if field in f and isinstance(f[field], datetime):
                    f[field] = f[field].isoformat()
            
            results.append(f)
        
        logger.info(f"Returning {len(results)} follow-ups for user {user_id}")
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in get_follow_ups: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch follow-ups: {str(e)}")