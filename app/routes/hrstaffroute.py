from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from bson import ObjectId
import json
import logging

from ..core.security import get_current_user
from ..config import settings
from ..database import get_database


# Set up logger
logger = logging.getLogger(__name__)

# Create router
hr_staff_router = APIRouter(
    prefix="/api/hr",
    tags=["HR Staff Management"]
)

# Helper function to convert MongoDB ObjectId to string
def convert_objectid_to_str(data):
    if isinstance(data, dict):
        for key in list(data.keys()):
            if isinstance(data[key], ObjectId):
                data[key] = str(data[key])
            elif isinstance(data[key], (dict, list)):
                data[key] = convert_objectid_to_str(data[key])
    elif isinstance(data, list):
        for i, item in enumerate(data):
            data[i] = convert_objectid_to_str(item)
    return data

# Helper function to check if a user can access HR functions
async def check_hr_access(user_data, role_param=None):
    """Check if user has HR or admin access based on their roles"""
    if not user_data:
        return False
    
    # Role parameter override for testing
    if role_param and role_param.lower() in ['admin', 'hr']:
        return True
    
    # Extract roles from user data
    user_roles = []
    
    # Check role field (string)
    if user_data.get('role'):
        if isinstance(user_data['role'], str):
            user_roles.append(user_data['role'].lower())
    
    # Check roles array
    if user_data.get('roles'):
        if isinstance(user_data['roles'], list):
            for role in user_data['roles']:
                if isinstance(role, str):
                    user_roles.append(role.lower())
                elif isinstance(role, dict) and role.get('name'):
                    user_roles.append(role['name'].lower())
        elif isinstance(user_data['roles'], str):
            # Handle case where roles might be a single string
            user_roles.append(user_data['roles'].lower())
    
    # Check role_names array
    if user_data.get('role_names') and isinstance(user_data['role_names'], list):
        user_roles.extend([r.lower() for r in user_data['role_names'] if r])
    
    # Check if any role is admin or hr
    is_admin = False
    is_hr = False
    
    for role in user_roles:
        if role == 'admin' or 'admin' in role:
            is_admin = True
        if role == 'hr' or 'hr' in role or 'human resource' in role or 'human_resources' in role:
            is_hr = True
    
    # Return True if user is either admin or hr
    if is_admin or is_hr:
        return True
    
    # Additional admin check - if reports_to is empty
    if user_data.get('reports_to') is None or user_data.get('reports_to') == "":
        return True
    
    return False

