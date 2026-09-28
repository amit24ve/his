from fastapi import APIRouter, HTTPException, Body, Query, Depends
from fastapi.responses import FileResponse
from app.database.schemas.lead_schema import Quotation, Milestone, UpdateMilestonePaid
from app.database import quotations_collection, get_database
from app.database.repositories.quotation_repository import QuotationRepository
from app.utils.pdf_utils import generate_quotation_pdf
from fastapi.encoders import jsonable_encoder
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from bson import ObjectId
from app.services.hierarchy_helper import HierarchyHelper
from app.dependencies import get_current_user

# Configure logger
logger = logging.getLogger(__name__)

quotation_router = APIRouter(prefix="/api/quotations", tags=["quotations"])

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
                "can_assign_quotations": True
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

def can_see_unassigned_quotations(db, user_id: str):
    """Check if user can see unassigned quotations (only top-level users and their direct reports)"""
    # Top-level users can see unassigned quotations
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


def calculate_acceptance_rate(quotations: List[dict]) -> float:
    if not quotations:
        return 0.0
    accepted = sum(1 for q in quotations if q.get('status') in ['accepted', 'paid'])
    return (accepted / len(quotations)) * 100

@quotation_router.post("/", status_code=201)
async def create_quotation(body: dict = Body(...)):
    lead_id = body.get("lead_id")
    client_name = body.get("client_name", "")
    amount = float(body.get("amount", 0))
    milestones = body.get("milestones", [])

    if not lead_id or not amount or not milestones:
        raise HTTPException(status_code=400, detail="lead_id, amount, milestones required")

    # Set paid_amount for each milestone
    for m in milestones:
        m["paid"] = bool(m.get("paid", False))
        m["paid_amount"] = m["amount"] if m["paid"] else 0

    paid_amount = sum(m["paid_amount"] for m in milestones)
    remaining_amount = max(amount - paid_amount, 0)
    percent = (paid_amount / amount * 100) if amount else 0

    if percent == 0:
        status = "draft"
    elif percent == 100:
        status = "completed"
    elif 80 <= percent < 100:
        status = "remaining"
    elif 50 <= percent < 80:
        status = "few"
    elif 20 <= percent < 40:
        status = "partial"
    else:
        status = "partial"

    # Generate quotation number using the repository
    repo = QuotationRepository()
    quotation_number = repo._generate_quotation_number()
    
    q = {
        "lead_id": lead_id,
        "client_name": client_name,
        "amount": amount,
        "milestones": milestones,
        "pdf_url": f"/static/pdfs/quotation_{lead_id}.pdf",
        "quotation_number": quotation_number,
        "status": status,
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
        "created_at": datetime.now(),
        "expiry_date": datetime.now() + timedelta(days=45),
        "updated_at": datetime.now()
    }
    quotations_collection.insert_one(q)
    q["_id"] = str(q.get("_id", ""))
    return q
    

