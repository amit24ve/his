from fastapi import APIRouter, Query, Response, Depends, HTTPException
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from io import BytesIO
from typing import List, Dict, Any, Optional
from bson import ObjectId
import pandas as pd
import logging
from app.database import get_database, leads_collection, users_collection, roles_collection
from app.utils.timezone_utils import (
    get_ist_now, get_ist_date, convert_to_ist, get_ist_timestamp,
    format_ist_datetime, parse_date_to_ist, make_datetime_serializable, IST
)

# Configure logger
logger = logging.getLogger(__name__)

# Enhanced report router
reports_router = APIRouter(prefix="/api/reports", tags=["reports"])

# Backward compatibility functions
def convert_utc_to_ist_string(utc_datetime):
    """Convert UTC datetime to IST string format - backward compatibility"""
    return format_ist_datetime(utc_datetime, "%Y-%m-%d %H:%M:%S IST")

def parse_date(date_str):
    """Convert string date to datetime object in IST timezone - backward compatibility"""
    return parse_date_to_ist(date_str)

@reports_router.get("/health")
async def health_check():
    """Simple health check endpoint for reports service"""
    return {"status": "ok", "service": "reports", "timestamp": get_ist_now().isoformat()}

def make_serializable(obj):
    """Convert MongoDB document to JSON-serializable dictionary with IST timezone handling."""
    return make_datetime_serializable(obj)

def get_user_by_id(db, user_id: str):
    """Get user by ID from database"""
    user = db.users.find_one({"user_id": user_id})
    if not user:
        user = db.users.find_one({"id": user_id})
        # Also try to find by MongoDB _id
        if not user and ObjectId.is_valid(user_id):
            try:
                user = db.users.find_one({"_id": ObjectId(user_id)})
            except:
                # If invalid ObjectId format, skip this check
                pass
    return user

def get_hierarchy_level(role_name):
    """Determine user hierarchy level based on role name."""
    if not role_name:
        return 4
    
    role_lower = role_name.lower()
    if "admin" in role_lower:
        return 1
    if "manager" in role_lower or "head" in role_lower:
        return 2
    if "executive" in role_lower or "rep" in role_lower or "agent" in role_lower or "team" in role_lower:
        return 3
    return 4  # Other roles

