# from app.database import followups_collection
# from datetime import datetime, timedelta
# from bson import ObjectId
# from datetime import datetime
# def serialize_followup(fu):
#     fu = dict(fu)
#     fu["_id"] = str(fu.get("_id", ""))
#     if "reminder_time" in fu and hasattr(fu["reminder_time"], "isoformat"):
#         fu["reminder_time"] = fu["reminder_time"].isoformat()
#     if "created_at" in fu and hasattr(fu["created_at"], "isoformat"):
#         fu["created_at"] = fu["created_at"].isoformat()
#     return fu

# async def add_followup(followup_data):
#     from app.database import followups_collection

#     query = {
#         "lead_id": followup_data["lead_id"],
#         "assigned_to": followup_data["assigned_to"],
#         "note": followup_data["note"],
#         "reminder_time": followup_data.get("reminder_time"),
#     }
#     existing = await followups_collection.find_one(query)
#     if existing:
#         return serialize_followup(existing)
#     # If not found, create new
#     followup = {
#         **followup_data,
#         "created_at": datetime.now(),
#         "sent": False,
#     }
#     result = await followups_collection.insert_one(followup)
#     followup["_id"] = str(result.inserted_id)
#     return serialize_followup(followup)

# async def add_followup(followup_data):
#     query = {
#         "lead_id": followup_data["lead_id"],
#         "assigned_to": followup_data["assigned_to"],
#         "note": followup_data["note"],
#         "reminder_time": followup_data.get("reminder_time"),
#     }
#     existing = followups_collection.find_one(query)
#     if existing:
#         return serialize_followup(existing)   # <-- Just return the existing one!
#     followup = {
#         **followup_data,
#         "created_at": datetime.now(),
#         "sent": False,
#     }
#     result = followups_collection.insert_one(followup)
#     followup["_id"] = str(result.inserted_id)
#     return serialize_followup(followup)

# # def fetch_upcoming_reminders(user_id, window_minutes=60):
# #     from datetime import datetime, timedelta
# #     now = datetime.now()
# #     reminder_window = now + timedelta(minutes=window_minutes)
# #     all_for_user = list(followups_collection.find({"assigned_to": user_id}))
# #     all_reminders = list(followups_collection.find({}))
# #     query = {
# #         "assigned_to": user_id,
# #         "reminder_time": {"$lte": reminder_window, "$gte": now},
# #         "sent": False
# #     }
# #     reminders = list(followups_collection.find(query).sort("reminder_time", 1))
# #     return [serialize_followup(rem) for rem in reminders]


# from datetime import datetime, timedelta

# async def fetch_upcoming_reminders(user_id, window_minutes=60):
#     now = datetime.now()
#     if window_minutes is not None:
#         reminder_window = now + timedelta(minutes=window_minutes)
#         query = {
#             "assigned_to": user_id,
#             "reminder_time": {"$lte": reminder_window, "$gte": now},
#             "sent": False
#         }
#     else:
#         query = {
#             "assigned_to": user_id,
#             "reminder_time": {"$gte": now},
#             "sent": False
#         }
#     cursor = followups_collection.find(query).sort("reminder_time", 1)
#     reminders = []
#     async for rem in cursor:
#         reminders.append(serialize_followup(rem))
#     return reminders

# def mark_reminder_sent(followup_id):
#     followups_collection.update_one({"_id": ObjectId(followup_id)}, {"$set": {"sent": True}})
    
    
# async def fetch_followups_for_lead(lead_id):
#     from app.database import db
#     cursor = db.followups_collection.find({"lead_id": lead_id})
#     results = []
#     for doc in cursor:
#         doc["_id"] = str(doc["_id"])
#         results.append(doc)
#     return results


# from app.database import get_database
# from bson import ObjectId
# from datetime import datetime, timedelta

# # Make sure you use Motor's client!
# db = get_database()
# followups_collection = db["followups"]

