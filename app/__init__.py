from fastapi import FastAPI, Query
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routes.auth import auth_router
from app.routes.roles import roles_router
from app.routes.admin import admin_router
from app.routes.lead import lead_router
import logging,os
from app.routes.permission import permission_router
from app.routes.leads import leads_router
from app.routes.followup import followup_router
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
import logging

# Create a backward compatibility router for singular 'followup' paths
followup_compat_router = APIRouter(prefix="/api/followup", tags=["followup-compat"])

@followup_compat_router.get("/user/{user_id}", response_model=List[dict])
async def compat_get_user_followups(
    user_id: str, 
    date: str = Query(None, description="Filter by date (YYYY-MM-DD)"),
    current_user: dict = Depends(lambda: {"user_id": "system"})  # Temporary bypass for debugging
):
    """Backward compatibility endpoint for /api/followup/user/{user_id}"""
    try:
        from app.database import followups_collection
        from datetime import datetime
        from bson import ObjectId
        
        logger = logging.getLogger(__name__)
        logger.info(f"Compat: User followups requested for user {user_id}, date filter: {date}")
        
        # Build query with optional date filter
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
        
        logger.info(f"Compat: Retrieved {len(processed_followups)} followups for user {user_id}")
        return processed_followups
        
    except HTTPException:
        raise
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"ERROR in compat_get_user_followups for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user follow-ups: {str(e)}")
from app.routes.quotation import quotation_router
from app.routes.customer import customer_router
from app.routes.loyalty import loyalty_router
from app.routes.staff_management import staff_router
from app.routes.payment_expense import payment_router
from app.routes.task import task_router
from app.routes.duplicates import duplicates_router
from app.routes.ticket import ticket_router
from app.routes.document import document_router
from app.routes.reports import reports_router
from app.routes.mobile import mobile_router
from app.routes.admin import admin_router
from app.routes.users import users_router
from app.routes.assigned_leads import assigned_leads_router
from app.routes.assigned_leads2 import assigned_leads2_router
from app.routes.employees_new import employees_router as yelop
from app.routes.duplicates import duplicates_router  # Import the duplicates router
from app.routes.hrstaffroute import hr_staff_router  # Import the HR staff router
from app.routes.meta_leads import meta_leads_router  # Import the Meta leads router
from app.routes.access_check import access_router  # Import the access check router
from app.routes.meta_tokens import meta_tokens_router  # Import the Meta tokens router
# Hospital HIS routes
from app.routes.appointments import appointments_router
from app.routes.patients import patients_router
from app.routes.doctors import doctors_router
from app.routes.departments import departments_router
from app.routes.insurance import insurance_router
from app.routes.opd import opd_router
from app.routes.ipd import ipd_router
from app.routes.pharmacy import pharmacy_router
from app.routes.laboratory import laboratory_router
from app.routes.radiology import radiology_router
from app.routes.blood_bank import blood_bank_router
from app.routes.ot_management import ot_router
from app.routes.emr import emr_router
from app.routes.nursing import nursing_router
from app.routes.teleconsultation import teleconsult_router
from app.routes.billing import billing_router
from app.routes.hospitals import hospitals_router
from app.routes.super_admin import super_admin_router