@quotation_router.patch("/{lead_id}/duepay")
async def pay_due_amount(lead_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """
    Pay any amount toward the due of a quotation.
    Only users with access to the lead can update payments.
    Request body:
    { 
        "amount": <number>, 
        "new_total_amount": <optional number>, 
        "new_milestone": <optional dict>,
        "milestone_paid_update": <optional [{"index": <int>, "paid": <bool>}]>
    }
    """
    print(f"Payment request for lead {lead_id}: {body}")
    
    # Get current user info
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
    logger.info(f"Payment update requested by user: {user_id} for lead: {lead_id}")
    
    pay_amount = round(float(body.get("amount", 0)), 2)  # Round to 2 decimal places to avoid precision issues
    print(f"Original amount: {body.get('amount', 0)}, Processed amount: {pay_amount}")
    
    if pay_amount < 0:
        raise HTTPException(status_code=400, detail="Amount must be >= 0")

    # Fetch quotation
    q = quotations_collection.find_one({"lead_id": lead_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Check hierarchy-based access
    is_admin = await HierarchyHelper.is_user_admin(user_id)
    if not is_admin:
        # Check if user can access this quotation based on lead ownership
        from app.database import db
        lead = db.leads.find_one({"lead_id": lead_id})
        if lead:
            lead_owner = lead.get("assigned_to") or lead.get("assigned_user_id") or lead.get("created_by")
            if not await HierarchyHelper.can_access_resource(user_id, lead_owner):
                raise HTTPException(
                    status_code=403, 
                    detail="Access denied: You don't have permission to modify this quotation's payments"
                )

    milestones = q.get('milestones', [])
    if not milestones:
        payment_title = body.get("payment_title", "Full Payment")
        milestones = [{
            "title": payment_title,
            "amount": q.get("amount", 0),
            "paid": False,
            "paid_amount": 0
        }]

    # Optionally update milestone paid status directly
    milestone_paid_update = body.get("milestone_paid_update")
    if milestone_paid_update:
        for upd in milestone_paid_update:
            idx = upd.get("index")
            paid = upd.get("paid")
            if idx is not None and 0 <= idx < len(milestones):
                milestones[idx]['paid'] = bool(paid)
                milestones[idx]['paid_amount'] = milestones[idx]['amount'] if paid else 0

    # Optionally add a new milestone
    new_milestone = body.get("new_milestone")
    if new_milestone:
        if "amount" not in new_milestone:
            raise HTTPException(status_code=400, detail="New milestone must have an amount")
        amount = float(new_milestone["amount"])
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Milestone amount must be positive")
        milestones.append({
            "title": new_milestone.get("title", f"Milestone {len(milestones)+1}"),
            "amount": amount,
            "paid": False,
            "paid_amount": 0
        })
        # Update the total amount if not explicitly provided
        q['amount'] = sum(m.get('amount', 0) for m in milestones)

    # Optionally update the total amount
    new_total_amount = body.get("new_total_amount")
    if new_total_amount is not None:
        try:
            new_total_amount = float(new_total_amount)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid new total amount provided.")
        if new_total_amount < 0:
            raise HTTPException(status_code=400, detail="Total amount must be positive")
        if new_total_amount != q.get('amount'):
            # If new amount is more than current, increase the last milestone
            diff = new_total_amount - sum(m.get("amount", 0) for m in milestones)
            if diff > 0:
                milestones[-1]["amount"] += diff
            q['amount'] = new_total_amount

    # Ensure all milestones have required fields
    for m in milestones:
        if 'paid' not in m:
            m['paid'] = False
        if 'paid_amount' not in m:
            m['paid_amount'] = m['amount'] if m['paid'] else 0

    # Distribute payment across milestones (partial payments supported)
    remaining = pay_amount
    for m in milestones:
        milestone_due = round(m.get('amount', 0) - m.get('paid_amount', 0), 2)
        if milestone_due <= 0:
            m['paid'] = True
            m['paid_amount'] = m['amount']
            continue
        pay_now = min(remaining, milestone_due)
        m['paid_amount'] = round(m.get('paid_amount', 0) + pay_now, 2)
        if m['paid_amount'] >= m.get('amount', 0):
            m['paid'] = True
            m['paid_amount'] = m.get('amount', 0)
        else:
            m['paid'] = False
        remaining = round(remaining - pay_now, 2)
        if remaining <= 0:
            break

    # If payment remains after all milestones are paid, create a new milestone for the extra payment
    if remaining > 0:
        payment_title = body.get("payment_title", f"Extra Payment {len(milestones)+1}")
        milestones.append({
            "title": payment_title,
            "amount": remaining,
            "paid": True,
            "paid_amount": remaining
        })
        remaining = 0

    # Recalculate paid and remaining amounts
    paid_amount = round(sum(m.get('paid_amount', 0) for m in milestones), 2)
    total_amount = round(q.get('amount', 0), 2)
    remaining_amount = round(max(total_amount - paid_amount, 0), 2)
    
    print(f"Payment calculation - Total: {total_amount}, Paid: {paid_amount}, Remaining: {remaining_amount}")
    print(f"Milestones after payment: {milestones}")
    
    percent = (paid_amount / total_amount * 100) if total_amount else 0
    if percent == 0:
        status = "draft"
    elif percent == 100:
        status = "completed"
    elif 80 <= percent < 100:
        status = "remaining"
    elif 50 <= percent < 80:
        status = "few"
    elif 20 <= percent < 40:
        status = "partial"
    else:
        status = "partial"

    update_data = {
        "milestones": milestones,
        "amount": total_amount,
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
        "status": status,
        "updated_at": datetime.now(),
    }
    quotations_collection.update_one(
        {"lead_id": lead_id},
        {"$set": update_data}
    )

    updated_q = quotations_collection.find_one({"lead_id": lead_id})
    updated_q["_id"] = str(updated_q["_id"])
    return {
        "status": "success",
        "paid_amount": updated_q.get("paid_amount", 0),
        "remaining_amount": updated_q.get("remaining_amount", 0),
        "amount": updated_q.get("amount", 0),
        "quotation_status": updated_q.get("status"),
        "milestones": updated_q.get("milestones", []),
        "quotation": updated_q
    }



@quotation_router.patch("/{lead_id}/milestone/{milestone_index}")
async def update_milestone_payment(lead_id: str, milestone_index: int, body: UpdateMilestonePaid):
    q = quotations_collection.find_one({"lead_id": lead_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    milestones = q.get('milestones', [])
    try:
        milestones[milestone_index]['paid'] = body.paid
        milestones[milestone_index]['paid_amount'] = milestones[milestone_index]['amount'] if body.paid else 0
    except IndexError:
        raise HTTPException(status_code=400, detail="Milestone index out of range")
    # Ensure all milestones have 'paid' and 'paid_amount'
    for m in milestones:
        if 'paid' not in m:
            m['paid'] = False
        if 'paid_amount' not in m:
            m['paid_amount'] = m['amount'] if m['paid'] else 0
        else:
            m['paid_amount'] = m['amount'] if m['paid'] else 0
    paid_amount = sum(m.get('paid_amount', 0) for m in milestones)
    total_amount = q.get('amount', 0)
    remaining_amount = max(total_amount - paid_amount, 0)
    percent = (paid_amount / total_amount * 100) if total_amount else 0
    if percent == 0:
        status = "initial"
    elif 20 <= percent < 40:
        status = "partial"
    elif 50 <= percent < 80:
        status = "few"
    elif 80 <= percent < 100:
        status = "remaining"
    elif percent == 100:
        status = "completed"
    else:
        status = "draft"
    quotations_collection.update_one(
        {"lead_id": lead_id},
        {"$set": {
            "milestones": milestones,
            "paid_amount": paid_amount,
            "remaining_amount": remaining_amount,
            "status": status
        }}
    )
    return {
        "status": "success",
        "milestone": milestones[milestone_index],
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
        "quotation_status": status
    }
    
    
@quotation_router.post("/{lead_id}/invoice")
async def generate_invoice(lead_id: str):
    q = quotations_collection.find_one({"lead_id": lead_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    pdf_path = generate_quotation_pdf(
        lead_id=q['lead_id'],
        amount=q['amount'],
        milestones=q['milestones'],
        client_name=q.get('client_name', ''),
        created_at=q.get('created_at'),
        quotation_number=q.get('quotation_number'),
        status=q.get('status'),
        expiry_date=q.get('expiry_date')
    )
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"invoice_{q['lead_id']}.pdf")


@quotation_router.get("/{lead_id}/progress")
async def get_lead_payment_progress(lead_id: str):
    q = quotations_collection.find_one({"lead_id": lead_id})
    if not q: raise HTTPException(status_code=404, detail="Quotation not found")
    # Ensure all milestones have 'paid' and 'paid_amount'
    for m in q.get('milestones', []):
        if 'paid' not in m:
            m['paid'] = False
        if 'paid_amount' not in m:
            m['paid_amount'] = m['amount'] if m['paid'] else 0
        else:
            m['paid_amount'] = m['amount'] if m['paid'] else 0
    total = q.get('amount', 0)
    paid = sum(m.get('paid_amount', 0) for m in q.get('milestones', []))
    remaining = max(total - paid, 0)
    progress = paid / total if total else 0
    return {
        "lead_id": lead_id,
        "total": total,
        "paid": paid,
        "remaining": remaining,
        "progress": progress
    }


@quotation_router.get("/", response_model=None)
async def get_all_quotations(current_user: dict = Depends(get_current_user)):
    """
    Get all quotations with hierarchy-based filtering
    Users can only see quotations for leads they have access to based on organizational hierarchy
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
        logger.info(f"Getting quotations for user: {user_id}")
        
        # Get database connection
        db = get_database()
        
        # Check if user is admin (admins can see all quotations)
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        if is_admin:
            # Admin users can see all quotations
            quotations = list(quotations_collection.find({}))
            logger.info(f"Admin user {user_id} accessing all quotations")
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
        
        logger.info(f"Found {len(quotations)} quotations for user {user_id}")
        
        total_amount = 0
        acceptance_amount = 0
        
        for q in quotations:
            q["_id"] = str(q["_id"])
            if "client_name" not in q:
                q["client_name"] = "Unknown"
            if "quotation_number" not in q:
                q["quotation_number"] = None
            for m in q.get("milestones", []):
                if "paid" not in m:
                    m["paid"] = False
                if "paid_amount" not in m:
                    m["paid_amount"] = m["amount"] if m["paid"] else 0
                else:
                    m["paid_amount"] = m["amount"] if m["paid"] else 0
            q["paid_amount"] = sum(m.get("paid_amount", 0) for m in q.get("milestones", []))
            q["remaining_amount"] = max(q.get("amount", 0) - q["paid_amount"], 0)
            percent = (q['paid_amount'] / q.get('amount', 0) * 100) if q.get('amount', 0) else 0
            # Status logic
            if percent == 0:
                q["status"] = "initial"
            elif 20 <= percent < 40:
                q["status"] = "partial"
            elif 50 <= percent < 80:
                q["status"] = "few"
            elif 80 <= percent < 100:
                q["status"] = "remaining"
            elif percent == 100:
                q["status"] = "completed"
            else:
                q["status"] = "draft"
            if "created_at" not in q:
                q["created_at"] = datetime.now()
            if "expiry_date" not in q:
                q["expiry_date"] = q["created_at"] + timedelta(days=45)
            total_amount += q.get("amount", 0) or 0
            acceptance_amount += q["paid_amount"] or 0
            
        acceptance_rate = (acceptance_amount / total_amount * 100) if total_amount > 0 else 0.0
        
        return {
            "quotations": jsonable_encoder(quotations),
            "summary": {
                "total_amount": total_amount,
                "acceptance_amount": acceptance_amount,
                "acceptance_rate": round(acceptance_rate, 2),
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting quotations for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving quotations: {str(e)}")

    # DUMMY: Calculate total expenses as 60% of total_amount for demonstration
    total_expenses = total_amount * 0.6

    return {
        "quotations": jsonable_encoder(quotations),
        "summary": {
            "total_amount": total_amount,
            "acceptance_amount": acceptance_amount,
            "acceptance_rate": round(acceptance_rate, 2),
            "total_expenses": total_expenses,   # <-- NEW LINE
        }
    }



@quotation_router.get("/monthly_summary")
async def monthly_summary():
    from collections import defaultdict
    import calendar
    monthly_revenue = defaultdict(float)
    for q in quotations_collection.find({}):
        dt = q.get("created_at")
        if not dt:
            continue
        month = dt.month
        monthly_revenue[month] += q.get("amount", 0)
    months = sorted(monthly_revenue.keys())
    labels = [calendar.month_abbr[m] for m in months]
    data = [monthly_revenue[m] for m in months]
    return {"labels": labels, "data": data}

@quotation_router.get("/user/{user_id}")
async def get_user_quotations(
    user_id: str,
    status: Optional[str] = Query(None, description="Filter by quotation status"),
    limit: int = Query(100, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get quotations for a specific user based on their hierarchy permissions"""
    try:
        db = get_database()
        
        # Get user hierarchy information
        user, user_roles = get_user_role_hierarchy(db, user_id)
        
        # If user is top-level or has subordinates, show subordinate quotations
        subordinates = get_all_subordinates_recursive(db, user_id)
        is_top_level = is_top_level_user(db, user_id)
        
        if is_top_level or subordinates:
            # User can see subordinate quotations
            subordinate_ids = [sub["user_id"] for sub in subordinates]
            subordinate_ids.append(user_id)  # Include user's own quotations
            
            # Get leads assigned to user and subordinates
            leads_query = {"assigned_to": {"$in": subordinate_ids}}
            user_leads = list(db.leads.find(leads_query, {"lead_id": 1, "assigned_to": 1}))
            user_lead_ids = [lead.get("lead_id") for lead in user_leads if lead.get("lead_id")]
            
            if not user_lead_ids:
                return make_serializable({
                    "success": True,
                    "quotations": [],
                    "total": 0,
                    "user_permissions": {
                        "is_top_level": is_top_level,
                        "subordinates_count": len(subordinates),
                        "can_see_all": is_top_level
                    }
                })
            
            # Build quotation query
            query = {"lead_id": {"$in": user_lead_ids}}
            
            if status:
                query["status"] = status
            
            # Get quotations
            quotations = list(quotations_collection.find(query).skip(skip).limit(limit))
            total = quotations_collection.count_documents(query)
            
            # Enrich quotations with assigned user info
            for quotation in quotations:
                quotation["_id"] = str(quotation["_id"])
                if quotation.get("lead_id"):
                    # Find the lead to get assigned user info
                    related_lead = next((lead for lead in user_leads if lead.get("lead_id") == quotation["lead_id"]), None)
                    if related_lead and related_lead.get("assigned_to"):
                        assigned_user = get_user_by_id(db, related_lead["assigned_to"])
                        if assigned_user:
                            quotation["assigned_user_info"] = {
                                "user_id": assigned_user.get("user_id"),
                                "name": assigned_user.get("full_name", ""),
                                "email": assigned_user.get("email", "")
                            }
        else:
            # User can only see their own quotations
            # Get leads assigned to user only
            user_leads = list(db.leads.find({"assigned_to": user_id}, {"lead_id": 1}))
            user_lead_ids = [lead.get("lead_id") for lead in user_leads if lead.get("lead_id")]
            
            if not user_lead_ids:
                return make_serializable({
                    "success": True,
                    "quotations": [],
                    "total": 0,
                    "user_permissions": {
                        "is_top_level": False,
                        "subordinates_count": 0,
                        "can_see_all": False
                    }
                })
            
            # Build quotation query for user's own quotations only
            query = {"lead_id": {"$in": user_lead_ids}}
            
            if status:
                query["status"] = status
            
            # Get quotations
            quotations = list(quotations_collection.find(query).skip(skip).limit(limit))
            total = quotations_collection.count_documents(query)
            
            # Add user info to quotations
            for quotation in quotations:
                quotation["_id"] = str(quotation["_id"])
                quotation["assigned_user_info"] = {
                    "user_id": user.get("user_id"),
                    "name": user.get("full_name", ""),
                    "email": user.get("email", "")
                }
        
        # Calculate summary
        total_amount = sum(q.get("amount", 0) for q in quotations)
        acceptance_amount = sum(q.get("paid_amount", 0) for q in quotations)
        acceptance_rate = (acceptance_amount / total_amount * 100) if total_amount > 0 else 0.0
        
        return make_serializable({
            "success": True,
            "quotations": quotations,
            "total": total,
            "summary": {
                "total_amount": total_amount,
                "acceptance_amount": acceptance_amount,
                "acceptance_rate": round(acceptance_rate, 2)
            },
            "user_permissions": {
                "is_top_level": is_top_level,
                "subordinates_count": len(subordinates),
                "can_see_all": is_top_level or len(subordinates) > 0
            },
            "limit": limit,
            "skip": skip
        })
        
    except Exception as e:
        logger.error(f"Error getting user quotations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user quotations: {str(e)}")

# Hierarchy endpoints for quotations
@quotation_router.get("/hierarchy/{user_id}")
async def get_user_quotations_hierarchy(user_id: str):
    """Get quotation hierarchy for a specific user"""
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
            "can_see_unassigned": can_see_unassigned_quotations(db, user_id),
            "direct_subordinates": get_direct_subordinates(db, user_id),
            "all_subordinates": get_all_subordinates_recursive(db, user_id)
        }
        
        return make_serializable({
            "success": True,
            "hierarchy": hierarchy
        })
        
    except Exception as e:
        logger.error(f"Error getting quotation hierarchy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get quotation hierarchy: {str(e)}")

@quotation_router.get("/subordinate-quotations/{manager_id}")
async def get_subordinate_quotations(
    manager_id: str,
    status: Optional[str] = Query(None, description="Filter by quotation status"),
    limit: int = Query(100, description="Limit number of results"),
    skip: int = Query(0, description="Skip number of results")
):
    """Get all quotations assigned to subordinates of a manager"""
    try:
        db = get_database()
        
        # Get all subordinates
        subordinates = get_all_subordinates_recursive(db, manager_id)
        subordinate_ids = [sub["user_id"] for sub in subordinates]
        
        if not subordinate_ids:
            return make_serializable({
                "success": True,
                "quotations": [],
                "total": 0,
                "subordinates": []
            })
        
        # Build query (quotations don't have assigned_to field traditionally, so we'll filter by related leads)
        # First get leads assigned to subordinates
        leads_query = {"assigned_to": {"$in": subordinate_ids}}
        subordinate_leads = list(db.leads.find(leads_query, {"lead_id": 1, "assigned_to": 1}))
        subordinate_lead_ids = [lead.get("lead_id") for lead in subordinate_leads if lead.get("lead_id")]
        
        if not subordinate_lead_ids:
            return make_serializable({
                "success": True,
                "quotations": [],
                "total": 0,
                "subordinates": subordinates
            })
        
        # Build quotation query
        query = {"lead_id": {"$in": subordinate_lead_ids}}
        
        if status:
            query["status"] = status
        
        # Get quotations
        quotations = list(quotations_collection.find(query).skip(skip).limit(limit))
        total = quotations_collection.count_documents(query)
        
        # Enrich quotations with assigned user info
        for quotation in quotations:
            quotation["_id"] = str(quotation["_id"])
            if quotation.get("lead_id"):
                # Find the lead to get assigned user info
                related_lead = next((lead for lead in subordinate_leads if lead.get("lead_id") == quotation["lead_id"]), None)
                if related_lead and related_lead.get("assigned_to"):
                    assigned_user = get_user_by_id(db, related_lead["assigned_to"])
                    if assigned_user:
                        quotation["assigned_user_info"] = {
                            "user_id": assigned_user.get("user_id"),
                            "name": assigned_user.get("full_name", ""),
                            "email": assigned_user.get("email", "")
                        }
        
        return make_serializable({
            "success": True,
            "quotations": quotations,
            "total": total,
            "subordinates": subordinates,
            "limit": limit,
            "skip": skip
        })
        
    except Exception as e:
        logger.error(f"Error getting subordinate quotations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get subordinate quotations: {str(e)}")

@quotation_router.get("/organization-hierarchy")
async def get_quotations_organization_hierarchy():
    """Get complete organization hierarchy with quotation statistics"""
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
                        # Count quotations for leads assigned to this user
                        user_leads = list(db.leads.find({"assigned_to": user.get("user_id")}, {"lead_id": 1}))
                        user_lead_ids = [lead.get("lead_id") for lead in user_leads if lead.get("lead_id")]
                        quotations_count = quotations_collection.count_documents({"lead_id": {"$in": user_lead_ids}}) if user_lead_ids else 0
                        
                        user_data = {
                            "user_id": user.get("user_id"),
                            "name": user.get("full_name", ""),
                            "email": user.get("email", ""),
                            "phone": user.get("phone", ""),
                            "department": user.get("department", ""),
                            "quotations_count": quotations_count,
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
        logger.error(f"Error getting quotations organization hierarchy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get quotations organization hierarchy: {str(e)}")