# def serialize_followup(fu):
#     fu = dict(fu)
#     fu["_id"] = str(fu.get("_id", ""))
#     if "reminder_time" in fu and hasattr(fu["reminder_time"], "isoformat"):
#         fu["reminder_time"] = fu["reminder_time"].isoformat()
#     if "created_at" in fu and hasattr(fu["created_at"], "isoformat"):
#         fu["created_at"] = fu["created_at"].isoformat()
#     if "updated_at" in fu and hasattr(fu["updated_at"], "isoformat"):
#         fu["updated_at"] = fu["updated_at"].isoformat()
#     return fu

# async def add_followup(followup_data):
#     query = {
#         "lead_id": followup_data["lead_id"],
#         "assigned_to": followup_data["assigned_to"],
#         "note": followup_data["note"],
#         "reminder_time": followup_data.get("reminder_time"),
#     }
#     existing = await followups_collection.find_one(query)
#     if existing:
#         return serialize_followup(existing)
#     followup = {
#         **followup_data,
#         "created_at": datetime.now(),
#         "sent": False,
#     }
#     result = await followups_collection.insert_one(followup)
#     followup["_id"] = str(result.inserted_id)
#     return serialize_followup(followup)

# async def fetch_upcoming_reminders(user_id, window_minutes=60):
#     now = datetime.now()
#     if window_minutes is not None:
#         reminder_window = now + timedelta(minutes=window_minutes)
#         query = {
#             "assigned_to": user_id,
#             "reminder_time": {"$lte": reminder_window, "$gte": now},
#             "sent": False
#         }
#     else:
#         query = {
#             "assigned_to": user_id,
#             "reminder_time": {"$gte": now},
#             "sent": False
#         }
#     cursor = followups_collection.find(query).sort("reminder_time", 1)
#     reminders = []
#     async for rem in cursor:
#         reminders.append(serialize_followup(rem))
#     return reminders

# async def fetch_followups_for_lead(lead_id):
#     cursor = followups_collection.find({"lead_id": lead_id})
#     results = []
#     async for doc in cursor:
#         doc["_id"] = str(doc["_id"])
#         results.append(doc)
#     return results

# async def mark_reminder_sent(followup_id):
#     await followups_collection.update_one({"_id": ObjectId(followup_id)}, {"$set": {"sent": True}})

# async def update_followup(followup_id: str, update_data: dict):
#     update_data["updated_at"] = datetime.now()
#     result = await followups_collection.find_one_and_update(
#         {"_id": ObjectId(followup_id)},
#         {"$set": update_data},
#         return_document=True  # Motor: use ReturnDocument.AFTER if needed
#     )
#     if result:
#         return serialize_followup(result)
#     else:
#         raise Exception("Follow-up not found")




from app.database import get_database, find_lead_by_id_or_lead_id
from bson import ObjectId
from datetime import datetime, timedelta

db = get_database()
followups_collection = db["followups"]

def serialize_followup(fu):
    """
    Serialize followup document to match the exact structure shown in the example.
    Keeps _id as ObjectId string and uses proper field names.
    """
    fu = dict(fu)
    # Convert ObjectId to string but keep the _id field name (not id)
    if isinstance(fu.get("_id"), ObjectId):
        fu["_id"] = str(fu["_id"])
    
    # Handle datetime fields - convert to ISO string format
    for k in ["created_at", "updated_at", "scheduled_date", "actual_date"]:
        if k in fu and hasattr(fu[k], "isoformat"):
            fu[k] = fu[k].isoformat()
    
    # Ensure required fields exist with defaults
    if "sent" not in fu:
        fu["sent"] = False
    
    return fu