@reports_router.get("/leads-distribution")
async def leads_distribution(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    db=Depends(get_database)
):
    """
    Get detailed lead distribution statistics for reporting, grouped by date,
    showing assignment counts, conversion rates, and distribution metrics.
    All dates are handled in Indian Standard Time (IST).
    """
    try:
        start_dt, end_dt = parse_date(start_date), parse_date(end_date)
        
        # Convert to end of day for end_dt to include full day
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert IST to UTC for database query
        start_dt_utc = start_dt.astimezone(ZoneInfo("UTC"))
        end_dt_utc = end_dt.astimezone(ZoneInfo("UTC"))
        
        # Aggregate leads by date
        pipeline = [
            {"$match": {"created_at": {"$gte": start_dt_utc, "$lte": end_dt_utc}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": "Asia/Kolkata"}},
                "total_leads": {"$sum": 1},
                "assigned_leads": {"$sum": {"$cond": [{"$ne": ["$assigned_to", None]}, 1, 0]}},
                "converted_leads": {"$sum": {"$cond": [{"$in": ["$status", ["converted", "won", "closed"]]}, 1, 0]}}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        daily_distribution = list(db.leads.aggregate(pipeline))
        for item in daily_distribution:
            item["date"] = item.pop("_id")
            if item["total_leads"] > 0:
                item["assignment_rate"] = round((item["assigned_leads"] / item["total_leads"]) * 100, 2)
                item["conversion_rate"] = round((item["converted_leads"] / item["total_leads"]) * 100, 2)
            else:
                item["assignment_rate"] = 0
                item["conversion_rate"] = 0
        
        # Get overall statistics
        total_leads = sum(item["total_leads"] for item in daily_distribution)
        total_assigned = sum(item["assigned_leads"] for item in daily_distribution)
        total_converted = sum(item["converted_leads"] for item in daily_distribution)
        
        overall_stats = {
            "total_leads": total_leads,
            "total_assigned": total_assigned,
            "total_converted": total_converted,
            "assignment_rate": round((total_assigned / total_leads) * 100, 2) if total_leads > 0 else 0,
            "conversion_rate": round((total_converted / total_leads) * 100, 2) if total_leads > 0 else 0,
            "period": f"{start_date} to {end_date}"
        }
        
        return {
            "success": True,
            "daily_distribution": daily_distribution,
            "overall_stats": overall_stats
        }
        
    except Exception as e:
        logger.error(f"Error in leads_distribution: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get leads distribution: {str(e)}")

@reports_router.get("/workload-analysis")
async def workload_analysis(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    db=Depends(get_database)
):
    """
    Analyze workload distribution across staff members for the given date range.
    Shows assigned leads per staff member, including conversion metrics.
    All dates are handled in Indian Standard Time (IST).
    """
    try:
        start_dt, end_dt = parse_date(start_date), parse_date(end_date)
        
        # Convert to end of day for end_dt to include full day
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert IST to UTC for database query
        start_dt_utc = start_dt.astimezone(ZoneInfo("UTC"))
        end_dt_utc = end_dt.astimezone(ZoneInfo("UTC"))
        
        # Get all users with their roles
        users = list(db.users.find({"is_active": True}))
        user_data = {}
        
        for user in users:
            user_id = user.get("user_id")
            if not user_id:
                continue
            
            # Get user roles
            role_ids = user.get("role_ids", [])
            roles = list(db.roles.find({"id": {"$in": role_ids}}))
            role_names = [r.get("name", "Unknown") for r in roles]
            
            # Get reporting manager
            reports_to = user.get("reports_to")
            manager = None
            if reports_to:
                manager = get_user_by_id(db, reports_to)
            
            # Get assigned leads for this user in the date range
            assigned_leads = list(db.leads.find({
                "assigned_to": user_id,
                "updated_at": {"$gte": start_dt_utc, "$lte": end_dt_utc}
            }))
            
            # Calculate lead metrics
            total_assigned = len(assigned_leads)
            converted_leads = sum(1 for lead in assigned_leads if lead.get("status") in ["converted", "won", "closed"])
            pending_leads = total_assigned - converted_leads
            
            # Get recent activity
            recent_activity = list(db.leads.find({
                "assigned_to": user_id,
                "updated_at": {"$gte": start_dt_utc, "$lte": end_dt_utc}
            }).sort("updated_at", -1).limit(5))
            
            # Prepare user data
            user_data[user_id] = {
                "user_id": user_id,
                "name": user.get("full_name", user.get("name", "Unknown")),
                "email": user.get("email", ""),
                "role_names": role_names,
                "hierarchy_level": min([get_hierarchy_level(r) for r in role_names]) if role_names else 4,
                "reports_to": {
                    "user_id": reports_to,
                    "name": manager.get("full_name", manager.get("name", "Unknown")) if manager else "N/A"
                } if manager else None,
                "workload": {
                    "total_assigned": total_assigned,
                    "converted": converted_leads,
                    "pending": pending_leads,
                    "conversion_rate": round((converted_leads / total_assigned) * 100, 2) if total_assigned > 0 else 0
                },
                "recent_activities": [
                    {
                        "lead_id": str(activity.get("_id")),
                        "lead_name": activity.get("name", "Unknown Lead"),
                        "status": activity.get("status", "new"),
                        "updated_at": convert_utc_to_ist_string(activity.get("updated_at")),
                        "action": "Updated lead" if "status_history" in activity else "Assigned lead"
                    }
                    for activity in recent_activity
                ]
            }
        
        # Convert to list and sort by hierarchy level
        result = list(user_data.values())
        result.sort(key=lambda x: (x["hierarchy_level"], -x["workload"]["total_assigned"]))
        
        # Get team distribution statistics
        team_stats = {}
        for user in result:
            role_key = ", ".join(user["role_names"])
            if role_key not in team_stats:
                team_stats[role_key] = {
                    "role": role_key,
                    "users": 0,
                    "total_leads": 0,
                    "converted_leads": 0,
                    "avg_leads_per_user": 0
                }
            
            team_stats[role_key]["users"] += 1
            team_stats[role_key]["total_leads"] += user["workload"]["total_assigned"]
            team_stats[role_key]["converted_leads"] += user["workload"]["converted"]
        
        # Calculate averages for team stats
        for key in team_stats:
            if team_stats[key]["users"] > 0:
                team_stats[key]["avg_leads_per_user"] = round(team_stats[key]["total_leads"] / team_stats[key]["users"], 1)
        
        team_summary = list(team_stats.values())
        team_summary.sort(key=lambda x: -x["total_leads"])
        
        return {
            "success": True,
            "staff_workload": result,
            "team_summary": team_summary,
            "period": f"{start_date} to {end_date}"
        }
        
    except Exception as e:
        logger.error(f"Error in workload_analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get workload analysis: {str(e)}")

@reports_router.get("/team-hierarchy-report")
async def team_hierarchy_report(
    db=Depends(get_database)
):
    """
    Generate a hierarchical report of teams and their performance.
    """
    try:
        # Get all roles with their hierarchy
        roles = list(db.roles.find())
        role_map = {role["id"]: role for role in roles}
        
        # Build role hierarchy tree
        def build_role_hierarchy(role_id=None):
            result = []
            
            # Find roles that report to this role
            for role in roles:
                if role.get("report_to") == role_id:
                    child_data = {
                        "role_id": role["id"],
                        "name": role["name"],
                        "description": role.get("description", ""),
                        "children": build_role_hierarchy(role["id"])
                    }
                    result.append(child_data)
            
            return result
        
        # Start with top-level roles (report_to is None)
        hierarchy = build_role_hierarchy(None)
        
        # Get all users and their assigned leads
        users = list(db.users.find({"is_active": True}))
        user_stats = {}
        
        for user in users:
            user_id = user.get("user_id")
            if not user_id:
                continue
            
            # Get role info
            role_ids = user.get("role_ids", [])
            role_names = [role_map.get(r, {}).get("name", "Unknown") for r in role_ids]
            
            # Get assigned leads count
            assigned_leads_count = db.leads.count_documents({"assigned_to": user_id})
            
            # Get leads conversion metrics
            converted_leads = db.leads.count_documents({
                "assigned_to": user_id,
                "status": {"$in": ["converted", "won", "closed"]}
            })
            
            user_stats[user_id] = {
                "user_id": user_id,
                "name": user.get("full_name", user.get("name", "Unknown")),
                "role_ids": role_ids,
                "role_names": role_names,
                "reports_to": user.get("reports_to"),
                "assigned_leads": assigned_leads_count,
                "converted_leads": converted_leads,
                "conversion_rate": round((converted_leads / assigned_leads_count) * 100, 2) if assigned_leads_count > 0 else 0
            }
        
        # Build user hierarchy based on reports_to field
        user_hierarchy = []
        
        # Find top-level users (no reports_to)
        for user_id, user in user_stats.items():
            if not user["reports_to"]:
                # This is a top-level user
                user_hierarchy.append(user)
        
        # Add team metrics
        role_metrics = {}
        for user_id, user in user_stats.items():
            for role_id in user["role_ids"]:
                if role_id not in role_metrics:
                    role_metrics[role_id] = {
                        "role_id": role_id,
                        "name": role_map.get(role_id, {}).get("name", "Unknown"),
                        "user_count": 0,
                        "total_leads": 0,
                        "converted_leads": 0,
                        "conversion_rate": 0
                    }
                
                role_metrics[role_id]["user_count"] += 1
                role_metrics[role_id]["total_leads"] += user["assigned_leads"]
                role_metrics[role_id]["converted_leads"] += user["converted_leads"]
        
        # Calculate conversion rates for roles
        for role_id in role_metrics:
            if role_metrics[role_id]["total_leads"] > 0:
                role_metrics[role_id]["conversion_rate"] = round(
                    (role_metrics[role_id]["converted_leads"] / role_metrics[role_id]["total_leads"]) * 100, 2
                )
        
        return {
            "success": True,
            "role_hierarchy": hierarchy,
            "user_stats": list(user_stats.values()),
            "role_metrics": list(role_metrics.values())
        }
        
    except Exception as e:
        logger.error(f"Error in team_hierarchy_report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get team hierarchy report: {str(e)}")

@reports_router.get("/leads-by-date-range")
async def leads_by_date_range(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by lead status"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user ID"),
    db=Depends(get_database)
):
    """
    Get leads created or updated within a specific date range with optional filtering.
    All dates are handled in Indian Standard Time (IST).
    """
    try:
        start_dt, end_dt = parse_date(start_date), parse_date(end_date)
        
        # Convert to end of day for end_dt to include full day
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert IST to UTC for database query
        start_dt_utc = start_dt.astimezone(ZoneInfo("UTC"))
        end_dt_utc = end_dt.astimezone(ZoneInfo("UTC"))
        
        # Build query filter
        query_filter = {"created_at": {"$gte": start_dt_utc, "$lte": end_dt_utc}}
        
        if status:
            query_filter["status"] = status
        
        if assigned_to:
            query_filter["assigned_to"] = assigned_to
        
        # Get leads matching the filter
        leads = list(db.leads.find(query_filter))
        
        # Extract user info for all assignees
        assignee_ids = {lead.get("assigned_to") for lead in leads if lead.get("assigned_to")}
        assignees = {}
        
        for user_id in assignee_ids:
            user = get_user_by_id(db, user_id)
            if user:
                assignees[user_id] = {
                    "user_id": user_id,
                    "name": user.get("full_name", user.get("name", "Unknown")),
                    "email": user.get("email", "")
                }
        
        # Process leads
        processed_leads = []
        for lead in leads:
            assigned_to = lead.get("assigned_to")
            assignee_info = assignees.get(assigned_to, {"name": "Unassigned"}) if assigned_to else {"name": "Unassigned"}
            
            processed_lead = {
                "lead_id": str(lead.get("_id")),
                "name": lead.get("name", "Unknown Lead"),
                "phone": lead.get("phone", ""),
                "email": lead.get("email", ""),
                "status": lead.get("status", "new"),
                "created_at": convert_utc_to_ist_string(lead.get("created_at")),
                "updated_at": convert_utc_to_ist_string(lead.get("updated_at")),
                "assigned_to": assigned_to,
                "assignee_name": assignee_info.get("name", "Unknown")
            }
            processed_leads.append(processed_lead)
        
        # Group by status
        leads_by_status = {}
        for lead in processed_leads:
            status = lead["status"] or "unknown"
            if status not in leads_by_status:
                leads_by_status[status] = []
            leads_by_status[status].append(lead)
        
        # Group by assignee
        leads_by_assignee = {}
        for lead in processed_leads:
            assignee = lead["assignee_name"]
            if assignee not in leads_by_assignee:
                leads_by_assignee[assignee] = []
            leads_by_assignee[assignee].append(lead)
        
        return {
            "success": True,
            "total_leads": len(processed_leads),
            "leads": processed_leads,
            "leads_by_status": leads_by_status,
            "leads_by_assignee": leads_by_assignee,
            "period": f"{start_date} to {end_date}"
        }
        
    except Exception as e:
        logger.error(f"Error in leads_by_date_range: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get leads by date range: {str(e)}")

@reports_router.get("/team-activities")
async def team_activities(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    team_id: Optional[str] = Query(None, description="Filter by team/role ID"),
    db=Depends(get_database)
):
    """
    Get team activities and performance metrics for the given date range.
    All dates are handled in Indian Standard Time (IST).
    """
    try:
        start_dt, end_dt = parse_date(start_date), parse_date(end_date)
        
        # Convert to end of day for end_dt to include full day
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert IST to UTC for database query
        start_dt_utc = start_dt.astimezone(ZoneInfo("UTC"))
        end_dt_utc = end_dt.astimezone(ZoneInfo("UTC"))
        
        # If team_id is provided, get users in that team/role
        user_filter = {}
        if team_id:
            user_filter["role_ids"] = team_id
        
        # Get all active users matching the filter
        users = list(db.users.find({**user_filter, "is_active": True}))
        user_ids = [user.get("user_id") for user in users if user.get("user_id")]
        
        # Get all activities within the date range for these users
        activities = []
        
        # Process lead assignments
        for user_id in user_ids:
            # Get leads assigned to this user in the date range
            assigned_leads = list(db.leads.find({
                "assigned_to": user_id,
                "updated_at": {"$gte": start_dt_utc, "$lte": end_dt_utc}
            }).sort("updated_at", -1))
            
            user = next((u for u in users if u.get("user_id") == user_id), {})
            user_name = user.get("full_name", user.get("name", "Unknown"))
            
            for lead in assigned_leads:
                activities.append({
                    "type": "lead_assignment",
                    "user_id": user_id,
                    "user_name": user_name,
                    "lead_id": str(lead.get("_id")),
                    "lead_name": lead.get("name", "Unknown Lead"),
                    "status": lead.get("status", "new"),
                    "timestamp": convert_utc_to_ist_string(lead.get("updated_at")),
                    "details": f"Lead assigned to {user_name}"
                })
                
                # Add status changes if available
                if "status_history" in lead:
                    for status_change in lead["status_history"]:
                        status_timestamp = status_change.get("timestamp")
                        if status_timestamp:
                            # Convert to UTC for comparison if needed
                            if isinstance(status_timestamp, str):
                                try:
                                    status_timestamp = datetime.fromisoformat(status_timestamp.replace('Z', '+00:00'))
                                except:
                                    continue
                            
                            if status_timestamp.tzinfo is None:
                                status_timestamp = status_timestamp.replace(tzinfo=ZoneInfo("UTC"))
                            
                            if start_dt_utc <= status_timestamp <= end_dt_utc:
                                activities.append({
                                    "type": "status_change",
                                    "user_id": user_id,
                                    "user_name": user_name,
                                    "lead_id": str(lead.get("_id")),
                                    "lead_name": lead.get("name", "Unknown Lead"),
                                    "status": status_change.get("status", "unknown"),
                                    "timestamp": convert_utc_to_ist_string(status_timestamp),
                                    "details": f"Status changed to {status_change.get('status', 'unknown')}"
                                })
        
        # Sort activities by timestamp
        activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # Group activities by user
        activities_by_user = {}
        for activity in activities:
            user_id = activity["user_id"]
            if user_id not in activities_by_user:
                activities_by_user[user_id] = []
            activities_by_user[user_id].append(activity)
        
        # Get activity counts by user
        user_activity_counts = {}
        for user_id, user_activities in activities_by_user.items():
            user = next((u for u in users if u.get("user_id") == user_id), {})
            user_name = user.get("full_name", user.get("name", "Unknown"))
            
            # Count activity types
            assignment_count = sum(1 for a in user_activities if a["type"] == "lead_assignment")
            status_change_count = sum(1 for a in user_activities if a["type"] == "status_change")
            
            user_activity_counts[user_id] = {
                "user_id": user_id,
                "user_name": user_name,
                "email": user.get("email", ""),
                "total_activities": len(user_activities),
                "assignments": assignment_count,
                "status_changes": status_change_count,
                "last_activity": user_activities[0]["timestamp"] if user_activities else None
            }
        
        return {
            "success": True,
            "activities": activities[:100],  # Limit to 100 most recent activities
            "user_activity_counts": list(user_activity_counts.values()),
            "period": f"{start_date} to {end_date}"
        }
        
    except Exception as e:
        logger.error(f"Error in team_activities: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get team activities: {str(e)}")

@reports_router.get("/assigned-leads-export/excel")
async def export_assigned_leads(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    db=Depends(get_database)
):
    """
    Export assigned leads data to Excel with detailed analytics.
    All dates are handled in Indian Standard Time (IST).
    """
    try:
        logger.info(f"Starting export of assigned leads from {start_date} to {end_date}")
        start_dt, end_dt = parse_date(start_date), parse_date(end_date)
        
        # Convert to end of day for end_dt to include full day
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert IST to UTC for database query (MongoDB stores in UTC)
        start_dt_utc = start_dt.astimezone(ZoneInfo("UTC"))
        end_dt_utc = end_dt.astimezone(ZoneInfo("UTC"))
        
        # Get all leads within the date range
        leads = list(db.leads.find({
            "updated_at": {"$gte": start_dt_utc, "$lte": end_dt_utc},
            "assigned_to": {"$ne": None}  # Only include assigned leads
        }))
        
        logger.info(f"Found {len(leads)} assigned leads for export")
        
        # Get all users who have assigned leads
        assignee_ids = {lead.get("assigned_to") for lead in leads if lead.get("assigned_to")}
        users = {}
        
        for user_id in assignee_ids:
            user = get_user_by_id(db, user_id)
            if user:
                # Get user's roles
                role_ids = user.get("role_ids", [])
                roles = list(db.roles.find({"id": {"$in": role_ids}}))
                role_names = [r.get("name", "Unknown") for r in roles]
                
                users[user_id] = {
                    "user_id": user_id,
                    "name": user.get("full_name", user.get("name", "Unknown")),
                    "email": user.get("email", ""),
                    "roles": role_names,
                    "reports_to": user.get("reports_to")
                }
        
        # Process leads for export
        processed_leads = []
        for lead in leads:
            assigned_to = lead.get("assigned_to")
            assignee = users.get(assigned_to, {"name": "Unknown", "email": "", "roles": []})
            
            # Get quotation data for this lead
            # Use the correct lead_id field that quotations are linked with
            lead_id = lead.get("lead_id", str(lead.get("_id")))  # Try lead_id first, fallback to ObjectId
            quotation = db.quotations.find_one({"lead_id": lead_id})
            
            # Prepare quotation fields
            quotation_amount = ""
            quotation_status = ""
            quotation_milestones_count = ""
            quotation_paid_amount = ""
            quotation_remaining_amount = ""
            quotation_progress = ""
            
            if quotation:
                quotation_amount = quotation.get("amount", 0)
                quotation_status = quotation.get("status", "")
                milestones = quotation.get("milestones", [])
                quotation_milestones_count = len(milestones)
                
                # Calculate payment progress
                total_paid = 0
                for milestone in milestones:
                    if milestone.get("paid", False):
                        total_paid += milestone.get("paid_amount", milestone.get("amount", 0))
                
                quotation_paid_amount = total_paid
                quotation_remaining_amount = max(quotation_amount - total_paid, 0)
                quotation_progress = f"{round((total_paid / quotation_amount) * 100, 1)}%" if quotation_amount > 0 else "0%"
            
            processed_lead = {
                "Lead ID": str(lead.get("lead_id")),
                "Lead Name": lead.get("name", "Unknown"),
                "Phone": lead.get("phone", ""),
                "Email": lead.get("email", ""),
                "Status": lead.get("status", ""),
                "Created Date": convert_utc_to_ist_string(lead.get("created_at")),
                "Assigned Date": convert_utc_to_ist_string(lead.get("updated_at")),
                "Assigned To (ID)": assigned_to,
                "Assigned To (Name)": assignee.get("name"),
                "Assignee Email": assignee.get("email"),
                "Assignee Roles": ", ".join(assignee.get("roles", [])),
                "Source": lead.get("source", ""),
                "Location": lead.get("location", lead.get("city", "")),
                "District": lead.get("district", ""),
                # "Notes": lead.get("notes", ""),
                "Quotation Amount": quotation_amount,
                "Quotation Status": quotation_status,
                "Total Payment Count": quotation_milestones_count,
                "Paid Amount": quotation_paid_amount,
                "Remaining Amount": quotation_remaining_amount,
                "Payment Progress": quotation_progress
            }
            processed_leads.append(processed_lead)
        
        # Create DataFrame
        if not processed_leads:
            # If no leads found, create empty DataFrame with default columns
            df = pd.DataFrame(columns=[
                "Lead ID", "Lead Name", "Phone", "Email", "Status", "Created Date", "Assigned Date",
                "Assigned To (ID)", "Assigned To (Name)", "Assignee Email", "Assignee Roles",
                "Source", "Location", "District", "Notes", "Quotation Amount", "Quotation Status", 
                "Milestones Count", "Paid Amount", "Remaining Amount", "Payment Progress"
            ])
        else:
            df = pd.DataFrame(processed_leads)
        
        # Create summary data
        summary_data = []
        
        # Group by assignee
        for user_id, user in users.items():
            user_leads = [l for l in processed_leads if l["Assigned To (ID)"] == user_id]
            total_leads = len(user_leads)
            
            # Count status types
            status_counts = {}
            for lead in user_leads:
                status = lead["Status"]
                if status not in status_counts:
                    status_counts[status] = 0
                status_counts[status] += 1
            
            # Calculate conversion rate
            converted = status_counts.get("converted", 0) + status_counts.get("won", 0) + status_counts.get("closed", 0)
            conversion_rate = (converted / total_leads) * 100 if total_leads > 0 else 0
            
            # Calculate quotation metrics
            leads_with_quotations = sum(1 for lead in user_leads if lead["Quotation Amount"] != "")
            total_quotation_amount = sum(lead["Quotation Amount"] for lead in user_leads if isinstance(lead["Quotation Amount"], (int, float)))
            total_paid_amount = sum(lead["Paid Amount"] for lead in user_leads if isinstance(lead["Paid Amount"], (int, float)))
            quotation_rate = (leads_with_quotations / total_leads) * 100 if total_leads > 0 else 0
            
            summary_data.append({
                "User ID": user_id,
                "Name": user["name"],
                "Email": user["email"],
                "Roles": ", ".join(user["roles"]),
                "Total Assigned": total_leads,
                "Converted": converted,
                "Conversion Rate (%)": round(conversion_rate, 2),
                "Leads with Quotations": leads_with_quotations,
                "Quotation Rate (%)": round(quotation_rate, 2),
                "Total Quotation Value": total_quotation_amount,
                "Total Paid Amount": total_paid_amount,
                **{f"Status: {status}": count for status, count in status_counts.items()}
            })
        
        summary_df = pd.DataFrame(summary_data)
        
        logger.info(f"Prepared data for Excel export: {len(df)} lead records, {len(summary_df)} user summaries")
        
        # Create Excel file with two sheets
        output = BytesIO()
        with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
            df.to_excel(writer, sheet_name="Assigned Leads", index=False, startrow=3)
            summary_df.to_excel(writer, sheet_name="User Summary", index=False, startrow=3)
            
            # Get the xlsxwriter workbook and worksheet objects
            workbook = writer.book
            
            # Add some formatting
            header_format = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1})
            info_format = workbook.add_format({'bold': True, 'bg_color': '#FFF2CC', 'border': 1})
            
            # Add timezone info header
            timezone_info = f"Report Generated: {get_ist_now().strftime('%Y-%m-%d %H:%M:%S IST')} | All dates and times are in Indian Standard Time (IST)"
            
            # First sheet - Assigned Leads
            assigned_sheet = writer.sheets["Assigned Leads"]
            assigned_sheet.write(0, 0, "CRM Assigned Leads Export", info_format)
            assigned_sheet.write(1, 0, timezone_info, info_format)
            assigned_sheet.write(2, 0, f"Date Range: {start_date} to {end_date} (IST)", info_format)
            
            for col_num, value in enumerate(df.columns.values):
                assigned_sheet.write(3, col_num, value, header_format)
                # Auto-adjust column width
                max_len = max(df[value].astype(str).str.len().max() if len(df) > 0 else 0, len(str(value))) + 2
                assigned_sheet.set_column(col_num, col_num, min(max_len, 40))
                
            # Second sheet - User Summary
            summary_sheet = writer.sheets["User Summary"]
            summary_sheet.write(0, 0, "CRM User Summary Report", info_format)
            summary_sheet.write(1, 0, timezone_info, info_format)
            summary_sheet.write(2, 0, f"Date Range: {start_date} to {end_date} (IST)", info_format)
            
            for col_num, value in enumerate(summary_df.columns.values):
                summary_sheet.write(3, col_num, value, header_format)
                # Auto-adjust column width
                max_len = max(summary_df[value].astype(str).str.len().max() if len(summary_df) > 0 else 0, len(str(value))) + 2
                summary_sheet.set_column(col_num, col_num, min(max_len, 40))
        
        output.seek(0)
        
        # Generate filename with IST timezone information
        ist_now = get_ist_now()
        filename = f"AssignedLeads_{start_date}_to_{end_date}_Generated_{ist_now.strftime('%Y%m%d_%H%M%S')}_IST.xlsx"
        
        headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
        logger.info(f"Excel export completed successfully: {filename}")
        return Response(output.read(), headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
    except Exception as e:
        logger.error(f"Error in export_assigned_leads: {str(e)}")
        # Add more detailed error information for debugging
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to export assigned leads: {str(e)}")
