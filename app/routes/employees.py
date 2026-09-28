"""
Comprehensive Employees Management API - Integrated with Users Database
Includes CRUD operations, attendance, leave requests, performance reports, and activity tracking
"""
from fastapi import APIRouter, HTTPException, Query, Body, Depends, status, File, UploadFile, Form
from fastapi.responses import FileResponse
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime, timedelta, date
import logging
import calendar
import json
import os
import shutil
from app.database import get_database
from app.dependencies import get_current_user
from app.services.auth_service import AuthService

# Helper function for password hashing with AuthService
def get_hashed_password(password: str) -> str:
    """Hash the password using the same method as auth service"""
    if not password:
        return ""
    try:
        # Create AuthService instance for password hashing
        auth_service = AuthService()
        # Hash the password using the same method
        hashed_password = auth_service.get_password_hash(password)
        # Log for debugging
        print(f"[DEBUG] Password hashing in employees.py - Using AuthService: {hashed_password[:20]}...")
        return hashed_password
    except Exception as e:
        print(f"[ERROR] Error hashing password: {str(e)}")
        return ""

# Configure logger
logger = logging.getLogger(__name__)

# Initialize router
employees_router = APIRouter(prefix="/api/employees", tags=["employees"])

# Helper function to check HR and Admin permissions
def has_admin_or_hr_permission(user_roles: List[str]) -> bool:
    """Check if user has Admin or HR permissions"""
    authorized_roles = ["hr", "admin", "hr_manager", "human_resources", "administrator"]
    if isinstance(user_roles, str):
        user_roles = [user_roles]
    
    # Handle case where user_roles might be a string instead of list
    if isinstance(user_roles, list):
        return any(str(role).lower() in authorized_roles for role in user_roles)
    else:
        return str(user_roles).lower() in authorized_roles

def extract_user_roles(current_user: dict) -> List[str]:
    """Extract user roles from current_user dict, handling both string and list formats"""
    roles = current_user.get("roles", [])
    
    # Handle case where roles might be a string
    if isinstance(roles, str):
        return [roles]
    elif isinstance(roles, list):
        return roles
    else:
        # Fallback to empty list if roles format is unexpected
        return []

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

# =================== EMPLOYEE CRUD OPERATIONS ===================

