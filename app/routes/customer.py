from fastapi import APIRouter, HTTPException, status, Body
from typing import List, Optional
from app.database.schemas.customer_schema import (
    CustomerProfileModel, FeedbackModel, CommunicationLogModel, TransactionModel, NoteModel, LoyaltyModel, ComplaintModel, ActivityLogModel
)
from app.database import (
    customers_collection,
    feedbacks_collection,
    logs_collection,
    transactions_collection,
    notes_collection,
    loyalty_collection,
    complaints_collection,
    activity_logs_collection,
    orders_collection
    
    
    
)
from bson import ObjectId
from datetime import datetime

customer_router = APIRouter(prefix="/api/customers", tags=["customers"])

def obj_id_to_str(doc):
    if "id" not in doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc

# --- Customer CRUD ---

from fastapi import UploadFile, File, Form

@customer_router.post("/", response_model=CustomerProfileModel)
async def create_customer(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: str = Form(...),
    city: str = Form(None),
    state: str = Form(None),
    country: str = Form(None),
    company: str = Form(None),
    job_title: str = Form(None),
    customer_type: str = Form("regular"),
    status: str = Form("active"),
    lifetime_value: float = Form(0.0),
    preferences: str = Form("{}"),
    tags: str = Form("") ,
    profile_picture: UploadFile = File(None)
):
    # Parse preferences and tags robustly
    import json
    # Parse preferences (should be a JSON string or dict)
    if isinstance(preferences, dict):
        preferences_dict = preferences
    else:
        try:
            preferences_dict = json.loads(preferences) if preferences else {}
        except Exception:
            preferences_dict = {}

    # Parse tags (should be a comma-separated string or list)
    if isinstance(tags, list):
        tags_list = [str(t).strip() for t in tags if str(t).strip()]
    else:
        tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    # Ensure lifetime_value is float
    try:
        lifetime_value = float(lifetime_value)
    except Exception:
        lifetime_value = 0.0

    # Duplicate check
    existing = customers_collection.find_one({
        "$or": [
            {"email": email},
            {"mailid": email},
            {"email_id": email},
            {"phone": phone},
            {"mobile": phone},
            {"contact": phone},
        ]
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Customer with this email or phone number already exists."
        )

    last_customer = customers_collection.find_one({"id": {"$regex": "^cus-\\d+$"}}, sort=[("id", -1)])
    new_id_num = int(last_customer["id"].replace("cus-", "")) + 1 if last_customer and "id" in last_customer else 1
    custom_id = f"cus-{new_id_num:03d}"

    # Handle file upload: save to /uploaded_pdfs/customer_{custom_id}/profile{ext}
    import os
    profile_picture_url = None
    if profile_picture is not None:
        # Create a subdirectory for each customer
        upload_dir = os.path.join("uploaded_pdfs", f"customer_{custom_id}")
        os.makedirs(upload_dir, exist_ok=True)
        file_ext = os.path.splitext(profile_picture.filename)[-1]
        file_name = f"profile{file_ext}"
        file_path = os.path.join(upload_dir, file_name)
        with open(file_path, "wb") as f:
            f.write(await profile_picture.read())
        # Store the URL as a relative path for frontend access
        profile_picture_url = f"/{file_path}"

    current_time = datetime.now()
    doc = {
        "id": custom_id,
        "name": name,
        "email": email,
        "phone": phone,
        "address": address,
        "city": city,
        "state": state,
        "country": country,
        "company": company,
        "job_title": job_title,
        "customer_type": customer_type,
        "status": status,
        "lifetime_value": lifetime_value,
        "preferences": preferences_dict,
        "tags": tags_list,
        "profile_picture": profile_picture_url,
        "created_at": current_time,
        "updated_at": current_time
    }
    result = customers_collection.insert_one(doc)
    inserted_doc = customers_collection.find_one({"_id": result.inserted_id})
    if inserted_doc:
        return obj_id_to_str(inserted_doc)
    return doc

@customer_router.get("/{customer_id}", response_model=CustomerProfileModel)
async def get_customer_profile(customer_id: str):
    doc = None
    if ObjectId.is_valid(customer_id):
        doc = customers_collection.find_one({"_id": ObjectId(customer_id)})
    if not doc:
        doc = customers_collection.find_one({"id": customer_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")

    doc = obj_id_to_str(doc)

    # Always provide both created_at and joined_on
    if "created_at" in doc:
        doc["joined_on"] = doc.get("joined_on", doc["created_at"])
    else:
        doc["created_at"] = doc["joined_on"] = ""

    # Always provide both profile_picture and avatar_url
    if "profile_picture" in doc and doc["profile_picture"]:
        doc["avatar_url"] = doc.get("avatar_url", doc["profile_picture"])
    else:
        doc["profile_picture"] = doc.get("avatar_url", "")
        doc["avatar_url"] = doc.get("avatar_url", "")

    # Always provide name, email, phone, etc. as empty string if missing
    for field in ["name", "email", "phone", "address", "city", "state", "country", "company", "job_title", "customer_type", "status"]:
        if field not in doc or doc[field] is None:
            doc[field] = ""

    # Map birthday to date_of_birth for frontend compatibility
    if "birthday" in doc and "date_of_birth" not in doc:
        doc["date_of_birth"] = doc["birthday"]

    return doc

@customer_router.put("/{customer_id}", response_model=CustomerProfileModel)
async def update_customer(customer_id: str, profile: CustomerProfileModel):
    query = {"id": customer_id} if customer_id.startswith("cus-") else {"_id": ObjectId(customer_id)}
    update_doc = {k: v for k, v in profile.dict(exclude_unset=True).items() if k not in ("id", "_id", "created_at")}
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update.")
    
    # Always update the updated_at field
    update_doc["updated_at"] = datetime.now()
    
    result = customers_collection.update_one(query, {"$set": update_doc})
    
    if not result.modified_count:
        # Check if the customer exists but no changes were made
        if customers_collection.find_one(query):
            doc = customers_collection.find_one(query)
            return obj_id_to_str(doc)
        # If customer doesn't exist
        raise HTTPException(status_code=404, detail="Customer not found")
    
    doc = customers_collection.find_one(query)
    return obj_id_to_str(doc)

@customer_router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: str):
    query = {"id": customer_id} if customer_id.startswith("cus-") else {"_id": ObjectId(customer_id)}
    result = customers_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return

@customer_router.get("/", response_model=List[CustomerProfileModel])
async def get_all_customers(
    status: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    country: Optional[str] = None,
    tags: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    skip: int = 0,
    limit: int = 100
):
    query = {}
    
    # Apply filters
    if status:
        query["status"] = status
        
    if email:
        query["$or"] = [
            {"email": email},
            {"mailid": email},
            {"email_id": email},
        ]
        
    if phone:
        phone_query = [
            {"phone": phone},
            {"mobile": phone},
            {"contact": phone},
        ]
        query["$or"] = query.get("$or", []) + phone_query if "$or" in query else phone_query
        
    if customer_type:
        query["customer_type"] = customer_type
        
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
        
    if state:
        query["state"] = {"$regex": state, "$options": "i"}
        
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
        
    if tags:
        query["tags"] = {"$in": [tag.strip() for tag in tags.split(",")]}
        
    if search:
        search_query = [
            {"name": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"id": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"job_title": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
            {"state": {"$regex": search, "$options": "i"}},
            {"country": {"$regex": search, "$options": "i"}},
        ]
        query["$or"] = query.get("$or", []) + search_query if "$or" in query else search_query
    
    # Determine sort direction
    sort_direction = -1 if sort_order.lower() == "desc" else 1
    
    # Get and process results
    docs = list(customers_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit))
    for doc in docs:
        obj_id_to_str(doc)
    
    return docs

# --- Notes Endpoints ---

@customer_router.post("/{customer_id}/notes", response_model=NoteModel)
async def add_customer_note(customer_id: str, note: NoteModel):
    note_doc = note.dict(exclude_unset=True)
    note_doc["customer_id"] = customer_id
    note_doc["created_at"] = note_doc.get("created_at") or datetime.now()

    # Handle frontend specific fields
    if "author" in note_doc and "user_id" not in note_doc:
        note_doc["user_id"] = note_doc.pop("author")
    # Always ensure user_id is present for Pydantic validation
    if not note_doc.get("user_id"):
        note_doc["user_id"] = "User"

    # Now validate with NoteModel before inserting
    note_model = NoteModel(**note_doc)
    result = notes_collection.insert_one(note_model.dict(exclude_unset=True))
    note_doc["id"] = str(result.inserted_id)
    return note_model

@customer_router.get("/{customer_id}/notes", response_model=List[NoteModel])
async def get_customer_notes(customer_id: str):
    notes = [NoteModel(**obj_id_to_str(note)) for note in notes_collection.find({"customer_id": customer_id})]
    return notes

# --- Communication Log Endpoints ---

@customer_router.post("/{customer_id}/communication", response_model=CommunicationLogModel)
async def add_communication_log(customer_id: str, log: CommunicationLogModel):
    log_doc = log.dict(exclude_unset=True)
    log_doc["customer_id"] = customer_id
    from pytz import timezone
    india = timezone('Asia/Kolkata')
    import datetime as dt
    log_doc["time"] = log_doc.get("time") or dt.datetime.now(india)
    
    # Handle frontend specific fields
    if "message" in log_doc and "content" not in log_doc:
        log_doc["content"] = log_doc.pop("message")
    if "by" in log_doc and "agent_id" not in log_doc:
        log_doc["agent_id"] = log_doc.pop("by")
    
    result = logs_collection.insert_one(log_doc)
    log_doc["id"] = str(result.inserted_id)
    return CommunicationLogModel(**log_doc)

@customer_router.get("/{customer_id}/communication", response_model=List[CommunicationLogModel])
async def get_communication_logs(customer_id: str):
    logs = [CommunicationLogModel(**obj_id_to_str(log)) for log in logs_collection.find({"customer_id": customer_id})]
    return logs

# --- Feedback Endpoints ---

@customer_router.post("/{customer_id}/feedback", response_model=FeedbackModel)
async def add_customer_feedback(customer_id: str, feedback: FeedbackModel):
    fb_doc = feedback.dict(exclude_unset=True)
    fb_doc["customer_id"] = customer_id
    fb_doc["date"] = fb_doc.get("date") or datetime.now()
    
    # Handle frontend specific fields
    if "comment" in fb_doc and "content" not in fb_doc:
        fb_doc["content"] = fb_doc.pop("comment")
    if "user_id" not in fb_doc:
        fb_doc["user_id"] = "User"  # Default user_id if not provided
        
    result = feedbacks_collection.insert_one(fb_doc)
    fb_doc["id"] = str(result.inserted_id)
    return FeedbackModel(**fb_doc)

@customer_router.get("/{customer_id}/feedback", response_model=List[FeedbackModel])
async def get_customer_feedbacks(customer_id: str):
    feedbacks = []
    for fb in feedbacks_collection.find({"customer_id": customer_id}):
        fb = obj_id_to_str(fb)
        # Map 'content' to 'comment' for frontend compatibility
        if "content" in fb and "comment" not in fb:
            fb["comment"] = fb["content"]
        # Only filter out truly empty feedbacks (no comment/content/rating)
        has_text = (fb.get("comment") and str(fb["comment"]).strip() != "") or (fb.get("content") and str(fb["content"]).strip() != "")
        has_rating = isinstance(fb.get("rating"), int) and fb["rating"] > 0
        if has_text or has_rating:
            feedbacks.append(FeedbackModel(**fb))
    return feedbacks

# --- Loyalty Endpoints ---

@customer_router.post("/{customer_id}/loyalty", response_model=LoyaltyModel)
async def update_customer_loyalty(customer_id: str, loyalty: LoyaltyModel):
    loyalty_doc = loyalty.dict(exclude_unset=True)
    loyalty_doc["customer_id"] = customer_id
    loyalty_doc["date"] = loyalty_doc.get("date") or datetime.now()
    result = loyalty_collection.insert_one(loyalty_doc)
    loyalty_doc["id"] = str(result.inserted_id)
    return LoyaltyModel(**loyalty_doc)

from fastapi import Response
from fastapi.responses import JSONResponse

@customer_router.get("/{customer_id}/loyalty")
async def get_customer_loyalty(customer_id: str):
    # Fetch all loyalty entries for the customer
    loyalty_history = []
    total_points = 0
    for item in loyalty_collection.find({"customer_id": customer_id}):
        item = obj_id_to_str(item)
        # Map to frontend expected format
        points = item.get("points", 0)
        total_points += points
        # Format change field for frontend
        item["change"] = f"+{points}" if points >= 0 else f"{points}"
        loyalty_history.append(item)
    return {"total_points": total_points, "history": loyalty_history}

# --- Complaints Endpoints (for history and tab) ---

@customer_router.post("/{customer_id}/complaints", response_model=ComplaintModel)
async def add_customer_complaint(customer_id: str, complaint: ComplaintModel):
    comp_doc = complaint.dict(exclude_unset=True)
    comp_doc["customer_id"] = customer_id
    comp_doc["created_at"] = comp_doc.get("created_at") or datetime.now()
    
    # Add date for frontend compatibility
    if "date" not in comp_doc:
        comp_doc["date"] = comp_doc["created_at"]
    
    result = complaints_collection.insert_one(comp_doc)
    comp_doc["id"] = str(result.inserted_id)
    return ComplaintModel(**comp_doc)

@customer_router.get("/{customer_id}/complaints", response_model=List[ComplaintModel])
async def get_customer_complaints(customer_id: str):
    complaints = [ComplaintModel(**obj_id_to_str(comp)) for comp in complaints_collection.find({"customer_id": customer_id})]
    return complaints


# --- Payments/Transactions Endpoints ---

@customer_router.get("/{customer_id}/payments", response_model=List[TransactionModel])
async def get_customer_payments(customer_id: str):
    txs = [TransactionModel(**obj_id_to_str(tx)) for tx in transactions_collection.find({"customer_id": customer_id})]
    return txs

# --- History Endpoint ---
@customer_router.get("/{customer_id}/history")
async def get_customer_history(customer_id: str):
    profile = None
    if ObjectId.is_valid(customer_id):
        profile = customers_collection.find_one({"_id": ObjectId(customer_id)})
    if not profile:
        profile = customers_collection.find_one({"id": customer_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Customer not found")
    profile = obj_id_to_str(profile)
    
    # Get payments sorted by timestamp (newest first)
    payment_transactions = list(transactions_collection.find({"customer_id": customer_id}).sort("timestamp", -1))
    payments = []
    for tx in payment_transactions:
        tx = obj_id_to_str(tx)
        # Map backend fields to frontend expected fields
        if "timestamp" in tx and "date" not in tx:
            tx["date"] = tx["timestamp"]
        if "payment_method" in tx and "mode" not in tx:
            tx["mode"] = tx["payment_method"]
        if "details" in tx and "remark" not in tx:
            tx["remark"] = tx["details"]
        if "reference_id" in tx and "order_id" not in tx:
            tx["order_id"] = tx["reference_id"]
        payments.append(tx)
    
    # Get complaints sorted by creation date (newest first)
    complaint_entries = list(complaints_collection.find({"customer_id": customer_id}).sort("created_at", -1))
    complaints = []
    for comp in complaint_entries:
        comp = obj_id_to_str(comp)
        # Map backend fields to frontend expected fields
        if "created_at" in comp and "date" not in comp:
            comp["date"] = comp["created_at"]
        complaints.append(comp)
    
    # Get communication logs sorted by time (newest first)
    communication_logs = list(logs_collection.find({"customer_id": customer_id}).sort("time", -1))
    communication = []
    for log in communication_logs:
        log = obj_id_to_str(log)
        # Map backend fields to frontend expected fields
        if "content" in log and "message" not in log:
            log["message"] = log["content"]
        if "agent_id" in log and "by" not in log:
            log["by"] = log["agent_id"]
        communication.append(log)
    # If no communication logs, create a default one
    if not communication:
        default_log = {
            "channel": "Email",
            "time": datetime.now(),
            "customer_id": customer_id,
            "content": "No communication log found. This is a default entry.",
            "agent_id": "User"
        }
        communication.append(default_log)
    
    # Get feedback sorted by date (newest first)
    feedback_entries = list(feedbacks_collection.find({"customer_id": customer_id}).sort("date", -1))
    feedback = []
    for fb in feedback_entries:
        fb = obj_id_to_str(fb)
        # Map backend fields to frontend expected fields
        if "content" in fb and "comment" not in fb:
            fb["comment"] = fb["content"]
        feedback.append(fb)
    
    # Calculate total loyalty points and get history (newest first)
    loyalty_history = list(loyalty_collection.find({"customer_id": customer_id}).sort("date", -1))
    loyalty_history_formatted = []
    
    for item in loyalty_history:
        item = obj_id_to_str(item)
        # Map to frontend expected format
        if "action" in item and item["action"] == "earn":
            item["change"] = f"+{item['points']}"
        elif "action" in item and item["action"] == "redeem":
            item["change"] = f"-{item['points']}"
        else:
            item["change"] = f"{item['points']}"
        
        loyalty_history_formatted.append(item)
    
    loyalty_points = {
        "total_points": sum(item.get("points", 0) for item in loyalty_history),
        "history": loyalty_history_formatted
    }
    
    # Get notes sorted by creation date (newest first)
    note_entries = list(notes_collection.find({"customer_id": customer_id}).sort("created_at", -1))
    notes = []
    for note in note_entries:
        note = obj_id_to_str(note)
        # Map backend fields to frontend expected fields
        if "user_id" in note and "author" not in note:
            note["author"] = note["user_id"]
        notes.append(note)
    
    # Get activity logs sorted by timestamp (newest first)
    activity_log_entries = list(activity_logs_collection.find({"customer_id": customer_id}).sort("timestamp", -1))
    activity_logs = []
    for log in activity_log_entries:
        log = obj_id_to_str(log)
        # Map backend fields to frontend expected fields
        if "description" in log and "details" not in log:
            log["details"] = log["description"]
        if "performed_by" in log and "user" not in log:
            log["user"] = log["performed_by"]
        if "timestamp" in log and "time" not in log:
            log["time"] = log["timestamp"]
        activity_logs.append(log)
    # Add metadata about the customer history
    customer_since = profile.get("created_at")
    days_as_customer = (datetime.now() - customer_since).days if customer_since else 0
    
    return {
        "profile": profile,
        "payments": payments,
        "complaints": complaints,
        "communication": communication,
        "feedback": feedback,
        "loyalty": loyalty_points,
        "notes": notes,
        "activity_logs": activity_logs,
        "metadata": {
            "customer_since": customer_since,
            "days_as_customer": days_as_customer,
            "total_payments": len(payments),
            "total_complaints": len(complaints),
            "total_communications": len(communication),
            "total_feedback": len(feedback),
            "loyalty_points": loyalty_points.get("total_points", 0)
        }
    }


# --- Activity Log Endpoints ---

@customer_router.post("/{customer_id}/activity_logs", response_model=ActivityLogModel)
async def add_customer_activity_log(customer_id: str, activity: ActivityLogModel):
    activity_doc = activity.dict(exclude_unset=True)
    activity_doc["customer_id"] = customer_id
    activity_doc["timestamp"] = activity_doc.get("timestamp") or datetime.now()
    # Map frontend fields to backend
    if "user" in activity_doc and "performed_by" not in activity_doc:
        activity_doc["performed_by"] = activity_doc.pop("user")
    if "details" in activity_doc and "description" not in activity_doc:
        activity_doc["description"] = activity_doc.pop("details")
    result = activity_logs_collection.insert_one(activity_doc)
    activity_doc["id"] = str(result.inserted_id)
    return ActivityLogModel(**activity_doc)

@customer_router.get("/{customer_id}/activity_logs", response_model=List[ActivityLogModel])
async def get_customer_activity_logs(customer_id: str):
    logs = [ActivityLogModel(**obj_id_to_str(log)) for log in activity_logs_collection.find({"customer_id": customer_id})]
    return logs

# --- Order Management Endpoints ---

@customer_router.post("/{customer_id}/orders")
async def add_customer_order(customer_id: str, order_data: dict):
    """Add a new order for a customer"""
    try:
        # Validate customer exists
        customer = None
        if ObjectId.is_valid(customer_id):
            customer = customers_collection.find_one({"_id": ObjectId(customer_id)})
        if not customer:
            customer = customers_collection.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Prepare order document
        order_doc = {
            **order_data,
            "customer_id": customer_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Insert order into orders collection
        result = orders_collection.insert_one(order_doc)
        order_doc["_id"] = result.inserted_id
        
        # Update customer's order count and revenue
        order_count_increment = 1
        revenue_increment = float(order_data.get("total_amount", 0))
        
        customers_collection.update_one(
            {"_id" if ObjectId.is_valid(customer_id) else "id": ObjectId(customer_id) if ObjectId.is_valid(customer_id) else customer_id},
            {
                "$inc": {
                    "orders": order_count_increment,
                    "revenue": revenue_increment,
                    "lifetime_value": revenue_increment
                },
                "$set": {
                    "updated_at": datetime.now(),
                    "last_purchase": datetime.now()
                }
            }
        )
        
        # Add activity log
        activity_logs_collection.insert_one({
            "customer_id": customer_id,
            "action": "order_added",
            "description": f"New order added: {order_data.get('item_name', 'Unknown item')}",
            "performed_by": "system",
            "timestamp": datetime.now(),
            "metadata": {
                "order_id": order_data.get("order_id"),
                "amount": order_data.get("total_amount")
            }
        })
        
        return {"success": True, "order_id": str(result.inserted_id), "message": "Order added successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding order: {str(e)}")

@customer_router.get("/{customer_id}/orders")
async def get_customer_orders(customer_id: str, skip: int = 0, limit: int = 50):
    """Get all orders for a customer"""
    try:
        orders_cursor = orders_collection.find({"customer_id": customer_id}).sort("created_at", -1).skip(skip).limit(limit)
        orders = []
        for order in orders_cursor:
            order = obj_id_to_str(order)
            orders.append(order)
        
        total_orders = orders_collection.count_documents({"customer_id": customer_id})
        
        return {
            "orders": orders,
            "total": total_orders,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching orders: {str(e)}")

@customer_router.put("/{customer_id}/orders/{order_id}")
async def update_customer_order(customer_id: str, order_id: str, order_data: dict):
    """Update an existing order"""
    try:
        query = {"_id": ObjectId(order_id), "customer_id": customer_id}
        update_data = {
            **order_data,
            "updated_at": datetime.now()
        }
        
        result = orders_collection.update_one(query, {"$set": update_data})
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Add activity log
        activity_logs_collection.insert_one({
            "customer_id": customer_id,
            "action": "order_updated",
            "description": f"Order updated: {order_data.get('item_name', 'Unknown item')}",
            "performed_by": "system",
            "timestamp": datetime.now(),
            "metadata": {
                "order_id": order_id
            }
        })
        
        return {"success": True, "message": "Order updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating order: {str(e)}")

@customer_router.delete("/{customer_id}/orders/{order_id}")
async def delete_customer_order(customer_id: str, order_id: str):
    """Delete an order"""
    try:
        # Get order details before deletion for activity log
        order = orders_collection.find_one({"_id": ObjectId(order_id), "customer_id": customer_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Delete the order
        result = orders_collection.delete_one({"_id": ObjectId(order_id), "customer_id": customer_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Update customer stats (decrement)
        revenue_decrement = float(order.get("total_amount", 0))
        customers_collection.update_one(
            {"_id" if ObjectId.is_valid(customer_id) else "id": ObjectId(customer_id) if ObjectId.is_valid(customer_id) else customer_id},
            {
                "$inc": {
                    "orders": -1,
                    "revenue": -revenue_decrement,
                    "lifetime_value": -revenue_decrement
                },
                "$set": {
                    "updated_at": datetime.now()
                }
            }
        )
        
        # Add activity log
        activity_logs_collection.insert_one({
            "customer_id": customer_id,
            "action": "order_deleted",
            "description": f"Order deleted: {order.get('item_name', 'Unknown item')}",
            "performed_by": "system",
            "timestamp": datetime.now(),
            "metadata": {
                "order_id": order_id,
                "amount": order.get("total_amount")
            }
        })
        
        return {"success": True, "message": "Order deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting order: {str(e)}")