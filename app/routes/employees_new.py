from fastapi import APIRouter, HTTPException, Query, Body, Depends, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime, timedelta, date
import logging
import calendar
import os
import uuid
import random
import hashlib
from pathlib import Path
import mimetypes
from app.database import get_database
from app.dependencies import get_current_user
from app.database import employees_collection
from app.models.employee import (
    EmployeeCreate, 
    EmployeeUpdate, 
    EmployeeResponse, 
    EmployeeCombined,
    EmployeeDocumentUpload,
    SyncCollectionsResponse,
    EmployeeListResponse
)



# Initialize router
employees_router = APIRouter(prefix="/api/employees", tags=["employees"])

# Utility function to make MongoDB documents JSON-serializable
def make_serializable(obj):
    """Convert MongoDB document to JSON-serializable dictionary."""
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_serializable(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, date):
        return obj.isoformat()
    else:
        return obj

# Helper function to check HR permissions
def has_hr_permission(user_roles: List[str]) -> bool:
    """Check if user has HR permissions"""
    hr_roles = ["hr", "admin", "hr_manager", "human_resources"]
    return any(role.lower() in hr_roles for role in user_roles)

# Helper function to check if user can manage leave requests (admin or HR roles)
def can_manage_leave_requests(user_roles: List[str]) -> bool:
    """Check if user has permissions to approve/reject leave requests (admin or HR roles)"""
    authorized_roles = ["hr", "admin", "hr_manager", "human_resources", "administrator"]

    # Check both direct role matching and case-insensitive matching
    has_permission = any(role.lower() in authorized_roles for role in user_roles)
    return has_permission

# Define valid employee roles/positions
VALID_EMPLOYEE_ROLES = {
    "hr": "HR",
    "manager": "Manager", 
    "sales": "Sales",
    "sales_executive": "Sales Executive",
    "sales_manager": "Sales Manager",
    "executive": "Executive",
    "team_leader": "Team Leader",
    "admin": "Admin",
    "administrator": "Administrator",
    "hr_manager": "HR Manager",
    "hr_executive": "HR Executive",
    "supervisor": "Supervisor",
    "assistant": "Assistant",
    "intern": "Intern",
    "employee": "Employee",
    "finance": "Finance",
    "finance_manager": "Finance Manager",
    "marketing": "Marketing",
    "marketing_manager": "Marketing Manager",
    "operations": "Operations",
    "operations_manager": "Operations Manager",
    "it": "IT",
    "it_support": "IT Support",
    "developer": "Developer",
    "ceo": "CEO",
    "cfo": "CFO",
    "cto": "CTO",
    "director": "Director"
}

# Function to ensure all roles have proper ID fields
def ensure_role_ids(db):
    """Check all roles in the database and ensure they have proper ID fields"""
    try:
        # Find roles without id field
        roles_without_id = list(db.roles.find({"id": {"$exists": False}}))
        
        for role in roles_without_id:
            # Generate a proper role ID
            role_name = role.get("name", "role").lower()
            role_prefix = role_name[:3].upper()
            new_id = f"{role_prefix}-{random.randint(100, 999)}"
            
            # Check if this ID already exists
            while db.roles.find_one({"id": new_id}):
                new_id = f"{role_prefix}-{random.randint(100, 999)}"
            
            # Update the role with the new ID
            db.roles.update_one(
                {"_id": role["_id"]},
                {"$set": {"id": new_id}}
            )
            print(f"[DEBUG] Added ID field to role {role.get('name')}: {new_id}")
        
        return len(roles_without_id)
    except Exception as e:
        print(f"[ERROR] Failed to fix role IDs: {str(e)}")
        return 0

# Helper function to validate employee role
def is_valid_employee_role(role: str) -> bool:
    """Check if the provided role is a valid employee role"""
    if not role:
        return False
        
    # If role is a dict, extract the name field
    if isinstance(role, dict):
        role = role.get("name", "")
    
    role = role.lower()
    
    # Direct match in VALID_EMPLOYEE_ROLES
    if role in VALID_EMPLOYEE_ROLES:
        return True
        
    # Check if it contains any valid role name
    for valid_role in VALID_EMPLOYEE_ROLES:
        if valid_role in role or role in valid_role:
            return True
            
    return False

# Helper function to get role prefix for emp_id
def get_role_prefix(role: str) -> str:
    """Get prefix for employee ID based on role"""
    role_prefixes = {
        "hr": "HR",
        "manager": "MGR", 
        "sales": "SLS",
        "executive": "EXE",
        "team_leader": "TL",
        "admin": "ADM",
        "supervisor": "SUP",
        "assistant": "AST",
        "intern": "INT",
        "employee": "EMP"
    }
    return role_prefixes.get(role.lower(), "EMP")

# Helper function to generate unique user ID
def generate_user_id(db):
    """Generate unique user ID for users collection"""
    import random
    while True:
        user_id = f"USR-{random.randint(100, 999)}"
        if not db.users.find_one({"user_id": user_id}):
            return user_id

# Helper function to generate unique employee ID with role-based prefix
def generate_employee_id(db, role: str = "employee"):
    """Generate unique employee ID for employees collection with role-based prefix"""
    import random
    prefix = get_role_prefix(role)
    while True:
        # Generate ID with role prefix and 4-digit number
        emp_id = f"{prefix}-{random.randint(1000, 9999)}"
        if not db.employees.find_one({"emp_id": emp_id}):
            return emp_id

# Helper function to check if user exists in either collection
def check_user_exists(db, email, user_id=None, emp_id=None):
    """Check if user exists in users or employees collection"""
    # Check in users collection
    user_query = {"email": email}
    if user_id:
        user_query["$or"] = [{"email": email}, {"user_id": user_id}]
    
    existing_user = db.users.find_one(user_query)
    
    # Check in employees collection
    emp_query = {"email": email}
    if emp_id:
        emp_query["$or"] = [{"email": email}, {"emp_id": emp_id}]
    
    existing_employee = db.employees.find_one(emp_query)
    
    return existing_user, existing_employee

# Helper function to determine if user should be stored in employees collection
def should_create_employee_record(roles: List[str], position: str = "") -> bool:
    """Determine if user should have employee record based on roles/position"""
    if not roles:
        roles = []
    
    # Check if any role or position matches employee criteria
    employee_criteria = ["hr", "manager", "sales", "executive", "team_leader", "supervisor", "assistant"]
    
    # Check roles
    for role in roles:
        if isinstance(role, str) and role.lower() in employee_criteria:
            return True
        elif isinstance(role, dict) and role.get("name", "").lower() in employee_criteria:
            return True
    
    # Check position
    if position and position.lower() in employee_criteria:
        return True
    
    # Check for any role that suggests employee status
    if any(is_valid_employee_role(str(role)) for role in roles):
        return True
        
    return True  # Default to creating employee record for all users