@employees_router.get("/", status_code=200)
async def get_all_employees(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, or user_id"),
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by role"),
    active_only: Optional[bool] = Query(True, description="Show only active employees")
):
    """Get all employees (users) with pagination and filtering"""
    try:
        db = get_database()
        query = {}
        
        # Apply filters
        if active_only is not None:
            query["is_active"] = active_only
        
        if department:
            query["department"] = {"$regex": department, "$options": "i"}
        
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"full_name": search_regex},
                {"email": search_regex},
                {"user_id": search_regex},
                {"username": search_regex}
            ]
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get users with role information
        pipeline = [
            {"$match": query},
            {
                "$lookup": {
                    "from": "roles",
                    "localField": "role_ids",
                    "foreignField": "id",
                    "as": "role_details"
                }
            },
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        employees = list(db.users.aggregate(pipeline))
        total = db.users.count_documents(query)
        
        # Format employees data
        formatted_employees = []
        for emp in employees:
            # Get role names
            role_names = [role.get("name", "Unknown") for role in emp.get("role_details", [])]
            
            formatted_emp = {
                "employee_id": emp.get("user_id"),
                "id": str(emp.get("_id")),
                "user_id": emp.get("user_id"),
                "full_name": emp.get("full_name"),
                "username": emp.get("username"),
                "email": emp.get("email"),
                "phone": emp.get("phone", ""),
                "department": emp.get("department", ""),
                "position": emp.get("position", ""),
                "role_name": ", ".join(role_names) if role_names else "No Role",
                "roles": role_names,
                "is_active": emp.get("is_active", True),
                "created_at": emp.get("created_at"),
                "reporting_user_id": emp.get("reporting_user_id"),
                "last_login": emp.get("last_login")
            }
            formatted_employees.append(formatted_emp)
        
        return make_serializable({
            "success": True,
            "data": formatted_employees,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
    except Exception as e:
        logger.error(f"Error getting employees: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get employees: {str(e)}")

@employees_router.get("/{employee_id}", status_code=200)
async def get_employee_by_id(employee_id: str):
    """Get a specific employee by ID with comprehensive information"""
    try:
        db = get_database()
        
        # Find user by user_id
        user = db.users.find_one({"user_id": employee_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get role information with permissions
        role_details = []
        if user.get("role_ids"):
            role_details = list(db.roles.find({"id": {"$in": user["role_ids"]}}))
        
        # Get assigned leads count
        assigned_leads_count = db.leads.count_documents({"assigned_to": employee_id})
        
        # Get documents count
        employee_docs_count = db.employee_documents.count_documents({"employee_id": employee_id})
        
        # Format response with comprehensive information
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
            "role_ids": user.get("role_ids", []),
            "roles": user.get("roles", []),
            "role_details": role_details,
            "permissions": [p for role in role_details for p in role.get("permissions", [])],
            "statistics": {
                "assigned_leads_count": assigned_leads_count,
                "documents_count": employee_docs_count
            },
            "is_active": user.get("is_active", True),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
            "reporting_user_id": user.get("reporting_user_id"),
            "reports_to": user.get("reports_to", user.get("reporting_user_id")),
            "last_login": user.get("last_login"),
            "failed_login_attempts": user.get("failed_login_attempts", 0),
            "address": user.get("address", ""),
            "city": user.get("city", ""),
            "state": user.get("state", ""),
            "country": user.get("country", ""),
            "zip_code": user.get("zip_code", user.get("pincode", "")),
            "pincode": user.get("pincode", user.get("zip_code", "")),
            "date_of_birth": user.get("date_of_birth", user.get("dob", "")),
            "dob": user.get("dob", user.get("date_of_birth", "")),
            "date_of_joining": user.get("date_of_joining", user.get("doj", "")),
            "doj": user.get("doj", user.get("date_of_joining", "")),
            "employee_type": user.get("employee_type", ""),
            "shift": user.get("shift", ""),
            "gender": user.get("gender", ""),
            "location": user.get("location", ""),
            "emergency_contact_name": user.get("emergency_contact_name", ""),
            "emergency_contact_phone": user.get("emergency_contact_phone", ""),
            "bank_name": user.get("bank_name", ""),
            "bank_account_number": user.get("bank_account_number", ""),
            "bank_ifsc": user.get("bank_ifsc", ""),
            "salary": user.get("salary", ""),
            "additional_info": user.get("additional_info", {})
        }
        
        # Add structured objects for frontend convenience
        employee_data["emergency_contact"] = {
            "name": user.get("emergency_contact_name", ""),
            "phone": user.get("emergency_contact_phone", "")
        }
        
        employee_data["bank_details"] = {
            "bank_name": user.get("bank_name", ""),
            "account_number": user.get("bank_account_number", ""),
            "ifsc": user.get("bank_ifsc", "")
        }
        
        return make_serializable({
            "success": True,
            "data": employee_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get employee: {str(e)}")

@employees_router.post("/", status_code=201)
async def create_employee(payload: Dict = Body(...)):
    """Create a new employee"""
    try:
        db = get_database()
        
        # Required fields
        required_fields = ["user_id", "email", "full_name"]
        for field in required_fields:
            if not payload.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Check if user_id or email already exists
        existing_user = db.users.find_one({
            "$or": [
                {"user_id": payload["user_id"]},
                {"email": payload["email"]}
            ]
        })
        
        if existing_user:
            raise HTTPException(status_code=400, detail="User ID or email already exists")
        
        # Create employee data
        
        # Handle role_ids and roles
        role_ids = payload.get("role_ids", [])
        roles = payload.get("roles", [])
        
        # If we have role_ids but no roles, try to extract role names
        if role_ids and not roles:
            # Try to fetch role info from database to get names
            roles_info = list(db.roles.find({"id": {"$in": role_ids}}))
            if roles_info:
                roles = [role.get("name", "").lower() for role in roles_info]
                print(f"[DEBUG] Extracted role names from role_ids: {roles}")
        
        # If we have roles but no role_ids, try to find corresponding role_ids
        if roles and not role_ids:
            # Try to fetch role IDs from role names
            role_names_lower = [r.lower() if isinstance(r, str) else r.get("name", "").lower() for r in roles]
            roles_info = list(db.roles.find({"name": {"$in": role_names_lower}}))
            if roles_info:
                role_ids = [role.get("id") for role in roles_info]
                print(f"[DEBUG] Found role_ids from role names: {role_ids}")
                
        # Ensure user_id is available - generate one if not provided
        user_id = payload.get("user_id")
        if not user_id:
            # Generate a user_id similar to employees_new.py
            import random
            while True:
                user_id = f"USR-{random.randint(100, 999)}"
                if not db.users.find_one({"user_id": user_id}):
                    break
            print(f"[DEBUG] Generated user_id: {user_id}")
        
        # Create employee data
        employee_data = {
            "user_id": user_id,
            "username": payload.get("username", user_id),
            "email": payload["email"],
            "full_name": payload["full_name"],
            "phone": payload.get("phone", ""),
            "department": payload.get("department", ""),
            "position": payload.get("position", ""),
            
            # Hash password properly using AuthService if provided
            "password": get_hashed_password(payload.get("password", "")),
            "role_ids": role_ids,
            "roles": roles,
            "is_active": payload.get("is_active", True),
            "reporting_user_id": payload.get("reporting_user_id", ""),
            "reports_to": payload.get("reports_to", payload.get("reporting_user_id", "")),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "last_login": None,
            "failed_login_attempts": payload.get("failed_login_attempts", 0),
            "address": payload.get("address", ""),
            "city": payload.get("city", ""),
            "state": payload.get("state", ""),
            "country": payload.get("country", ""),
            "zip_code": payload.get("zip_code", payload.get("pincode", "")),
            "pincode": payload.get("pincode", payload.get("zip_code", "")),
            "date_of_birth": payload.get("date_of_birth", payload.get("dob", "")),
            "dob": payload.get("dob", payload.get("date_of_birth", "")),
            "date_of_joining": payload.get("date_of_joining", payload.get("doj", "")),
            "doj": payload.get("doj", payload.get("date_of_joining", "")),
            "employee_type": payload.get("employee_type", ""),
            "shift": payload.get("shift", ""),
            "gender": payload.get("gender", ""),
            "location": payload.get("location", ""),
            "emergency_contact_name": payload.get("emergency_contact_name", ""),
            "emergency_contact_phone": payload.get("emergency_contact_phone", ""),
            "bank_name": payload.get("bank_name", ""),
            "bank_account_number": payload.get("bank_account_number", ""),
            "bank_ifsc": payload.get("bank_ifsc", ""),
            "salary": payload.get("salary", ""),
            "additional_info": payload.get("additional_info", {})
        }
        
        # Insert employee
        result = db.users.insert_one(employee_data)
        employee_data["_id"] = result.inserted_id
        
        return make_serializable({
            "success": True,
            "message": "Employee created successfully",
            "data": employee_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating employee: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create employee: {str(e)}")

@employees_router.put("/{employee_id}", status_code=200)
async def update_employee(employee_id: str, payload: Dict = Body(...)):
    """Update an existing employee"""
    try:
        db = get_database()
        
        # Log the incoming payload for debugging
        print(f"[DEBUG] Updating employee {employee_id} with payload: {json.dumps(payload, default=str)}")
        
        # Log specific fields from payload that we're interested in
        important_fields = ["user_id", "full_name", "name", "email", "role_ids", "roles", "bank_details", "emergency_contact", 
                           "bank_name", "bank_account_number", "bank_ifsc", "reporting_user_id", "reports_to"]
        debug_fields = {k: payload.get(k) for k in important_fields if k in payload}
        print(f"[DEBUG] Important fields in payload: {json.dumps(debug_fields, default=str)}")
        
        # Log all keys in payload for debugging
        print(f"[DEBUG] All payload keys: {list(payload.keys())}")
        
        # Find existing employee
        existing_employee = db.users.find_one({"user_id": employee_id})
        if not existing_employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Prepare update data
        update_data = {}
        updatable_fields = [
            "full_name", "name", "email", "phone", "department", "position", 
            "role_ids", "roles", "role", "is_active", "reporting_user_id", "reports_to", "additional_info",
            "address", "city", "state", "zip_code", "pincode", "country",
            "date_of_birth", "dob", "date_of_joining", "doj", "employee_type", 
            "emergency_contact_name", "emergency_contact_phone",
            "bank_account_number", "bank_name", "bank_ifsc",
            "salary", "shift", "gender", "location", "username",
            "is_half_day", "reason", "failed_login_attempts", "last_login",
            "employee_id", "id", "user_id", "role_name", "role_names"
        ]
        
        # Field mappings for alternative field names
        field_mappings = {
            "name": "full_name",
            "dob": "date_of_birth",
            "date_of_birth": "dob",
            "doj": "date_of_joining",
            "date_of_joining": "doj",
            "pincode": "zip_code",
            "zip_code": "pincode",
            "reports_to": "reporting_user_id",
            "reporting_user_id": "reports_to"
        }
        
        # Handle role_ids and roles relationship
        if "role_ids" in payload and not "roles" in payload:
            # Try to fetch role info from database to get names
            role_ids = payload["role_ids"]
            if not isinstance(role_ids, list):
                role_ids = [role_ids]
            roles_info = list(db.roles.find({"id": {"$in": role_ids}}))
            if roles_info:
                payload["roles"] = [role.get("name", "").lower() for role in roles_info]
                print(f"[DEBUG] Extracted role names from role_ids: {payload['roles']}")
        
        # If we have roles but no role_ids, try to find corresponding role_ids
        if "roles" in payload and not "role_ids" in payload:
            # Try to fetch role IDs from role names
            role_names = payload["roles"]
            if not isinstance(role_names, list):
                role_names = [role_names]
            role_names_lower = [r.lower() if isinstance(r, str) else r.get("name", "").lower() for r in role_names]
            roles_info = list(db.roles.find({"name": {"$in": role_names_lower}}))
            if roles_info:
                payload["role_ids"] = [role.get("id") for role in roles_info]
                print(f"[DEBUG] Found role_ids from role names: {payload['role_ids']}")
        
        # Handle single role field
        if "role" in payload:
            role_name = payload["role"]
            update_data["role"] = role_name
            
            # If role_ids and roles are not already set, try to find role_id for this role
            if not "role_ids" in update_data and not "roles" in update_data:
                role_info = db.roles.find_one({"name": {"$regex": f"^{role_name}$", "$options": "i"}})
                if role_info:
                    update_data["role_ids"] = [role_info.get("id")]
                    update_data["roles"] = [role_name]
                    print(f"[DEBUG] Found role_id {role_info.get('id')} for role name {role_name}")
                else:
                    print(f"[DEBUG] Could not find role_id for role name {role_name}")
            
            # Log for debugging
            print(f"[DEBUG] Processing role field: {role_name}")
                
        # Handle role_details if provided (typically from a MongoDB document)
        if "role_details" in payload and isinstance(payload["role_details"], list) and payload["role_details"]:
            # Extract role IDs and role names from role_details
            role_ids = []
            role_names = []
            for role_detail in payload["role_details"]:
                if isinstance(role_detail, dict):
                    if "id" in role_detail:
                        role_ids.append(role_detail["id"])
                    if "name" in role_detail:
                        role_names.append(role_detail["name"])
            
            if role_ids and not "role_ids" in payload:
                update_data["role_ids"] = role_ids
            if role_names and not "roles" in payload:
                update_data["roles"] = role_names
        
        # Handle password update using consistent hashing if provided
        if "password" in payload and payload["password"]:
            from app.services.auth_service import AuthService
            auth_service = AuthService()
            update_data["password"] = auth_service.get_password_hash(payload["password"])
            print(f"[DEBUG] Password updated for employee {employee_id} using AuthService")
        
        # Process standard fields
        for field in updatable_fields:
            if field in payload:
                # Special handling for certain fields
                if field == "department" and payload[field] == "Marketing":
                    # Log department change
                    print(f"[DEBUG] Processing department change: {payload[field]}")
                
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
            if "account_no" in payload["bank_details"]:
                update_data["bank_account_number"] = payload["bank_details"]["account_no"]
            if "ifsc" in payload["bank_details"]:
                update_data["bank_ifsc"] = payload["bank_details"]["ifsc"]
            if "ifsc_code" in payload["bank_details"]:
                update_data["bank_ifsc"] = payload["bank_details"]["ifsc_code"]
                
            # Log the bank details for debugging
            print(f"[DEBUG] Processing bank details: {json.dumps(payload['bank_details'], default=str)}")
        
        # Handle nested salary field if it comes as an object
        if "salary_details" in payload and isinstance(payload["salary_details"], dict):
            if "amount" in payload["salary_details"]:
                update_data["salary"] = payload["salary_details"]["amount"]
        
        # Handle location if it comes as an object with coordinates
        if "location_details" in payload and isinstance(payload["location_details"], dict):
            if "address" in payload["location_details"]:
                update_data["location"] = payload["location_details"]
        
        # Add direct support for reports_to field (equivalent to reporting_user_id)
        if "reports_to" in payload and not "reporting_user_id" in update_data:
            update_data["reporting_user_id"] = payload["reports_to"]
        elif "reporting_user_id" in payload and not "reports_to" in update_data:
            update_data["reports_to"] = payload["reporting_user_id"]
            
        # Handle any MongoDB special fields if they are present in the payload
        if "_id" in payload and isinstance(payload["_id"], dict) and "$oid" in payload["_id"]:
            # Don't include _id in update data as it's immutable
            print(f"[DEBUG] Detected MongoDB document with _id: {payload['_id']['$oid']}")
            
        # Handle date fields in MongoDB format
        date_fields = ["created_at", "updated_at", "last_login"]
        for date_field in date_fields:
            if date_field in payload and isinstance(payload[date_field], dict) and "$date" in payload[date_field]:
                try:
                    # Parse ISO date string from MongoDB format
                    update_data[date_field] = datetime.fromisoformat(
                        payload[date_field]["$date"].replace("Z", "+00:00")
                    )
                except Exception as e:
                    print(f"[WARNING] Could not parse date field {date_field}: {str(e)}")
        
        if update_data:
            update_data["updated_at"] = datetime.now()
            
            # Log the final update data for debugging
            print(f"[DEBUG] Final update data: {json.dumps(update_data, default=str)}")
            
            # Update employee
            result = db.users.update_one(
                {"user_id": employee_id},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="Employee not found")
        
            # Get updated employee data
            updated_employee = db.users.find_one({"user_id": employee_id})
            
            # Log what fields were updated
            print(f"[INFO] Employee {employee_id} updated successfully. Fields updated: {list(update_data.keys())}")
            
            # Compare original payload with what was updated
            missing_fields = [field for field in payload.keys() if field not in update_data and field not in ["_id", "id"]]
            if missing_fields:
                print(f"[WARNING] Some fields in payload were not processed: {missing_fields}")
        
            # Return response format that exactly matches what frontend expects
            response = {
                "success": True,
                "message": "Employee updated successfully",
                "updated_user": True,
                "updated_employee": True
            }
            
            # Only add these fields if needed for debugging
            if "debug" in payload and payload["debug"]:
                response["fields_updated"] = list(update_data.keys())
                response["data"] = updated_employee
                
            return make_serializable(response)
        else:
            return make_serializable({
                "success": True,
                "message": "No changes were made to the employee profile",
                "updated_user": False,
                "updated_employee": False,
                "data": existing_employee
            })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update employee: {str(e)}")

@employees_router.delete("/{employee_id}", status_code=200)
async def delete_employee(employee_id: str):
    """Delete an employee (soft delete by setting is_active to False)"""
    try:
        db = get_database()
        
        # Find employee
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Soft delete by setting is_active to False
        db.users.update_one(
            {"user_id": employee_id},
            {"$set": {"is_active": False, "updated_at": datetime.now()}}
        )
        
        return {
            "success": True,
            "message": "Employee deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete employee: {str(e)}")

@employees_router.get("/stats", status_code=200)
async def get_employee_stats():
    """Get employee statistics"""
    try:
        db = get_database()
        
        # Basic employee stats
        total_employees = db.users.count_documents({"is_active": True})
        total_inactive = db.users.count_documents({"is_active": False})
        
        # Department breakdown
        dept_pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {"_id": "$department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        departments = list(db.users.aggregate(dept_pipeline))
        
        # Role breakdown
        role_pipeline = [
            {"$match": {"is_active": True}},
            {"$lookup": {
                "from": "roles",
                "localField": "role_ids",
                "foreignField": "id",
                "as": "role_details"
            }},
            {"$unwind": {"path": "$role_details", "preserveNullAndEmptyArrays": True}},
            {"$group": {"_id": "$role_details.name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        roles = list(db.users.aggregate(role_pipeline))
        
        # Today's attendance
        today = datetime.now().strftime("%Y-%m-%d")
        present_today = db.attendance.count_documents({
            "date": today,
            "status": "present"
        })
        
        return make_serializable({
            "success": True,
            "total_employees": total_employees,
            "total_inactive": total_inactive,
            "departments": [{"name": d.get("_id", "Unknown"), "count": d["count"]} for d in departments],
            "roles": [{"name": r.get("_id", "Unknown"), "count": r["count"]} for r in roles],
            "attendance": {
                "today": present_today
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting employee stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get employee stats: {str(e)}")

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
        logger.error(f"Error getting departments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get departments: {str(e)}")

# =================== EMPLOYEE DOCUMENTS MANAGEMENT ===================

# Direct upload endpoint with no model validation
@employees_router.post("/documents/upload-file", status_code=201)
async def upload_employee_document_direct(
    file: UploadFile = File(...),
    employee_id: str = Form(...),
    document_type: str = Form(default="General"),
    document_name: str = Form(default=None),
    description: str = Form(default=""),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document for an employee - simplified endpoint"""
    try:
        logger.info(f"Document upload direct request for employee {employee_id}")
        logger.info(f"File: {file.filename}, Type: {document_type}, Name: {document_name}")
        
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Authorization check: users can only upload for themselves unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only upload documents for yourself")
            
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Read file content
        file_content = await file.read()
        
        # Generate unique filename
        timestamp = datetime.now().timestamp()
        filename = f"{timestamp}_{file.filename}"
        
        # Define upload directory - create if it doesn't exist
        upload_dir = f"uploads/employee_{employee_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file to disk
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(file_content)
         
        # Create document record in database
        document = {
            "employee_id": employee_id,
            "document_type": document_type or "General",
            "document_name": document_name or file.filename,
            "filename": filename,
            "file_path": filepath,
            "uploaded_by": current_user_id,
            "upload_date": datetime.now(),
            "file_size": len(file_content),
            "mime_type": file.content_type,
            "description": description or ""
        }
        
        result = db.employee_documents.insert_one(document)
        document["_id"] = result.inserted_id
        
        return make_serializable({
            "success": True,
            "message": "Document uploaded successfully",
            "data": document
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")


@employees_router.post("/{employee_id}/documents/upload", status_code=201)
async def upload_employee_document(
    employee_id: str,
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(default=None),
    document_name: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    employee_id_form: Optional[str] = Form(default=None),  # Additional field from frontend
    current_user: dict = Depends(get_current_user)
):
    """Upload a document for an employee"""
    try:
        logger.info(f"Document upload request for employee {employee_id}")
        logger.info(f"File: {file.filename}, Type: {document_type}, Name: {document_name}")
        
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Authorization check: users can only upload for themselves unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only upload documents for yourself")
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Read file content
        file_content = await file.read()
        
        # Generate unique filename
        timestamp = datetime.now().timestamp()
        filename = f"{timestamp}_{file.filename}"
        
        # Define upload directory - create if it doesn't exist
        upload_dir = f"uploads/employee_{employee_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file to disk
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(file_content)
        
        # Create document record in database
        document = {
            "employee_id": employee_id,
            "document_type": document_type or "General",
            "document_name": document_name or file.filename,
            "name": document_name or file.filename,  # Also set name for EmployeeDocumentUpload model
            "url": filepath,  # Set url for EmployeeDocumentUpload model
            "description": description or "",
            "filename": filename,
            "file_path": filepath,
            "uploaded_by": current_user_id,  # Use the authenticated user's ID
            "upload_date": datetime.now(),
            "file_size": len(file_content),
            "mime_type": file.content_type
        }
        
        result = db.employee_documents.insert_one(document)
        document["_id"] = result.inserted_id
        
        return make_serializable({
            "success": True,
            "message": "Document uploaded successfully",
            "data": document
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@employees_router.get("/{employee_id}/documents", status_code=200)
async def get_employee_documents(
    employee_id: str,
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    current_user: dict = Depends(get_current_user)
):
    """Get all documents for an employee"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Authorization check: users can only view their own documents unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only view your own documents")
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Build query
        query = {"employee_id": employee_id}
        if document_type:
            query["document_type"] = document_type
        
        # Get documents
        documents = list(db.employee_documents.find(query).sort("upload_date", -1))
        
        return make_serializable({
            "success": True,
            "data": documents
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting documents for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")

@employees_router.delete("/{employee_id}/documents/{document_id}", status_code=200)
async def delete_employee_document(
    employee_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an employee document"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Authorization check: users can only delete their own documents unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only delete your own documents")
        
        # Get document details
        document = db.employee_documents.find_one({
            "_id": ObjectId(document_id) if len(document_id) == 24 else document_id,
            "employee_id": employee_id
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete file from disk if it exists
        file_path = document.get("file_path") or document.get("filepath")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Error deleting document file: {str(e)}")
                # Continue even if file deletion fails
        
        # Remove document from database
        result = db.employee_documents.delete_one({"_id": document["_id"]})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete document from database")
        
        return make_serializable({
            "success": True,
            "message": "Document deleted successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document {document_id} for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@employees_router.get("/{employee_id}/documents/{document_id}/download", status_code=200)
async def download_employee_document(
    employee_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download an employee document"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Authorization check: users can only download their own documents unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only download your own documents")
        
        # Get document details
        document = db.employee_documents.find_one({
            "_id": ObjectId(document_id) if len(document_id) == 24 else document_id,
            "employee_id": employee_id
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = document.get("file_path")
        if not file_path or not os.path.exists(file_path):
            # Try alternate field name
            file_path = document.get("filepath")
            if not file_path or not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="Document file not found")
        
        # Return the file
        return FileResponse(
            path=file_path, 
            filename=document.get("document_name", document.get("filename", "document")),
            media_type=document.get("mime_type", "application/octet-stream")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading document {document_id} for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download document: {str(e)}")

@employees_router.get("/{employee_id}/leads", status_code=200)
async def get_employee_leads(
    employee_id: str,
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by lead status"),
    search: Optional[str] = Query(None, description="Search by lead name or company"),
    current_user: dict = Depends(get_current_user)
):
    """Get all leads assigned to an employee"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Authorization check: users can only view their own leads unless they're admin/manager
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        is_manager = "manager" in user_roles
        
        if not (is_admin_or_hr or is_manager) and employee_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only view your own leads")
        
        # Verify employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Build query
        query = {"assigned_to": employee_id}
        
        if status:
            query["status"] = status
            
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"name": search_regex},
                {"company_name": search_regex},
                {"email": search_regex},
                {"phone": search_regex},
            ]
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get leads
        leads = list(db.leads.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.leads.count_documents(query)
        
        # Add employee name to leads
        for lead in leads:
            lead["assigned_to_name"] = employee.get("full_name", "Unknown")
        
        return make_serializable({
            "success": True,
            "data": leads,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting leads for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get leads: {str(e)}")

# =================== ATTENDANCE MANAGEMENT ===================

@employees_router.post("/attendance/checkin", status_code=201)
async def checkin_attendance(
    payload: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Check in attendance for an employee"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        user_id = payload.get("user_id")
        status = payload.get("status", "present")
        notes = payload.get("notes", "")
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        # Authorization check: users can only checkin for themselves unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and user_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only check in for yourself")
        
        # Verify user exists
        user = db.users.find_one({"user_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        today = datetime.now().strftime("%Y-%m-%d")
        current_time = datetime.now()
        
        # Check if already checked in today
        existing_record = db.attendance.find_one({
            "user_id": user_id,
            "date": today
        })
        
        if existing_record:
            # Update existing record (checkout)
            update_data = {
                "checkout_time": current_time,
                "status": status,
                "notes": notes,
                "updated_at": current_time,
                "marked_by": current_user.get("full_name", current_user.get("name", "Unknown"))
            }
            
            # Calculate working hours if both checkin and checkout exist
            if existing_record.get("checkin_time"):
                checkin_time = existing_record["checkin_time"]
                if isinstance(checkin_time, str):
                    checkin_time = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))
                
                working_hours = (current_time - checkin_time).total_seconds() / 3600
                update_data["working_hours"] = round(working_hours, 2)
            
            db.attendance.update_one(
                {"user_id": user_id, "date": today},
                {"$set": update_data}
            )
            message = "Checkout recorded successfully"
        else:
            # Create new checkin record
            attendance_record = {
                "user_id": user_id,
                "employee_name": user.get("full_name", user.get("username")),
                "date": today,
                "checkin_time": current_time,
                "checkout_time": None,
                "status": status,
                "working_hours": 0,
                "notes": notes,
                "location": {
                    "latitude": latitude,
                    "longitude": longitude
                } if latitude and longitude else None,
                "created_at": current_time,
                "marked_by": current_user.get("full_name", current_user.get("name", "Self")),
                "updated_at": current_time
            }
            
            db.attendance.insert_one(attendance_record)
            message = "Checkin recorded successfully"
        
        return {
            "success": True,
            "message": message,
            "timestamp": current_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording attendance: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to record attendance: {str(e)}")

@employees_router.get("/attendance/records", status_code=200)
async def get_attendance_records(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records with filtering - role-based access"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Check if user has admin/HR permissions
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        query = {}
        
        # Role-based access control
        if is_admin_or_hr:
            # Admin/HR can see all records or filter by specific employee
            if employee_id:
                query["user_id"] = employee_id
        else:
            # Regular employees can only see their own records
            query["user_id"] = current_user.get("user_id", current_user.get("employee_id", ""))
        
        if start_date:
            query["date"] = {"$gte": start_date}
        
        if end_date:
            if "date" in query:
                query["date"]["$lte"] = end_date
            else:
                query["date"] = {"$lte": end_date}
        
        # Pagination
        skip = (page - 1) * limit
        
        records = list(db.attendance.find(query).sort("date", -1).skip(skip).limit(limit))
        total = db.attendance.count_documents(query)
        
        # Add employee names for admin/HR view
        if is_admin_or_hr and records:
            user_ids = list(set(record.get("user_id") for record in records if record.get("user_id")))
            users_data = {user["user_id"]: user for user in db.users.find({"user_id": {"$in": user_ids}})}
            
            for record in records:
                user_id = record.get("user_id")
                if user_id in users_data:
                    record["employee_name"] = users_data[user_id].get("full_name", users_data[user_id].get("name", "Unknown"))
                    record["employee_id"] = users_data[user_id].get("employee_id", user_id)
                else:
                    record["employee_name"] = "Unknown Employee"
                    record["employee_id"] = user_id
        
        return make_serializable({
            "success": True,
            "data": records,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "user_permissions": {
                "is_admin_or_hr": is_admin_or_hr,
                "can_view_all": is_admin_or_hr
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting attendance records: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get attendance records: {str(e)}")

@employees_router.get("/attendance/summary", status_code=200)
async def get_attendance_summary(
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    month: int = Query(datetime.now().month, description="Month (1-12)"),
    year: int = Query(datetime.now().year, description="Year")
):
    """Get attendance summary for specified month/year"""
    try:
        db = get_database()
        
        # Create date range for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
        
        date_start_str = start_date.strftime("%Y-%m-%d")
        date_end_str = end_date.strftime("%Y-%m-%d")
        
        # Build aggregation pipeline
        match_stage = {
            "date": {"$gte": date_start_str, "$lte": date_end_str}
        }
        
        if employee_id:
            match_stage["user_id"] = employee_id
        
        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": "$user_id",
                    "employee_name": {"$first": "$employee_name"},
                    "total_days_present": {"$sum": {"$cond": [{"$eq": ["$status", "present"]}, 1, 0]}},
                    "total_days_absent": {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}},
                    "total_working_hours": {"$sum": "$working_hours"},
                    "late_checkins": {"$sum": {"$cond": [{"$gt": ["$checkin_time", "09:30:00"]}, 1, 0]}},
                    "records": {"$push": "$$ROOT"}
                }
            }
        ]
        
        summary_data = list(db.attendance.aggregate(pipeline))
        
        # Calculate working days in the month (assuming 5-day work week)
        total_working_days = 0
        current_date = start_date
        while current_date <= end_date:
            if current_date.weekday() < 5:  # Monday = 0, Friday = 4
                total_working_days += 1
            current_date += timedelta(days=1)
        
        # Format summary
        formatted_summary = []
        for summary in summary_data:
            attendance_percentage = round(
                (summary["total_days_present"] / total_working_days * 100), 2
            ) if total_working_days > 0 else 0
            
            avg_hours_per_day = round(
                summary["total_working_hours"] / summary["total_days_present"], 2
            ) if summary["total_days_present"] > 0 else 0
            
            formatted_summary.append({
                "user_id": summary["_id"],
                "employee_name": summary["employee_name"],
                "total_working_days": total_working_days,
                "total_days_present": summary["total_days_present"],
                "total_days_absent": summary["total_days_absent"],
                "attendance_percentage": attendance_percentage,
                "total_working_hours": summary["total_working_hours"],
                "average_hours_per_day": avg_hours_per_day,
                "late_arrivals": summary["late_checkins"]
            })
        
        return make_serializable({
            "success": True,
            "month": month,
            "year": year,
            "total_working_days": total_working_days,
            "summary": formatted_summary
        })
        
    except Exception as e:
        logger.error(f"Error getting attendance summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get attendance summary: {str(e)}")

@employees_router.get("/attendance/all-admin", status_code=200)
async def get_all_attendance_admin(
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page"),
    department: Optional[str] = Query(None, description="Filter by department"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by employee name or ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get all attendance records for Admin/HR with advanced filtering"""
    try:
        user_roles = extract_user_roles(current_user)
        
        # Check if user has admin/HR permissions
        if not has_admin_or_hr_permission(user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions. Only Admin and HR can access all attendance data")
        
        db = get_database()
        query = {}
        
        # Date filtering
        if month and year:
            import calendar
            start_date = datetime(year, month, 1).strftime("%Y-%m-%d")
            end_date = datetime(year, month, calendar.monthrange(year, month)[1]).strftime("%Y-%m-%d")
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif not month and not year:
            # Default to current month
            now = datetime.now()
            start_date = datetime(now.year, now.month, 1).strftime("%Y-%m-%d")
            end_date = datetime(now.year, now.month, calendar.monthrange(now.year, now.month)[1]).strftime("%Y-%m-%d")
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        # Status filter
        if status:
            query["status"] = status
        
        # Get user IDs based on department filter or search
        user_ids_filter = None
        if department or search:
            user_query = {}
            if department:
                user_query["department"] = department
            if search:
                user_query["$or"] = [
                    {"full_name": {"$regex": search, "$options": "i"}},
                    {"name": {"$regex": search, "$options": "i"}},
                    {"user_id": {"$regex": search, "$options": "i"}},
                    {"employee_id": {"$regex": search, "$options": "i"}}
                ]
            
            matching_users = list(db.users.find(user_query, {"user_id": 1}))
            user_ids_filter = [user["user_id"] for user in matching_users]
            
            if user_ids_filter:
                query["user_id"] = {"$in": user_ids_filter}
            else:
                # No matching users found
                return make_serializable({
                    "success": True,
                    "data": [],
                    "page": page,
                    "limit": limit,
                    "total": 0,
                    "pages": 0,
                    "filters_applied": {"department": department, "search": search, "status": status}
                })
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get attendance records
        records = list(db.attendance.find(query).sort([("date", -1), ("checkin_time", 1)]).skip(skip).limit(limit))
        total = db.attendance.count_documents(query)
        
        # Enrich with employee information
        if records:
            user_ids = list(set(record.get("user_id") for record in records if record.get("user_id")))
            users_data = {user["user_id"]: user for user in db.users.find({"user_id": {"$in": user_ids}})}
            
            for record in records:
                user_id = record.get("user_id")
                if user_id in users_data:
                    user_info = users_data[user_id]
                    record["employee_name"] = user_info.get("full_name", user_info.get("name", "Unknown"))
                    record["employee_id"] = user_info.get("employee_id", user_id)
                    record["department"] = user_info.get("department", "Not assigned")
                    record["position"] = user_info.get("position", "Not assigned")
                else:
                    record["employee_name"] = "Unknown Employee"
                    record["employee_id"] = user_id
                    record["department"] = "Not assigned"
                    record["position"] = "Not assigned"
        
        return make_serializable({
            "success": True,
            "data": records,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "filters_applied": {
                "department": department,
                "search": search,
                "status": status,
                "month": month,
                "year": year
            },
            "user_permissions": {
                "is_admin_or_hr": True,
                "can_view_all": True,
                "can_edit": True
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all attendance records: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get all attendance records: {str(e)}")

# =================== LEAVE MANAGEMENT ===================

@employees_router.post("/leave-requests", status_code=201)
async def create_leave_request(
    payload: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Create a new leave request"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        user_id = payload.get("user_id")
        leave_type = payload.get("leave_type")  # sick, vacation, personal, etc.
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        reason = payload.get("reason", "")
        is_half_day = payload.get("is_half_day", False)
        
        if not all([user_id, leave_type, start_date, end_date]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Authorization check: users can only create requests for themselves unless they're admin/HR
        current_user_id = current_user.get("user_id", current_user.get("employee_id"))
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        if not is_admin_or_hr and user_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only create leave requests for yourself")
        
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
            "status": "pending",  # pending, approved, rejected
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
        logger.error(f"Error creating leave request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create leave request: {str(e)}")

@employees_router.get("/leave-requests-api", status_code=200)
@employees_router.get("/leave-requests", status_code=200)
async def get_leave_requests(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID (Admin/HR only)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    leave_type: Optional[str] = Query(None, description="Filter by leave type"),
    current_user: dict = Depends(get_current_user)
):
    """Get leave requests with filtering - role-based access"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Check if user has admin/HR permissions
        is_admin_or_hr = has_admin_or_hr_permission(user_roles)
        
        query = {}
        
        # Role-based access control
        if is_admin_or_hr:
            # Admin/HR can see all requests or filter by specific employee
            if employee_id:
                query["user_id"] = employee_id
        else:
            # Regular employees can only see their own requests
            query["user_id"] = current_user.get("user_id", current_user.get("employee_id", ""))
        
        if status:
            query["status"] = status
            
        if leave_type:
            query["leave_type"] = leave_type
        
        # Pagination
        skip = (page - 1) * limit
        
        requests = list(db.leave_requests.find(query).sort("requested_at", -1).skip(skip).limit(limit))
        total = db.leave_requests.count_documents(query)
        
        # Add employee names for admin/HR view
        if is_admin_or_hr and requests:
            user_ids = list(set(request.get("user_id") for request in requests if request.get("user_id")))
            users_data = {user["user_id"]: user for user in db.users.find({"user_id": {"$in": user_ids}})}
            
            for request in requests:
                user_id = request.get("user_id")
                if user_id in users_data:
                    request["employee_name"] = users_data[user_id].get("full_name", users_data[user_id].get("name", "Unknown"))
                    request["employee_id"] = users_data[user_id].get("employee_id", user_id)
                else:
                    request["employee_name"] = "Unknown Employee"
                    request["employee_id"] = user_id
        
        return make_serializable({
            "success": True,
            "data": requests,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "user_permissions": {
                "is_admin_or_hr": is_admin_or_hr,
                "can_view_all": is_admin_or_hr,
                "can_approve_reject": is_admin_or_hr
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting leave requests: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get leave requests: {str(e)}")

@employees_router.get("/leave-requests/all-admin", status_code=200)
async def get_all_leave_requests_admin(
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page"),
    department: Optional[str] = Query(None, description="Filter by department"),
    status: Optional[str] = Query(None, description="Filter by status"),
    leave_type: Optional[str] = Query(None, description="Filter by leave type"),
    search: Optional[str] = Query(None, description="Search by employee name or ID"),
    start_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """Get all leave requests for Admin/HR with advanced filtering"""
    try:
        user_roles = extract_user_roles(current_user)
        
        # Check if user has admin/HR permissions
        if not has_admin_or_hr_permission(user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions. Only Admin and HR can access all leave requests")
        
        db = get_database()
        query = {}
        
        # Status filter
        if status:
            query["status"] = status
        
        # Leave type filter
        if leave_type:
            query["leave_type"] = leave_type
        
        # Date range filter (for leave start dates)
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query["$gte"] = start_date
            if end_date:
                date_query["$lte"] = end_date
            query["start_date"] = date_query
        
        # Get user IDs based on department filter or search
        user_ids_filter = None
        if department or search:
            user_query = {}
            if department:
                user_query["department"] = department
            if search:
                user_query["$or"] = [
                    {"full_name": {"$regex": search, "$options": "i"}},
                    {"name": {"$regex": search, "$options": "i"}},
                    {"user_id": {"$regex": search, "$options": "i"}},
                    {"employee_id": {"$regex": search, "$options": "i"}}
                ]
            
            matching_users = list(db.users.find(user_query, {"user_id": 1}))
            user_ids_filter = [user["user_id"] for user in matching_users]
            
            if user_ids_filter:
                query["user_id"] = {"$in": user_ids_filter}
            else:
                # No matching users found
                return make_serializable({
                    "success": True,
                    "data": [],
                    "page": page,
                    "limit": limit,
                    "total": 0,
                    "pages": 0,
                    "filters_applied": {
                        "department": department, 
                        "search": search, 
                        "status": status,
                        "leave_type": leave_type,
                        "start_date": start_date,
                        "end_date": end_date
                    }
                })
        
        # Pagination
        skip = (page - 1) * limit
        
        # Get leave requests
        requests = list(db.leave_requests.find(query).sort("requested_at", -1).skip(skip).limit(limit))
        total = db.leave_requests.count_documents(query)
        
        # Enrich with employee information
        if requests:
            user_ids = list(set(request.get("user_id") for request in requests if request.get("user_id")))
            users_data = {user["user_id"]: user for user in db.users.find({"user_id": {"$in": user_ids}})}
            
            for request in requests:
                user_id = request.get("user_id")
                if user_id in users_data:
                    user_info = users_data[user_id]
                    request["employee_name"] = user_info.get("full_name", user_info.get("name", "Unknown"))
                    request["employee_id"] = user_info.get("employee_id", user_id)
                    request["department"] = user_info.get("department", "Not assigned")
                    request["position"] = user_info.get("position", "Not assigned")
                else:
                    request["employee_name"] = "Unknown Employee"
                    request["employee_id"] = user_id
                    request["department"] = "Not assigned"
                    request["position"] = "Not assigned"
        
        # Get summary statistics
        summary_stats = {
            "total_requests": total,
            "pending_requests": db.leave_requests.count_documents({**query, "status": "pending"}),
            "approved_requests": db.leave_requests.count_documents({**query, "status": "approved"}),
            "rejected_requests": db.leave_requests.count_documents({**query, "status": "rejected"})
        }
        
        return make_serializable({
            "success": True,
            "data": requests,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "summary_stats": summary_stats,
            "filters_applied": {
                "department": department,
                "search": search,
                "status": status,
                "leave_type": leave_type,
                "start_date": start_date,
                "end_date": end_date
            },
            "user_permissions": {
                "is_admin_or_hr": True,
                "can_view_all": True,
                "can_approve_reject": True
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all leave requests: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get all leave requests: {str(e)}")

@employees_router.put("/leave-requests/{request_id}/approve", status_code=200)
async def approve_leave_request(
    request_id: str,
    payload: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Approve a leave request - Admin/HR only"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Check if user has admin/HR permissions
        if not has_admin_or_hr_permission(user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions. Only Admin and HR can approve leave requests")
        
        # Find the leave request
        leave_request = db.leave_requests.find_one({"_id": ObjectId(request_id)})
        if not leave_request:
            raise HTTPException(status_code=404, detail="Leave request not found")
        
        if leave_request["status"] != "pending":
            raise HTTPException(status_code=400, detail="Leave request is not pending")
        
        # Update the request
        update_data = {
            "status": "approved",
            "approved_by": current_user.get("full_name", current_user.get("name", "Admin")),
            "approved_by_id": current_user.get("user_id", current_user.get("employee_id")),
            "approved_at": datetime.now(),
            "approval_notes": payload.get("notes", "")
        }
        
        db.leave_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Leave request approved successfully",
            "approved_by": update_data["approved_by"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving leave request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to approve leave request: {str(e)}")

@employees_router.put("/leave-requests/{request_id}/reject", status_code=200)
async def reject_leave_request(
    request_id: str,
    payload: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Reject a leave request - Admin/HR only"""
    try:
        db = get_database()
        user_roles = extract_user_roles(current_user)
        
        # Check if user has admin/HR permissions
        if not has_admin_or_hr_permission(user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions. Only Admin and HR can reject leave requests")
        
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
            "rejected_by": current_user.get("full_name", current_user.get("name", "Admin")),
            "rejected_by_id": current_user.get("user_id", current_user.get("employee_id")),
            "rejected_at": datetime.now(),
            "rejection_reason": reason
        }
        
        db.leave_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Leave request rejected successfully",
            "rejected_by": update_data["rejected_by"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting leave request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reject leave request: {str(e)}")

# =================== PERFORMANCE & REPORTS ===================

@employees_router.get("/performance/{employee_id}", status_code=200)
async def get_employee_performance(
    employee_id: str,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get employee performance metrics including leads activity"""
    try:
        db = get_database()
        
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
        
        # Leads Activity - Get leads assigned to this employee
        total_leads = db.leads.count_documents({
            "assigned_to": employee_id,
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        # Converted leads (qualified status)
        converted_leads = db.leads.count_documents({
            "assigned_to": employee_id,
            "status": "qualified",
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        })
        
        # Lead status breakdown
        status_pipeline = [
            {"$match": {
                "assigned_to": employee_id,
                "created_at": {"$gte": start_dt, "$lt": end_dt}
            }},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        lead_status_breakdown = list(db.leads.aggregate(status_pipeline))
        
        # Lead activities (notes, calls, meetings, etc.)
        activities = list(db.lead_activities.find({
            "created_by": employee_id,
            "created_at": {"$gte": start_dt, "$lt": end_dt}
        }))
        
        # Group activities by type
        activity_breakdown = {}
        for activity in activities:
            activity_type = activity.get("activity_type", "unknown")
            activity_breakdown[activity_type] = activity_breakdown.get(activity_type, 0) + 1
        
        # Attendance for the period
        attendance_records = list(db.attendance.find({
            "user_id": employee_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        
        present_days = sum(1 for record in attendance_records if record.get("status") == "present")
        total_working_hours = sum(record.get("working_hours", 0) for record in attendance_records)
        
        # Calculate performance metrics
        conversion_rate = round((converted_leads / total_leads * 100), 2) if total_leads > 0 else 0
        avg_activities_per_day = round(len(activities) / len(attendance_records), 2) if attendance_records else 0
        
        performance_data = {
            "employee_id": employee_id,
            "employee_name": employee.get("full_name", employee.get("username")),
            "period": {"start_date": start_date, "end_date": end_date},
            "leads_metrics": {
                "total_leads": total_leads,
                "converted_leads": converted_leads,
                "conversion_rate": conversion_rate,
                "status_breakdown": {item["_id"]: item["count"] for item in lead_status_breakdown}
            },
            "activity_metrics": {
                "total_activities": len(activities),
                "activity_breakdown": activity_breakdown,
                "avg_activities_per_day": avg_activities_per_day
            },
            "attendance_metrics": {
                "present_days": present_days,
                "total_working_hours": total_working_hours,
                "avg_hours_per_day": round(total_working_hours / present_days, 2) if present_days > 0 else 0
            }
        }
        
        return make_serializable({
            "success": True,
            "data": performance_data
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting employee performance: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get employee performance: {str(e)}")

@employees_router.get("/reports/daily", status_code=200)
async def get_daily_report(
    report_date: Optional[str] = Query(None, description="Date for report (YYYY-MM-DD), defaults to today")
):
    """Get daily activity report for all employees"""
    try:
        db = get_database()
        
        if not report_date:
            report_date = datetime.now().strftime("%Y-%m-%d")
        
        # Convert to datetime range
        start_dt = datetime.strptime(report_date, "%Y-%m-%d")
        end_dt = start_dt + timedelta(days=1)
        
        # Get all active employees
        employees = list(db.users.find({"is_active": True}))
        
        daily_report = []
        
        for emp in employees:
            user_id = emp.get("user_id")
            
            # Attendance for the day
            attendance = db.attendance.find_one({
                "user_id": user_id,
                "date": report_date
            })
            
            # Lead activities for the day
            activities_count = db.lead_activities.count_documents({
                "created_by": user_id,
                "created_at": {"$gte": start_dt, "$lt": end_dt}
            })
            
            # New leads assigned
            new_leads = db.leads.count_documents({
                "assigned_to": user_id,
                "created_at": {"$gte": start_dt, "$lt": end_dt}
            })
            
            # Leads converted (qualified)
            converted_leads = db.leads.count_documents({
                "assigned_to": user_id,
                "status": "qualified",
                "updated_at": {"$gte": start_dt, "$lt": end_dt}
            })
            
            employee_report = {
                "user_id": user_id,
                "employee_name": emp.get("full_name", emp.get("username")),
                "department": emp.get("department", ""),
                "attendance": {
                    "status": attendance.get("status", "absent") if attendance else "absent",
                    "checkin_time": attendance.get("checkin_time") if attendance else None,
                    "checkout_time": attendance.get("checkout_time") if attendance else None,
                    "working_hours": attendance.get("working_hours", 0) if attendance else 0
                },
                "performance": {
                    "activities_count": activities_count,
                    "new_leads": new_leads,
                    "converted_leads": converted_leads
                }
            }
            
            daily_report.append(employee_report)
        
        # Summary statistics
        total_present = sum(1 for emp in daily_report if emp["attendance"]["status"] == "present")
        total_activities = sum(emp["performance"]["activities_count"] for emp in daily_report)
        total_conversions = sum(emp["performance"]["converted_leads"] for emp in daily_report)
        
        return make_serializable({
            "success": True,
            "report_date": report_date,
            "summary": {
                "total_employees": len(employees),
                "present_today": total_present,
                "attendance_rate": round((total_present / len(employees) * 100), 2) if employees else 0,
                "total_activities": total_activities,
                "total_conversions": total_conversions
            },
            "employee_reports": daily_report
        })
        
    except Exception as e:
        logger.error(f"Error getting daily report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get daily report: {str(e)}")

@employees_router.get("/reports/performance-summary", status_code=200)
async def get_performance_summary(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Filter by department")
):
    """Get performance summary for all employees"""
    try:
        db = get_database()
        
        # Set default date range (last 30 days)
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Convert to datetime
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        # Get employees
        emp_query = {"is_active": True}
        if department:
            emp_query["department"] = department
        
        employees = list(db.users.find(emp_query))
        
        performance_summary = []
        
        for emp in employees:
            user_id = emp.get("user_id")
            
            # Leads metrics
            total_leads = db.leads.count_documents({
                "assigned_to": user_id,
                "created_at": {"$gte": start_dt, "$lt": end_dt}
            })
            
            converted_leads = db.leads.count_documents({
                "assigned_to": user_id,
                "status": "qualified",
                "created_at": {"$gte": start_dt, "$lt": end_dt}
            })
            
            # Activity count
            activities_count = db.lead_activities.count_documents({
                "created_by": user_id,
                "created_at": {"$gte": start_dt, "$lt": end_dt}
            })
            
            # Attendance
            attendance_records = list(db.attendance.find({
                "user_id": user_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }))
            
            present_days = sum(1 for record in attendance_records if record.get("status") == "present")
            
            # Calculate metrics
            conversion_rate = round((converted_leads / total_leads * 100), 2) if total_leads > 0 else 0
            
            emp_summary = {
                "user_id": user_id,
                "employee_name": emp.get("full_name", emp.get("username")),
                "department": emp.get("department", ""),
                "total_leads": total_leads,
                "converted_leads": converted_leads,
                "conversion_rate": conversion_rate,
                "total_activities": activities_count,
                "present_days": present_days,
                "attendance_rate": round((present_days / len(attendance_records) * 100), 2) if attendance_records else 0
            }
            
            performance_summary.append(emp_summary)
        
        # Sort by conversion rate
        performance_summary.sort(key=lambda x: x["conversion_rate"], reverse=True)
        
        return make_serializable({
            "success": True,
            "period": {"start_date": start_date, "end_date": end_date},
            "department_filter": department,
            "performance_summary": performance_summary
        })
        
    except Exception as e:
        logger.error(f"Error getting performance summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance summary: {str(e)}")