async def add_followup(followup_data):
    """
    Add a new followup with the exact document structure as specified.
    """
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    current_time_utc = datetime.now()
    current_time_ist = current_time_utc.replace(tzinfo=pytz.UTC).astimezone(ist)
    
    # Find the lead to get customer name and phone if not provided
    lead_id = followup_data.get("lead_id")
    customer_name = followup_data.get("customer_name")
    customer_phone = followup_data.get("customer_phone")
    
    # If customer info not provided, try to get from lead
    if lead_id and (not customer_name or not customer_phone):
        try:
            lead = find_lead_by_id_or_lead_id(lead_id)
            if lead:
                if not customer_name:
                    customer_name = lead.get("name")  # Customer name stored as "name" in leads
                if not customer_phone:
                    customer_phone = lead.get("phone")  # Customer phone stored as "phone" in leads
        except Exception as e:
            print(f"Warning: Could not fetch lead data for customer info: {e}")
    
    # Create the followup document with the exact structure
    followup = {
        "lead_id": followup_data.get("lead_id"),
        "type": followup_data.get("type", "call"),
        "scheduled_date": followup_data.get("scheduled_date"),
        "remarks": followup_data.get("remarks"),
        "assigned_to": followup_data.get("assigned_to"),
        "status": followup_data.get("status", "pending"),
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "created_at": current_time_ist,
        "updated_at": current_time_ist,
        "sent": followup_data.get("sent", False),
    }
    
    # Remove None values to keep the document clean
    followup = {k: v for k, v in followup.items() if v is not None}
    
    # Insert into database
    result = followups_collection.insert_one(followup)
    followup["_id"] = result.inserted_id
    
    # Update the related lead's follow_up_updated_at timestamp
    try:
        if lead_id:
            lead = find_lead_by_id_or_lead_id(lead_id)
            if lead:
                from app.database import get_database
                db = get_database()
                db.leads.update_one(
                    {"_id": lead["_id"]},  # Use the actual ObjectId
                    {"$set": {"follow_up_updated_at": current_time_ist}}
                )
    except Exception as e:
        print(f"Warning: Could not update lead follow_up_updated_at: {e}")
    
    # Log activity for followup creation
    try:
        from app.routes.leads import create_lead_activity_internal
        
        # Use the provided user name or fall back to assigned_to
        activity_creator = followup_data.get("created_by_name", followup_data.get("assigned_to", "system"))
        
        print(f"Creating followup activity for lead_id: {followup_data.get('lead_id')}, creator: {activity_creator}")
        
        await create_lead_activity_internal(
            lead_id=followup_data.get("lead_id"),
            activity_type="followup_created", 
            description=f"Follow-up scheduled for {followup_data.get('scheduled_date', 'N/A')} - {followup_data.get('type', 'call').title()}",
            created_by=activity_creator,
            metadata={
                "followup_id": str(result.inserted_id),
                "type": followup_data.get("type", "call"),
                "status": followup_data.get("status", "pending"),
                "remarks": followup_data.get("remarks", "")[:100] if followup_data.get("remarks") else ""
            }
        )
        print(f"Successfully created followup activity")
    except Exception as e:
        print(f"Warning: Could not log followup activity: {e}")
        import traceback
        traceback.print_exc()
    
    return serialize_followup(followup)

async def fetch_upcoming_reminders(user_id, window_minutes=10):
    """
    Fetch upcoming reminders for a specific user within the specified window (default 10 minutes)
    """
    now = datetime.now()
    reminder_window = now + timedelta(minutes=window_minutes)
    query = {
        "assigned_to": user_id,
        "scheduled_date": {"$lte": reminder_window, "$gte": now},
        "sent": False,
        "status": {"$ne": "completed"}  # Don't show completed follow-ups
    }
    cursor = followups_collection.find(query).sort("scheduled_date", 1)
    reminders = []
    for rem in cursor:
        reminders.append(serialize_followup(rem))
    return reminders

async def fetch_all_upcoming_reminders(window_minutes=10):
    """
    Fetch all upcoming reminders for admin view within the specified window (default 10 minutes)
    """
    now = datetime.now()
    reminder_window = now + timedelta(minutes=window_minutes)
    query = {
        "scheduled_date": {"$lte": reminder_window, "$gte": now},
        "sent": False,
        "status": {"$ne": "completed"}  # Don't show completed follow-ups
    }
    cursor = followups_collection.find(query).sort("scheduled_date", 1)
    reminders = []
    for rem in cursor:
        # Enrich with lead information
        lead_info = None
        try:
            from app.database import get_database
            db = get_database()
            lead_info = db.leads.find_one({"lead_id": rem.get("lead_id")})
        except Exception as e:
            print(f"Warning: Could not fetch lead info: {e}")
        
        reminder_data = serialize_followup(rem)
        if lead_info:
            reminder_data["lead_name"] = lead_info.get("name", "Unknown")
            reminder_data["lead_phone"] = lead_info.get("phone", "Unknown")
        
        reminders.append(reminder_data)
    return reminders