# Create the FastAPI app
app = FastAPI(
    title="B2B CRM API",
    description="API for B2B CRM System",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://cubehis.avopay.pro:5000",
    "https://cubehis.avopay.pro",
    "http://cubehis.avopay.pro",
    "https://cubehis.avopay.pro:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ONLY the auth router for now
app.include_router(auth_router)
app.include_router(roles_router)
app.include_router(admin_router)
app.include_router(permission_router)
app.include_router(lead_router)
app.include_router(leads_router)
app.include_router(followup_router)
app.include_router(followup_compat_router)
app.include_router(quotation_router)
app.include_router(customer_router)
app.include_router(loyalty_router)
app.include_router(staff_router)
app.include_router(payment_router)
app.include_router(task_router)
app.include_router(ticket_router)
# Include duplicates_router for both endpoints
app.include_router(duplicates_router, prefix="/api/duplicates", tags=["duplicates"])
# Also include duplicates_router with a different prefix for the alternate path
app.include_router(duplicates_router, prefix="/api", tags=["duplicates-alt"], include_in_schema=False)
app.include_router(document_router)
app.include_router(reports_router)
app.include_router(mobile_router) 
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(assigned_leads_router)
app.include_router(assigned_leads2_router)
app.include_router(yelop)
app.include_router(duplicates_router, tags=["duplicates"])
app.include_router(hr_staff_router)  # Include the HR staff router
app.include_router(meta_leads_router)  # Include the Meta leads router
app.include_router(meta_tokens_router, prefix="/api")  # Include the Meta tokens router
app.include_router(access_router, prefix="/api")  # Include the access check router
# Hospital HIS routers
app.include_router(appointments_router)
app.include_router(patients_router)
app.include_router(doctors_router)
app.include_router(departments_router)
app.include_router(insurance_router)
app.include_router(opd_router)
app.include_router(ipd_router)
app.include_router(pharmacy_router)
app.include_router(laboratory_router)
app.include_router(radiology_router)
app.include_router(blood_bank_router)
app.include_router(ot_router)
app.include_router(emr_router)
app.include_router(nursing_router)
app.include_router(teleconsult_router)
app.include_router(billing_router)
app.include_router(hospitals_router)
app.include_router(super_admin_router)
# Initialize logging
logging.info("Roles router initialized and registered")
logging.info("HR Staff router initialized and registered")
logging.info("Meta leads router initialized and registered")

# Auto-start Meta leads scheduler
@app.on_event("startup")
async def startup_event():
    """Auto-start background services on app startup"""
    try:
        from app.services.meta_scheduler import start_meta_scheduler
        await start_meta_scheduler()
        logging.info("Meta leads scheduler auto-started on app startup")
    except Exception as e:
        logging.error(f"Failed to auto-start Meta leads scheduler: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop background services on app shutdown"""
    try:
        from app.services.meta_scheduler import stop_meta_scheduler
        await stop_meta_scheduler()
        logging.info("Meta leads scheduler stopped on app shutdown")
    except Exception as e:
        logging.error(f"Failed to stop Meta leads scheduler: {str(e)}")
# Debug HR Staff router routes
for route in hr_staff_router.routes:
    logging.info(f"HR Staff route registered: {route.path} [{', '.join(route.methods)}]")
os.makedirs("employee_document", exist_ok=True)

app.mount("/css", StaticFiles(directory="app/static/css"), name="css")
app.mount("/js", StaticFiles(directory="app/static/js"), name="js")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/uploaded_pdfs", StaticFiles(directory="uploaded_pdfs"), name="uploaded_pdfs")
app.mount("/employee_document", StaticFiles(directory="employee_document"), name="employee_document")
app.mount(
    "/kyc_document",
    StaticFiles(directory="static/kyc_document"),
    name="kyc_document"
)
# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "B2B CRM API",
        "version": "1.0.0",
        "status": "running",
        "timestamp": "2025-05-29 11:49:41",
        "user": "soheru"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": "2025-05-29 11:49:41"
    }
    
@app.get("/index")
async def index():
    """Index endpoint for testing"""
    return FileResponse("app/static/index.html")

# Debug endpoint to check registered routes
@app.get("/debug/routes")
async def list_routes():
    """List all registered routes (admin or dev use only)"""
    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name if hasattr(route, "name") else None,
            })
    return {"routes": routes}

# Lead activities endpoint (redirect to leads router)
@app.get("/api/lead-activities")
async def get_all_lead_activities(
    lead_id: Optional[str] = Query(None, description="Filter by specific lead ID"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page")
):
    """
    Retrieve lead activities with pagination.
    This is a convenience endpoint that forwards to the leads router.
    """
    from app.routes.leads import get_lead_activities
    return await get_lead_activities(lead_id=lead_id, page=page, limit=limit)
