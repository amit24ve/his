from fastapi import APIRouter, HTTPException, Body, Query, Depends
from fastapi.responses import FileResponse
from app.database import get_database, quotations_collection
from fastapi.encoders import jsonable_encoder
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from bson import ObjectId
from app.services.hierarchy_helper import HierarchyHelper
from app.dependencies import get_current_user

# Configure logger
logger = logging.getLogger(__name__)

payment_router = APIRouter(prefix="/api/payments", tags=["payments"])

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
                "can_view_payments": True
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

def can_see_all_payments(db, user_id: str):
    """Check if user can see all payments (only top-level users and their direct reports)"""
    # Top-level users can see all payments
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
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

# Get payment data from quotations (payments are stored as milestones in quotations)
@payment_router.get("/")
async def get_all_payments(current_user: dict = Depends(get_current_user)):
    """Get all payments from quotation milestones with hierarchy-based filtering"""
    try:
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Getting payments for user: {user_id}")
        
        # Get database connection
        db = get_database()
        
        # Check if user is admin (admins can see all payments)
        from app.services.hierarchy_helper import HierarchyHelper
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if is_admin:
            # Admin users can see all quotations/payments
            quotations = list(quotations_collection.find({}))
            logger.info(f"Admin user {user_id} accessing all payments")
        else:
            # Non-admin users: filter via accessible leads
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            logger.info(f"Non-admin user {user_id} can access users: {accessible_user_ids}")
            
            # Find leads that user can access based on hierarchy
            accessible_leads_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}}
                ]
            }
            
            # Get accessible lead IDs
            accessible_leads = list(db.leads.find(accessible_leads_query, {"lead_id": 1}))
            accessible_lead_ids = [lead.get("lead_id") for lead in accessible_leads if lead.get("lead_id")]
            
            logger.info(f"User {user_id} can access {len(accessible_lead_ids)} leads")
            
            # Filter quotations based on accessible leads
            if accessible_lead_ids:
                quotations = list(quotations_collection.find({"lead_id": {"$in": accessible_lead_ids}}))
            else:
                quotations = []
        
        all_payments = []
        
        for quotation in quotations:
            quotation["_id"] = str(quotation["_id"])
            
            # Extract payments from milestones
            for milestone in quotation.get("milestones", []):
                if milestone.get("paid") and milestone.get("paid_amount", 0) > 0:
                    payment_data = {
                        "payment_id": f"{quotation['_id']}_{milestone.get('title', 'payment')}",
                        "lead_id": quotation.get("lead_id"),
                        "quotation_id": quotation["_id"],
                        "client_name": quotation.get("client_name", ""),
                        "milestone_title": milestone.get("title", ""),
                        "amount": milestone.get("paid_amount", 0),
                        "milestone_amount": milestone.get("amount", 0),
                        "payment_date": quotation.get("updated_at", quotation.get("created_at")),
                        "status": "completed" if milestone.get("paid") else "pending",
                        "quotation_status": quotation.get("status", ""),
                        "created_at": quotation.get("created_at"),
                        "updated_at": quotation.get("updated_at")
                    }
                    all_payments.append(payment_data)
        
        # Calculate summary
        total_amount = sum(payment.get("amount", 0) for payment in all_payments)
        total_payments = len(all_payments)
        
        return make_serializable({
            "success": True,
            "payments": all_payments,
            "summary": {
                "total_amount": total_amount,
                "total_payments": total_payments
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting payments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get payments: {str(e)}")

# Get expenses data
@payment_router.get("/expenses")
async def get_all_expenses(current_user: dict = Depends(get_current_user)):
    """Get all expenses with hierarchy-based filtering"""
    try:
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Getting expenses for user: {user_id}")
        
        # Get database connection
        db = get_database()
        
        # Check if user is admin (admins can see all expenses)
        from app.services.hierarchy_helper import HierarchyHelper
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if is_admin:
            # Admin users can see all expenses
            expenses_cursor = db.expenses.find({})
        else:
            # Non-admin users: apply hierarchy filtering
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            logger.info(f"Non-admin user {user_id} can access users: {accessible_user_ids}")
            
            # Filter expenses by accessible users
            expenses_cursor = db.expenses.find({
                "$or": [
                    {"created_by": {"$in": accessible_user_ids}},
                    {"assigned_to": {"$in": accessible_user_ids}}
                ]
            })
        
        # Convert to list and make serializable
        expenses = list(expenses_cursor)
        
        # Process each expense
        for expense in expenses:
            expense["_id"] = str(expense["_id"])
            
            # Ensure all required fields exist
            expense.setdefault("description", "")
            expense.setdefault("category", "")
            expense.setdefault("amount", 0)
            expense.setdefault("created_by", "")
            expense.setdefault("created_at", "")
        
        return make_serializable(expenses)
        
    except Exception as e:
        logger.error(f"Error getting expenses: {str(e)}")
        # Return empty array instead of raising error to prevent frontend crashes
        return []

# Hierarchy endpoints for payments
@payment_router.get("/hierarchy/{user_id}")
async def get_user_payments_hierarchy(user_id: str):
    """Get payment hierarchy for a specific user"""
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
            "can_see_all_payments": can_see_all_payments(db, user_id),
            "direct_subordinates": get_direct_subordinates(db, user_id),
            "all_subordinates": get_all_subordinates_recursive(db, user_id)
        }
        
        return make_serializable({
            "success": True,
            "hierarchy": hierarchy
        })
        
    except Exception as e:
        logger.error(f"Error getting payment hierarchy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get payment hierarchy: {str(e)}")

@payment_router.get("/subordinate-payments/{manager_id}")
async def get_subordinate_payments(
    manager_id: str,
    status: Optional[str] = Query(None, description="Filter by payment status"),
    limit: int = Query(100, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get all payments from subordinates of a manager"""
    try:
        db = get_database()
        
        # Get all subordinates
        subordinates = get_all_subordinates_recursive(db, manager_id)
        subordinate_ids = [sub["user_id"] for sub in subordinates]
        
        if not subordinate_ids:
            return make_serializable({
                "success": True,
                "payments": [],
                "total": 0,
                "subordinates": []
            })
        
        # Get leads assigned to subordinates
        leads_query = {"assigned_to": {"$in": subordinate_ids}}
        subordinate_leads = list(db.leads.find(leads_query, {"lead_id": 1, "assigned_to": 1}))
        subordinate_lead_ids = [lead.get("lead_id") for lead in subordinate_leads if lead.get("lead_id")]
        
        if not subordinate_lead_ids:
            return make_serializable({
                "success": True,
                "payments": [],
                "total": 0,
                "subordinates": subordinates
            })
        
        # Get quotations for these leads
        quotations_query = {"lead_id": {"$in": subordinate_lead_ids}}
        quotations = list(quotations_collection.find(quotations_query))
        
        # Extract payments from quotation milestones
        payments = []
        for quotation in quotations:
            quotation["_id"] = str(quotation["_id"])
            
            # Find the assigned user for this lead
            related_lead = next((lead for lead in subordinate_leads if lead.get("lead_id") == quotation["lead_id"]), None)
            assigned_user_info = None
            if related_lead and related_lead.get("assigned_to"):
                assigned_user = get_user_by_id(db, related_lead["assigned_to"])
                if assigned_user:
                    assigned_user_info = {
                        "user_id": assigned_user.get("user_id"),
                        "name": assigned_user.get("full_name", ""),
                        "email": assigned_user.get("email", "")
                    }
            
            # Extract payments from milestones
            for milestone in quotation.get("milestones", []):
                if milestone.get("paid") and milestone.get("paid_amount", 0) > 0:
                    payment_data = {
                        "payment_id": f"{quotation['_id']}_{milestone.get('title', 'payment')}",
                        "lead_id": quotation.get("lead_id"),
                        "quotation_id": quotation["_id"],
                        "client_name": quotation.get("client_name", ""),
                        "milestone_title": milestone.get("title", ""),
                        "amount": milestone.get("paid_amount", 0),
                        "milestone_amount": milestone.get("amount", 0),
                        "payment_date": quotation.get("updated_at", quotation.get("created_at")),
                        "status": "completed" if milestone.get("paid") else "pending",
                        "quotation_status": quotation.get("status", ""),
                        "assigned_user_info": assigned_user_info,
                        "created_at": quotation.get("created_at"),
                        "updated_at": quotation.get("updated_at")
                    }
                    if not status or payment_data["status"] == status:
                        payments.append(payment_data)
        
        # Apply pagination
        total = len(payments)
        payments = payments[skip:skip + limit]
        
        return make_serializable({
            "success": True,
            "payments": payments,
            "total": total,
            "subordinates": subordinates,
            "limit": limit,
            "skip": skip
        })
        
    except Exception as e:
        logger.error(f"Error getting subordinate payments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get subordinate payments: {str(e)}")

@payment_router.get("/organization-hierarchy")
async def get_payments_organization_hierarchy():
    """Get complete organization hierarchy with payment statistics"""
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
                        # Count payments for leads assigned to this user
                        user_leads = list(db.leads.find({"assigned_to": user.get("user_id")}, {"lead_id": 1}))
                        user_lead_ids = [lead.get("lead_id") for lead in user_leads if lead.get("lead_id")]
                        
                        # Get quotations for these leads and count payments
                        payments_count = 0
                        total_payment_amount = 0
                        if user_lead_ids:
                            user_quotations = list(quotations_collection.find({"lead_id": {"$in": user_lead_ids}}))
                            for quotation in user_quotations:
                                for milestone in quotation.get("milestones", []):
                                    if milestone.get("paid") and milestone.get("paid_amount", 0) > 0:
                                        payments_count += 1
                                        total_payment_amount += milestone.get("paid_amount", 0)
                        
                        user_data = {
                            "user_id": user.get("user_id"),
                            "name": user.get("full_name", ""),
                            "email": user.get("email", ""),
                            "phone": user.get("phone", ""),
                            "department": user.get("department", ""),
                            "payments_count": payments_count,
                            "total_payment_amount": total_payment_amount,
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
        logger.error(f"Error getting payments organization hierarchy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get payments organization hierarchy: {str(e)}")

@payment_router.get("/invoices")
async def get_invoices(
    skip: int = Query(0, description="Skip number of results"),
    limit: int = Query(10, description="Limit number of results"),
    dealer_id: Optional[str] = Query(None, description="Filter by dealer ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get paginated list of invoices from quotations"""
    try:
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Getting invoices for user: {user_id}, skip: {skip}, limit: {limit}")
        
        # Get database connection
        db = get_database()
        
        # Check if user is admin (admins can see all invoices)
        from app.services.hierarchy_helper import HierarchyHelper
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if is_admin:
            # Admin users can see all quotations/invoices
            query = {}
        else:
            # Non-admin users: filter via accessible leads
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            logger.info(f"Non-admin user {user_id} can access users: {accessible_user_ids}")
            
            # Find leads that user can access based on hierarchy
            accessible_leads_query = {
                "$or": [
                    {"assigned_to": {"$in": accessible_user_ids}},
                    {"assigned_user_id": {"$in": accessible_user_ids}},
                    {"created_by": {"$in": accessible_user_ids}}
                ]
            }
            
            # Get accessible lead IDs
            accessible_leads = list(db.leads.find(accessible_leads_query, {"lead_id": 1}))
            accessible_lead_ids = [lead.get("lead_id") for lead in accessible_leads if lead.get("lead_id")]
            
            if accessible_lead_ids:
                query = {"lead_id": {"$in": accessible_lead_ids}}
            else:
                query = {"lead_id": {"$in": []}}  # Empty result for users with no accessible leads
        
        # Add dealer filter if provided
        if dealer_id:
            query["dealer_id"] = dealer_id
        
        # Get total count for pagination
        total_count = quotations_collection.count_documents(query)
        
        # Get quotations with pagination
        quotations = list(quotations_collection.find(query)
                         .sort("created_at", -1)
                         .skip(skip)
                         .limit(limit))
        
        # Transform quotations into invoice format
        invoices = []
        for quotation in quotations:
            quotation["_id"] = str(quotation["_id"])
            
            # Calculate totals from milestones
            total_amount = sum(milestone.get("amount", 0) for milestone in quotation.get("milestones", []))
            paid_amount = sum(milestone.get("paid_amount", 0) for milestone in quotation.get("milestones", []) if milestone.get("paid"))
            remaining_amount = total_amount - paid_amount
            
            # Determine invoice status
            status = "pending"
            if paid_amount >= total_amount:
                status = "paid"
            elif paid_amount > 0:
                status = "partial"
            
            invoice_data = {
                "id": quotation["_id"],
                "lead_id": quotation.get("lead_id"),
                "client_name": quotation.get("client_name", ""),
                "dealer_id": quotation.get("dealer_id", ""),
                "amount": total_amount,
                "paid_amount": paid_amount,
                "remaining_amount": remaining_amount,
                "status": status,
                "created_at": quotation.get("created_at"),
                "updated_at": quotation.get("updated_at"),
                "invoice_date": quotation.get("created_at"),
                "due_date": quotation.get("due_date"),
                "milestones": quotation.get("milestones", [])
            }
            invoices.append(invoice_data)
        
        return make_serializable({
            "success": True,
            "invoices": invoices,
            "pagination": {
                "total": total_count,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total_count
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting invoices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get invoices: {str(e)}")