async def fetch_followups_for_lead(lead_id):
    """Fetch followups for a lead - supports both ObjectId and lead_id"""
    # First try to find the lead to get both identifiers and customer data
    lead = find_lead_by_id_or_lead_id(lead_id)
    if not lead:
        return []  # Lead not found, return empty list
    
    # Get both possible identifiers from the lead
    lead_object_id = str(lead["_id"])
    lead_business_id = lead.get("lead_id")
    
    # Get customer data from lead
    customer_name = lead.get("name")
    customer_phone = lead.get("phone")
    
    # Search followups using both identifiers
    query = {"$or": [
        {"lead_id": lead_id},  # Original search term
        {"lead_id": lead_object_id},  # MongoDB ObjectId as string
    ]}
    
    # Add business lead_id to search if it exists and is different
    if lead_business_id and lead_business_id != lead_id and lead_business_id != lead_object_id:
        query["$or"].append({"lead_id": lead_business_id})
    
    cursor = followups_collection.find(query)
    results = []
    for doc in cursor:
        # Populate customer data if missing
        if not doc.get("customer_name") and customer_name:
            doc["customer_name"] = customer_name
        if not doc.get("customer_phone") and customer_phone:
            doc["customer_phone"] = customer_phone
        results.append(serialize_followup(doc))
    return results

async def mark_reminder_sent(followup_id):
    followups_collection.update_one({"_id": ObjectId(followup_id)}, {"$set": {"sent": True}})

async def update_followup(followup_id: str, update_data: dict, current_user: dict = None):
    from app.routes.leads import create_lead_activity_internal
    
    # Get the original followup data before update
    original_followup = followups_collection.find_one({"_id": ObjectId(followup_id)})
    if not original_followup:
        raise Exception("Follow-up not found")
    
    # Add updated timestamp in IST
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    current_time_utc = datetime.now()
    current_time_ist = current_time_utc.replace(tzinfo=pytz.UTC).astimezone(ist)
    update_data["updated_at"] = current_time_ist
    
    # Update the followup
    result = followups_collection.find_one_and_update(
        {"_id": ObjectId(followup_id)},
        {"$set": update_data},
        return_document=True
    )
    
    if result:
        # Update the related lead's follow_up_updated_at timestamp
        try:
            from app.database import get_database
            db = get_database()
            lead_id = result.get("lead_id")
            if lead_id:
                db.leads.update_one(
                    {"lead_id": lead_id},
                    {"$set": {"follow_up_updated_at": current_time_ist}}
                )
                
                # Log activity for followup update
                changes = []
                tracked_fields = ["status", "type", "scheduled_date", "remarks"]
                
                for field in tracked_fields:
                    old_value = original_followup.get(field)
                    new_value = result.get(field)
                    if str(old_value) != str(new_value):
                        changes.append(f"{field}: '{old_value}' → '{new_value}'")
                
                if changes:
                    # Get current user name from various possible sources
                    current_user_name = "system"  # default fallback
                    if current_user:
                        current_user_name = (
                            current_user.get("username") or 
                            current_user.get("user_id") or 
                            current_user.get("id") or 
                            current_user.get("name") or
                            "system"
                        )
                    elif update_data.get("updated_by"):
                        current_user_name = update_data.get("updated_by")
                    
                    await create_lead_activity_internal(
                        lead_id=lead_id,
                        activity_type="followup_updated",
                        description=f"Follow-up updated: {', '.join(changes)}",
                        created_by=current_user_name,
                        metadata={
                            "followup_id": str(followup_id),
                            "changes": changes
                        }
                    )
        except Exception as e:
            print(f"Warning: Could not update lead follow_up_updated_at: {e}")
        
        return serialize_followup(result)
    else:
        raise Exception("Follow-up not found")