# Endpoints for HR dashboard
@hr_staff_router.get("/dashboard")
async def get_hr_dashboard(
    user_id: str = Query(None, description="User ID"),
    role: str = Query(None, description="User role (admin/hr/employee)"),
    current_user = Depends(get_current_user)
):
    """Get dashboard statistics for HR module"""
    try:
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict()
        
        # Check if user has HR access
        has_access = await check_hr_access(user_dict, role)
        
        # Get database reference
        db = get_database()
        
        # Statistics to return
        stats = {
            "totalEmployees": 0,
            "presentToday": 0,
            "absentToday": 0,
            "onLeaveToday": 0,
            "pendingLeaveRequests": 0,
            "departmentBreakdown": []
        }
        
        # Only get detailed stats for admin/HR
        if has_access:
            # Total employees (excluding customers)
            employee_count = db.users.count_documents({
                "role": {"$nin": ["customer", "Customer"]}
            })
            stats["totalEmployees"] = employee_count
            
            # Today's date
            today = datetime.now().strftime("%Y-%m-%d")
            
            # Present today (check attendance records)
            present_count = db.attendance.count_documents({
                "date": today,
                "status": "present"
            })
            stats["presentToday"] = present_count
            
            # Calculate absent (total employees - present)
            stats["absentToday"] = employee_count - present_count
            
            # On leave today
            on_leave_count = db.leave_requests.count_documents({
                "status": "approved",
                "start_date": {"$lte": today},
                "end_date": {"$gte": today}
            })
            stats["onLeaveToday"] = on_leave_count
            
            # Pending leave requests
            pending_count = db.leave_requests.count_documents({
                "status": "pending"
            })
            stats["pendingLeaveRequests"] = pending_count
            
            # Department breakdown
            pipeline = [
                {"$match": {"department": {"$exists": True, "$ne": None}}},
                {"$group": {"_id": "$department", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            
            departments = list(db.users.aggregate(pipeline))
            stats["departmentBreakdown"] = [
                {"department": d["_id"], "count": d["count"]} 
                for d in departments if d["_id"]
            ]
        else:
            # Limited stats for regular employees
            user_data = db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
            
            if user_data:
                stats["department"] = user_data.get("department", "Not Assigned")
                
                # Get user's leave counts
                leave_count = db.leave_requests.count_documents({
                    "user_id": user_id,
                    "status": "approved"
                })
                stats["totalApprovedLeaves"] = leave_count
                
                pending_count = db.leave_requests.count_documents({
                    "user_id": user_id,
                    "status": "pending"
                })
                stats["pendingLeaves"] = pending_count
        
        # Extract roles for permission checks
        user_roles = []
        if user_dict.get('roles'):
            if isinstance(user_dict['roles'], list):
                user_roles = [r.lower() for r in user_dict['roles'] if r]
            elif isinstance(user_dict['roles'], str):
                user_roles = [user_dict['roles'].lower()]
        
        # Check specific roles
        is_admin = 'admin' in user_roles
        is_hr = any(r in ['hr', 'hr_admin', 'human_resources'] for r in user_roles)
        is_manager = any(r in ['manager', 'team_leader'] for r in user_roles)
        
        # Add permissions to the response
        stats["can_manage_all"] = has_access
        stats["permissions"] = {
            "is_admin": is_admin,
            "is_hr": is_hr,
            "is_manager": is_manager,
            "can_view_all_employees": is_admin or is_hr,
            "can_manage_attendance": is_admin or is_hr,
            "can_manage_leaves": is_admin or is_hr,
            "can_approve_leaves": is_admin or is_hr or is_manager
        }
        stats["user_roles"] = user_roles
        
        return convert_objectid_to_str(stats)
    
    except Exception as e:
        logger.error(f"Error in HR dashboard: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

# Endpoints for Employees
@hr_staff_router.get("/employees")
async def get_employees(
    user_id: str = Query(None, description="User ID"),
    role: str = Query(None, description="User role (admin/hr/employee)"),
    current_user: dict = Depends(get_current_user)
):
    """Get list of employees based on user's role"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user, role)
        
        # Get database reference
        db = get_database()
        
        # Query filter
        query_filter = {"role": {"$nin": ["customer", "Customer"]}}
        
        if not has_access:
            # Regular employees can only see basic info about other employees
            projection = {
                "name": 1, 
                "email": 1, 
                "department": 1, 
                "position": 1,
                "profile_image": 1
            }
            
            # If specific user_id provided, only return that user
            if user_id:
                if ObjectId.is_valid(user_id):
                    query_filter["_id"] = ObjectId(user_id)
                else:
                    query_filter["user_id"] = user_id
        else:
            # HR/Admin can see all fields
            projection = {}
        
        # Get employees
        employees_data = list(db.users.find(query_filter, projection))
        
        return convert_objectid_to_str(employees_data)
    
    except Exception as e:
        logger.error(f"Error in get employees: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

# Endpoints for Attendance
@hr_staff_router.get("/attendance")
async def get_attendance(
    user_id: str = Query(None, description="User ID"),
    role: str = Query(None, description="User role (admin/hr/employee)"),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records based on user's role"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user, role)
        
        # Get database reference
        db = get_database()
        
        # For specific user (self or as requested by HR)
        if user_id:
            query_filter = {}
            
            # Find by ObjectId or user_id field
            if ObjectId.is_valid(user_id):
                query_filter["user_id"] = user_id
            else:
                query_filter["user_id"] = user_id
            
            # Get attendance records
            attendance_records = list(db.attendance.find(query_filter).sort("date", -1).limit(30))
            
            # Ensure check-in and check-out fields are properly formatted for display
            for record in attendance_records:
                # Format timestamps for display
                if "check_in" in record and record["check_in"]:
                    record["checkin_display"] = record["check_in"]
                    
                if "check_out" in record and record["check_out"]:
                    record["checkout_display"] = record["check_out"]
                    
                # Include geo location information for frontend display
                if "geo_location" in record:
                    record["location_data"] = record["geo_location"]
                elif "geo_lat" in record and "geo_long" in record:
                    record["location_data"] = {
                        "latitude": record["geo_lat"],
                        "longitude": record["geo_long"],
                        "address": record.get("location", "No address available")
                    }
                    
                # Include checkout location information
                if "checkout_geo_location" in record:
                    record["checkout_location_data"] = record["checkout_geo_location"]
                elif "checkout_geo_lat" in record and "checkout_geo_long" in record:
                    record["checkout_location_data"] = {
                        "latitude": record["checkout_geo_lat"],
                        "longitude": record["checkout_geo_long"],
                        "address": record.get("checkout_location", "No address available")
                    }
            
            return convert_objectid_to_str({
                "success": True,
                "data": attendance_records
            })
        
        # For HR/Admin - get all attendance
        elif has_access:
            # Get all attendance records, limited to last 30 days
            thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
            attendance_records = list(db.attendance.find({
                "date": {"$gte": thirty_days_ago}
            }).sort("date", -1))
            
            # Ensure check-in and check-out fields are properly formatted for display
            for record in attendance_records:
                # Format timestamps for display
                if "check_in" in record and record["check_in"]:
                    record["checkin_display"] = record["check_in"]
                    
                if "check_out" in record and record["check_out"]:
                    record["checkout_display"] = record["check_out"]
                    
                # Include geo location information for frontend display
                if "geo_location" in record:
                    record["location_data"] = record["geo_location"]
                elif "geo_lat" in record and "geo_long" in record:
                    record["location_data"] = {
                        "latitude": record["geo_lat"],
                        "longitude": record["geo_long"],
                        "address": record.get("location", "No address available")
                    }
                    
                # Include checkout location information
                if "checkout_geo_location" in record:
                    record["checkout_location_data"] = record["checkout_geo_location"]
                elif "checkout_geo_lat" in record and "checkout_geo_long" in record:
                    record["checkout_location_data"] = {
                        "latitude": record["checkout_geo_lat"],
                        "longitude": record["checkout_geo_long"],
                        "address": record.get("checkout_location", "No address available")
                    }
            
            return convert_objectid_to_str({
                "success": True,
                "data": attendance_records
            })
        
        else:
            # No user_id and not HR - use current_user's id
            current_user_id = str(current_user.get("_id"))
            
            attendance_records = list(db.attendance.find({
                "user_id": current_user_id
            }).sort("date", -1).limit(30))
            
            # Ensure check-in and check-out fields are properly formatted for display
            for record in attendance_records:
                # Format timestamps for display
                if "check_in" in record and record["check_in"]:
                    record["checkin_display"] = record["check_in"]
                    
                if "check_out" in record and record["check_out"]:
                    record["checkout_display"] = record["check_out"]
                    
                # Include geo location information for frontend display
                if "geo_location" in record:
                    record["location_data"] = record["geo_location"]
                elif "geo_lat" in record and "geo_long" in record:
                    record["location_data"] = {
                        "latitude": record["geo_lat"],
                        "longitude": record["geo_long"],
                        "address": record.get("location", "No address available")
                    }
                    
                # Include checkout location information
                if "checkout_geo_location" in record:
                    record["checkout_location_data"] = record["checkout_geo_location"]
                elif "checkout_geo_lat" in record and "checkout_geo_long" in record:
                    record["checkout_location_data"] = {
                        "latitude": record["checkout_geo_lat"],
                        "longitude": record["checkout_geo_long"],
                        "address": record.get("checkout_location", "No address available")
                    }
            
            return convert_objectid_to_str({
                "success": True,
                "data": attendance_records
            })
    
    except Exception as e:
        logger.error(f"Error in get attendance: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.post("/attendance/checkin")
async def check_in(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Record attendance check-in"""
    try:
        # Get user_id from request or current user
        user_id = data.get("user_id") or str(current_user.get("_id"))
        
        # Get database reference
        db = get_database()
        
        # Current date and time
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        current_time = now.strftime("%H:%M:%S")
        
        # Check if already checked in today
        existing = db.attendance.find_one({
            "user_id": user_id,
            "date": today
        })
        
        if existing:
            # Add display fields to the existing record before returning
            existing_copy = dict(existing)
            
            # Format timestamps for display
            if "check_in" in existing_copy and existing_copy["check_in"]:
                existing_copy["checkin_display"] = existing_copy["check_in"]
                
            if "check_out" in existing_copy and existing_copy["check_out"]:
                existing_copy["checkout_display"] = existing_copy["check_out"]
                
            # Include geo location information for frontend display
            if "geo_location" in existing_copy:
                existing_copy["location_data"] = existing_copy["geo_location"]
            elif "geo_lat" in existing_copy and "geo_long" in existing_copy:
                existing_copy["location_data"] = {
                    "latitude": existing_copy["geo_lat"],
                    "longitude": existing_copy["geo_long"],
                    "address": existing_copy.get("location", "No address available")
                }
                
            # Include checkout location information if available
            if "checkout_geo_location" in existing_copy:
                existing_copy["checkout_location_data"] = existing_copy["checkout_geo_location"]
            elif "checkout_geo_lat" in existing_copy and "checkout_geo_long" in existing_copy:
                existing_copy["checkout_location_data"] = {
                    "latitude": existing_copy["checkout_geo_lat"],
                    "longitude": existing_copy["checkout_geo_long"],
                    "address": existing_copy.get("checkout_location", "No address available")
                }
            
            return JSONResponse(
                status_code=400,
                content={"detail": "Already checked in today", "record": convert_objectid_to_str(existing_copy)}
            )
        
        # Get user details
        user_data = None
        if ObjectId.is_valid(user_id):
            user_data = db.users.find_one({"_id": ObjectId(user_id)})
        else:
            user_data = db.users.find_one({"user_id": user_id})
        
        if not user_data:
            return JSONResponse(
                status_code=404,
                content={"detail": "Employee not found"}
            )
        
        # Create attendance record
        attendance_record = {
            "user_id": user_id,
            "user_name": user_data.get("name") or user_data.get("full_name") or user_data.get("username") or "Employee",
            "date": today,
            "check_in": current_time,
            "check_out": None,
            "notes": data.get("notes", ""),
            "status": "present",
            "working_hours": 0,
            # Add geolocation data if provided
            "location": data.get("location", ""),
            "geo_lat": data.get("geo_lat"),
            "geo_long": data.get("geo_long"),
            "checkin_time": data.get("checkin_time")
        }
        
        # Store geo_location as a separate field if provided
        if data.get("geo_location"):
            attendance_record["geo_location"] = {
                "latitude": data.get("geo_location", {}).get("latitude"),
                "longitude": data.get("geo_location", {}).get("longitude"),
                "address": data.get("geo_location", {}).get("address", "")
            }
        
        # Insert record
        result = db.attendance.insert_one(attendance_record)
        
        # Return result
        return convert_objectid_to_str({
            "success": True,
            "message": "Check-in recorded successfully",
            "record_id": str(result.inserted_id)
        })
    
    except Exception as e:
        logger.error(f"Error in check-in: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.post("/attendance/manual-checkin")
async def manual_check_in(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Record manual attendance check-in by HR or admin"""
    try:
        # Check if user has admin/HR privileges
        has_access = await check_hr_access(current_user)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Only HR and admin users can create manual attendance records"}
            )
        
        # Get database reference
        db = get_database()
        
        # Validate required fields
        if not data.get("user_id") or not data.get("date"):
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required fields: user_id and date are required"}
            )
        
        # Get user details
        user_id = data.get("user_id")
        user_data = None
        if ObjectId.is_valid(user_id):
            user_data = db.users.find_one({"_id": ObjectId(user_id)})
        else:
            user_data = db.users.find_one({"user_id": user_id})
        
        if not user_data:
            return JSONResponse(
                status_code=404,
                content={"detail": "Employee not found"}
            )
            
        # Check for existing record on the given date
        attendance_date = data.get("date")
        existing = db.attendance.find_one({
            "user_id": user_id,
            "date": attendance_date
        })
        
        if existing:
            # Update existing record
            update_data = {}
            if data.get("check_in"):
                update_data["check_in"] = data.get("check_in")
            if data.get("check_out"):
                update_data["check_out"] = data.get("check_out")
            if data.get("status"):
                update_data["status"] = data.get("status")
            if data.get("location"):
                update_data["location"] = data.get("location")
            if data.get("notes"):
                update_data["notes"] = data.get("notes")
                
            # Calculate working hours if both check-in and check-out are provided
            if data.get("check_in") and data.get("check_out"):
                # Simple string-based calculation
                try:
                    check_in_time = datetime.strptime(data["check_in"], "%H:%M:%S")
                    check_out_time = datetime.strptime(data["check_out"], "%H:%M:%S")
                    working_hours = (check_out_time - check_in_time).total_seconds() / 3600
                    update_data["working_hours"] = round(working_hours, 2)
                except:
                    pass
            
            db.attendance.update_one(
                {"_id": existing["_id"]},
                {"$set": update_data}
            )
            
            # Get the updated record
            updated = db.attendance.find_one({"_id": existing["_id"]})
            return convert_objectid_to_str({
                "success": True,
                "message": "Attendance record updated",
                "record": updated
            })
        else:
            # Create new record
            attendance_record = {
                "user_id": user_id,
                "user_name": user_data.get("name") or user_data.get("full_name") or user_data.get("username") or "Employee",
                "date": attendance_date,
                "check_in": data.get("check_in"),
                "check_out": data.get("check_out"),
                "status": data.get("status", "present"),
                "location": data.get("location", "Office"),
                "notes": data.get("notes", "Manual entry"),
                "created_by": str(current_user.get("_id")),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            # Calculate working hours if both check-in and check-out are provided
            if data.get("check_in") and data.get("check_out"):
                try:
                    check_in_time = datetime.strptime(data["check_in"], "%H:%M:%S")
                    check_out_time = datetime.strptime(data["check_out"], "%H:%M:%S")
                    working_hours = (check_out_time - check_in_time).total_seconds() / 3600
                    attendance_record["working_hours"] = round(working_hours, 2)
                except:
                    attendance_record["working_hours"] = 0
            else:
                attendance_record["working_hours"] = 0
            
            # Insert record
            result = db.attendance.insert_one(attendance_record)
            
            # Return result with the created record
            created = db.attendance.find_one({"_id": result.inserted_id})
            return convert_objectid_to_str({
                "success": True,
                "message": "Manual attendance record created",
                "record": created
            })
    except Exception as e:
        logger.error(f"Error in manual check-in: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.post("/attendance/checkout")
async def check_out(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Record attendance check-out"""
    try:
        # Get user_id from request or current user
        user_id = data.get("user_id") or str(current_user.get("_id"))
        
        # Get database reference
        db = get_database()
        
        # Current date and time
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        current_time = now.strftime("%H:%M:%S")
        
        # Find today's attendance record
        attendance_record = db.attendance.find_one({
            "user_id": user_id,
            "date": today
        })
        
        if not attendance_record:
            return JSONResponse(
                status_code=404,
                content={"detail": "No check-in record found for today"}
            )
        
        # Check if already checked out
        if attendance_record.get("check_out"):
            # Add display fields to the record before returning
            record_copy = dict(attendance_record)
            
            # Format timestamps for display
            if "check_in" in record_copy and record_copy["check_in"]:
                record_copy["checkin_display"] = record_copy["check_in"]
                
            if "check_out" in record_copy and record_copy["check_out"]:
                record_copy["checkout_display"] = record_copy["check_out"]
                
            # Include geo location information for frontend display
            if "geo_location" in record_copy:
                record_copy["location_data"] = record_copy["geo_location"]
            elif "geo_lat" in record_copy and "geo_long" in record_copy:
                record_copy["location_data"] = {
                    "latitude": record_copy["geo_lat"],
                    "longitude": record_copy["geo_long"],
                    "address": record_copy.get("location", "No address available")
                }
                
            # Include checkout location information
            if "checkout_geo_location" in record_copy:
                record_copy["checkout_location_data"] = record_copy["checkout_geo_location"]
            elif "checkout_geo_lat" in record_copy and "checkout_geo_long" in record_copy:
                record_copy["checkout_location_data"] = {
                    "latitude": record_copy["checkout_geo_lat"],
                    "longitude": record_copy["checkout_geo_long"],
                    "address": record_copy.get("checkout_location", "No address available")
                }
            
            return JSONResponse(
                status_code=400,
                content={"detail": "Already checked out today", "record": convert_objectid_to_str(record_copy)}
            )
        
        # Calculate working hours
        check_in_time = datetime.strptime(f"{today} {attendance_record['check_in']}", "%Y-%m-%d %H:%M:%S")
        check_out_time = datetime.strptime(f"{today} {current_time}", "%Y-%m-%d %H:%M:%S")
        
        # Calculate the difference in hours
        working_hours = round((check_out_time - check_in_time).total_seconds() / 3600, 2)
        
        # Prepare update data
        update_data = {
            "check_out": current_time,
            "working_hours": working_hours,
            "notes": attendance_record.get("notes", "") + " " + data.get("notes", "")
        }
        
        # Add geolocation data if provided
        if data.get("checkout_location"):
            update_data["checkout_location"] = data.get("checkout_location")
        
        if data.get("checkout_geo_lat"):
            update_data["checkout_geo_lat"] = data.get("checkout_geo_lat")
            
        if data.get("checkout_geo_long"):
            update_data["checkout_geo_long"] = data.get("checkout_geo_long")
            
        if data.get("checkout_time"):
            update_data["checkout_time"] = data.get("checkout_time")
            
        # Store checkout_geo_location as a separate field if provided
        if data.get("checkout_geo_location"):
            update_data["checkout_geo_location"] = {
                "latitude": data.get("checkout_geo_location", {}).get("latitude"),
                "longitude": data.get("checkout_geo_location", {}).get("longitude"),
                "address": data.get("checkout_geo_location", {}).get("address", "")
            }
        
        # Update attendance record
        db.attendance.update_one(
            {"_id": attendance_record["_id"]},
            {"$set": update_data}
        )
        
        # Get the updated record for the response
        updated_record = db.attendance.find_one({"_id": attendance_record["_id"]})
        
        # Format for display
        if updated_record:
            # Format timestamps for display
            if "check_in" in updated_record and updated_record["check_in"]:
                updated_record["checkin_display"] = updated_record["check_in"]
                
            if "check_out" in updated_record and updated_record["check_out"]:
                updated_record["checkout_display"] = updated_record["check_out"]
                
            # Include geo location information for frontend display
            if "geo_location" in updated_record:
                updated_record["location_data"] = updated_record["geo_location"]
            elif "geo_lat" in updated_record and "geo_long" in updated_record:
                updated_record["location_data"] = {
                    "latitude": updated_record["geo_lat"],
                    "longitude": updated_record["geo_long"],
                    "address": updated_record.get("location", "No address available")
                }
                
            # Include checkout location information
            if "checkout_geo_location" in updated_record:
                updated_record["checkout_location_data"] = updated_record["checkout_geo_location"]
            elif "checkout_geo_lat" in updated_record and "checkout_geo_long" in updated_record:
                updated_record["checkout_location_data"] = {
                    "latitude": updated_record["checkout_geo_lat"],
                    "longitude": updated_record["checkout_geo_long"],
                    "address": updated_record.get("checkout_location", "No address available")
                }
        
        # Return result
        return convert_objectid_to_str({
            "success": True,
            "message": "Check-out recorded successfully",
            "working_hours": working_hours,
            "record": updated_record
        })
    
    except Exception as e:
        logger.error(f"Error in check-out: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

# Endpoints for Leave Management
@hr_staff_router.get("/leave-requests")
async def get_leave_requests(
    user_id: str = Query(None, description="User ID"),
    role: str = Query(None, description="User role (admin/hr/employee)"),
    current_user: dict = Depends(get_current_user)
):
    """Get leave requests based on user's role"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user, role)
        
        # Get database reference
        db = get_database()
        
        # Query filter
        query_filter = {}
        
        # If specific user_id provided or not admin/HR
        if user_id and not has_access:
            query_filter["user_id"] = user_id
        elif not has_access:
            # Regular employees can only see their own leave requests
            query_filter["user_id"] = str(current_user.get("_id"))
        
        # Get leave requests
        leave_requests = list(db.leave_requests.find(query_filter).sort("requested_at", -1))
        
        return convert_objectid_to_str({
            "success": True,
            "can_manage_all": has_access,
            "data": leave_requests
        })
    
    except Exception as e:
        logger.error(f"Error in get leave requests: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.post("/leave-requests")
async def create_leave_request(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Create a new leave request"""
    try:
        # Get user_id from request or current user
        user_id = data.get("user_id") or str(current_user.get("_id"))
        
        # Get database reference
        db = get_database()
        
        # Get user details if not provided
        if not data.get("employee_name") or not data.get("employee_email"):
            user_data = None
            if ObjectId.is_valid(user_id):
                user_data = db.users.find_one({"_id": ObjectId(user_id)})
            else:
                user_data = db.users.find_one({"user_id": user_id})
            
            if user_data:
                if not data.get("employee_name"):
                    data["employee_name"] = user_data.get("name") or user_data.get("full_name") or user_data.get("username") or "Employee"
                
                if not data.get("employee_email"):
                    data["employee_email"] = user_data.get("email", "")
                
                if not data.get("department"):
                    data["department"] = user_data.get("department", "")
        
        # Ensure required fields
        required_fields = ["start_date", "end_date", "leave_type", "reason"]
        for field in required_fields:
            if field not in data:
                return JSONResponse(
                    status_code=400,
                    content={"detail": f"Missing required field: {field}"}
                )
        
        # Validate dates
        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
            
            if start_date > end_date:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Start date must be before or equal to end date"}
                )
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid date format. Use YYYY-MM-DD"}
            )
        
        # Calculate days count if not provided
        if not data.get("days_count") or not data.get("days_requested"):
            days = (end_date - start_date).days + 1
            data["days_count"] = days
            data["days_requested"] = days
        
        # Set defaults
        data["status"] = "pending"
        data["requested_at"] = datetime.now().isoformat()
        data["user_id"] = user_id
        data["employee_id"] = user_id  # For backwards compatibility
        
        # Insert leave request
        result = db.leave_requests.insert_one(data)
        
        # Return result
        return convert_objectid_to_str({
            "success": True,
            "message": "Leave request submitted successfully",
            "request_id": str(result.inserted_id)
        })
    
    except Exception as e:
        logger.error(f"Error in create leave request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.put("/leave-requests/{request_id}/approve")
async def approve_leave_request(
    request_id: str = Path(..., description="Leave request ID"),
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Approve a leave request"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user)
        
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "You don't have permission to approve leave requests"}
            )
        
        # Get database reference
        db = get_database()
        
        # Get leave request
        leave_request = None
        if ObjectId.is_valid(request_id):
            leave_request = db.leave_requests.find_one({"_id": ObjectId(request_id)})
        
        if not leave_request:
            return JSONResponse(
                status_code=404,
                content={"detail": "Leave request not found"}
            )
        
        # Update leave request
        db.leave_requests.update_one(
            {"_id": leave_request["_id"]},
            {"$set": {
                "status": "approved",
                "approved_at": datetime.now().isoformat(),
                "reviewer_id": data.get("reviewer_id") or str(current_user.get("_id")),
                "reviewer_comments": data.get("reviewer_comments") or "Approved"
            }}
        )
        
        # Return result
        return {
            "success": True,
            "message": "Leave request approved successfully"
        }
    
    except Exception as e:
        logger.error(f"Error in approve leave request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.put("/leave-requests/{request_id}/reject")
async def reject_leave_request(
    request_id: str = Path(..., description="Leave request ID"),
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Reject a leave request"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user)
        
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "You don't have permission to reject leave requests"}
            )
        
        # Get database reference
        db = get_database()
        
        # Get leave request
        leave_request = None
        if ObjectId.is_valid(request_id):
            leave_request = db.leave_requests.find_one({"_id": ObjectId(request_id)})
        
        if not leave_request:
            return JSONResponse(
                status_code=404,
                content={"detail": "Leave request not found"}
            )
        
        # Ensure reason is provided
        reason = data.get("reason") or data.get("reviewer_comments")
        if not reason:
            return JSONResponse(
                status_code=400,
                content={"detail": "Reason for rejection is required"}
            )
        
        # Update leave request
        db.leave_requests.update_one(
            {"_id": leave_request["_id"]},
            {"$set": {
                "status": "rejected",
                "rejected_at": datetime.now().isoformat(),
                "reviewer_id": data.get("reviewer_id") or str(current_user.get("_id")),
                "reviewer_comments": reason
            }}
        )
        
        # Return result
        return {
            "success": True,
            "message": "Leave request rejected successfully"
        }
    
    except Exception as e:
        logger.error(f"Error in reject leave request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

# New endpoints for employee statistics and attendance

@hr_staff_router.get("/employees/statistics", include_in_schema=False)
@hr_staff_router.get("/api/employees/statistics")  # Add the path that the frontend is looking for
async def get_employee_statistics(
    user_id: str = Query(None, description="User ID"),
    role: str = Query(None, description="User role"),
    current_user = Depends(get_current_user)
):
    """Get statistics for employees"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict()
        
        # Validate access
        has_access = await check_hr_access(user_dict, role)
        if not has_access and user_id != current_user.id:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied"}
            )
        
        # Prepare statistics
        stats = {
            "totalTasks": 0,
            "completedTasks": 0,
            "pendingLeaves": 0,
            "attendanceRate": 0
        }
        
        # Count tasks if task collection exists
        if "tasks" in db.list_collection_names():
            query = {"assigned_to": user_id} if user_id else {}
            stats["totalTasks"] = db.tasks.count_documents(query)
            stats["completedTasks"] = db.tasks.count_documents({
                **query, 
                "status": {"$in": ["completed", "done"]}
            })
        
        # Count pending leaves
        if "leave_requests" in db.list_collection_names():
            query = {"employee_id": user_id} if user_id else {}
            stats["pendingLeaves"] = db.leave_requests.count_documents({
                **query,
                "status": "pending"
            })
        
        # Calculate attendance rate (last 30 days)
        if "attendance" in db.list_collection_names():
            today = datetime.now()
            thirty_days_ago = today - timedelta(days=30)
            
            # Query to find attendance records
            query = {"employee_id": user_id} if user_id else {}
            total_records = db.attendance.count_documents({
                **query,
                "date": {"$gte": thirty_days_ago.strftime("%Y-%m-%d")}
            })
            
            present_records = db.attendance.count_documents({
                **query,
                "date": {"$gte": thirty_days_ago.strftime("%Y-%m-%d")},
                "status": "present"
            })
            
            stats["attendanceRate"] = round((present_records / total_records * 100) if total_records > 0 else 0, 2)
        
        return stats
        
    except Exception as e:
        logger.error(f"Error in employee statistics: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.get("/employees/attendance/all", include_in_schema=False)
@hr_staff_router.get("/api/employees/attendance/all")  # Add the path that the frontend is looking for
async def get_all_attendance_hr(
    current_user_id: str = Query(..., description="Current user ID"),
    role: str = Query(None, description="User role (admin/hr)"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(100, description="Items per page"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user)
):
    """Get attendance records for all employees (admin/HR only)"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict() if hasattr(current_user, 'to_dict') else current_user
        
        # Validate access - only admin/HR should access all attendance
        has_access = await check_hr_access(user_dict, role)
        if not has_access:
            return JSONResponse(
                status_code=403, 
                content={"detail": "Access denied - only admin or HR can view all attendance"}
            )
            
        # Set date range (default to last 7 days)
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if not start_date:
            start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            
        # Query attendance records
        query = {
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get records with pagination
        attendance_records = list(db.attendance.find(query).sort("date", -1).skip(skip).limit(limit))
        total_records = db.attendance.count_documents(query)
        
        # Convert ObjectId to string for each record
        for record in attendance_records:
            if "_id" in record:
                record["_id"] = str(record["_id"])
        
        # Group by date
        attendance_by_date = {}
        for record in attendance_records:
            date = record.get('date')
            if date not in attendance_by_date:
                attendance_by_date[date] = []
            attendance_by_date[date].append(record)
        
        return {
            "records": attendance_records,
            "records_by_date": attendance_by_date,
            "total": total_records,
            "page": page,
            "limit": limit,
            "pages": (total_records + limit - 1) // limit if total_records > 0 else 1,
            "summary": {
                "present": sum(1 for r in attendance_records if r.get("status") == "present"),
                "absent": sum(1 for r in attendance_records if r.get("status") == "absent"),
                "leave": sum(1 for r in attendance_records if r.get("status") == "leave"),
                "total": len(attendance_records)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting all attendance: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.get("/employees/attendance/user", include_in_schema=False)
@hr_staff_router.get("/api/employees/attendance/user")  # Add the path that the frontend is looking for
async def get_employee_attendance(
    user_id: str = Query(..., description="User ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user)
):
    """Get attendance records for a specific employee"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict()
        
        # Validate access
        has_access = await check_hr_access(user_dict)
        if not has_access and user_id != current_user.id:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied"}
            )
        
        # Set date range (default to last 30 days)
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
        # Query attendance records
        query = {
            "employee_id": user_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        attendance_records = list(db.attendance.find(query).sort("date", -1))
        
        # Convert ObjectId to string for each record
        for record in attendance_records:
            if "_id" in record:
                record["_id"] = str(record["_id"])
        
        return {
            "records": attendance_records,
            "summary": {
                "present": sum(1 for r in attendance_records if r.get("status") == "present"),
                "absent": sum(1 for r in attendance_records if r.get("status") == "absent"),
                "leave": sum(1 for r in attendance_records if r.get("status") == "leave"),
                "total": len(attendance_records)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in employee attendance: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.get("/employees/attendance/all", include_in_schema=False)
@hr_staff_router.get("/api/employees/attendance/all")  # Add the path that the frontend is looking for
async def get_all_attendance(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user)
):
    """Get all attendance records (for HR and admin only)"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict()
        
        # Validate access - only HR and admin can view all attendance
        has_access = await check_hr_access(user_dict)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Only HR and admin can view all attendance records."}
            )
        
        # Set date range (default to last 30 days)
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
        # Query all attendance records within date range
        query = {
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        attendance_records = list(db.attendance.find(query).sort("date", -1))
        
        # Convert ObjectId to string for each record
        attendance_records = convert_objectid_to_str(attendance_records)
        
        return {
            "success": True,
            "data": attendance_records
        }
        
    except Exception as e:
        logger.error(f"Error in get all attendance: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@hr_staff_router.put("/attendance/edit/{attendance_id}")
@hr_staff_router.put("/api/employees/attendance/edit/{attendance_id}")  # Add the path that the frontend is looking for
async def edit_attendance_record(
    attendance_id: str = Path(..., description="Attendance record ID"),
    data: Dict[str, Any] = Body(...),
    current_user = Depends(get_current_user)
):
    """Edit an attendance record (HR/Admin only)"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict()
        
        # Validate access - only HR and admin can edit attendance
        has_access = await check_hr_access(user_dict)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Only HR and admin can edit attendance records."}
            )
            
        # Check if attendance record exists
        attendance_record = None
        if ObjectId.is_valid(attendance_id):
            attendance_record = db.attendance.find_one({"_id": ObjectId(attendance_id)})
            
        if not attendance_record:
            return JSONResponse(
                status_code=404,
                content={"detail": "Attendance record not found"}
            )
            
        # Fields that can be updated
        allowed_fields = [
            "date", "status", "checkin_time", "checkout_time", 
            "working_hours", "notes", "location", "location_name"
        ]
        
        # Create update object with only allowed fields
        update_data = {}
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
                
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.now().isoformat()
        update_data["updated_by"] = str(current_user.get("_id", ""))
        
        # Add audit trail
        if not "audit_trail" in attendance_record:
            attendance_record["audit_trail"] = []
            
        audit_entry = {
            "action": "edit",
            "timestamp": datetime.now().isoformat(),
            "user_id": str(current_user.get("_id", "")),
            "user_name": current_user.get("name", ""),
            "changes": update_data
        }
        
        # Update the record
        db.attendance.update_one(
            {"_id": ObjectId(attendance_id)},
            {
                "$set": update_data,
                "$push": {"audit_trail": audit_entry}
            }
        )
        
        # Get updated record
        updated_record = db.attendance.find_one({"_id": ObjectId(attendance_id)})
        
        return convert_objectid_to_str({
            "success": True,
            "message": "Attendance record updated successfully",
            "record": updated_record
        })
        
    except Exception as e:
        logger.error(f"Error in edit attendance record: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )
        
@hr_staff_router.post("/attendance/create")
@hr_staff_router.post("/api/employees/attendance/create")  # Add the path that the frontend is looking for
async def create_attendance_record(
    data: Dict[str, Any] = Body(...),
    current_user = Depends(get_current_user)
):
    """Create an attendance record for an employee (HR/Admin only)"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict()
        
        # Validate access - only HR and admin can create attendance records
        has_access = await check_hr_access(user_dict)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Only HR and admin can create attendance records."}
            )
            
        # Validate required fields
        required_fields = ["user_id", "date", "status"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required fields: {', '.join(missing_fields)}"}
            )
            
        # Get employee details
        user_id = data.get("user_id")
        user_data = None
        
        if ObjectId.is_valid(user_id):
            user_data = db.users.find_one({"_id": ObjectId(user_id)})
        else:
            user_data = db.users.find_one({"user_id": user_id})
            
        if not user_data:
            return JSONResponse(
                status_code=404,
                content={"detail": "Employee not found"}
            )
            
        # Set employee name if not provided
        if not data.get("employee_name"):
            data["employee_name"] = user_data.get("name") or user_data.get("full_name") or user_data.get("username") or "Employee"
        
        # Set employee_id for consistency
        data["employee_id"] = user_id
            
        # Check if record already exists for the date
        existing_record = db.attendance.find_one({
            "user_id": user_id,
            "date": data["date"]
        })
        
        if existing_record:
            return JSONResponse(
                status_code=400,
                content={"detail": "Attendance record already exists for this employee on this date"}
            )
            
        # Add timestamps
        now = datetime.now()
        data["created_at"] = now.isoformat()
        data["updated_at"] = now.isoformat()
        
        # Add audit information
        data["created_by"] = str(current_user.get("_id", ""))
        data["created_by_name"] = current_user.get("name", "")
        
        # Add notes if not provided
        if not data.get("notes"):
            data["notes"] = f"Manually added by {current_user.get('name', 'admin/HR')}"
            
        # Insert the record
        result = db.attendance.insert_one(data)
        
        # Get the created record
        created_record = db.attendance.find_one({"_id": result.inserted_id})
        
        return convert_objectid_to_str({
            "success": True,
            "message": "Attendance record created successfully",
            "record": created_record
        })
        
    except Exception as e:
        logger.error(f"Error in create attendance record: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )
        
    except Exception as e:
        logger.error(f"Error in employee attendance: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )
