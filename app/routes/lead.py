from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, BackgroundTasks
from typing import List, Optional
from app.database.schemas.lead_schema import LeadCreate, LeadUpdate, LeadResponse, LeadStatus, LeadSource
from app.database.repositories.lead_repository import LeadRepository
from app.dependencies import get_current_user
from datetime import datetime
from app.database import db

# Create router - make sure the name matches what's imported in __init__.py
lead_router = APIRouter(prefix="/api/leads", tags=["leads"])

# Default leads data
DEFAULT_LEADS = [
    {
        "full_name": "Rajesh Kumar",
        "company": "ABC Industries",
        "email": "rajesh@abc-industries.com",
        "phone": "+91 9876543210",
        "source": "website",
        "status": "hot",
        "requirements": "Looking for complete inventory management system with POS integration",
        "notes": "Decision maker, budget approved for Q2"
    },
    {
        "full_name": "Priya Sharma",
        "company": "Sunshine Exports",
        "email": "p.sharma@sunshine-exports.com",
        "phone": "+91 8765432109",
        "source": "whatsapp",
        "status": "warm",
        "requirements": "Needs export documentation management solution",
        "notes": "Currently using competitor product, unhappy with support"
    },
    {
        "full_name": "Anil Agarwal",
        "company": "Tech Solutions Ltd",
        "email": "anil@techsolutions.in",
        "phone": "+91 7654321098",
        "source": "referral",
        "status": "cold",
        "requirements": "Cloud-based CRM with API access",
        "notes": "Referred by existing client, price sensitive"
    },
    {
        "full_name": "Sneha Patel",
        "company": "Green Organics",
        "email": "sneha@greenorganics.com",
        "phone": "+91 9876543211",
        "source": "facebook",
        "status": "new",
        "requirements": "Supply chain management for organic produce",
        "notes": "Initial inquiry via Facebook page"
    },
    {
        "full_name": "Vikram Singh",
        "company": "Royal Enterprises",
        "email": "vikram@royal.in",
        "phone": "+91 8765432100",
        "source": "email",
        "status": "converted",
        "requirements": "Franchise management solution",
        "notes": "Already purchased base package, potential for upsell"
    }
]

@lead_router.get("/debug")
async def debug_leads_api(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to test API connectivity and database access"""
    try:
        # Create repository instance
        lead_repo = LeadRepository()
        
        # Get count of leads
        count = len(lead_repo.list_leads(limit=5))
        
        collections = db.list_collection_names()
        
        return {
            "status": "ok",
            "user": current_user,
            "lead_count": count,
            "collections": collections,
            "timestamp": datetime.now()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug error: {str(e)}"
        )

@lead_router.post("/", response_model=LeadResponse)
async def create_lead(lead: LeadCreate, current_user: dict = Depends(get_current_user)):
    """Create a new lead with duplicate prevention"""
    try:
        lead_repo = LeadRepository()
        lead_dict = lead.dict()
        
        # Check for existing lead with same email or phone
        existing_lead = None
        if lead_dict.get("email"):
            existing_lead = lead_repo.get_lead_by_email(lead_dict["email"])
        
        if not existing_lead and lead_dict.get("phone"):
            existing_lead = lead_repo.get_lead_by_phone(lead_dict["phone"])
            
        # If lead exists, update it instead of creating duplicate
        if existing_lead:
            print(f"Found existing lead with id {existing_lead['id']}, updating instead of creating duplicate")
            lead_dict["updated_at"] = datetime.now()
            updated_lead = lead_repo.update_lead(existing_lead["id"], lead_dict)
            return updated_lead
        
        # No existing lead found, create new one
        lead_dict["created_by"] = current_user.get("id")
        if not lead_dict.get("assigned_to"):
            lead_dict["assigned_to"] = current_user.get("id")
            
        created_lead = lead_repo.create_lead(lead_dict)
        if not created_lead:
            raise HTTPException(status_code=500, detail="Failed to create lead")
            
        return created_lead
        
    except Exception as e:
        print(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating lead: {str(e)}")

@lead_router.get("/", response_model=List[LeadResponse])
async def list_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[LeadStatus] = None,
    source: Optional[LeadSource] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List leads with optional filtering"""
    try:
        # Create repository instance
        lead_repo = LeadRepository()
        
        # Build filters
        filters = {}
        
        if status:
            filters["status"] = status
            
        if source:
            filters["source"] = source
            
        if assigned_to:
            filters["assigned_to"] = assigned_to
            
        if search:
            # Simple text search in name, company, or email
            filters["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"company": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
        
        # Get leads
        leads = lead_repo.list_leads(filters=filters, skip=skip, limit=limit)
        
        return leads
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing leads: {str(e)}"
        )

@lead_router.get("/check-leads-exist")
async def check_if_leads_exist(current_user: dict = Depends(get_current_user)):
    """Check if any leads exist in the system"""
    try:
        # Create repository instance
        lead_repo = LeadRepository()
        
        # Check if leads exist
        leads = lead_repo.list_leads(limit=1)
        has_leads = len(leads) > 0
        
        return {"has_leads": has_leads}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking leads: {str(e)}"
        )

@lead_router.post("/create-default-leads", response_model=List[LeadResponse])
async def add_default_leads(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create default leads for demonstration purposes"""
    try:
        # Create repository instance
        lead_repo = LeadRepository()
        
        # Check if leads exist
        leads = lead_repo.list_leads(limit=1)
        if len(leads) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Default leads cannot be created as there are already leads in the system"
            )
        
        created_leads = []
        
        # Create each default lead
        for lead_data in DEFAULT_LEADS:
            # Add creator info
            lead_data["created_by"] = current_user.get("id")
            
            # Assign some leads to the current user
            if lead_data["full_name"] in ["Rajesh Kumar", "Priya Sharma", "Vikram Singh"]:
                lead_data["assigned_to"] = current_user.get("id")
            
            created_lead = lead_repo.create_lead(lead_data)
            created_leads.append(created_lead)
        
        return created_leads
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating default leads: {str(e)}"
        )
        
@lead_router.get("/test-db-connection", response_model=dict)
async def test_db_connection():
    """Test database connection"""
    try:
        
        # Check if can list collections
        collections = db.list_collection_names()
        
        # Try counting documents in leads collection
        leads_count = db.leads.count_documents({})
        
        # Try a simple insert and delete to verify write permissions
        test_id = db.test_collection.insert_one({"test": True, "timestamp": datetime.now()}).inserted_id
        db.test_collection.delete_one({"_id": test_id})
        
        return {
            "success": True,
            "collections": collections,
            "leads_count": leads_count,
            "message": "Database connection successful"
        }
    except Exception as e:
        print(f"[ERROR] Database connection test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "message": "Database connection failed"
        }