async def fetch_all_followups():
    """
    Fetch all follow-ups from the database with lead information (admin only)
    """
    try:
        from app.database import get_database
        db = get_database()
        
        print("DEBUG: Fetching all followups for admin")
        
        # First check if we have any follow-ups at all
        total_count = await followups_collection.count_documents({})
        print(f"DEBUG: Total follow-ups in database: {total_count}")
        
        # Aggregate pipeline to join with leads collection
        pipeline = [
            {
                "$lookup": {
                    "from": "leads",
                    "localField": "lead_id",
                    "foreignField": "lead_id",
                    "as": "lead"
                }
            },
            {
                "$unwind": {
                    "path": "$lead",
                    "preserveNullAndEmptyArrays": True
                }
            },
            {
                "$sort": {"scheduled_date": -1}  # Most recent first
            }
        ]
        
        cursor = followups_collection.aggregate(pipeline)
        followups = await cursor.to_list(length=None)
        
        print(f"DEBUG: Found {len(followups)} follow-ups after aggregation")
        
        result = [serialize_followup_with_lead(fu) for fu in followups]
        print(f"DEBUG: Returning {len(result)} serialized follow-ups")
        
        return result
    except Exception as e:
        print(f"ERROR in fetch_all_followups: {e}")
        return []

async def fetch_user_followups(user_id: str):
    """
    Fetch all follow-ups for a specific user with lead information
    """
    try:
        from app.database import get_database
        db = get_database()
        
        print(f"DEBUG: Fetching follow-ups for user: {user_id}")
        
        # First check if we have any follow-ups for this user
        user_count = await followups_collection.count_documents({"assigned_to": user_id})
        print(f"DEBUG: Follow-ups assigned to {user_id}: {user_count}")
        
        # Aggregate pipeline to join with leads collection and filter by user
        pipeline = [
            {
                "$match": {"assigned_to": user_id}
            },
            {
                "$lookup": {
                    "from": "leads",
                    "localField": "lead_id",
                    "foreignField": "lead_id",
                    "as": "lead"
                }
            },
            {
                "$unwind": {
                    "path": "$lead",
                    "preserveNullAndEmptyArrays": True
                }
            },
            {
                "$sort": {"scheduled_date": -1}  # Most recent first
            }
        ]
        
        cursor = followups_collection.aggregate(pipeline)
        followups = await cursor.to_list(length=None)
        
        print(f"DEBUG: Found {len(followups)} follow-ups for user {user_id} after aggregation")
        
        result = [serialize_followup_with_lead(fu) for fu in followups]
        print(f"DEBUG: Returning {len(result)} serialized follow-ups for user {user_id}")
        
        return result
    except Exception as e:
        print(f"ERROR in fetch_user_followups for {user_id}: {e}")
        return []

def serialize_followup_with_lead(fu):
    """
    Serialize follow-up with lead information while maintaining the correct document structure
    """
    fu = dict(fu)
    # Keep _id as string (don't change to id)
    if isinstance(fu.get("_id"), ObjectId):
        fu["_id"] = str(fu["_id"])
    
    # Handle datetime fields
    for field in ["scheduled_date", "created_at", "updated_at", "actual_date"]:
        if field in fu and hasattr(fu[field], "isoformat"):
            fu[field] = fu[field].isoformat()
    
    # Add lead information if available
    if "lead" in fu and fu["lead"]:
        lead = fu["lead"]
        fu["lead_name"] = lead.get("company_name") or lead.get("name", "Unknown")
        fu["lead_phone"] = lead.get("phone", "")
        fu["lead_email"] = lead.get("email", "")
        
        # Populate customer_name and customer_phone from lead data if not already present
        if not fu.get("customer_name"):
            fu["customer_name"] = lead.get("name", "")  # Customer name from "name" field
        if not fu.get("customer_phone"):
            fu["customer_phone"] = lead.get("phone", "")  # Customer phone from "phone" field
        
        # Keep the lead object for reference
        fu["lead"] = {
            "lead_id": lead.get("lead_id", ""),
            "company_name": lead.get("company_name", ""),
            "contact_person": lead.get("name", ""),
            "phone": lead.get("phone", ""),
            "email": lead.get("email", ""),
            "status": lead.get("status", "")
        }
    
    # Ensure sent field exists
    if "sent" not in fu:
        fu["sent"] = False
    
    return fu