@employees_router.post("/sync-collections", status_code=200)
async def sync_employee_collections(
    current_user: dict = Depends(get_current_user)
):
    """Sync data between users and employees collections"""
    try:
        db = get_database()
        current_user_roles = current_user.get("roles", [])
        
        # Check if user has HR permissions
        if not has_hr_permission(current_user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        sync_results = {
            "users_processed": 0,
            "employees_created": 0,
            "employees_processed": 0,
            "users_created": 0,
            "errors": []
        }
        
        # Sync users to employees collection
        users = list(db.users.find({}))
        for user in users:
            sync_results["users_processed"] += 1
            
            # Check if employee record exists
            existing_emp = db.employees.find_one({"user_id": user["user_id"]})
            
            # Determine if this user should have an employee record
            user_roles = user.get("roles", [])
            user_position = user.get("position", "")
            
            if not existing_emp and should_create_employee_record(user_roles, user_position):
                try:
                    # Determine primary role for emp_id generation
                    primary_role = "employee"
                    if user_roles:
                        for role in user_roles:
                            role_name = role if isinstance(role, str) else role.get("name", "")
                            if is_valid_employee_role(role_name):
                                primary_role = role_name.lower()
                                break
                    elif user_position and is_valid_employee_role(user_position):
                        primary_role = user_position.lower()
                    
                    emp_id = generate_employee_id(db, primary_role)
                    employee_data = {
                        "emp_id": emp_id,
                        "employee_id": emp_id,
                        "name": user.get("full_name", ""),
                        "email": user.get("email", ""),
                        "phone": user.get("phone", ""),
                        "position": user.get("position", primary_role.title()),
                        "role": primary_role,
                        "roles": user_roles,
                        "salary": str(user.get("salary", "0")),
                        "location": user.get("city", ""),
                        "date_of_joining": user.get("date_of_joining", datetime.now().strftime("%Y-%m-%d")),
                        "shift": "9am - 6pm",
                        "gender": "",
                        "documents": [],
                        "user_id": user["user_id"],
                        "department": user.get("department", ""),
                        "is_active": user.get("is_active", True),
                        "created_at": datetime.now(),
                        "updated_at": datetime.now()
                    }
                    
                    db.employees.insert_one(employee_data)
                    sync_results["employees_created"] += 1
                except Exception as e:
                    sync_results["errors"].append(f"Error creating employee for user {user['user_id']}: {str(e)}")
            elif existing_emp:
                # Update existing employee record with role information if missing
                try:
                    update_data = {}
                    if not existing_emp.get("role") and user_roles:
                        primary_role = "employee"
                        for role in user_roles:
                            role_name = role if isinstance(role, str) else role.get("name", "")
                            if is_valid_employee_role(role_name):
                                primary_role = role_name.lower()
                                break
                        update_data["role"] = primary_role
                        update_data["position"] = existing_emp.get("position", primary_role.title())
                    
                    if not existing_emp.get("roles"):
                        update_data["roles"] = user_roles
                    
                    if update_data:
                        update_data["updated_at"] = datetime.now()
                        db.employees.update_one(
                            {"_id": existing_emp["_id"]},
                            {"$set": update_data}
                        )
                except Exception as e:
                    sync_results["errors"].append(f"Error updating employee {existing_emp.get('emp_id')}: {str(e)}")
        
        # Sync employees to users collection
        employees = list(db.employees.find({}))
        for employee in employees:
            sync_results["employees_processed"] += 1
            
            # Check if user record exists
            user_id = employee.get("user_id")
            if not user_id:
                # Generate user_id if not present
                user_id = generate_user_id(db)
                db.employees.update_one(
                    {"_id": employee["_id"]},
                    {"$set": {"user_id": user_id}}
                )
            
            existing_user = db.users.find_one({"user_id": user_id})
            
            if not existing_user:
                try:
                    # Use AuthService for consistent password hashing
                    from app.services.auth_service import AuthService
                    auth_service = AuthService()
                    default_password = auth_service.get_password_hash("password123")
                    print(f"[DEBUG] Default password hashed with AuthService: {default_password[:20]}...")
                    
                    user_data = {
                        "user_id": user_id,
                        "username": employee.get("email", "").split("@")[0] if employee.get("email") else user_id,
                        "email": employee.get("email", ""),
                        "full_name": employee.get("name", ""),
                        "phone": employee.get("phone", ""),
                        "department": employee.get("department", ""),
                        "role_ids": [],
                        "roles": [],
                        "reports_to": "",
                        "is_active": employee.get("is_active", True),
                        "password": default_password,
                        "created_at": datetime.now(),
                        "updated_at": datetime.now(),
                        "last_login": None,
                        "failed_login_attempts": 0
                    }
                    
                    db.users.insert_one(user_data)
                    sync_results["users_created"] += 1
                except Exception as e:
                    sync_results["errors"].append(f"Error creating user for employee {employee.get('emp_id')}: {str(e)}")
        
        return {
            "success": True,
            "message": "Collections synchronized successfully",
            "results": sync_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync collections: {str(e)}")

# =================== EMPLOYEE CRUD OPERATIONS ===================

@employees_router.get("/roles", status_code=200)
async def get_valid_employee_roles():
    """Get list of valid employee roles/positions"""
    return {
        "success": True,
        "roles": VALID_EMPLOYEE_ROLES,
        "role_list": list(VALID_EMPLOYEE_ROLES.keys()),
        "message": "Valid employee roles retrieved successfully"
    }
    
@employees_router.get("/fix-role-ids", status_code=200)
async def fix_role_ids():
    """Fix all roles in the system to ensure they have proper ID fields"""
    try:
        db = get_database()
        fixed_count = ensure_role_ids(db)
        
        # Also check for any roles with improper format IDs
        roles = list(db.roles.find({"id": {"$exists": True}}))
        updated_count = 0
        
        for role in roles:
            role_id = role.get("id")
            if isinstance(role_id, str) and (not "-" in role_id or role_id.startswith("role-")):
                # This is an improper format ID, fix it
                role_name = role.get("name", "role").lower()
                role_prefix = role_name[:3].upper()
                new_id = f"{role_prefix}-{random.randint(100, 999)}"
                
                # Check if this ID already exists
                while db.roles.find_one({"id": new_id}):
                    new_id = f"{role_prefix}-{random.randint(100, 999)}"
                
                # Update the role with the new ID
                db.roles.update_one(
                    {"_id": role["_id"]},
                    {"$set": {"id": new_id}}
                )
                updated_count += 1
        
        return {
            "success": True,
            "fixed_count": fixed_count,
            "reformatted_count": updated_count,
            "message": f"Fixed {fixed_count} roles without IDs and reformatted {updated_count} improper IDs"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to fix role IDs"
        }

@employees_router.get("/collection/employees", status_code=200)
async def get_employees_from_collection(
    page: int = Query(1, description="Page number"),
    limit: int = Query(20, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, or emp_id"),
    role: Optional[str] = Query(None, description="Filter by employee role"),
    except_role: Optional[str] = Query(None, description="Exclude employees with this role (e.g., 'customer')"),
    department: Optional[str] = Query(None, description="Filter by department"),
    current_user: dict = Depends(get_current_user)
):
    """Get employees specifically from employees collection with enhanced filtering"""
    try:
        db = get_database()
        query = {}
        
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"name": search_regex},
                {"email": search_regex},
                {"emp_id": search_regex},
                {"employee_id": search_regex},
                {"position": search_regex}
            ]
        
        if role and is_valid_employee_role(role):
            query["role"] = role.lower()
        elif except_role:
            # Exclude employees with the specified role
            query["role"] = {"$ne": except_role.lower()}
        
        if department:
            query["department"] = {"$regex": department, "$options": "i"}
        
        # Pagination
        skip = (page - 1) * limit
        
        employees = list(db.employees.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.employees.count_documents(query)
        
        # Enhance with user data if available
        enhanced_employees = []
        for emp in employees:
            user_data = None
            if emp.get("user_id"):
                user_data = db.users.find_one({"user_id": emp["user_id"]})
            
            enhanced_emp = {
                **emp,
                "_id": str(emp["_id"]),
                "user_data": make_serializable(user_data) if user_data else None
            }
            enhanced_employees.append(enhanced_emp)
        
        return make_serializable({
            "success": True,
            "data": enhanced_employees,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "filters": {
                "search": search,
                "role": role,
                "department": department
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employees: {str(e)}")
        
        # Enhance with user data if available
        enhanced_employees = []
        for emp in employees:
            user_data = None
            if emp.get("user_id"):
                user_data = db.users.find_one({"user_id": emp["user_id"]})
            
            enhanced_emp = {
                **emp,
                "_id": str(emp["_id"]),
                "user_data": make_serializable(user_data) if user_data else None
            }
            enhanced_employees.append(enhanced_emp)
        
        return make_serializable({
            "success": True,
            "data": enhanced_employees,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employees: {str(e)}")

@employees_router.get("/", status_code=200)
async def get_all_employees(
    page: int = Query(1, description="Page number"),
    limit: int = Query(20, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, or user_id"),
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by role"),
    except_role: Optional[str] = Query(None, description="Exclude users with this role (e.g., 'customer')"),
    active_only: Optional[bool] = Query(True, description="Show only active employees"),
    current_user: dict = Depends(get_current_user)
):
    """Get employees with hierarchy filtering and role-based filtering - combines data from both users and employees collections"""
    try:
        db = get_database()
        current_user_id = current_user.get("user_id")
        current_user_roles = current_user.get("roles", [])
        
        # Check if user has HR permissions
        is_hr = has_hr_permission(current_user_roles)
        
        # Build query for users collection
        user_query = {}
        
        # Apply hierarchy filtering
        if not is_hr:
            user_query["$or"] = [
                {"reports_to": current_user_id},  # Direct reports
                {"user_id": current_user_id},  # Self
                {"reports_to": {"$in": [None, ""]}},  # Top level (no manager)
            ]
        
        # Apply other filters
        if active_only is not None:
            user_query["is_active"] = active_only
        
        if department:
            user_query["department"] = {"$regex": department, "$options": "i"}
        
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            search_condition = {
                "$or": [
                    {"full_name": search_regex},
                    {"email": search_regex},
                    {"user_id": search_regex},
                    {"username": search_regex}
                ]
            }
            
            if user_query:
                user_query = {"$and": [user_query, search_condition]}
            else:
                user_query = search_condition
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get users with role information
        pipeline = [
            {"$match": user_query},
            {
                "$lookup": {
                    "from": "roles",
                    "localField": "role_ids", 
                    "foreignField": "id",
                    "as": "role_details"
                }
            },
            {
                "$lookup": {
                    "from": "employees",
                    "localField": "user_id",
                    "foreignField": "user_id",
                    "as": "employee_details"
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        users = list(db.users.aggregate(pipeline))
        total_before_role_filter = db.users.count_documents(user_query)
        
        # Apply role filtering if specified (post-processing since we need employee_details)
        if role and is_valid_employee_role(role):
            filtered_users = []
            for user in users:
                employee_details = user.get("employee_details", [])
                employee_info = employee_details[0] if employee_details else {}
                
                # Check if user has the specified role
                user_roles = user.get("roles", [])
                employee_role = employee_info.get("role", "")
                
                # Check role match
                role_match = False
                if employee_role.lower() == role.lower():
                    role_match = True
                else:
                    for user_role in user_roles:
                        role_name = user_role if isinstance(user_role, str) else user_role.get("name", "")
                        if role_name.lower() == role.lower():
                            role_match = True
                            break
                
                if role_match:
                    filtered_users.append(user)
            
            users = filtered_users
            total = len(filtered_users)
        else:
            total = total_before_role_filter
        
        # Apply except_role filtering if specified (exclude users with specific role)
        if except_role:
            filtered_users = []
            for user in users:
                employee_details = user.get("employee_details", [])
                employee_info = employee_details[0] if employee_details else {}
                
                # Check if user has the excluded role
                user_roles = user.get("roles", [])
                employee_role = employee_info.get("role", "")
                
                # Check if user should be excluded
                should_exclude = False
                if employee_role.lower() == except_role.lower():
                    should_exclude = True
                else:
                    for user_role in user_roles:
                        role_name = user_role if isinstance(user_role, str) else user_role.get("name", "")
                        if role_name.lower() == except_role.lower():
                            should_exclude = True
                            break
                
                # Only include if not excluded
                if not should_exclude:
                    filtered_users.append(user)
            
            users = filtered_users
            total = len(filtered_users)
        
        # Format employees data combining both collections
        formatted_employees = []
        for user in users:
            # Get role names
            role_names = [role.get("name", "Unknown") for role in user.get("role_details", [])]
            
            # Get employee details from employees collection
            employee_details = user.get("employee_details", [])
            employee_info = employee_details[0] if employee_details else {}
            
            # Get latest attendance status
            today = datetime.now().strftime("%Y-%m-%d")
            attendance_today = db.attendance.find_one({
                "user_id": user.get("user_id"),
                "date": today
            })
            
            # Check if current user can manage this employee's attendance
            can_manage_attendance = (
                is_hr or  # HR can manage anyone
                user.get("user_id") == current_user_id or  # Self management
                user.get("reports_to") == current_user_id or  # Direct report
                user.get("reports_to") in [None, ""]  # Top level employees (no manager)
            )
            
            formatted_emp = {
                "employee_id": employee_info.get("emp_id", user.get("user_id")),
                "emp_id": employee_info.get("emp_id"),
                "id": str(user.get("_id")),
                "user_id": user.get("user_id"),
                "full_name": user.get("full_name"),
                "name": employee_info.get("name", user.get("full_name")),
                "username": user.get("username"),
                "email": user.get("email"),
                "phone": user.get("phone", employee_info.get("phone", "")),
                "department": user.get("department", employee_info.get("department", "")),
                "position": employee_info.get("position", ""),
                "role": employee_info.get("role", "employee"),  # Primary role from employees collection
                "salary": employee_info.get("salary", ""),
                "location": employee_info.get("location", ""),
                "shift": employee_info.get("shift", ""),
                "gender": employee_info.get("gender", ""),
                "date_of_joining": employee_info.get("date_of_joining"),
                "role_names": role_names,
                "roles": user.get("roles", []),
                "is_active": user.get("is_active", True),
                "created_at": user.get("created_at"),
                "reports_to": user.get("reports_to"),
                "last_login": user.get("last_login"),
                "can_manage_attendance": can_manage_attendance,
                "attendance_status": {
                    "status": attendance_today.get("status", "absent") if attendance_today else "absent",
                    "checkin_time": attendance_today.get("checkin_time") if attendance_today else None,
                    "checkout_time": attendance_today.get("checkout_time") if attendance_today else None,
                    "can_checkout": bool(attendance_today and attendance_today.get("checkin_time") and not attendance_today.get("checkout_time")) if can_manage_attendance else False,
                    "can_checkin": not bool(attendance_today and attendance_today.get("checkin_time")) if can_manage_attendance else False
                },
                "documents": employee_info.get("documents", [])
            }
            formatted_employees.append(formatted_emp)
        
        return make_serializable({
            "success": True,
            "data": formatted_employees,
            "employees": formatted_employees,  # For compatibility
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employees: {str(e)}")

@employees_router.get("/{employee_id}/profile", status_code=200)
async def get_employee_profile(
    employee_id: str,
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Get detailed employee profile with reports and analytics"""
    try:
        db = get_database()
        
        # Find user by user_id
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get role information
        role_details = []
        if user.get("role_ids"):
            role_details = list(db.roles.find({"id": {"$in": user["role_ids"]}}))
        
        # Get current month attendance summary
        now = datetime.now()
        start_of_month = datetime(now.year, now.month, 1)
        end_of_month = datetime(now.year, now.month, calendar.monthrange(now.year, now.month)[1])
        
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {
                "$gte": start_of_month.strftime("%Y-%m-%d"),
                "$lte": end_of_month.strftime("%Y-%m-%d")
            }
        }))
        
        # Calculate attendance metrics
        present_days = sum(1 for record in attendance_records if record.get("status") == "present")
        total_working_hours = sum(record.get("working_hours", 0) for record in attendance_records)
        working_days_in_month = len([d for d in range(1, calendar.monthrange(now.year, now.month)[1] + 1) 
                                   if datetime(now.year, now.month, d).weekday() < 5])
        
        # Get leads assigned this month
        leads_this_month = db.leads.count_documents({
            "assigned_to": employee_id,
            "created_at": {"$gte": start_of_month, "$lte": end_of_month}
        })
        
        # Get lead activities this month
        activities_this_month = db.lead_activities.count_documents({
            "created_by": employee_id,
            "created_at": {"$gte": start_of_month, "$lte": end_of_month}
        })
        
        # Get pending leave requests
        pending_leaves = db.leave_requests.count_documents({
            "user_id": employee_id,
            "status": "pending"
        })
        
        # Format response
        employee_data = {
            "employee_id": user.get("user_id"),
            "id": str(user.get("_id")),
            "user_id": user.get("user_id"),
            "full_name": user.get("full_name"),
            "username": user.get("username"),
            "email": user.get("email"),
            "phone": user.get("phone", ""),
            "department": user.get("department", ""),
            "position": user.get("position", ""),
            "role_names": [role.get("name", "Unknown") for role in role_details],
            "is_active": user.get("is_active", True),
            "created_at": user.get("created_at"),
            "reporting_user_id": user.get("reporting_user_id"),
            "last_login": user.get("last_login"),
            "current_month_stats": {
                "present_days": present_days,
                "working_days": working_days_in_month,
                "attendance_percentage": round((present_days / working_days_in_month * 100), 2) if working_days_in_month > 0 else 0,
                "total_working_hours": total_working_hours,
                "avg_hours_per_day": round(total_working_hours / present_days, 2) if present_days > 0 else 0,
                "leads_assigned": leads_this_month,
                "activities_completed": activities_this_month,
                "pending_leave_requests": pending_leaves
            }
        }
        
        return make_serializable({
            "success": True,
            "data": employee_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee profile: {str(e)}")

@employees_router.post("/", status_code=201)
async def create_employee(payload: Dict = Body(...)):
    """Create a new employee with comprehensive profile data in both users and employees collections"""
    try:
        db = get_database()
        
        # Ensure all roles in the database have proper ID fields
        fixed_roles = ensure_role_ids(db)
        if fixed_roles > 0:
            print(f"[DEBUG] Fixed {fixed_roles} roles without ID fields")
        
        # Debug: Print all fields from the payload to see what's being sent
        print(f"[DEBUG] CREATE EMPLOYEE - Received payload with fields: {list(payload.keys())}")
        # Print role related fields for debugging
        print(f"[DEBUG] Role fields - role: {payload.get('role')}, roles: {payload.get('roles')}, role_ids: {payload.get('role_ids')}")
        
        # Required fields
        required_fields = ["email", "full_name", "password"]
        for field in required_fields:
            if not payload.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Validate role/position if provided
        # Handle both singular and plural forms (role and roles) for compatibility
        user_roles = payload.get("roles", [])
        
        # If frontend sent 'role' (singular), convert to 'roles' array format
        if not user_roles and "role" in payload:
            single_role = payload.get("role")
            if single_role:
                if isinstance(single_role, str):
                    # Simple role name
                    user_roles = [single_role]
                    # Fetch role details from database if available
                    role_data = db.roles.find_one({"name": single_role.lower()})
                    if role_data:
                        print(f"[DEBUG] Found role details in database: {role_data}")
                elif isinstance(single_role, dict):
                    # The role is already an object with details
                    print(f"[DEBUG] Received role object: {single_role}")
                    if "name" in single_role:
                        user_roles = [single_role["name"]]
                        # Fetch complete role details if only partial info is provided
                        if "id" in single_role and not "permissions" in single_role:
                            complete_role = db.roles.find_one({"id": single_role["id"]})
                            if complete_role:
                                single_role = complete_role
                                print(f"[DEBUG] Enhanced role with complete details: {single_role}")
                print(f"[DEBUG] Converted singular role '{single_role}' to roles array: {user_roles}")
        
        user_position = payload.get("position", "")
        
        # Determine primary role for employee
        primary_role = "employee"
        if user_roles:
            for role in user_roles:
                role_name = role if isinstance(role, str) else role.get("name", "")
                if is_valid_employee_role(role_name):
                    primary_role = role_name.lower()
                    break
        elif user_position and is_valid_employee_role(user_position):
            primary_role = user_position.lower()
        
        # Generate unique IDs
        user_id = payload.get("user_id") or generate_user_id(db)
        emp_id = payload.get("emp_id") or generate_employee_id(db, primary_role)
        
        # Check if user already exists in either collection
        existing_user, existing_employee = check_user_exists(db, payload["email"], user_id, emp_id)
        
        if existing_user and existing_employee:
            # Both records exist with matching email - don't create
            raise HTTPException(status_code=400, detail="User already exists in both systems")
        elif existing_user and existing_user.get("email") == payload["email"]:
            # User exists but check if employee record exists
            if existing_employee and existing_employee.get("email") == payload["email"]:
                raise HTTPException(status_code=400, detail="User already exists in both systems")
            # User exists but no employee record - create only employee record if criteria met
            user_record = existing_user
            create_user = False
            create_employee_record = should_create_employee_record(user_roles, user_position)
        elif existing_employee and existing_employee.get("email") == payload["email"]:
            # Employee exists but no user record - create only user record
            employee_record = existing_employee
            create_user = True
            create_employee_record = False
        else:
            # Neither exists - create both if employee criteria met
            create_user = True
            create_employee_record = should_create_employee_record(user_roles, user_position)
        
        # Import and use the AuthService for consistent password hashing
        from app.services.auth_service import AuthService
        auth_service = AuthService()
        
        # Hash password using the same method as in auth_service
        password_hash = auth_service.get_password_hash(payload["password"])
        
        # Log for debugging
        print(f"[DEBUG] Employee password hashing - Using AuthService method: {password_hash[:20]}...")
        
        # Prepare user data for users collection
        if create_user:
            # Ensure we have both role_ids and roles with complete details
            role_ids = payload.get("role_ids", [])
            role_objects = []  # Store complete role objects
            
            # Handle the case where role_ids is a single string
            if isinstance(role_ids, str):
                role_ids = [role_ids]
                print(f"[DEBUG] Converted single role_id string to array: {role_ids}")
            
            # Check if we have full role objects in the payload
            if "role_objects" in payload and isinstance(payload["role_objects"], list):
                role_objects = payload["role_objects"]
                print(f"[DEBUG] Found complete role objects in payload: {role_objects}")
                
                # Extract role_ids and user_roles from role_objects
                role_ids = []
                user_roles = []
                for role_obj in role_objects:
                    if "id" in role_obj:
                        role_ids.append(role_obj["id"])
                    if "name" in role_obj:
                        user_roles.append(role_obj["name"].lower())
                
                # Store/update all role objects in the database
                for role_obj in role_objects:
                    if "id" in role_obj and "name" in role_obj:
                        existing_role = db.roles.find_one({"id": role_obj["id"]})
                        if existing_role:
                            # Update existing role
                            update_data = {
                                "name": role_obj["name"],
                                "updated_at": datetime.now()
                            }
                            if "description" in role_obj:
                                update_data["description"] = role_obj["description"]
                            if "permissions" in role_obj:
                                update_data["permissions"] = role_obj["permissions"]
                                
                            db.roles.update_one({"id": role_obj["id"]}, {"$set": update_data})
                            print(f"[DEBUG] Updated existing role: {role_obj['id']}")
                        else:
                            # Create new role
                            new_role = {
                                "id": role_obj["id"],
                                "name": role_obj["name"],
                                "description": role_obj.get("description", f"Role: {role_obj['name']}"),
                                "permissions": role_obj.get("permissions", []),
                                "created_at": datetime.now(),
                                "updated_at": datetime.now()
                            }
                            db.roles.insert_one(new_role)
                            print(f"[DEBUG] Created new role from object: {new_role}")
            
            # If we have role_ids but no roles, try to extract role names
            if role_ids and not user_roles:
                # Try to fetch role info from database to get names
                # Always use the "id" field, not "_id"
                roles_info = list(db.roles.find({"id": {"$in": role_ids}}))
                
                if roles_info:
                    user_roles = [role.get("name", "").lower() for role in roles_info]
                    role_objects = roles_info
                    print(f"[DEBUG] Extracted role names from role_ids: {user_roles}")
                else:
                    # If no roles found, try to fix any roles that might be using _id instead of id
                    for role_id in role_ids:
                        role_info = db.roles.find_one({"_id": role_id})
                        if role_info:
                            # This role is using _id instead of id, add the id field
                            if "name" in role_info:
                                role_prefix = role_info["name"][:3].upper()
                                new_id = f"{role_prefix}-{random.randint(100, 999)}"
                                db.roles.update_one(
                                    {"_id": role_id},
                                    {"$set": {"id": new_id}}
                                )
                                # Add the name to user_roles
                                user_roles.append(role_info.get("name", "").lower())
                                role_objects.append(role_info)
                                print(f"[DEBUG] Fixed role with missing id field: {new_id}")
            
            # If we have roles but no role_ids, try to find corresponding role_ids
            if user_roles and not role_ids:
                # Try to fetch role IDs from role names
                role_names_lower = [r.lower() if isinstance(r, str) else r.get("name", "").lower() for r in user_roles]
                roles_info = list(db.roles.find({"name": {"$in": role_names_lower}}))
                if roles_info:
                    # Always use the "id" field, not "_id"
                    role_ids = []
                    for role in roles_info:
                        if "id" in role:
                            role_ids.append(role["id"])
                        else:
                            # If no "id" field exists, create one with proper format
                            role_prefix = role.get("name", "role")[:3].upper()
                            new_id = f"{role_prefix}-{random.randint(100, 999)}"
                            # Update the role with the new ID
                            db.roles.update_one(
                                {"_id": role["_id"]},
                                {"$set": {"id": new_id}}
                            )
                            role_ids.append(new_id)
                    print(f"[DEBUG] Found role_ids from role names: {role_ids}")
            
            # If we still don't have role_ids but have a single role field
            if not role_ids and "role" in payload:
                single_role = payload.get("role")
                if isinstance(single_role, dict):
                    # The role field contains a role object with details
                    if "id" in single_role:
                        # Use the provided ID
                        role_ids = [single_role["id"]]
                        user_roles = [single_role.get("name", "").lower()]
                        
                        # Store the complete role object if it doesn't exist already
                        existing_role = db.roles.find_one({"id": single_role["id"]})
                        if not existing_role and "name" in single_role:
                            # Create the role with all details from the object
                            role_data = {
                                "id": single_role["id"],
                                "name": single_role["name"],
                                "description": single_role.get("description", f"Role: {single_role['name']}"),
                                "permissions": single_role.get("permissions", []),
                                "created_at": datetime.now(),
                                "updated_at": datetime.now()
                            }
                            db.roles.insert_one(role_data)
                            print(f"[DEBUG] Created new role from provided object: {role_data}")
                        
                        print(f"[DEBUG] Using role ID and details from role object: {role_ids}")
                    elif "name" in single_role:
                        # Use name to find or create role with all provided details
                        role_name = single_role["name"].lower()
                        existing_role = db.roles.find_one({"name": role_name})
                        
                        if existing_role:
                            # Use existing role but update with any new details
                            role_ids = [existing_role.get("id")]
                            
                            # Update the role with any new details
                            update_data = {}
                            if "description" in single_role and single_role["description"] != existing_role.get("description"):
                                update_data["description"] = single_role["description"]
                            if "permissions" in single_role:
                                update_data["permissions"] = single_role["permissions"]
                            
                            if update_data:
                                update_data["updated_at"] = datetime.now()
                                db.roles.update_one({"_id": existing_role["_id"]}, {"$set": update_data})
                                print(f"[DEBUG] Updated existing role with new details: {update_data}")
                        else:
                            # Create new role with proper ID format
                            role_prefix = role_name[:3].upper()
                            new_id = f"{role_prefix}-{random.randint(100, 999)}"
                            
                            # Create new role record
                            role_data = {
                                "id": new_id,
                                "name": role_name,
                                "description": single_role.get("description", f"Role: {role_name}"),
                                "permissions": single_role.get("permissions", []),
                                "created_at": datetime.now(),
                                "updated_at": datetime.now()
                            }
                            db.roles.insert_one(role_data)
                            role_ids = [new_id]
                            print(f"[DEBUG] Created new role from details: {role_data}")
                else:
                    # The role field contains a role name as string
                    role_name = single_role.lower() if isinstance(single_role, str) else "employee"
                    roles_info = list(db.roles.find({"name": role_name}))
                    
                    if roles_info:
                        # Always use the "id" field, never use _id
                        role_ids = []
                        for role in roles_info:
                            if "id" in role:
                                role_ids.append(role["id"])
                            else:
                                # If no id field exists, add one
                                role_prefix = role_name[:3].upper()
                                new_id = f"{role_prefix}-{random.randint(100, 999)}"
                                # Update the role with the new ID
                                db.roles.update_one(
                                    {"_id": role["_id"]},
                                    {"$set": {"id": new_id}}
                                )
                                role_ids.append(new_id)
                        print(f"[DEBUG] Found role_ids from single role field: {role_ids}")
                    else:
                        # If we can't find a matching role, store the role properly with id field
                        print(f"[DEBUG] No matching role found in database, will create a proper entry")
                        # Create the role in the database if it doesn't exist
                        role_name = single_role.lower() if isinstance(single_role, str) else "employee"
                        # Generate a consistent role ID format
                        role_prefix = role_name[:3].upper()
                        counter = 1
                        
                        # Check if a similar role exists to get the next counter
                        existing_roles = list(db.roles.find({"id": {"$regex": f"^{role_prefix}-"}}).sort("id", -1).limit(1))
                        if existing_roles:
                            try:
                                last_id = existing_roles[0]["id"]
                                counter_part = last_id.split("-")[1]
                                if counter_part.isdigit():
                                    counter = int(counter_part) + 1
                            except (IndexError, ValueError):
                                counter = 1
                        
                        new_role_id = f"{role_prefix}-{counter:03d}"
                        
                        # Check if this exact role ID already exists
                        while db.roles.find_one({"id": new_role_id}):
                            counter += 1
                            new_role_id = f"{role_prefix}-{counter:03d}"
                        
                        # Create proper role with name, id, and description
                        role_display_name = VALID_EMPLOYEE_ROLES.get(role_name, role_name.title())
                        
                        new_role = {
                            "id": new_role_id,
                            "name": role_name,
                            "display_name": role_display_name,
                            "description": f"Auto-generated role for {role_display_name}",
                            "permissions": [],
                            "created_at": datetime.now(),
                            "updated_at": datetime.now()
                        }
                        db.roles.insert_one(new_role)
                        role_ids = [new_role_id]
                        print(f"[DEBUG] Created new role with ID: {new_role_id}, name: {role_name}, display_name: {role_display_name}")
            
            # Ensure user_roles is not empty if we have a role
            if not user_roles and "role" in payload:
                single_role = payload.get("role")
                if single_role:
                    user_roles = [single_role.lower()]
                    print(f"[DEBUG] Set user_roles from role field: {user_roles}")
            
            # Print debug info
            print(f"[DEBUG] Final role_ids: {role_ids}, roles: {user_roles}")
            
            # Ensure role_ids and user_roles are lists
            if role_ids and not isinstance(role_ids, list):
                role_ids = [role_ids]
            if user_roles and not isinstance(user_roles, list):
                user_roles = [user_roles]
                
            # Normalize role names to ensure consistency
            normalized_roles = []
            if user_roles:
                for role in user_roles:
                    if isinstance(role, dict) and "name" in role:
                        normalized_roles.append(role["name"].lower())
                    elif isinstance(role, str):
                        normalized_roles.append(role.lower())
                    else:
                        print(f"[WARNING] Unexpected role format: {role}")
                user_roles = normalized_roles
                
            # Get complete role details if available
            role_details = []
            if role_ids:
                # Fetch complete role objects from database
                role_details = list(db.roles.find({"id": {"$in": role_ids}}))
                print(f"[DEBUG] Fetched {len(role_details)} complete role details from database")
            
            # If we have a single role object, use its details
            role_object = None
            if "role" in payload and isinstance(payload["role"], dict) and "id" in payload["role"]:
                role_object = payload["role"]
                
            # Extract all fields from payload to ensure we don't miss anything
            user_data = {
                "user_id": user_id,
                "username": payload.get("username", payload["email"].split("@")[0]),
                "email": payload["email"],
                "full_name": payload["full_name"],
                "phone": payload.get("phone", ""),
                "department": payload.get("department", ""),
                "position": user_position or primary_role.title(),
                "role_ids": role_ids,  # Store IDs from roles collection
                "roles": user_roles,    # Store role names
                # Also store complete role details
                "role_details": [
                    {
                        "id": role.get("id"),
                        "name": role.get("name"),
                        "description": role.get("description"),
                        "permissions": role.get("permissions", [])
                    }
                    for role in role_details if role
                ] if role_details else ([
                    {
                        "id": role_object.get("id"),
                        "name": role_object.get("name"),
                        "description": role_object.get("description"),
                        "permissions": role_object.get("permissions", [])
                    }
                ] if role_object else []),
                "reports_to": payload.get("reporting_user_id", payload.get("reports_to", "")),
                "is_active": payload.get("is_active", True),
                "password": password_hash,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "last_login": None,
                "failed_login_attempts": 0
            }
            
            # Insert into users collection
            user_result = db.users.insert_one(user_data)
            user_data["_id"] = user_result.inserted_id
            user_record = user_data
        
        # Prepare employee data for employees collection
        if create_employee_record:
            # Ensure role_ids is defined for employee record
            role_ids = payload.get("role_ids", [])
            if 'user_data' in locals() and user_data.get("role_ids"):
                role_ids = user_data["role_ids"]
            
            # Handle date fields
            # Handle both date_of_joining and doj fields (frontend may send either)
            date_of_joining = payload.get("date_of_joining")
            if not date_of_joining and payload.get("doj"):
                date_of_joining = payload.get("doj")
                
            # Handle date_of_birth and dob fields
            date_of_birth = payload.get("date_of_birth")
            if not date_of_birth and payload.get("dob"):
                date_of_birth = payload.get("dob")
            
            # Combine any location fields
            location = payload.get("location", "")
            if not location and payload.get("city"):
                location = payload.get("city")
                
            # Build employee data with all possible fields from the form
            employee_data = {
                # Primary identification fields
                "emp_id": emp_id,
                "employee_id": emp_id,  # For compatibility
                "user_id": user_id,  # Link to users collection
                
                # Basic information
                "name": payload["full_name"],
                "email": payload["email"],
                "phone": payload.get("phone", ""),
                "gender": payload.get("gender", ""),
                "date_of_birth": date_of_birth,
                
                # Job information
                "position": user_position or primary_role.title(),
                "department": payload.get("department", ""),
                "role": primary_role,  # Primary role (single string)
                "roles": user_roles,    # All roles (list of strings)
                "role_ids": role_ids,   # All role IDs (list of strings)
                # Complete role details if they exist
                "role_details": user_data.get("role_details", []) if "user_data" in locals() else [],
                "reports_to": payload.get("reporting_user_id", payload.get("reports_to", "")),
                "salary": str(payload.get("salary", "0")),
                "date_of_joining": date_of_joining or datetime.now().strftime("%Y-%m-%d"),
                "employee_type": payload.get("employee_type", "full_time"),
                "shift": payload.get("shift", "9am - 6pm"),
                
                # Location information
                "location": location,
                "address": payload.get("address", ""),
                "city": payload.get("city", ""),
                "state": payload.get("state", ""),
                "zip_code": payload.get("pincode", payload.get("zip_code", "")),  # Handle both pincode and zip_code
                "country": payload.get("country", "India"),
                
                # Emergency contact information
                "emergency_contact_name": payload.get("emergency_contact_name", ""),
                "emergency_contact_phone": payload.get("emergency_contact_phone", ""),
                
                # Bank details
                "bank_account_number": payload.get("bank_account_number", ""),
                "bank_name": payload.get("bank_name", ""),
                "bank_ifsc": payload.get("bank_ifsc", ""),
                
                # System fields
                "is_active": payload.get("is_active", True),
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "documents": [],
                
                # Other fields from form
                "qualification": payload.get("qualification", ""),
                "experience": payload.get("experience", ""),
                "skills": payload.get("skills", []),
                "certifications": payload.get("certifications", []),
                "pf_number": payload.get("pf_number", ""),
                "esi_number": payload.get("esi_number", ""),
                "pan_number": payload.get("pan_number", ""),
                "aadhar_number": payload.get("aadhar_number", ""),
                
                # Additional data
                "additional_info": payload.get("additional_info", {})
            }
            
            # Add any remaining fields from the payload that weren't explicitly handled
            for key, value in payload.items():
                if key not in employee_data and key not in ["password", "username"]:
                    employee_data[key] = value
                    print(f"[DEBUG] Added additional field from payload: {key}")
            
            # Insert into employees collection
            emp_result = db.employees.insert_one(employee_data)
            employee_data["_id"] = emp_result.inserted_id
            employee_record = employee_data
        
        # Prepare response data
        response_data = {
            "user_record": make_serializable(user_record) if 'user_record' in locals() else None,
            "employee_record": make_serializable(employee_record) if 'employee_record' in locals() else None,
            "user_id": user_id,
            "emp_id": emp_id,
            "primary_role": primary_role,
            "created_user": create_user,
            "created_employee": create_employee_record
        }
        
        message_parts = []
        if create_user:
            message_parts.append("User record created")
        if create_employee_record:
            message_parts.append(f"Employee record created with role: {primary_role}")
        if not message_parts:
            message_parts.append("Records already exist and matched")
        
        return make_serializable({
            "success": True,
            "message": " and ".join(message_parts),
            "data": response_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create employee: {str(e)}")

@employees_router.put("/{employee_id}/deactivate", status_code=200)
async def deactivate_employee(employee_id: str):
    """Deactivate an employee (soft delete)"""
    try:
        db = get_database()
        
        # Find employee
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Deactivate employee
        db.users.update_one(
            {"user_id": employee_id},
            {"$set": {"is_active": False, "updated_at": datetime.now()}}
        )
        
        return {
            "success": True,
            "message": "Employee deactivated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to deactivate employee: {str(e)}")

# =================== ATTENDANCE MANAGEMENT ===================

@employees_router.post("/attendance/checkin", status_code=201)
async def checkin_attendance(payload: Dict = Body(...)):
    """Check in/out attendance for an employee"""
    try:
        db = get_database()
        user_id = payload.get("user_id")
        action = payload.get("action", "checkin")  # checkin or checkout
        notes = payload.get("notes", "")
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        # Verify user exists
        user = db.users.find_one({"user_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        today = datetime.now().strftime("%Y-%m-%d")
        current_time = datetime.now()
        
        # Check if already has record today
        existing_record = db.attendance.find_one({
            "user_id": user_id,
            "date": today
        })
        
        if action == "checkin":
            if existing_record and existing_record.get("checkin_time"):
                raise HTTPException(status_code=400, detail="Already checked in today")
            
            # Create or update checkin record
            attendance_record = {
                "user_id": user_id,
                "employee_name": user.get("full_name", user.get("username")),
                "date": today,
                "checkin_time": current_time,
                "checkout_time": None,
                "status": "present",
                "working_hours": 0,
                "notes": notes,
                "location": {
                    "latitude": latitude,
                    "longitude": longitude
                } if latitude and longitude else None,
                "created_at": current_time,
                "updated_at": current_time
            }
            
            if existing_record:
                db.attendance.update_one(
                    {"user_id": user_id, "date": today},
                    {"$set": attendance_record}
                )
            else:
                db.attendance.insert_one(attendance_record)
            
            message = "Checked in successfully"
            
        elif action == "checkout":
            if not existing_record or not existing_record.get("checkin_time"):
                raise HTTPException(status_code=400, detail="No checkin record found for today")
            
            if existing_record.get("checkout_time"):
                raise HTTPException(status_code=400, detail="Already checked out today")
            
            # Calculate working hours
            checkin_time = existing_record["checkin_time"]
            if isinstance(checkin_time, str):
                checkin_time = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))
            
            working_hours = (current_time - checkin_time).total_seconds() / 3600
            
            # Update checkout
            db.attendance.update_one(
                {"user_id": user_id, "date": today},
                {"$set": {
                    "checkout_time": current_time,
                    "working_hours": round(working_hours, 2),
                    "notes": notes,
                    "updated_at": current_time
                }}
            )
            
            message = "Checked out successfully"
        
        return {
            "success": True,
            "message": message,
            "timestamp": current_time,
            "working_hours": round(working_hours, 2) if action == "checkout" else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record attendance: {str(e)}")

@employees_router.post("/{employee_id}/attendance/checkin", status_code=201)
async def employee_checkin(
    employee_id: str,
    payload: Dict = Body(...)
):
    """Check in attendance for specific employee with geolocation support"""
    try:
        db = get_database()
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get data from payload
        today = payload.get("date", datetime.now().strftime("%Y-%m-%d"))
        current_time = datetime.now()
        
        # Location data from your attendance system
        geo_lat = payload.get("geo_lat")
        geo_long = payload.get("geo_long") 
        location_name = payload.get("location_name", payload.get("location", "Office"))
        attendance_status = payload.get("status", "present")
        time_provided = payload.get("time")
        notes = payload.get("notes", "")
        
        # Parse time if provided
        if time_provided:
            try:
                if isinstance(time_provided, str):
                    current_time = datetime.fromisoformat(time_provided.replace('Z', '+00:00'))
                else:
                    current_time = time_provided
            except:
                current_time = datetime.now()
        
        # Check if already checked in today
        existing_record = db.attendance.find_one({
            "user_id": employee_id,
            "date": today
        })
        
        # Allow update if status was "absent" and now marking "present" (rescue scenario)
        if existing_record and existing_record.get("checkin_time") and existing_record.get("status") == "present":
            raise HTTPException(status_code=400, detail="Already checked in today")
        
        # Create or update checkin record
        attendance_record = {
            "user_id": employee_id,
            "employee_id": employee_id,
            "employee_name": user.get("full_name", user.get("username")),
            "date": today,
            "checkin_time": current_time,
            "checkout_time": None,
            "status": attendance_status,
            "working_hours": 0,
            "notes": notes,
            "location": location_name,
            "location_name": location_name,
            "geo_lat": geo_lat,
            "geo_long": geo_long,
            "time": current_time,
            "created_at": current_time,
            "updated_at": current_time
        }
        
        if existing_record:
            # Update existing record (rescue scenario)
            db.attendance.update_one(
                {"user_id": employee_id, "date": today},
                {"$set": attendance_record}
            )
            action_message = "Attendance updated successfully"
        else:
            # Create new record
            result = db.attendance.insert_one(attendance_record)
            attendance_record["_id"] = result.inserted_id
            action_message = "Checked in successfully"
        
        return {
            "success": True,
            "message": action_message,
            "timestamp": current_time,
            "data": {
                "employee_id": employee_id,
                "date": today,
                "status": attendance_status,
                "location": location_name,
                "geo_lat": geo_lat,
                "geo_long": geo_long
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check in: {str(e)}")

@employees_router.post("/{employee_id}/attendance/checkout", status_code=201)
async def employee_checkout(
    employee_id: str,
    payload: Dict = Body(...)
):
    """Check out attendance for specific employee with geolocation support"""
    try:
        db = get_database()
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        today = payload.get("date", datetime.now().strftime("%Y-%m-%d"))
        current_time = datetime.now()
        
        # Location data from your attendance system
        geo_lat = payload.get("geo_lat")
        geo_long = payload.get("geo_long")
        location_name = payload.get("location_name", payload.get("location", "Office"))
        time_provided = payload.get("time")
        notes = payload.get("notes", "")
        
        # Parse time if provided
        if time_provided:
            try:
                if isinstance(time_provided, str):
                    current_time = datetime.fromisoformat(time_provided.replace('Z', '+00:00'))
                else:
                    current_time = time_provided
            except:
                current_time = datetime.now()
        
        # Check if has checkin record today
        existing_record = db.attendance.find_one({
            "user_id": employee_id,
            "date": today
        })
        
        if not existing_record or not existing_record.get("checkin_time"):
            raise HTTPException(status_code=400, detail="No checkin record found for today")
        
        if existing_record.get("checkout_time"):
            raise HTTPException(status_code=400, detail="Already checked out today")
        
        # Calculate working hours
        checkin_time = existing_record["checkin_time"]
        if isinstance(checkin_time, str):
            # Parse string datetime and make it timezone aware if needed
            checkin_time = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))
        elif isinstance(checkin_time, datetime) and checkin_time.tzinfo is None:
            # If checkin_time is offset-naive, make current_time also offset-naive for consistency
            current_time = current_time.replace(tzinfo=None)
        
        working_hours = (current_time - checkin_time).total_seconds() / 3600
        
        # Update checkout with geolocation data
        checkout_data = {
            "checkout_time": current_time,
            "working_hours": round(working_hours, 2),
            "notes": notes,
            "updated_at": current_time
        }
        
        # Add geolocation data if provided
        if geo_lat is not None:
            checkout_data["checkout_geo_lat"] = geo_lat
            # Also update the main geo_lat for consistency
            checkout_data["geo_lat"] = geo_lat
        if geo_long is not None:
            checkout_data["checkout_geo_long"] = geo_long
            # Also update the main geo_long for consistency
            checkout_data["geo_long"] = geo_long
        if location_name:
            checkout_data["checkout_location"] = location_name
            # Also update the main location fields for consistency
            checkout_data["location"] = location_name
            checkout_data["location_name"] = location_name
        
        # Update the time field to checkout time for consistency
        checkout_data["time"] = current_time
        
        db.attendance.update_one(
            {"user_id": employee_id, "date": today},
            {"$set": checkout_data}
        )
        
        return {
            "success": True,
            "message": "Checked out successfully",
            "timestamp": current_time,
            "working_hours": round(working_hours, 2),
            "data": {
                "employee_id": employee_id,
                "date": today,
                "checkout_time": current_time,
                "working_hours": round(working_hours, 2),
                "checkout_location": location_name,
                "checkout_geo_lat": geo_lat,
                "checkout_geo_long": geo_long
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check out: {str(e)}")

@employees_router.get("/{employee_id}/attendance", status_code=200)
async def get_employee_attendance(
    employee_id: str,
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(31, description="Items per page")
):
    """Get attendance records for specific employee"""
    try:
        db = get_database()
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Set default month/year
        if not month:
            month = datetime.now().month
        if not year:
            year = datetime.now().year
        
        # Create date range
        start_date = datetime(year, month, 1).strftime("%Y-%m-%d")
        end_date = datetime(year, month, calendar.monthrange(year, month)[1]).strftime("%Y-%m-%d")
        
        query = {
            "user_id": employee_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        # Pagination
        skip = (page - 1) * limit
        
        records = list(db.attendance.find(query).sort("date", -1).skip(skip).limit(limit))
        total = db.attendance.count_documents(query)
        
        # Calculate summary
        present_days = sum(1 for record in records if record.get("status") == "present")
        total_hours = sum(record.get("working_hours", 0) for record in records)
        working_days = len([d for d in range(1, calendar.monthrange(year, month)[1] + 1) 
                           if datetime(year, month, d).weekday() < 5])
        
        return make_serializable({
            "success": True,
            "records": records,
            "page": page,
            "limit": limit,
            "total": total,
            "summary": {
                "month": month,
                "year": year,
                "present_days": present_days,
                "working_days": working_days,
                "attendance_percentage": round((present_days / working_days * 100), 2) if working_days > 0 else 0,
                "total_working_hours": total_hours,
                "avg_hours_per_day": round(total_hours / present_days, 2) if present_days > 0 else 0
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance records: {str(e)}")

@employees_router.get("/{employee_id}", status_code=200)
async def get_employee_by_id(
    employee_id: str,
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Get employee by ID with attendance status - combines data from both collections"""
    try:
        db = get_database()
        
        # Try to find by user_id first, then by emp_id
        user = db.users.find_one({"user_id": employee_id})
        employee_record = None
        
        if user:
            # Found by user_id, get corresponding employee record
            employee_record = db.employees.find_one({"user_id": employee_id})
        else:
            # Try to find by emp_id in employees collection
            employee_record = db.employees.find_one({"emp_id": employee_id})
            if employee_record:
                # Found by emp_id, get corresponding user record
                user = db.users.find_one({"user_id": employee_record.get("user_id")})
        
        if not user and not employee_record:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get role information
        role_details = []
        if user and user.get("role_ids"):
            role_details = list(db.roles.find({"id": {"$in": user["role_ids"]}}))
        
        # Get today's attendance status
        today = datetime.now().strftime("%Y-%m-%d")
        lookup_id = user.get("user_id") if user else employee_record.get("user_id")
        attendance_today = db.attendance.find_one({
            "user_id": lookup_id,
            "date": today
        })
        
        # Combine data from both collections
        employee_data = {
            "employee_id": employee_record.get("emp_id") if employee_record else user.get("user_id"),
            "emp_id": employee_record.get("emp_id") if employee_record else None,
            "id": str(user.get("_id")) if user else str(employee_record.get("_id")),
            "user_id": user.get("user_id") if user else employee_record.get("user_id"),
            "full_name": user.get("full_name") if user else employee_record.get("name"),
            "name": employee_record.get("name") if employee_record else user.get("full_name"),
            "username": user.get("username") if user else "",
            "email": user.get("email") if user else employee_record.get("email"),
            "phone": user.get("phone") if user else employee_record.get("phone", ""),
            "department": user.get("department") if user else employee_record.get("department", ""),
            "position": employee_record.get("position", "") if employee_record else "",
            "salary": employee_record.get("salary", "") if employee_record else "",
            "location": employee_record.get("location", "") if employee_record else "",
            "shift": employee_record.get("shift", "") if employee_record else "",
            "gender": employee_record.get("gender", "") if employee_record else "",
            "date_of_joining": employee_record.get("date_of_joining") if employee_record else "",
            "date_of_birth": employee_record.get("date_of_birth") if employee_record else user.get("date_of_birth") if user else "",
            "employee_type": employee_record.get("employee_type", "") if employee_record else user.get("employee_type", ""),
            "role_names": [role.get("name", "Unknown") for role in role_details],
            "roles": user.get("roles", []) if user else [],
            "status": "active" if (user and user.get("is_active", True)) or (employee_record and employee_record.get("is_active", True)) else "inactive",
            "is_active": user.get("is_active", True) if user else employee_record.get("is_active", True),
            "created_at": user.get("created_at") if user else employee_record.get("created_at"),
            "reports_to": user.get("reports_to") if user else "",
            "last_login": user.get("last_login") if user else None,
            
            # Address fields
            "address": employee_record.get("address", "") if employee_record else user.get("address", ""),
            "city": employee_record.get("city", "") if employee_record else user.get("city", ""),
            "state": employee_record.get("state", "") if employee_record else user.get("state", ""),
            "zip_code": employee_record.get("zip_code", "") if employee_record else user.get("zip_code", ""),
            "country": employee_record.get("country", "") if employee_record else user.get("country", ""),
            
            # Emergency contact
            "emergency_contact_name": employee_record.get("emergency_contact_name", "") if employee_record else user.get("emergency_contact_name", ""),
            "emergency_contact_phone": employee_record.get("emergency_contact_phone", "") if employee_record else user.get("emergency_contact_phone", ""),
            
            # Bank details
            "bank_account_number": employee_record.get("bank_account_number", "") if employee_record else user.get("bank_account_number", ""),
            "bank_name": employee_record.get("bank_name", "") if employee_record else user.get("bank_name", ""),
            "bank_ifsc": employee_record.get("bank_ifsc", "") if employee_record else user.get("bank_ifsc", ""),
            
            # Additional details
            "qualification": employee_record.get("qualification", "") if employee_record else user.get("qualification", ""),
            "experience": employee_record.get("experience", "") if employee_record else user.get("experience", ""),
            "skills": employee_record.get("skills", []) if employee_record else user.get("skills", []),
            "certifications": employee_record.get("certifications", []) if employee_record else user.get("certifications", []),
            "pf_number": employee_record.get("pf_number", "") if employee_record else user.get("pf_number", ""),
            "esi_number": employee_record.get("esi_number", "") if employee_record else user.get("esi_number", ""),
            "pan_number": employee_record.get("pan_number", "") if employee_record else user.get("pan_number", ""),
            "aadhar_number": employee_record.get("aadhar_number", "") if employee_record else user.get("aadhar_number", ""),
            
            "documents": employee_record.get("documents", []) if employee_record else [],
            "attendance_status": {
                "status": attendance_today.get("status", "absent") if attendance_today else "absent",
                "checkin_time": attendance_today.get("checkin_time") if attendance_today else None,
                "checkout_time": attendance_today.get("checkout_time") if attendance_today else None,
                "can_checkout": bool(attendance_today and attendance_today.get("checkin_time") and not attendance_today.get("checkout_time"))
            }
        }
        
        return make_serializable({
            "success": True,
            "employee": employee_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee: {str(e)}")

@employees_router.get("/{employee_id}/leave-requests", status_code=200)
async def get_employee_leave_requests(
    employee_id: str,
    page: int = Query(1, description="Page number"),
    limit: int = Query(20, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get leave requests for specific employee"""
    try:
        db = get_database()
        
        # Debug logging
        print(f"📋 Fetching leave requests for employee_id: {employee_id}")
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
                
        query = {"user_id": employee_id}
        
        if status:
            query["status"] = status
        
       
        # Pagination
        skip = (page - 1) * limit
        
        requests = list(db.leave_requests.find(query).sort("requested_at", -1).skip(skip).limit(limit))
        total = db.leave_requests.count_documents(query)
                
        result = make_serializable({
            "success": True,
            "requests": requests,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get leave requests: {str(e)}")

@employees_router.get("/{employee_id}/documents", status_code=200)
async def get_employee_documents(
    employee_id: str,
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Get employee documents"""
    try:
        db = get_database()
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # For now, return empty documents (implement document storage later)
        documents = []
        
        return make_serializable({
            "success": True,
            "documents": documents
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")

@employees_router.post("/{employee_id}/documents", status_code=201)
async def upload_employee_document(
    employee_id: str,
    payload: Dict = Body(...),
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Upload/Add employee document to employees collection"""
    try:
        db = get_database()
        
        # Find employee record
        employee = db.employees.find_one({
            "$or": [
                {"emp_id": employee_id},
                {"user_id": employee_id}
            ]
        })
        
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Document data
        document_name = payload.get("name")
        document_url = payload.get("url")
        
        if not document_name or not document_url:
            raise HTTPException(status_code=400, detail="Document name and URL are required")
        
        # Create document entry
        document_entry = {
            "name": document_name,
            "uploaded": datetime.now().strftime("%Y-%m-%d"),
            "url": document_url
        }
        
        # Add to documents array
        db.employees.update_one(
            {"_id": employee["_id"]},
            {
                "$push": {"documents": document_entry},
                "$set": {"updated_at": datetime.now()}
            }
        )
        
        return {
            "success": True,
            "message": "Document added successfully",
            "document": document_entry
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add document: {str(e)}")

@employees_router.put("/{employee_id}", status_code=200)
async def update_employee(
    employee_id: str,
    payload: Dict = Body(...),
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Update employee information in both collections"""
    try:
        db = get_database()
        
        # Debug: Print all fields from the payload to see what's being sent
        print(f"[DEBUG] UPDATE EMPLOYEE {employee_id} - Received payload with fields: {list(payload.keys())}")
        # Print role related fields for debugging
        print(f"[DEBUG] Role fields - role: {payload.get('role')}, roles: {payload.get('roles')}, role_ids: {payload.get('role_ids')}")
        
        # Find employee in both collections
        user = db.users.find_one({
            "$or": [
                {"user_id": employee_id},
                {"user_id": employee_id}
            ]
        })
        
        employee = db.employees.find_one({
            "$or": [
                {"emp_id": employee_id},
                {"user_id": employee_id}
            ]
        })
        
        if not user and not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        current_time = datetime.now()
        
        # Update user collection if exists
        if user:
            user_update = {}
            
            # Core user fields that should be updated
            user_fields = [
                "full_name", "email", "phone", "department", "role_ids", "roles", 
                "reports_to", "is_active", "position", "salary"
            ]
            
            # Add all fields from payload to user_fields if they exist and are not None
            for field in user_fields:
                if field in payload and payload[field] is not None:
                    user_update[field] = payload[field]
            
            # Handle alternative field names for user collection
            field_mappings = {
                "name": "full_name",  # Map name to full_name for user collection
                "reporting_user_id": "reports_to"
            }
            
            # Apply field mappings
            for alt_field, std_field in field_mappings.items():
                if alt_field in payload and payload[alt_field] is not None:
                    user_update[std_field] = payload[alt_field]
            
            # Handle role_ids and roles relationship
            if "role_ids" in payload and "roles" not in payload:
                # Try to fetch role info from database to get names
                role_ids = payload["role_ids"]
                if role_ids:
                    roles_info = list(db.roles.find({"id": {"$in": role_ids}}))
                    if roles_info:
                        user_update["roles"] = [role.get("name", "").lower() for role in roles_info]
                        print(f"[DEBUG] Extracted role names from role_ids: {user_update['roles']}")
            
            # If we have roles but no role_ids, try to find corresponding role_ids
            if "roles" in payload and "role_ids" not in payload:
                # Try to fetch role IDs from role names
                role_names = payload["roles"]
                if role_names:
                    role_names_lower = [r.lower() if isinstance(r, str) else r.get("name", "").lower() for r in role_names]
                    roles_info = list(db.roles.find({"name": {"$in": role_names_lower}}))
                    if roles_info:
                        user_update["role_ids"] = [role.get("id") for role in roles_info]
                        print(f"[DEBUG] Found role_ids from role names: {user_update['role_ids']}")
            
            # Handle password updates consistently using AuthService
            if "password" in payload and payload["password"]:
                from app.services.auth_service import AuthService
                auth_service = AuthService()
                user_update["password"] = auth_service.get_password_hash(payload["password"])
                print(f"[DEBUG] Password updated for employee {employee_id} using AuthService")
            
            # Add additional user profile fields if present in payload
            additional_user_fields = [
                "address", "city", "state", "country", "gender", "date_of_birth", 
                "date_of_joining", "employee_type", "shift", "location", "zip_code"
            ]
            
            for field in additional_user_fields:
                if field in payload and payload[field] is not None:
                    user_update[field] = payload[field]
            
            # Handle alternative date field names
            if "dob" in payload and payload["dob"] is not None:
                user_update["date_of_birth"] = payload["dob"]
            if "doj" in payload and payload["doj"] is not None:
                user_update["date_of_joining"] = payload["doj"]
            if "pincode" in payload and payload["pincode"] is not None:
                user_update["zip_code"] = payload["pincode"]
            
            # Handle emergency contact details
            if "emergency_contact_name" in payload:
                user_update["emergency_contact_name"] = payload["emergency_contact_name"]
            if "emergency_contact_phone" in payload:
                user_update["emergency_contact_phone"] = payload["emergency_contact_phone"]
            
            # Handle emergency contact as object
            if "emergency_contact" in payload and isinstance(payload["emergency_contact"], dict):
                if payload["emergency_contact"].get("name") is not None:
                    user_update["emergency_contact_name"] = payload["emergency_contact"]["name"]
                if payload["emergency_contact"].get("phone") is not None:
                    user_update["emergency_contact_phone"] = payload["emergency_contact"]["phone"]
            
            # Handle bank details
            if "bank_name" in payload:
                user_update["bank_name"] = payload["bank_name"]
            if "bank_account_number" in payload:
                user_update["bank_account_number"] = payload["bank_account_number"]
            if "bank_ifsc" in payload:
                user_update["bank_ifsc"] = payload["bank_ifsc"]
            
            # Handle bank details as object
            if "bank_details" in payload and isinstance(payload["bank_details"], dict):
                if payload["bank_details"].get("bank_name") is not None:
                    user_update["bank_name"] = payload["bank_details"]["bank_name"]
                if payload["bank_details"].get("account_number") is not None:
                    user_update["bank_account_number"] = payload["bank_details"]["account_number"]
                if payload["bank_details"].get("ifsc") is not None:
                    user_update["bank_ifsc"] = payload["bank_details"]["ifsc"]
            
            # Handle additional professional fields
            additional_professional_fields = [
                "qualification", "experience", "skills", "certifications",
                "pf_number", "esi_number", "pan_number", "aadhar_number"
            ]
            
            for field in additional_professional_fields:
                if field in payload and payload[field] is not None:
                    user_update[field] = payload[field]
            
            if user_update:
                user_update["updated_at"] = current_time
                print(f"[DEBUG] Updating user {employee_id} with data: {user_update}")
                print(f"[DEBUG] User update fields: {list(user_update.keys())}")
                db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": user_update}
                )
                print(f"[DEBUG] User collection updated successfully for {employee_id}")
            else:
                print(f"[DEBUG] No user updates needed for {employee_id}")
        
        # Update employee collection if exists
        if employee:
            employee_update = {}
            employee_fields = [
                # Basic fields
                "name", "email", "phone", "position", "salary", "location", "shift", "gender",
                "date_of_joining", "date_of_birth", "department", "is_active", "employee_type",
                
                # Address fields
                "address", "city", "state", "zip_code", "pincode", "country",
                
                # Emergency contact
                "emergency_contact_name", "emergency_contact_phone",
                
                # Bank details
                "bank_account_number", "bank_name", "bank_ifsc",
                
                # Additional details
                "qualification", "experience", "skills", "certifications",
                "pf_number", "esi_number", "pan_number", "aadhar_number"
            ]
            
            # Handle field mapping and alternative field names
            field_mappings = {
                "full_name": "name",
                "dob": "date_of_birth",
                "doj": "date_of_joining",
                "pincode": "zip_code",
            }
            
            # First process standard fields - only update if not None for critical fields
            for field in employee_fields:
                if field in payload:
                    # For critical fields, only update if not None
                    critical_fields = ["name", "email", "phone"]
                    if field in critical_fields and payload[field] is None:
                        continue
                    employee_update[field] = payload[field]
            
            # Then handle alternative field names and mappings
            for alt_field, std_field in field_mappings.items():
                if alt_field in payload and payload[alt_field] is not None:
                    employee_update[std_field] = payload[alt_field]
            
            # Special case for full_name to name mapping
            if "full_name" in payload:
                employee_update["name"] = payload["full_name"]
            
            # Handle emergency contact as object
            if "emergency_contact" in payload and isinstance(payload["emergency_contact"], dict):
                if payload["emergency_contact"].get("name") is not None:
                    employee_update["emergency_contact_name"] = payload["emergency_contact"]["name"]
                if payload["emergency_contact"].get("phone") is not None:
                    employee_update["emergency_contact_phone"] = payload["emergency_contact"]["phone"]
            
            # Handle individual emergency contact fields
            if "emergency_contact_name" in payload:
                employee_update["emergency_contact_name"] = payload["emergency_contact_name"]
            if "emergency_contact_phone" in payload:
                employee_update["emergency_contact_phone"] = payload["emergency_contact_phone"]
            
            # Handle bank details as object
            if "bank_details" in payload and isinstance(payload["bank_details"], dict):
                if payload["bank_details"].get("bank_name") is not None:
                    employee_update["bank_name"] = payload["bank_details"]["bank_name"]
                if payload["bank_details"].get("account_number") is not None:
                    employee_update["bank_account_number"] = payload["bank_details"]["account_number"]
                if payload["bank_details"].get("ifsc") is not None:
                    employee_update["bank_ifsc"] = payload["bank_details"]["ifsc"]
            
            # Handle individual bank detail fields
            if "bank_name" in payload:
                employee_update["bank_name"] = payload["bank_name"]
            if "bank_account_number" in payload:
                employee_update["bank_account_number"] = payload["bank_account_number"]
            if "bank_ifsc" in payload:
                employee_update["bank_ifsc"] = payload["bank_ifsc"]
            
            # Handle role_ids and roles for employee record
            if "role_ids" in payload:
                employee_update["role_ids"] = payload["role_ids"]
            
            if "roles" in payload:
                employee_update["roles"] = payload["roles"]
                # If roles contains a valid employee role, update the primary role field
                primary_role = None
                for role in payload["roles"]:
                    role_name = role if isinstance(role, str) else role.get("name", "")
                    if is_valid_employee_role(role_name):
                        primary_role = role_name.lower()
                        break
                
                if primary_role:
                    employee_update["role"] = primary_role
            
            if employee_update:
                employee_update["updated_at"] = current_time
                print(f"[DEBUG] Updating employee {employee_id} with data: {employee_update}")
                print(f"[DEBUG] Employee update fields: {list(employee_update.keys())}")
                db.employees.update_one(
                    {"_id": employee["_id"]},
                    {"$set": employee_update}
                )
                print(f"[DEBUG] Employee collection updated successfully for {employee_id}")
            else:
                print(f"[DEBUG] No employee updates needed for {employee_id}")
        
        # Prepare detailed response
        updated_fields = []
        if user and 'user_update' in locals() and user_update:
            updated_fields.extend([f"user.{field}" for field in user_update.keys() if field != "updated_at"])
        if employee and 'employee_update' in locals() and employee_update:
            updated_fields.extend([f"employee.{field}" for field in employee_update.keys() if field != "updated_at"])
        
        return {
            "success": True,
            "message": f"Employee updated successfully. Updated fields: {', '.join(updated_fields) if updated_fields else 'No changes detected'}",
            "updated_user": bool(user and 'user_update' in locals() and user_update),
            "updated_employee": bool(employee and 'employee_update' in locals() and employee_update),
            "updated_fields": updated_fields,
            "employee_id": employee_id,
            "timestamp": current_time.isoformat(),
            "data": {
                "user_fields_updated": list(user_update.keys()) if 'user_update' in locals() and user_update else [],
                "employee_fields_updated": list(employee_update.keys()) if 'employee_update' in locals() and employee_update else [],
                "collections_updated": {
                    "users": bool(user and 'user_update' in locals() and user_update),
                    "employees": bool(employee and 'employee_update' in locals() and employee_update)
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update employee: {str(e)}")

@employees_router.get("/my-attendance", status_code=200)
async def get_my_attendance_records(
    user_id: str = Query(..., description="Current user ID"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(31, description="Items per page")
):
    """Get attendance records for current user"""
    try:
        db = get_database()
        
        # Set default month/year
        if not month:
            month = datetime.now().month
        if not year:
            year = datetime.now().year
        
        # Create date range
        start_date = datetime(year, month, 1).strftime("%Y-%m-%d")
        end_date = datetime(year, month, calendar.monthrange(year, month)[1]).strftime("%Y-%m-%d")
        
        query = {
            "user_id": user_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        # Pagination
        skip = (page - 1) * limit
        
        records = list(db.attendance.find(query).sort("date", -1).skip(skip).limit(limit))
        total = db.attendance.count_documents(query)
        
        # Calculate summary
        present_days = sum(1 for record in records if record.get("status") == "present")
        total_hours = sum(record.get("working_hours", 0) for record in records)
        working_days = len([d for d in range(1, calendar.monthrange(year, month)[1] + 1) 
                           if datetime(year, month, d).weekday() < 5])
        
        return make_serializable({
            "success": True,
            "data": records,
            "page": page,
            "limit": limit,
            "total": total,
            "summary": {
                "month": month,
                "year": year,
                "present_days": present_days,
                "working_days": working_days,
                "attendance_percentage": round((present_days / working_days * 100), 2) if working_days > 0 else 0,
                "total_working_hours": total_hours,
                "avg_hours_per_day": round(total_hours / present_days, 2) if present_days > 0 else 0
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance records: {str(e)}")

@employees_router.get("/attendance/all-records", status_code=200)
async def get_all_attendance_records(
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    date: Optional[str] = Query(None, description="Specific date (YYYY-MM-DD)"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    department: Optional[str] = Query(None, description="Filter by department"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page")
):
    """Get all attendance records (HR only)"""
    try:
        # Check HR permission
        if not has_hr_permission(current_user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        db = get_database()
        query = {}
        
        # Apply filters
        if date:
            query["date"] = date
        else:
            # Default to today
            query["date"] = datetime.now().strftime("%Y-%m-%d")
        
        if employee_id:
            query["user_id"] = employee_id
        
        # If department filter, get users from that department first
        if department:
            dept_users = list(db.users.find({"department": department, "is_active": True}))
            user_ids = [user["user_id"] for user in dept_users]
            query["user_id"] = {"$in": user_ids}
        
        # Pagination
        skip = (page - 1) * limit
        
        records = list(db.attendance.find(query).sort([("date", -1), ("checkin_time", 1)]).skip(skip).limit(limit))
        total = db.attendance.count_documents(query)
        
        # Enhance records with employee details
        enhanced_records = []
        for record in records:
            user = db.users.find_one({"user_id": record["user_id"]})
            if user:
                record["employee_details"] = {
                    "full_name": user.get("full_name"),
                    "department": user.get("department"),
                    "position": user.get("position")
                }
            enhanced_records.append(record)
        
        return make_serializable({
            "success": True,
            "data": enhanced_records,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance records: {str(e)}")

@employees_router.put("/attendance/{record_id}/edit", status_code=200)
async def edit_attendance_record(
    record_id: str,
    payload: Dict = Body(...),
    current_user_roles: List[str] = Query(..., description="Current user roles")
):
    """Edit attendance record (HR only)"""
    try:
        # Check HR permission
        if not has_hr_permission(current_user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        db = get_database()
        
        # Find attendance record
        record = db.attendance.find_one({"_id": ObjectId(record_id)})
        if not record:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        # Update fields
        update_data = {}
        editable_fields = ["checkin_time", "checkout_time", "status", "notes", "working_hours"]
        
        for field in editable_fields:
            if field in payload:
                if field in ["checkin_time", "checkout_time"] and payload[field]:
                    # Convert to datetime if string
                    if isinstance(payload[field], str):
                        update_data[field] = datetime.fromisoformat(payload[field].replace('Z', '+00:00'))
                    else:
                        update_data[field] = payload[field]
                else:
                    update_data[field] = payload[field]
        
        # Recalculate working hours if both times are provided
        if "checkin_time" in update_data and "checkout_time" in update_data:
            if update_data["checkin_time"] and update_data["checkout_time"]:
                working_hours = (update_data["checkout_time"] - update_data["checkin_time"]).total_seconds() / 3600
                update_data["working_hours"] = round(working_hours, 2)
        
        update_data["updated_at"] = datetime.now()
        
        # Update record
        db.attendance.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Attendance record updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to edit attendance record: {str(e)}")

@employees_router.get("/admin/attendance", status_code=200)
async def get_admin_attendance_data(
    page: int = Query(1, description="Page number"),
    limit: int = Query(100, description="Items per page"),
    date: Optional[str] = Query(None, description="Specific date (YYYY-MM-DD)"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    department: Optional[str] = Query(None, description="Filter by department"),
    status: Optional[str] = Query(None, description="Filter by status (present/absent)"),
    search: Optional[str] = Query(None, description="Search by employee name or ID")
):
    """Get all attendance collection data - Admin endpoint with comprehensive filtering"""
    try:
        db = get_database()
        
        # Build query
        query = {}
        
        # Date filtering
        if date:
            query["date"] = date
        elif month and year:
            # Get all dates in the specified month
            start_date = datetime(year, month, 1).strftime("%Y-%m-%d")
            end_date = datetime(year, month, calendar.monthrange(year, month)[1]).strftime("%Y-%m-%d")
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif not date and not month and not year:
            # Default to current month if no date filters specified
            now = datetime.now()
            start_date = datetime(now.year, now.month, 1).strftime("%Y-%m-%d")
            end_date = datetime(now.year, now.month, calendar.monthrange(now.year, now.month)[1]).strftime("%Y-%m-%d")
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        # Employee ID filter
        if employee_id:
            query["user_id"] = employee_id
        
        # Status filter
        if status:
            query["status"] = status
        
        # Department filter - need to get user IDs from users collection
        user_ids_for_dept = None
        if department:
            dept_users = list(db.users.find({"department": department}, {"user_id": 1}))
            user_ids_for_dept = [user["user_id"] for user in dept_users]
            if user_ids_for_dept:
                if "user_id" in query:
                    # If employee_id filter already exists, combine with department filter
                    if query["user_id"] in user_ids_for_dept:
                        pass  # Keep existing employee_id filter
                    else:
                        query["user_id"] = {"$in": []}  # No match
                else:
                    query["user_id"] = {"$in": user_ids_for_dept}
            else:
                query["user_id"] = {"$in": []}  # No users in department
        
        # Search filter - search by employee name
        search_user_ids = None
        if search:
            search_users = list(db.users.find({
                "$or": [
                    {"full_name": {"$regex": search, "$options": "i"}},
                    {"user_id": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}}
                ]
            }, {"user_id": 1}))
            search_user_ids = [user["user_id"] for user in search_users]
            
            if search_user_ids:
                if "user_id" in query:
                    if isinstance(query["user_id"], dict) and "$in" in query["user_id"]:
                        # Intersection with existing user_id filter
                        query["user_id"]["$in"] = list(set(query["user_id"]["$in"]) & set(search_user_ids))
                    elif isinstance(query["user_id"], str):
                        # Check if existing user_id is in search results
                        if query["user_id"] not in search_user_ids:
                            query["user_id"] = {"$in": []}  # No match
                    else:
                        query["user_id"] = {"$in": search_user_ids}
                else:
                    query["user_id"] = {"$in": search_user_ids}
            else:
                query["user_id"] = {"$in": []}  # No matching users found
        
        # Get total count for pagination
        total = db.attendance.count_documents(query)
        
        # Apply pagination
        skip = (page - 1) * limit
        
        # Get attendance records with sorting
        attendance_records = list(
            db.attendance.find(query)
            .sort([("date", -1), ("checkin_time", 1)])
            .skip(skip)
            .limit(limit)
        )
        
        # Enhance records with employee details
        enhanced_records = []
        user_cache = {}  # Cache user details to avoid repeated queries
        
        for record in attendance_records:
            user_id = record.get("user_id")
            
            # Get user details (use cache if available)
            if user_id not in user_cache:
                user = db.users.find_one({"user_id": user_id})
                user_cache[user_id] = user
            else:
                user = user_cache[user_id]
            
            # Get employee details from employees collection
            employee = db.employees.find_one({"user_id": user_id})
            
            # Build enhanced record
            enhanced_record = dict(record)
            enhanced_record["employee_details"] = {
                "employee_id": user_id,
                "user_id": user_id,
                "full_name": user.get("full_name", "") if user else "",
                "email": user.get("email", "") if user else "",
                "phone": user.get("phone", "") if user else "",
                "department": user.get("department", "") if user else "",
                "position": employee.get("position", "") if employee else user.get("position", "") if user else "",
                "emp_id": employee.get("emp_id", "") if employee else "",
                "is_active": user.get("is_active", True) if user else False
            }
            
            # Add calculated fields
            if record.get("checkin_time") and record.get("checkout_time"):
                checkin = record["checkin_time"]
                checkout = record["checkout_time"]
                
                # Ensure datetime objects
                if isinstance(checkin, str):
                    checkin = datetime.fromisoformat(checkin.replace('Z', '+00:00'))
                if isinstance(checkout, str):
                    checkout = datetime.fromisoformat(checkout.replace('Z', '+00:00'))
                
                # Calculate actual working hours if not stored
                if not enhanced_record.get("working_hours"):
                    working_hours = (checkout - checkin).total_seconds() / 3600
                    enhanced_record["calculated_working_hours"] = round(working_hours, 2)
            
            enhanced_records.append(enhanced_record)
        
        # Calculate summary statistics
        summary_stats = {
            "total_records": total,
            "present_count": db.attendance.count_documents({**query, "status": "present"}),
            "absent_count": db.attendance.count_documents({**query, "status": "absent"}),
            "late_count": db.attendance.count_documents({**query, "status": "late"}),
        }
        
        # Add department-wise breakdown if no specific filters
        department_breakdown = []
        if not department and not employee_id:
            pipeline = [
                {"$match": query},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "user_id",
                        "as": "user_info"
                    }
                },
                {"$unwind": "$user_info"},
                {
                    "$group": {
                        "_id": "$user_info.department",
                        "total": {"$sum": 1},
                        "present": {"$sum": {"$cond": [{"$eq": ["$status", "present"]}, 1, 0]}},
                        "absent": {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}}
                    }
                },
                {"$sort": {"_id": 1}}
            ]
            department_breakdown = list(db.attendance.aggregate(pipeline))
        
        return make_serializable({
            "success": True,
            "message": "Attendance data retrieved successfully",
            "data": enhanced_records,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit,
                "has_next": page * limit < total,
                "has_prev": page > 1
            },
            "summary": summary_stats,
            "department_breakdown": department_breakdown,
            "filters_applied": {
                "date": date,
                "month": month,
                "year": year,
                "employee_id": employee_id,
                "department": department,
                "status": status,
                "search": search
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance data: {str(e)}")

@employees_router.post("/admin/attendance/checkout", status_code=201)
async def admin_checkout_employee(
    payload: Dict = Body(...)
):
    """Admin checkout endpoint for handling frontend requests"""
    try:
        # Extract employee_id from payload
        employee_id = payload.get("employee_id") or payload.get("user_id")
        
        if not employee_id:
            raise HTTPException(status_code=400, detail="employee_id is required in payload")
        
        # Redirect to the individual employee checkout endpoint
        db = get_database()
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        today = payload.get("date", datetime.now().strftime("%Y-%m-%d"))
        current_time = datetime.now()
        
        # Location data from payload
        geo_lat = payload.get("geo_lat")
        geo_long = payload.get("geo_long")
        location_name = payload.get("location_name", payload.get("location", "Office"))
        time_provided = payload.get("time")
        notes = payload.get("notes", "")
        
        # Parse time if provided
        if time_provided:
            try:
                if isinstance(time_provided, str):
                    current_time = datetime.fromisoformat(time_provided.replace('Z', '+00:00'))
                else:
                    current_time = time_provided
            except:
                current_time = datetime.now()
        
        # Check if has checkin record today
        existing_record = db.attendance.find_one({
            "user_id": employee_id,
            "date": today
        })
        
        if not existing_record or not existing_record.get("checkin_time"):
            raise HTTPException(status_code=400, detail="No checkin record found for today")
        
        if existing_record.get("checkout_time"):
            raise HTTPException(status_code=400, detail="Already checked out today")
        
        # Calculate working hours
        checkin_time = existing_record["checkin_time"]
        if isinstance(checkin_time, str):
            checkin_time = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))
        
        working_hours = (current_time - checkin_time).total_seconds() / 3600
        
        # Update checkout with geolocation data
        checkout_data = {
            "checkout_time": current_time,
            "working_hours": round(working_hours, 2),
            "notes": notes,
            "updated_at": current_time
        }
        
        # Add geolocation data if provided
        if geo_lat is not None:
            checkout_data["checkout_geo_lat"] = geo_lat
            # Also update the main geo_lat for consistency
            checkout_data["geo_lat"] = geo_lat
        if geo_long is not None:
            checkout_data["checkout_geo_long"] = geo_long
            # Also update the main geo_long for consistency
            checkout_data["geo_long"] = geo_long
        if location_name:
            checkout_data["checkout_location"] = location_name
            # Also update the main location fields for consistency
            checkout_data["location"] = location_name
            checkout_data["location_name"] = location_name
        
        # Update the time field to checkout time for consistency
        checkout_data["time"] = current_time
        
        db.attendance.update_one(
            {"user_id": employee_id, "date": today},
            {"$set": checkout_data}
        )
        
        return {
            "success": True,
            "message": "Checked out successfully",
            "timestamp": current_time,
            "working_hours": round(working_hours, 2),
            "data": {
                "employee_id": employee_id,
                "date": today,
                "checkout_time": current_time,
                "working_hours": round(working_hours, 2),
                "checkout_location": location_name,
                "checkout_geo_lat": geo_lat,
                "checkout_geo_long": geo_long
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check out: {str(e)}")

# =================== LEAVE MANAGEMENT ===================

@employees_router.get("/debug/current-user", status_code=200)
async def debug_current_user(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check current user data and permissions"""
    try:
        # Extract user roles and ID from current_user with multiple possible formats
        current_user_roles = (
            current_user.get("roles", []) or 
            current_user.get("role_names", []) or 
            current_user.get("user_roles", []) or
            []
        )
        current_user_id = current_user.get("user_id") or current_user.get("id")
        
        # Check permissions
        can_manage = can_manage_leave_requests(current_user_roles)
        has_hr = has_hr_permission(current_user_roles)
        
        debug_info = {
            "success": True,
            "current_user_raw": current_user,
            "current_user_id": current_user_id,
            "current_user_roles": current_user_roles,
            "can_manage_leave_requests": can_manage,
            "has_hr_permission": has_hr,
            "debug_timestamp": datetime.now().isoformat()
        }
        
        return debug_info
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "debug_timestamp": datetime.now().isoformat()
        }

@employees_router.post("/debug/create-test-leave-request", status_code=201)
async def create_test_leave_request(
    employee_id: str = Query(..., description="Employee ID to create test leave request for")
):
    """Debug endpoint to create a test leave request for testing"""
    try:
        db = get_database()
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Create a test leave request
        test_leave_request = {
            "user_id": employee_id,
            "employee_name": user.get("full_name", user.get("username", "Unknown")),
            "leave_type": "Annual Leave",
            "start_date": "2025-08-01",
            "end_date": "2025-08-03",
            "days_requested": 3,
            "reason": "Test leave request for debugging",
            "is_half_day": False,
            "status": "pending",
            "requested_at": datetime.now(),
            "approved_by": None,
            "approved_at": None,
            "rejection_reason": None
        }
        
        result = db.leave_requests.insert_one(test_leave_request)
        test_leave_request["_id"] = result.inserted_id
                
        return make_serializable({
            "success": True,
            "message": "Test leave request created successfully",
            "data": test_leave_request
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create test leave request: {str(e)}")

@employees_router.post("/leave-requests", status_code=201)
async def create_leave_request(payload: Dict = Body(...)):
    """Create a new leave request"""
    try:
        db = get_database()
        
        user_id = payload.get("user_id")
        leave_type = payload.get("leave_type")
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        reason = payload.get("reason", "")
        is_half_day = payload.get("is_half_day", False)
        
        if not all([user_id, leave_type, start_date, end_date]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify user exists
        user = db.users.find_one({"user_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Calculate number of days
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        days_requested = (end - start).days + 1
        
        if is_half_day:
            days_requested = 0.5
        
        leave_request = {
            "user_id": user_id,
            "employee_name": user.get("full_name", user.get("username")),
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "days_requested": days_requested,
            "reason": reason,
            "is_half_day": is_half_day,
            "status": "pending",
            "requested_at": datetime.now(),
            "approved_by": None,
            "approved_at": None,
            "rejection_reason": None
        }
        
        result = db.leave_requests.insert_one(leave_request)
        leave_request["_id"] = result.inserted_id
        
        return make_serializable({
            "success": True,
            "message": "Leave request created successfully",
            "data": leave_request
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create leave request: {str(e)}")

@employees_router.get("/leave-requests", status_code=200)
async def get_leave_requests(
    current_user_id: str = Query(..., description="Current user ID"),
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID (Admin/HR only)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[str] = Query(None, description="Filter from date"),
    end_date: Optional[str] = Query(None, description="Filter to date")
):
    """Get leave requests - own requests or all if Admin/HR"""
    try:
        db = get_database()
        query = {}
        
        # Check if user has permissions to view all leave requests (admin or HR)
        can_view_all = can_manage_leave_requests(current_user_roles)
        
        if can_view_all and employee_id:
            # Admin/HR can view specific employee's requests
            query["user_id"] = employee_id
        elif can_view_all:
            # Admin/HR can view all requests (no user filter)
            pass
        else:
            # Regular users can only see their own requests
            query["user_id"] = current_user_id
        
        # Apply other filters
        if status:
            query["status"] = status
        
        if start_date:
            query["start_date"] = {"$gte": start_date}
        
        if end_date:
            if "start_date" in query:
                query["start_date"]["$lte"] = end_date
            else:
                query["start_date"] = {"$lte": end_date}
        
        # Pagination
        skip = (page - 1) * limit
        
        requests = list(db.leave_requests.find(query).sort("requested_at", -1).skip(skip).limit(limit))
        total = db.leave_requests.count_documents(query)
        
        return make_serializable({
            "success": True,
            "data": requests,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "can_manage_all": can_view_all
        })
        
    except Exception as e:
        return {"success": False, "error": str(e), "message": "Failed to get leave requests"}

@employees_router.put("/leave-requests/{request_id}/approve", status_code=200)
async def approve_leave_request(
    request_id: str,
    payload: Dict = Body(default={}),
    current_user: dict = Depends(get_current_user)
):
    """Approve a leave request (Admin or HR roles only)"""
    try:
        # Extract user roles and ID from current_user with multiple possible formats
        raw_roles = (
            current_user.get("roles", []) or 
            current_user.get("role_names", []) or 
            current_user.get("user_roles", []) or
            current_user.get("role", []) or
            []
        )
        
        # Handle both string and list formats for roles
        if isinstance(raw_roles, str):
            current_user_roles = [raw_roles]
        elif isinstance(raw_roles, list):
            # Flatten any nested role objects and extract role names
            current_user_roles = []
            for role in raw_roles:
                if isinstance(role, str):
                    current_user_roles.append(role)
                elif isinstance(role, dict):
                    current_user_roles.append(role.get("name", str(role)))
                else:
                    current_user_roles.append(str(role))
        else:
            current_user_roles = []
        
        current_user_id = current_user.get("user_id") or current_user.get("id")

        # Check if user has permission to manage leave requests (admin or HR)
        if not can_manage_leave_requests(current_user_roles):
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient permissions. Only Admin or HR roles can approve leave requests. Your roles: {current_user_roles}"
            )
        
        db = get_database()
        
        # Find the leave request
        leave_request = db.leave_requests.find_one({"_id": ObjectId(request_id)})
        if not leave_request:
            raise HTTPException(status_code=404, detail="Leave request not found")
        
        if leave_request["status"] != "pending":
            raise HTTPException(status_code=400, detail="Leave request is not pending")
        
        # Update the request
        update_data = {
            "status": "approved",
            "approved_by": current_user_id,
            "approved_at": datetime.now(),
            "approval_notes": payload.get("notes", "")
        }
        
        db.leave_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_data}
        )
        

        return {
            "success": True,
            "message": "Leave request approved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve leave request: {str(e)}")

@employees_router.put("/leave-requests/{request_id}/reject", status_code=200)
async def reject_leave_request(
    request_id: str,
    payload: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Reject a leave request (Admin or HR roles only)"""
    try:
        # Extract user roles and ID from current_user with multiple possible formats
        raw_roles = (
            current_user.get("roles", []) or 
            current_user.get("role_names", []) or 
            current_user.get("user_roles", []) or
            current_user.get("role", []) or
            []
        )
        
        # Handle both string and list formats for roles
        if isinstance(raw_roles, str):
            current_user_roles = [raw_roles]
        elif isinstance(raw_roles, list):
            # Flatten any nested role objects and extract role names
            current_user_roles = []
            for role in raw_roles:
                if isinstance(role, str):
                    current_user_roles.append(role)
                elif isinstance(role, dict):
                    current_user_roles.append(role.get("name", str(role)))
                else:
                    current_user_roles.append(str(role))
        else:
            current_user_roles = []
        
        current_user_id = current_user.get("user_id") or current_user.get("id")
        
        # Check if user has permission to manage leave requests (admin or HR)
        if not can_manage_leave_requests(current_user_roles):
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient permissions. Only Admin or HR roles can reject leave requests. Your roles: {current_user_roles}"
            )
        
        db = get_database()
        
        reason = payload.get("reason", "")
        if not reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        
        # Find the leave request
        leave_request = db.leave_requests.find_one({"_id": ObjectId(request_id)})
        if not leave_request:
            raise HTTPException(status_code=404, detail="Leave request not found")
        
        if leave_request["status"] != "pending":
            raise HTTPException(status_code=400, detail="Leave request is not pending")
        
        # Update the request
        update_data = {
            "status": "rejected",
            "approved_by": current_user_id,
            "approved_at": datetime.now(),
            "rejection_reason": reason
        }
        
        db.leave_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Leave request rejected successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject leave request: {str(e)}")

# =================== REPORTS AND ANALYTICS ===================

@employees_router.get("/reports/daily-summary", status_code=200)
async def get_daily_summary(
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    date: Optional[str] = Query(None, description="Date for report (YYYY-MM-DD)")
):
    """Get daily summary report (HR only)"""
    try:
        # Check HR permission
        if not has_hr_permission(current_user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        db = get_database()
        
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        
        # Get attendance summary
        attendance_records = list(db.attendance.find({"date": date}))
        total_employees = db.users.count_documents({"is_active": True})
        present_today = len([r for r in attendance_records if r.get("status") == "present"])
        
        # Get leads assigned today
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        start_dt = date_obj
        end_dt = date_obj + timedelta(days=1)
        
        leads_assigned_today = db.leads.count_documents({
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        # Get activities today
        activities_today = db.lead_activities.count_documents({
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        # Get follow-ups due today
        followups_today = db.lead_activities.count_documents({
            "follow_up_date": date,
            "status": {"$ne": "completed"}
        })
        
        # Department wise breakdown
        dept_attendance = {}
        for record in attendance_records:
            user = db.users.find_one({"user_id": record["user_id"]})
            if user:
                dept = user.get("department", "Unknown")
                if dept not in dept_attendance:
                    dept_attendance[dept] = {"present": 0, "total": 0}
                dept_attendance[dept]["present"] += 1 if record.get("status") == "present" else 0
        
        # Get total employees per department
        for dept in dept_attendance:
            dept_attendance[dept]["total"] = db.users.count_documents({
                "department": dept,
                "is_active": True
            })
        
        return make_serializable({
            "success": True,
            "date": date,
            "summary": {
                "total_employees": total_employees,
                "present_today": present_today,
                "attendance_rate": round((present_today / total_employees * 100), 2) if total_employees > 0 else 0,
                "leads_assigned_today": leads_assigned_today,
                "activities_today": activities_today,
                "followups_due_today": followups_today
            },
            "department_breakdown": dept_attendance
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get daily summary: {str(e)}")

@employees_router.get("/reports/employee-performance/{employee_id}", status_code=200)
async def get_employee_performance_report(
    employee_id: str,
    current_user_id: str = Query(..., description="Current user ID"),
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get detailed performance report for an employee"""
    try:
        db = get_database()
        
        # Check permissions - HR can view anyone, others can only view themselves
        is_hr = has_hr_permission(current_user_roles)
        if not is_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Set default date range (last 30 days)
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Convert to datetime for queries
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        # Attendance metrics
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        
        present_days = sum(1 for record in attendance_records if record.get("status") == "present")
        total_working_hours = sum(record.get("working_hours", 0) for record in attendance_records)
        
        # Leads metrics
        total_leads = db.leads.count_documents({
            "assigned_to": employee_id,
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        converted_leads = db.leads.count_documents({
            "assigned_to": employee_id,
            "status": "qualified",
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        # Activities metrics
        activities = list(db.lead_activities.find({
            "created_by": employee_id,
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        }))
        
        # Activity breakdown by type
        activity_breakdown = {}
        for activity in activities:
            activity_type = activity.get("activity_type", "unknown")
            activity_breakdown[activity_type] = activity_breakdown.get(activity_type, 0) + 1
        
        # Performance metrics
        conversion_rate = round((converted_leads / total_leads * 100), 2) if total_leads > 0 else 0
        avg_hours_per_day = round(total_working_hours / present_days, 2) if present_days > 0 else 0
        
        performance_data = {
            "employee_id": employee_id,
            "employee_name": employee.get("full_name", employee.get("username")),
            "department": employee.get("department", ""),
            "position": employee.get("position", ""),
            "period": {"start_date": start_date, "end_date": end_date},
            "attendance_metrics": {
                "present_days": present_days,
                "total_working_hours": total_working_hours,
                "avg_hours_per_day": avg_hours_per_day
            },
            "leads_metrics": {
                "total_leads": total_leads,
                "converted_leads": converted_leads,
                "conversion_rate": conversion_rate
            },
            "activity_metrics": {
                "total_activities": len(activities),
                "activity_breakdown": activity_breakdown,
                "avg_activities_per_day": round(len(activities) / present_days, 2) if present_days > 0 else 0
            }
        }
        
        return make_serializable({
            "success": True,
            "data": performance_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee performance: {str(e)}")

@employees_router.get("/calendar/attendance/{employee_id}", status_code=200)
async def get_attendance_calendar(
    employee_id: str,
    current_user_id: str = Query(..., description="Current user ID"),
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    month: int = Query(..., description="Month (1-12)"),
    year: int = Query(..., description="Year")
):
    """Get attendance calendar for an employee"""
    try:
        db = get_database()
        
        # Check permissions
        is_hr = has_hr_permission(current_user_roles)
        if not is_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Get attendance records for the month
        start_date = datetime(year, month, 1).strftime("%Y-%m-%d")
        end_date = datetime(year, month, calendar.monthrange(year, month)[1]).strftime("%Y-%m-%d")
        
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        
        # Get leave records for the month
        leave_records = list(db.leave_requests.find({
            "user_id": employee_id,
            "status": "approved",
            "$or": [
                {"start_date": {"$gte": start_date, "$lte": end_date}},
                {"end_date": {"$gte": start_date, "$lte": end_date}},
                {"start_date": {"$lte": start_date}, "end_date": {"$gte": end_date}}
            ]
        }))
        
        # Create calendar data
        calendar_data = {}
        
        # Add attendance records
        for record in attendance_records:
            date_key = record["date"]
            calendar_data[date_key] = {
                "type": "attendance",
                "status": record.get("status", "present"),
                "checkin_time": record.get("checkin_time"),
                "checkout_time": record.get("checkout_time"),
                "working_hours": record.get("working_hours", 0),
                "notes": record.get("notes", "")
            }
        
        # Add leave days
        for leave in leave_records:
            leave_start = datetime.strptime(leave["start_date"], "%Y-%m-%d")
            leave_end = datetime.strptime(leave["end_date"], "%Y-%m-%d")
            
            current_date = leave_start
            while current_date <= leave_end:
                if current_date.month == month and current_date.year == year:
                    date_key = current_date.strftime("%Y-%m-%d")
                    calendar_data[date_key] = {
                        "type": "leave",
                        "leave_type": leave.get("leave_type"),
                        "reason": leave.get("reason", ""),
                        "is_half_day": leave.get("is_half_day", False)
                    }
                current_date += timedelta(days=1)
        
        # Add holidays (you can customize this based on your holiday system)
        # For now, marking weekends
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            date_obj = datetime(year, month, day)
            date_key = date_obj.strftime("%Y-%m-%d")
            
            if date_obj.weekday() >= 5:  # Weekend
                if date_key not in calendar_data:
                    calendar_data[date_key] = {
                        "type": "weekend",
                        "status": "weekend"
                    }
        
        return make_serializable({
            "success": True,
            "month": month,
            "year": year,
            "calendar_data": calendar_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance calendar: {str(e)}")

# =================== UTILITY ENDPOINTS ===================

@employees_router.get("/departments", status_code=200)
async def get_departments():
    """Get list of all departments"""
    try:
        db = get_database()
        
        pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {"_id": "$department"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}}
        ]
        
        departments = [dept["_id"] for dept in db.users.aggregate(pipeline)]
        
        return {
            "success": True,
            "departments": departments
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get departments: {str(e)}")

@employees_router.get("/roles", status_code=200)
async def get_roles():
    """Get list of all roles"""
    try:
        db = get_database()
        
        roles = list(db.roles.find({}, {"_id": 0, "id": 1, "name": 1, "description": 1}))
        
        return {
            "success": True,
            "roles": roles
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get roles: {str(e)}")

@employees_router.get("/stats/overview", status_code=200)
async def get_overview_stats(
    current_user_roles: List[str] = Query(..., description="Current user roles")
):
    """Get overview statistics"""
    try:
        # Check HR permission for full stats
        is_hr = has_hr_permission(current_user_roles)
        if not is_hr:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        db = get_database()
        
        # Basic employee stats
        total_employees = db.users.count_documents({"is_active": True})
        total_inactive = db.users.count_documents({"is_active": False})
        
        # Today's attendance
        today = datetime.now().strftime("%Y-%m-%d")
        present_today = db.attendance.count_documents({
            "date": today,
            "status": "present"
        })
        
        # Pending leave requests
        pending_leaves = db.leave_requests.count_documents({"status": "pending"})
        
        # This month's metrics
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_month = start_of_month.replace(month=start_of_month.month + 1) - timedelta(days=1)
        
        leads_this_month = db.leads.count_documents({
            "created_at": {"$gte": start_of_month, "$lte": end_of_month}
        })
        
        activities_this_month = db.lead_activities.count_documents({
            "created_at": {"$gte": start_of_month, "$lte": end_of_month}
        })
        
        return {
            "success": True,
            "stats": {
                "total_employees": total_employees,
                "total_inactive": total_inactive,
                "present_today": present_today,
                "attendance_rate": round((present_today / total_employees * 100), 2) if total_employees > 0 else 0,
                "pending_leave_requests": pending_leaves,
                "leads_this_month": leads_this_month,
                "activities_this_month": activities_this_month
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get overview stats: {str(e)}")

@employees_router.get("/dashboard-stats", status_code=200)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard statistics for HR module"""
    try:
        db = get_database()
        current_user_id = current_user.get("user_id")
        current_user_roles = current_user.get("roles", [])
        
        # Check if user has HR permissions
        is_hr = has_hr_permission(current_user_roles)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Base query for employees
        employee_query = {"is_active": True}
        
        if not is_hr:
            # Non-HR users see limited scope
            employee_query["$or"] = [
                {"reporting_user_id": current_user_id},  # Direct reports
                {"user_id": current_user_id},  # Self
                {"reporting_user_id": {"$in": [None, ""]}},  # Top level
            ]
        
        # Get total employees count
        total_employees = db.users.count_documents(employee_query)
        
        # Get attendance stats for today
        attendance_query = {"date": today}
        if not is_hr:
            # Filter attendance based on visible employees
            visible_users = list(db.users.find(employee_query, {"user_id": 1}))
            visible_user_ids = [user["user_id"] for user in visible_users]
            attendance_query["user_id"] = {"$in": visible_user_ids}
        
        present_today = db.attendance.count_documents({
            **attendance_query,
            "status": "present"
        })
        
        absent_today = total_employees - present_today
        
        # Get pending leave requests
        leave_query = {"status": "pending"}
        if not is_hr:
            visible_users = list(db.users.find(employee_query, {"user_id": 1}))
            visible_user_ids = [user["user_id"] for user in visible_users]
            leave_query["user_id"] = {"$in": visible_user_ids}
        
        pending_leaves = db.leave_requests.count_documents(leave_query)
        
        # Get on leave today count
        today_date = datetime.now().date()
        on_leave_today = db.leave_requests.count_documents({
            **leave_query.copy(),
            "status": "approved",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        })
        
        stats = {
            "total_employees": total_employees,
            "present_today": present_today,
            "absent_today": absent_today,
            "pending_leaves": pending_leaves,
            "on_leave_today": on_leave_today,
            "attendance_rate": round((present_today / total_employees * 100), 2) if total_employees > 0 else 0
        }
        
        return make_serializable({
            "success": True,
            "stats": stats,
            **stats  # Also include stats at root level for compatibility
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard stats: {str(e)}")

@employees_router.get("/me", status_code=200)
async def get_current_employee_info(
    current_user: dict = Depends(get_current_user)
):
    """Get current employee information for profile"""
    try:
        db = get_database()
        current_user_id = current_user.get("user_id")
        
        # Find user by user_id
        user = db.users.find_one({"user_id": current_user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get role information
        role_details = []
        if user.get("role_ids"):
            role_details = list(db.roles.find({"id": {"$in": user["role_ids"]}}))
        
        # Get today's attendance status
        today = datetime.now().strftime("%Y-%m-%d")
        attendance_today = db.attendance.find_one({
            "user_id": current_user_id,
            "date": today
        })
        
        # Format employee data
        employee_data = {
            "id": current_user_id,
            "employee_id": user.get("user_id"),
            "name": user.get("full_name", user.get("username")),
            "full_name": user.get("full_name"),
            "email": user.get("email"),
            "phone": user.get("phone", ""),
            "department": user.get("department", ""),
            "position": user.get("position", ""),
            "role": role_details[0].get("name", "employee") if role_details else "employee",
            "permissions": [role.get("permissions", []) for role in role_details],
            "address": user.get("address", ""),
            "join_date": user.get("date_of_joining", user.get("created_at")),
            "attendance_status": {
                "status": attendance_today.get("status", "absent") if attendance_today else "absent",
                "checkin_time": attendance_today.get("checkin_time") if attendance_today else None,
                "checkout_time": attendance_today.get("checkout_time") if attendance_today else None,
                "can_checkout": bool(attendance_today and attendance_today.get("checkin_time") and not attendance_today.get("checkout_time"))
            }
        }
        
        return make_serializable({
            "success": True,
            "employee": employee_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee info: {str(e)}")

# =================== ROLES AND DEPARTMENTS ===================

@employees_router.get("/roles", status_code=200)
async def get_roles():
    """Get list of all available roles"""
    try:
        db = get_database()
        roles = list(db.roles.find({}, {"_id": 0}))
        
        return {
            "success": True,
            "roles": roles
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get roles: {str(e)}")

@employees_router.get("/departments", status_code=200)
async def get_departments():
    """Get list of all departments"""
    try:
        db = get_database()
        
        pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {"_id": "$department"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}}
        ]
        
        departments = [dept["_id"] for dept in db.users.aggregate(pipeline)]
        
        return {
            "success": True,
            "departments": departments
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get departments: {str(e)}")

# =================== EMPLOYEE PROFILE MANAGEMENT ===================

@employees_router.get("/{employee_id}/profile", status_code=200)
async def get_employee_profile(
    employee_id: str,
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Get detailed employee profile with current month stats"""
    try:
        db = get_database()
        
        # Find user by user_id
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get role information
        role_details = []
        if user.get("role_ids"):
            role_details = list(db.roles.find({"id": {"$in": user["role_ids"]}}))
        
        # Calculate current month stats
        now = datetime.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_month = start_of_month.replace(month=start_of_month.month + 1) - timedelta(days=1)
        
        # Attendance stats for current month
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {
                "$gte": start_of_month.strftime("%Y-%m-%d"),
                "$lte": end_of_month.strftime("%Y-%m-%d")
            }
        }))
        
        present_days = sum(1 for record in attendance_records if record.get("status") == "present")
        total_working_hours = sum(record.get("working_hours", 0) for record in attendance_records)
        working_days_in_month = sum(1 for i in range(1, now.day + 1) 
                                   if datetime(now.year, now.month, i).weekday() < 5)
        
        # Activity stats for current month
        activities_completed = db.lead_activities.count_documents({
            "created_by": employee_id,
            "created_at": {"$gte": start_of_month, "$lte": end_of_month}
        })
        
        # Leads assigned this month
        leads_assigned = db.leads.count_documents({
            "assigned_to": employee_id,
            "created_at": {"$gte": start_of_month, "$lte": end_of_month}
        })
        
        # Format response
        employee_data = {
            "employee_id": user.get("user_id"),
            "id": str(user.get("_id")),
            "user_id": user.get("user_id"),
            "full_name": user.get("full_name"),
            "username": user.get("username"),
            "email": user.get("email"),
            "phone": user.get("phone", ""),
            "address": user.get("address", ""),
            "city": user.get("city", ""),
            "state": user.get("state", ""),
            "zip_code": user.get("zip_code", ""),
            "country": user.get("country", ""),
            "department": user.get("department", ""),
            "position": user.get("position", ""),
            "role_names": [role.get("name", "Unknown") for role in role_details],
            "is_active": user.get("is_active", True),
            "created_at": user.get("created_at"),
            "date_of_birth": user.get("date_of_birth"),
            "date_of_joining": user.get("date_of_joining"),
            "employee_type": user.get("employee_type", ""),
            "reporting_user_id": user.get("reporting_user_id"),
            "last_login": user.get("last_login"),
            "additional_info": user.get("additional_info", {}),
            "emergency_contact_name": user.get("emergency_contact_name", ""),
            "emergency_contact_phone": user.get("emergency_contact_phone", ""),
            "bank_account_number": user.get("bank_account_number", ""),
            "bank_name": user.get("bank_name", ""),
            "bank_ifsc": user.get("bank_ifsc", ""),
            "salary": user.get("salary", ""),
            "current_month_stats": {
                "present_days": present_days,
                "total_working_hours": round(total_working_hours, 1),
                "attendance_percentage": round((present_days / working_days_in_month * 100), 1) if working_days_in_month > 0 else 0,
                "avg_hours_per_day": round(total_working_hours / present_days, 1) if present_days > 0 else 0,
                "activities_completed": activities_completed,
                "leads_assigned": leads_assigned
            }
        }
        
        return make_serializable({
            "success": True,
            "data": employee_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee profile: {str(e)}")

@employees_router.put("/{employee_id}/profile", status_code=200)
async def update_employee_profile(
    employee_id: str,
    payload: Dict = Body(...),
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Update employee profile"""
    try:
        db = get_database()
        
        # Find existing employee
        existing_employee = db.users.find_one({"user_id": employee_id})
        if not existing_employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Prepare update data
        update_data = {}
        updatable_fields = [
            "full_name", "email", "phone", "address", "city", "state", "zip_code", "country",
            "department", "position", "role_ids", "roles", "role", "is_active", "reports_to", "reporting_user_id",
            "date_of_birth", "date_of_joining", "employee_type", "emergency_contact_name",
            "emergency_contact_phone", "bank_account_number", "bank_name", "bank_ifsc",
            "salary", "additional_info", "shift", "gender", "location", "username"
        ]
        
        # Field mappings for alternative field names
        field_mappings = {
            "name": "full_name",
            "dob": "date_of_birth",
            "doj": "date_of_joining",
            "pincode": "zip_code",
            "reports_to": "reporting_user_id"
        }
        
        # Process standard fields
        for field in updatable_fields:
            if field in payload:
                update_data[field] = payload[field]
        
        # Handle alternative field names
        for alt_field, std_field in field_mappings.items():
            if alt_field in payload and payload[alt_field] is not None:
                update_data[std_field] = payload[alt_field]
        
        # Handle emergency contact as object
        if "emergency_contact" in payload and isinstance(payload["emergency_contact"], dict):
            if "name" in payload["emergency_contact"]:
                update_data["emergency_contact_name"] = payload["emergency_contact"]["name"]
            if "phone" in payload["emergency_contact"]:
                update_data["emergency_contact_phone"] = payload["emergency_contact"]["phone"]
        
        # Handle bank details as object
        if "bank_details" in payload and isinstance(payload["bank_details"], dict):
            if "bank_name" in payload["bank_details"]:
                update_data["bank_name"] = payload["bank_details"]["bank_name"]
            if "account_number" in payload["bank_details"]:
                update_data["bank_account_number"] = payload["bank_details"]["account_number"]
            if "ifsc" in payload["bank_details"]:
                update_data["bank_ifsc"] = payload["bank_details"]["ifsc"]
                
        # Handle password update if provided
        if "password" in payload and payload["password"]:
            from app.services.auth_service import AuthService
            auth_service = AuthService()
            update_data["password"] = auth_service.get_password_hash(payload["password"])
        
        if update_data:
            update_data["updated_at"] = datetime.now()
            
            # Update employee
            db.users.update_one(
                {"user_id": employee_id},
                {"$set": update_data}
            )
        
        # Get updated employee data
        updated_employee = db.users.find_one({"user_id": employee_id})
        
        return make_serializable({
            "success": True,
            "message": "Employee profile updated successfully",
            "data": updated_employee
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update employee profile: {str(e)}")

# =================== EMPLOYEE DOCUMENTS MANAGEMENT ===================

@employees_router.get("/{employee_id}/documents", status_code=200)
async def get_employee_documents(
    employee_id: str,
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Get employee documents"""
    try:
        db = get_database()
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get documents from employee_documents collection
        documents = list(db.employee_documents.find({"employee_id": employee_id}))
        
        return make_serializable({
            "success": True,
            "data": documents,
            "total": len(documents)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee documents: {str(e)}")

@employees_router.post("/{employee_id}/documents", status_code=201)
async def upload_employee_document(
    employee_id: str,
    payload: Dict = Body(...),
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Upload employee document"""
    try:
        db = get_database()
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Required fields for document
        required_fields = ["document_type", "document_name", "file_path"]
        for field in required_fields:
            if not payload.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Create document record
        document_data = {
            "employee_id": employee_id,
            "document_type": payload["document_type"],  # resume, id_proof, address_proof, etc.
            "document_name": payload["document_name"],
            "file_path": payload["file_path"],
            "file_size": payload.get("file_size", 0),
            "mime_type": payload.get("mime_type", ""),
            "uploaded_by": current_user_id or "system",
            "uploaded_at": datetime.now(),
            "description": payload.get("description", ""),
            "is_verified": False,
            "verified_by": None,
            "verified_at": None
        }
        
        # Insert document
        result = db.employee_documents.insert_one(document_data)
        document_data["_id"] = result.inserted_id
        
        return make_serializable({
            "success": True,
            "message": "Document uploaded successfully",
            "data": document_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload employee document: {str(e)}")

@employees_router.delete("/{employee_id}/documents/{document_id}", status_code=200)
async def delete_employee_document(
    employee_id: str,
    document_id: str,
    current_user_id: Optional[str] = Query(None, description="Current user ID for permission check")
):
    """Delete employee document"""
    try:
        db = get_database()
        
        # Find and delete document
        result = db.employee_documents.delete_one({
            "_id": ObjectId(document_id),
            "employee_id": employee_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "success": True,
            "message": "Document deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete employee document: {str(e)}")

# =================== ENHANCED EMPLOYEE REPORTS ===================

@employees_router.get("/reports/employee-performance/{employee_id}", status_code=200)
async def get_employee_performance_report(
    employee_id: str,
    current_user_id: str = Query(..., description="Current user ID"),
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get detailed employee performance report"""
    try:
        db = get_database()
        
        # Check permissions - HR or the employee themselves
        is_hr = has_hr_permission(current_user_roles)
        if not is_hr and current_user_id != employee_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Set default date range (last 30 days)
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Convert to datetime for queries
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        # Leads Activity
        total_leads = db.leads.count_documents({
            "assigned_to": employee_id,
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        converted_leads = db.leads.count_documents({
            "assigned_to": employee_id,
            "status": "qualified",
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        # Activity breakdown
        activities = list(db.lead_activities.find({
            "created_by": employee_id,
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        }))
        
        activity_breakdown = {}
        for activity in activities:
            activity_type = activity.get("activity_type", "unknown")
            activity_breakdown[activity_type] = activity_breakdown.get(activity_type, 0) + 1
        
        # Attendance metrics
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        
        present_days = sum(1 for record in attendance_records if record.get("status") == "present")
        total_working_hours = sum(record.get("working_hours", 0) for record in attendance_records)
        
        performance_data = {
            "employee_id": employee_id,
            "employee_name": employee.get("full_name", employee.get("username")),
            "period": {"start_date": start_date, "end_date": end_date},
            "leads_metrics": {
                "total_leads": total_leads,
                "converted_leads": converted_leads,
                "conversion_rate": round((converted_leads / total_leads * 100), 2) if total_leads > 0 else 0
            },
            "activity_metrics": {
                "total_activities": len(activities),
                "activity_breakdown": activity_breakdown,
                "avg_activities_per_day": round(len(activities) / len(attendance_records), 2) if attendance_records else 0
            },
            "attendance_metrics": {
                "present_days": present_days,
                "total_working_hours": round(total_working_hours, 1),
                "avg_hours_per_day": round(total_working_hours / present_days, 1) if present_days > 0 else 0
            }
        }
        
        return make_serializable({
            "success": True,
            "data": performance_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee performance report: {str(e)}")

@employees_router.get("/calendar/attendance/{employee_id}", status_code=200)
async def get_attendance_calendar(
    employee_id: str,
    current_user_id: str = Query(..., description="Current user ID"),
    current_user_roles: List[str] = Query(..., description="Current user roles"),
    month: int = Query(..., description="Month (1-12)"),
    year: int = Query(..., description="Year")
):
    """Get attendance calendar for employee"""
    try:
        db = get_database()
        
        # Check permissions
        is_hr = has_hr_permission(current_user_roles)
        if not is_hr and current_user_id != employee_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Create date range for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
        
        date_start_str = start_date.strftime("%Y-%m-%d")
        date_end_str = end_date.strftime("%Y-%m-%d")
        
        # Get attendance records
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {"$gte": date_start_str, "$lte": date_end_str}
        }))
        
        # Get leave records
        leave_records = list(db.leave_requests.find({
            "user_id": employee_id,
            "status": "approved",
            "start_date": {"$lte": date_end_str},
            "end_date": {"$gte": date_start_str}
        }))
        
        # Build calendar data
        calendar_data = {}
        
        # Add attendance data
        for record in attendance_records:
            date_key = record["date"]
            calendar_data[date_key] = {
                "type": "attendance",
                "status": record.get("status", "unknown"),
                "checkin_time": record.get("checkin_time"),
                "checkout_time": record.get("checkout_time"),
                "working_hours": record.get("working_hours", 0)
            }
        
        # Add leave data
        for leave in leave_records:
            current_date = datetime.strptime(leave["start_date"], "%Y-%m-%d")
            end_leave_date = datetime.strptime(leave["end_date"], "%Y-%m-%d")
            
            while current_date <= end_leave_date:
                if start_date <= current_date <= end_date:
                    date_key = current_date.strftime("%Y-%m-%d")
                    calendar_data[date_key] = {
                        "type": "leave",
                        "leave_type": leave.get("leave_type", "unknown"),
                        "reason": leave.get("reason", "")
                    }
                current_date += timedelta(days=1)
        
        # Add weekend markers
        current_date = start_date
        while current_date <= end_date:
            date_key = current_date.strftime("%Y-%m-%d")
            if current_date.weekday() >= 5 and date_key not in calendar_data:  # Saturday = 5, Sunday = 6
                calendar_data[date_key] = {
                    "type": "weekend"
                }
            current_date += timedelta(days=1)
        
        return make_serializable({
            "success": True,
            "calendar_data": calendar_data,
            "month": month,
            "year": year,
            "employee_name": employee.get("full_name", employee.get("username"))
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance calendar: {str(e)}")

# Document Management Endpoints

@employees_router.post("/upload-document")
async def upload_document_general(
    file: UploadFile = File(...),
    document_type: str = Query("document", description="Type of document"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document for current user or general document"""
    try:
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        # Get current user info
        current_user_id = current_user.get("user_id", "unknown")
        
        # Create upload directory
        upload_dir = Path("uploaded_pdfs") / f"user_{current_user_id}"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{datetime.now().timestamp()}_{file.filename}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            import shutil
            shutil.copyfileobj(file.file, buffer)
        
        return {
            "success": True,
            "message": "Document uploaded successfully",
            "filename": unique_filename,
            "document_type": document_type,
            "upload_path": str(file_path)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@employees_router.post("/documents/upload/{employee_id}")
async def upload_employee_document(
    employee_id: str,
    document_type: str = Query(..., description="Type of document (e.g., 'contract', 'id_proof', 'resume')"),
    description: str = Query("", description="Document description"),
    current_user: dict = Depends(lambda: {"role_names": ["hr"], "username": "current_user"})
):
    """Upload a document for an employee"""
    try:
        from fastapi import UploadFile, File
        from pathlib import Path
        import os
        import uuid
        import time
        
        db = get_database()
        
        # Check permissions
        if not has_hr_permission(current_user.get("role_names", [])):
            # Allow employees to upload their own documents
            employee = db.users.find_one({"employee_id": employee_id})
            if not employee or employee.get("username") != current_user.get("username"):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Verify employee exists
        employee = db.users.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Create employee document directory
        upload_dir = Path("uploaded_pdfs") / f"employee_{employee_id}"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # For now, return success without actual file upload since we don't have the file parameter
        # This will be enhanced when the frontend sends actual files
        document_record = {
            "employee_id": employee_id,
            "document_type": document_type,
            "description": description,
            "upload_date": datetime.now(),
            "uploaded_by": current_user.get("username"),
            "file_path": f"employee_{employee_id}/placeholder.pdf",
            "status": "uploaded"
        }
        
        # Save document record to database
        result = db.employee_documents.insert_one(document_record)
        document_record["_id"] = str(result.inserted_id)
        
        return {
            "success": True,
            "message": "Document uploaded successfully",
            "document": make_serializable(document_record)
        }
        
    except HTTPException:
        raise
    except Exception as e:
       raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@employees_router.get("/documents/{employee_id}")
async def get_employee_documents(
    employee_id: str,
    current_user: dict = Depends(lambda: {"role_names": ["hr"], "username": "current_user"})
):
    """Get all documents for an employee"""
    try:
        db = get_database()
        
        # Check permissions
        if not has_hr_permission(current_user.get("role_names", [])):
            # Allow employees to view their own documents
            employee = db.users.find_one({"employee_id": employee_id})
            if not employee or employee.get("username") != current_user.get("username"):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Get all documents for the employee
        documents = list(db.employee_documents.find({"employee_id": employee_id}))
        
        return {
            "success": True,
            "documents": make_serializable(documents)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employee documents: {str(e)}")

@employees_router.delete("/documents/{document_id}")
async def delete_employee_document(
    document_id: str,
    current_user: dict = Depends(lambda: {"role_names": ["hr"], "username": "current_user"})
):
    """Delete an employee document"""
    try:
        db = get_database()
        
        # Check if document exists
        document = db.employee_documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Check permissions
        if not has_hr_permission(current_user.get("role_names", [])):
            # Allow employees to delete their own documents
            employee = db.users.find_one({"employee_id": document["employee_id"]})
            if not employee or employee.get("username") != current_user.get("username"):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Delete document record from database
        result = db.employee_documents.delete_one({"_id": ObjectId(document_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Try to delete physical file (ignore errors if file doesn't exist)
        try:
            if document.get("file_path") and os.path.exists(document["file_path"]):
                os.remove(document["file_path"])
        except Exception as file_error:
            pass
        return {
            "success": True,
            "message": "Document deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


# Document upload endpoint
@employees_router.post("/{employee_id}/documents/upload")
async def upload_employee_document(
    employee_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    uploaded_by: str = Form(...)
):
    """Upload a document for an employee"""
    try:
        db = get_database()
        
        # Verify employee exists - check both user_id and employee_id fields
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            # Also try to find by employee_id field as fallback
            employee = db.users.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Validate file size (10MB limit)
        if file.size > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
        
        # Validate file type
        allowed_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/jpg',
            'image/png'
        ]
        
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Create upload directory if it doesn't exist
        upload_dir = Path("employee_document")
        upload_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{employee_id}_{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Save document record to database
        document_record = {
            "employee_id": employee_id,
            "filename": file.filename,
            "original_filename": file.filename,
            "stored_filename": unique_filename,
            "file_path": str(file_path),
            "document_type": document_type,
            "file_size": len(content),
            "content_type": file.content_type,
            "uploaded_by": uploaded_by,
            "upload_date": datetime.now(),
            "created_at": datetime.now()
        }
        
        result = db.employee_documents.insert_one(document_record)
        document_record["_id"] = result.inserted_id
        
        return {
            "success": True,
            "message": "Document uploaded successfully",
            "document": make_serializable(document_record)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


# Document download endpoint
@employees_router.get("/{employee_id}/documents/{document_id}/download")
async def download_employee_document(employee_id: str, document_id: str):
    """Download an employee document"""
    try:
        db = get_database()
        
        # Find document
        document = db.employee_documents.find_one({
            "_id": ObjectId(document_id),
            "employee_id": employee_id
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = document.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Determine content type
        content_type = document.get("content_type") or mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        
        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=document.get("original_filename", document.get("filename", "document"))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


# Get employee documents endpoint
@employees_router.get("/{employee_id}/documents")
async def get_employee_documents(employee_id: str):
    """Get all documents for an employee"""
    try:
        db = get_database()
        
        # Verify employee exists
        employee = db.users.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get documents
        documents = list(db.employee_documents.find(
            {"employee_id": employee_id}
        ).sort("upload_date", -1))
        
        # Format documents for response
        formatted_documents = []
        for doc in documents:
            formatted_doc = {
                "id": str(doc["_id"]),
                "filename": doc.get("original_filename", doc.get("filename")),
                "document_type": doc.get("document_type"),
                "file_size": doc.get("file_size"),
                "upload_date": doc.get("upload_date").strftime("%Y-%m-%d %H:%M:%S") if doc.get("upload_date") else None,
                "uploaded_by": doc.get("uploaded_by"),
                "content_type": doc.get("content_type")
            }
            formatted_documents.append(formatted_doc)
        
        return {
            "success": True,
            "documents": formatted_documents,
            "count": len(formatted_documents)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

# =================== STAFF ATTENDANCE ENDPOINTS (Alternative URLs) ===================

@employees_router.post("/staff/attendance", status_code=201)
async def create_staff_attendance(payload: Dict = Body(...)):
    """Create staff attendance record (alternative endpoint for compatibility)"""
    try:
        db = get_database()
        
        # Extract data from payload
        employee_id = payload.get("employee_id")
        date = payload.get("date", datetime.now().strftime("%Y-%m-%d"))
        status = payload.get("status", "present")
        geo_lat = payload.get("geo_lat")
        geo_long = payload.get("geo_long")
        location_name = payload.get("location_name", "Office")
        time_provided = payload.get("time")
        
        if not employee_id:
            raise HTTPException(status_code=400, detail="employee_id is required")
        
        # Verify user exists
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Parse time if provided
        current_time = datetime.now()
        if time_provided:
            try:
                if isinstance(time_provided, str):
                    current_time = datetime.fromisoformat(time_provided.replace('Z', '+00:00'))
                else:
                    current_time = time_provided
            except:
                current_time = datetime.now()
        
        # Check for existing record
        existing_record = db.attendance.find_one({
            "user_id": employee_id,
            "date": date
        })
        
        # Create attendance record
        attendance_record = {
            "user_id": employee_id,
            "employee_id": employee_id,
            "employee_name": user.get("full_name", user.get("username")),
            "date": date,
            "checkin_time": current_time,
            "checkout_time": None,
            "status": status,
            "working_hours": 0,
            "location": location_name,
            "location_name": location_name,
            "geo_lat": geo_lat,
            "geo_long": geo_long,
            "time": current_time,
            "created_at": current_time,
            "updated_at": current_time
        }
        
        if existing_record:
            # Update existing record
            db.attendance.update_one(
                {"user_id": employee_id, "date": date},
                {"$set": attendance_record}
            )
            message = "Attendance record updated successfully"
        else:
            # Create new record
            result = db.attendance.insert_one(attendance_record)
            attendance_record["_id"] = result.inserted_id
            message = "Attendance record created successfully"
        
        return {
            "success": True,
            "message": message,
            "data": {
                "employee_id": employee_id,
                "date": date,
                "status": status,
                "location": location_name,
                "geo_lat": geo_lat,
                "geo_long": geo_long,
                "timestamp": current_time
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create attendance record: {str(e)}")

@employees_router.get("/staff/attendance", status_code=200)
async def get_staff_attendance(
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)"),
    employee_id: Optional[str] = Query(None, description="Employee ID filter"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page")
):
    """Get staff attendance records (alternative endpoint for compatibility)"""
    try:
        db = get_database()
        
        # Build query
        query = {}
        if date:
            query["date"] = date
        if employee_id:
            query["user_id"] = employee_id
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get records
        records = list(db.attendance.find(query).sort("date", -1).skip(skip).limit(limit))
        total = db.attendance.count_documents(query)
        
        return make_serializable({
            "success": True,
            "data": records,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance records: {str(e)}")

# =================== DEBUG ENDPOINTS ===================

@employees_router.get("/debug/current-user", status_code=200)
async def debug_current_user(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check current user information and role processing"""
    try:
        # Extract roles using the same logic as the leave request endpoints
        raw_roles = (
            current_user.get("roles", []) or 
            current_user.get("role_names", []) or 
            current_user.get("user_roles", []) or
            current_user.get("role", []) or
            []
        )
        
        # Handle both string and list formats for roles
        if isinstance(raw_roles, str):
            processed_roles = [raw_roles]
        elif isinstance(raw_roles, list):
            # Flatten any nested role objects and extract role names
            processed_roles = []
            for role in raw_roles:
                if isinstance(role, str):
                    processed_roles.append(role)
                elif isinstance(role, dict):
                    processed_roles.append(role.get("name", str(role)))
                else:
                    processed_roles.append(str(role))
        else:
            processed_roles = []
        
        # Check permissions
        can_manage_leaves = can_manage_leave_requests(processed_roles)
        
        return {
            "success": True,
            "debug_info": {
                "user_id": current_user.get("user_id") or current_user.get("id"),
                "username": current_user.get("username", "Unknown"),
                "email": current_user.get("email", "Unknown"),
                "raw_roles": raw_roles,
                "processed_roles": processed_roles,
                "raw_roles_type": type(raw_roles).__name__,
                "can_manage_leave_requests": can_manage_leaves,
                "all_user_fields": list(current_user.keys()),
                "current_user_object": current_user
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "current_user_object": current_user
        }

# Add missing endpoints required by frontend
@employees_router.get("/statistics")
async def get_employee_statistics(
    user_id: str = Query(None, description="User ID"),
    role: str = Query(None, description="User role"),
    current_user = Depends(get_current_user)
):
    """Get statistics for employees"""
    try:
        db = get_database()
        
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict() if hasattr(current_user, 'to_dict') else current_user
        
        # Validate access
        # For simplicity, we'll allow access if user_id matches current user or user has admin/hr roles
        has_access = False
        
        # Check if current user is requesting their own data
        if user_id and user_id == user_dict.get('id', ''):
            has_access = True
        
        # Check for admin/hr roles
        user_roles = user_dict.get('roles', [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        
        if any(r.lower() in ['admin', 'hr', 'hr_admin'] for r in user_roles):
            has_access = True
            
        if not has_access:
            return {"error": "Access denied", "status": 403}
        
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
        return {"error": str(e), "status": 500}

@employees_router.get("/attendance/all")
async def get_all_attendance(
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
        has_access = False
        
        # Check for admin/hr roles
        user_roles = user_dict.get('roles', [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        
        if any(r.lower() in ['admin', 'hr', 'hr_admin'] for r in user_roles):
            has_access = True
            
        if not has_access:
            return {"error": "Access denied - only admin or HR can view all attendance", "status": 403}
            
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
        return {"error": str(e), "status": 500}

@employees_router.get("/attendance/user")
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
        user_dict = current_user.to_dict() if hasattr(current_user, 'to_dict') else current_user
        
        # Validate access - same logic as statistics endpoint
        has_access = False
        
        # Check if current user is requesting their own data
        if user_id == user_dict.get('id', ''):
            has_access = True
        
        # Check for admin/hr roles
        user_roles = user_dict.get('roles', [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        
        if any(r.lower() in ['admin', 'hr', 'hr_admin'] for r in user_roles):
            has_access = True
            
        if not has_access:
            return {"error": "Access denied", "status": 403}
            
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
        return {"error": str(e), "status": 500}

# Permission checking utility endpoint
@employees_router.get("/permissions")
async def check_user_permissions(
    current_user = Depends(get_current_user)
):
    """Check user permissions for HR functionality"""
    try:
        # Convert UserInfo to dict for backward compatibility
        user_dict = current_user.to_dict() if hasattr(current_user, 'to_dict') else current_user
        
        # Extract roles
        user_roles = user_dict.get('roles', [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        
        # Check for admin/hr roles
        is_admin = any(r.lower() == 'admin' for r in user_roles)
        is_hr = any(r.lower() in ['hr', 'hr_admin', 'human_resources'] for r in user_roles)
        is_manager = any(r.lower() in ['manager', 'team_leader'] for r in user_roles)
        
        # Create permissions object
        permissions = {
            "can_view_all_employees": is_admin or is_hr,
            "can_view_all_attendance": is_admin or is_hr,
            "can_manage_leave_requests": is_admin or is_hr,
            "can_manage_attendance": is_admin or is_hr,
            "can_approve_leave": is_admin or is_hr or is_manager,
            "can_create_employee": is_admin or is_hr,
            "can_edit_employee": is_admin or is_hr,
            "is_admin": is_admin,
            "is_hr": is_hr,
            "is_manager": is_manager,
            "roles": user_roles
        }
        
        return {
            "success": True,
            "permissions": permissions,
            "user_id": user_dict.get("id") or user_dict.get("user_id"),
            "username": user_dict.get("username", "")
        }
        
    except Exception as e:
        return {"error": str(e), "status": 500}

# Export the router
def get_router():
    return employees_router
