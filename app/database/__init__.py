import os
import logging
from pymongo import MongoClient, IndexModel, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import ServerSelectionTimeoutError, OperationFailure
from bson import ObjectId
from datetime import datetime
from typing import Dict, Any, Optional, List

# Set up logging
logger = logging.getLogger(__name__)

# Force dnspython to use Google DNS (8.8.8.8) for SRV lookups so MongoDB Atlas
# hostnames resolve even when the local router DNS (192.168.1.x) times out.
try:
    import dns.resolver
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "8.8.4.4"]
    dns.resolver.default_resolver.timeout = 5
    dns.resolver.default_resolver.lifetime = 10
except Exception:
    pass  # dnspython not available — pymongo will use system DNS

# MongoDB connection settings
MONGO_URI = os.getenv("DATABASE_URL", "mongodb+srv://neelbert_test:Neelbert%40123.@cluster0.ijzzjo3.mongodb.net/?appName=Cluster0")
DB_NAME = os.getenv("DB_NAME", "hospital")

# Connection parameters — short timeouts so startup never hangs on DNS failure
MONGO_CLIENT_KWARGS = dict(
    serverSelectionTimeoutMS=8000,
    connectTimeoutMS=8000,
    socketTimeoutMS=10000,
)

_client = None  # Global MongoDB client

# Current credentials for logging
CURRENT_USER = "amit24ve"
CURRENT_TIMESTAMP = "2025-06-05 12:42:20"

def get_database():
    """Get MongoDB database connection with connection pooling"""
    global _client

    if _client is None:
        try:
            logger.info("Connecting to MongoDB...")
            _client = MongoClient(MONGO_URI, **MONGO_CLIENT_KWARGS)
            # Test connection
            _client.admin.command('ping')
            logger.info("MongoDB connection successful")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {str(e)}", exc_info=True)
            raise
    return _client[DB_NAME]


# ── Lazy global client ──────────────────────────────────────────────────────
# Do NOT call MongoClient at module import time — DNS SRV lookup can block/crash
# startup if Atlas DNS is unreachable. All collection references below use a
# property-style helper that creates the client on first access.

def _db() -> Database:
    """Return the database, creating the MongoClient lazily on first call."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, **MONGO_CLIENT_KWARGS)
    return _client[DB_NAME]


class _LazyDB:
    """Proxy that defers MongoClient creation until first attribute access.
    Allows `db.collection_name` to work without connecting at import time."""
    def __getattr__(self, name: str):
        return getattr(_db(), name)

    def __getitem__(self, name: str):
        return _db()[name]


db = _LazyDB()  # drop-in replacement — `db.xxx` now lazily connects

# Collection references — all use _db() so MongoClient is never created at import time
def users_collection():
    return _db().users

def roles_collection():
    return _db().roles

def get_meeting_collection():
    return _db().meetings

def permissions_collection():
    return _db().permissions

def access_logs_collection():
    return _db().access_logs

def followups_collection():
    return _db().followups

def quotations_collection():
    return _db().quotations

def lead_sources_collection():
    return _db().lead_sources

def lead_assignments_collection():
    return _db().lead_assignments

def enquiries_collection():
    return _db().enquiries

def franchises_collection():
    return _db().franchises

def lead_activities_collection():
    return _db().lead_activities

def duplicate_leads_collection():
    return _db().duplicate_leads

def activities_collection():
    return _db().activities

def customers_collection():
    return _db().customers

def orders_collection():
    return _db().orders

def feedbacks_collection():
    return _db().feedbacks

def logs_collection():
    return _db().comm_logs

def transactions_collection():
    return _db().transactions

def employees_collection():
    return _db().employees

def notes_collection():
    return _db().notes

def loyalty_collection():
    return _db().loyalty

def complaints_collection():
    return _db().complaints

def activity_logs_collection():
    return _db().activity_logs

def cashback_transactions_collection():
    return _db().cashback_transactions

def loyalty_campaigns_collection():
    return _db().loyalty_campaigns

def referrals_collection():
    return _db().referrals

def redemptions_collection():
    return _db().redemptions

def tier_config_collection():
    return _db().loyalty_tier_config

def attendance_collection():
    return _db().attendance

def daily_reports_collection():
    return _db().daily_reports

def leave_requests_collection():
    return _db().leave_requests

def products_collection():
    return _db().products

def stock_collection():
    return _db().stock

def stock_logs_collection():
    return _db().stock_logs

def payments_collection():
    return _db().payments

def expenses_collection():
    return _db().expenses

def invoices_collection():
    return _db().invoices

def tasks_collection():
    return _db().tasks

def leads_collection():
    return _db().leads


def find_lead_by_id_or_lead_id(identifier: str):
    """
    Find a lead by either MongoDB _id (ObjectId) or business lead_id.
    
    Args:
        identifier: Either ObjectId string or lead_id string
        
    Returns:
        Lead document if found, None otherwise
    """
    try:
        collection = leads_collection()
        
        # First try to find by ObjectId (_id)
        try:
            object_id = ObjectId(identifier)
            lead = collection.find_one({"_id": object_id})
            if lead:
                return lead
        except:
            # identifier is not a valid ObjectId, continue to try lead_id
            pass
        
        # If not found by ObjectId, try to find by lead_id
        lead = collection.find_one({"lead_id": identifier})
        if lead:
            return lead
        
        # Not found by either method
        return None
        
    except Exception as e:
        logger.error(f"Error finding lead by identifier {identifier}: {str(e)}")
        return None

def find_user_by_id_or_user_id(identifier: str):
    """
    Find a user by either MongoDB _id (ObjectId) or business user_id.
    
    Args:
        identifier: Either ObjectId string or user_id string
        
    Returns:
        User document if found, None otherwise
    """
    try:
        collection = users_collection()
        
        # First try to find by ObjectId (_id)
        try:
            object_id = ObjectId(identifier)
            user = collection.find_one({"_id": object_id})
            if user:
                return user
        except:
            # identifier is not a valid ObjectId, continue to try user_id
            pass
        
        # If not found by ObjectId, try to find by user_id
        user = collection.find_one({"user_id": identifier})
        if user:
            return user
        
        # Also try the legacy id field for backward compatibility
        user = collection.find_one({"id": identifier})
        if user:
            return user
        
        # Not found by any method
        return None
        
    except Exception as e:
        logger.error(f"Error finding user by identifier {identifier}: {str(e)}")
        return None

#here is document collection
def document_collection():
    return db.documents
# --- here is ticket collection ---
def ticket_collection():
    return db.tickets

from pymongo.collection import Collection
from pymongo import ReturnDocument

def get_next_sequence(db, name):
    counter = db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return counter["seq"]

def safe_create_index(collection, keys, **kwargs):
    """Safely create an index, handling existing indexes."""
    try:
        # Get existing indexes to check for conflicts
        existing_indexes = collection.list_indexes()
        index_names = [idx['name'] for idx in existing_indexes]
        
        # If index_name is not specified, use a custom one to avoid conflicts
        if 'name' not in kwargs:
            # Create a name based on the keys and options
            key_str = '_'.join(f"{k}_{v}" for k, v in keys)
            if 'sparse' in kwargs and kwargs['sparse']:
                key_str += '_sparse'
            if 'unique' in kwargs and kwargs['unique']:
                key_str += '_unique'
            kwargs['name'] = key_str
        
        # Check if an index with this name already exists
        if kwargs['name'] in index_names:
            logger.info(f"Index {kwargs['name']} already exists on {collection.name}")
            return True
            
        collection.create_index(keys, **kwargs)
        logger.info(f"Created index {kwargs.get('name', 'unnamed')} on {collection.name}")
        return True
    except OperationFailure as e:
        if "already exists" in str(e) or "same name" in str(e) or "IndexOptionsConflict" in str(e):
            logger.warning(f"Index on {collection.name} already exists with different options: {e}")
            return False
        else:
            logger.error(f"Failed to create index on {collection.name}: {e}")
            # Don't raise the exception, just log it to prevent startup failure
            return False

def initialize_db():
    """Initialize database connection and setup."""
    try:
        # Test connection
        _db().command('ping')
        logger.info(f"Connected to MongoDB: {MONGO_URI}")
        
        # Create indexes safely
        create_indexes()
        
        # Initialize default data
        initialize_default_data()
        
        logger.info(f"[{CURRENT_TIMESTAMP}] Database initialized successfully")
        return True
        
    except ServerSelectionTimeoutError:
        logger.error(f"Failed to connect to MongoDB: {MONGO_URI}")
        raise

def create_indexes():
    """Create necessary database indexes safely."""
    logger.info("Creating database indexes")
    
    # Core application indexes
    safe_create_index(users_collection(), [("username", ASCENDING)], unique=True)
    safe_create_index(users_collection(), [("email", ASCENDING)], unique=True)
    safe_create_index(roles_collection(), [("name", ASCENDING)], unique=True)
    
    # Leads indexes
    safe_create_index(leads_collection(), [("created_at", DESCENDING)])
    safe_create_index(leads_collection(), [("source", ASCENDING)])
    safe_create_index(leads_collection(), [("email", ASCENDING)], sparse=True, name="email_sparse")
    safe_create_index(leads_collection(), [("phone", ASCENDING)], sparse=True, name="phone_sparse")
    safe_create_index(leads_collection(), [("full_name", ASCENDING)])
    safe_create_index(leads_collection(), [("status", ASCENDING)])
    safe_create_index(leads_collection(), [("assigned_to", ASCENDING)])
    
    # Followups indexes
    safe_create_index(followups_collection(), [("lead_id", ASCENDING)])
    safe_create_index(followups_collection(), [("scheduled_date", ASCENDING)])
    safe_create_index(followups_collection(), [("status", ASCENDING)])
    safe_create_index(followups_collection(), [("assigned_to", ASCENDING)])
    
    safe_create_index(followups_collection(), [("reminder_time", ASCENDING)])
    safe_create_index(followups_collection(), [("created_at", ASCENDING)])
    
    # Quotations indexes
    safe_create_index(quotations_collection, [("lead_id", ASCENDING)])
    safe_create_index(quotations_collection, [("quotation_number", ASCENDING)], unique=True)
    safe_create_index(quotations_collection, [("status", ASCENDING)])
    safe_create_index(quotations_collection, [("created_at", ASCENDING)])
    
    # Lead sources collection indexes
    safe_create_index(lead_sources_collection, [("source_type", ASCENDING)])
    safe_create_index(lead_sources_collection, [("integration_id", ASCENDING)], unique=True)
    
    # Lead assignments collection indexes
    safe_create_index(lead_assignments_collection, [("lead_id", ASCENDING)], unique=True)
    safe_create_index(lead_assignments_collection, [("user_id", ASCENDING)])
    safe_create_index(lead_assignments_collection, [("created_at", ASCENDING)])
    
    # Duplicate leads indexes
    safe_create_index(duplicate_leads_collection(), [("original_lead_id", ASCENDING)])
    safe_create_index(duplicate_leads_collection(), [("duplicate_created_at", DESCENDING)])
    safe_create_index(duplicate_leads_collection(), [("email", ASCENDING)], sparse=True)
    safe_create_index(duplicate_leads_collection(), [("phone", ASCENDING)], sparse=True)

def initialize_default_data():
    """Initialize default data in the database."""
    logger.info("Initializing default data")
    
    # No default role seeding — roles are created manually via the UI
    # to avoid ObjectId-based IDs and keep data clean.
    
    # Assign admin role to specific users if admin role already exists
    assign_admin_role("admin")
    assign_admin_role("superuser")
    assign_admin_role(CURRENT_USER)

def assign_admin_role(username):
    """Assign admin role to the specified user."""
    # Get admin role ID
    admin_role = roles_collection().find_one({"name": "admin"})
    if not admin_role:
        logger.error("Admin role not found, this shouldn't happen")
        return False
    
    admin_role_id = admin_role.get("id") or str(admin_role["_id"])
    
    # Check if user exists
    users_coll = users_collection()  # Use function to get collection
    user = users_coll.find_one({"username": username})
    if not user:
        # Create user if not exists
        user_id = str(ObjectId())
        users_coll.insert_one({
            "id": user_id,
            "username": username,
            "email": f"{username}@example.com",  # Placeholder email
            "created_at": datetime.now(),
            "role_ids": [admin_role_id],
            "is_active": True,
            "is_system": True  # Flag: hide from user management UI
        })
        logger.info(f"Created user {username} with admin role")
        return True
    
    # Update existing user
    role_ids = user.get("role_ids", [])
    if admin_role_id not in role_ids:
        role_ids.append(admin_role_id)
        users_coll.update_one(
            {"_id": user["_id"]},
            {"$set": {"role_ids": role_ids}}
        )
        logger.info(f"Added admin role to user {username}")
        return True
    else:
        logger.info(f"User {username} already has admin role")
        return True

def close_db_connection():
    """Close database connection."""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")

async def insert_lead(lead_data):
    """Insert a new lead into the database with error handling"""
    db = get_database()
    try:
        # Clean up data for MongoDB
        # Remove any '.' characters in keys as MongoDB doesn't support them
        clean_data = {}
        for key, value in lead_data.items():
            if key is None:
                continue
                
            new_key = str(key).replace('.', '_')
            
            # Handle raw data specially
            if key == 'raw_data' and isinstance(value, dict):
                clean_raw_data = {}
                for k, v in value.items():
                    if k is None:
                        continue
                    clean_k = str(k).replace('.', '_')
                    clean_raw_data[clean_k] = v
                clean_data[new_key] = clean_raw_data
            else:
                clean_data[new_key] = value
        
        # Set created_at if not present
        if 'created_at' not in clean_data:
            clean_data['created_at'] = datetime.now()
                
        # Insert the cleaned data
        leads_coll = leads_collection()
        result = leads_coll.insert_one(clean_data)
        logger.info(f"Inserted lead with ID: {result.inserted_id}")
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Error inserting lead: {str(e)}", exc_info=True)
        raise

async def insert_duplicate_lead(lead_data, original_lead_id):
    """Insert a lead into the duplicate_leads collection with reference to the original lead"""
    db = get_database()
    try:
        # Clean up data for MongoDB
        # Remove any '.' characters in keys as MongoDB doesn't support them
        clean_data = {}
        for key, value in lead_data.items():
            if key is None:
                continue
                
            new_key = str(key).replace('.', '_')
            
            # Handle raw data specially
            if key == 'raw_data' and isinstance(value, dict):
                clean_raw_data = {}
                for k, v in value.items():
                    if k is None:
                        continue
                    clean_k = str(k).replace('.', '_')
                    clean_raw_data[clean_k] = v
                clean_data[new_key] = clean_raw_data
            else:
                clean_data[new_key] = value
        
        # Add reference to original lead
        clean_data['original_lead_id'] = original_lead_id
        clean_data['duplicate_created_at'] = datetime.now()
        
        # Add import metadata
        clean_data['import_source'] = lead_data.get('source', 'manual_import')
        clean_data['import_batch'] = lead_data.get('import_batch', None)
        clean_data['is_duplicate'] = True
        clean_data['duplicate_reason'] = 'email_or_phone_match'
        
        # Insert the cleaned data into duplicate_leads collection
        duplicate_leads = duplicate_leads_collection()  # Use the function to get collection
        result = duplicate_leads.insert_one(clean_data)
        logger.info(f"Inserted duplicate lead with ID: {result.inserted_id}, original lead: {original_lead_id}")
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Error inserting duplicate lead: {str(e)}", exc_info=True)
        # Just log the error but don't raise to avoid disrupting the import process
        logger.error(f"Details - lead_data: {lead_data}, original_lead_id: {original_lead_id}")
        return None

async def update_lead_source(source_id, source_data):
    """Update or insert a lead source"""
    db = get_database()
    try:
        # Ensure source_id is set in the data
        source_data["integration_id"] = source_id
        
        result = db.lead_sources.update_one(
            {"integration_id": source_id},
            {"$set": source_data},
            upsert=True
        )
        
        logger.info(f"Updated lead source: {source_id}")
        return result.modified_count > 0 or result.upserted_id is not None
    except Exception as e:
        logger.error(f"Error updating lead source: {str(e)}", exc_info=True)
        raise

async def find_duplicate_lead(email=None, phone=None):
    """Find a lead by email or phone number with error handling"""
    if not email and not phone:
        return None
        
    db = get_database()
    try:
        query = {"$or": []}
        
        if email and email.strip():
            # Clean the email by removing whitespace and converting to lowercase
            clean_email = email.strip().lower()
            # Check different possible email field names
            query["$or"].extend([
                {"email": clean_email}, 
                {"Email": clean_email}, 
                {"emailAddress": clean_email},
                {"email_address": clean_email}
            ])
        
        if phone and phone.strip():
            # Clean the phone by removing non-digit characters
            clean_phone = ''.join(filter(str.isdigit, phone))
            if clean_phone:
                # Check different possible phone field names
                query["$or"].extend([
                    {"phone": {"$regex": clean_phone}}, 
                    {"Phone": {"$regex": clean_phone}},
                    {"phoneNumber": {"$regex": clean_phone}},
                    {"phone_number": {"$regex": clean_phone}},
                    {"alternate_phone": {"$regex": clean_phone}},
                    {"alternatePhone": {"$regex": clean_phone}},
                    {"alternate_phone_number": {"$regex": clean_phone}}
                ])
        
        # Only proceed with the query if we have at least one condition
        if not query["$or"]:
            return None
            
        leads = leads_collection()  # Use the function to get collection
        return leads.find_one(query)
    except Exception as e:
        logger.error(f"Error finding duplicate lead: {str(e)}", exc_info=True)
        return None  # Return None instead of raising to avoid disrupting import process

# Helper functions for serialization
def serialize_id(document):
    if document and "_id" in document:
        document["id"] = str(document["_id"])
        del document["_id"]
    return document

def get_object_id(id_str):
    """Convert string ID to ObjectId."""
    try:
        return ObjectId(id_str)
    except:
        return None

def get_leads(page=1, limit=100, source=None, start_date=None, end_date=None):
    """Get leads with pagination and filtering."""
    # Prepare query
    query = {}
    
    # Filter by source
    if source:
        query["source"] = source
    
    # Filter by date range
    if start_date or end_date:
        date_query = {}
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_query["$gte"] = start
            except ValueError:
                logger.warning(f"Invalid start_date format: {start_date}")
                
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                date_query["$lte"] = end
            except ValueError:
                logger.warning(f"Invalid end_date format: {end_date}")
                
        if date_query:
            query["created_at"] = date_query
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Execute query
    leads_coll = leads_collection()  # Use the function to get collection
    cursor = leads_coll.find(
        query,
        sort=[("created_at", -1)],
        skip=skip,
        limit=limit
    )
    
    # Convert MongoDB documents to list of dicts
    leads = list(cursor)
    
    # Convert _id to string
    for lead in leads:
        lead["id"] = str(lead.pop("_id")) if "_id" in lead else lead.get("id")
    
    return leads

def get_lead_sources():
    """Get all lead sources."""
    cursor = lead_sources_collection.find(sort=[("source_type", 1), ("name", 1)])
    
    sources = list(cursor)
    
    # Convert _id to string
    for source in sources:
        source["id"] = str(source.pop("_id")) if "_id" in source else source.get("id")
    
    # Add lead count for each source
    leads_coll = leads_collection()  # Use the function to get collection
    for source in sources:
        source_type = source.get("source_type")
        integration_id = source.get("integration_id")
        if source_type and integration_id:
            source["total_leads"] = leads_coll.count_documents({
                "$or": [
                    {"source": source_type, "source_id": integration_id},
                    {"source_type": source_type, "source_id": integration_id}
                ]
            })
        else:
            source["total_leads"] = 0
    
    return sources

# Initialize database on import
try:
    initialize_db()
except Exception as e:
    logger.error(f"Error initializing database: {e}")
    print(f"Database initialization error: {e}")
    # Don't re-raise to prevent startup failure
    print("Application will continue but some features may not work properly")




from pymongo.collection import Collection
from bson import ObjectId
from datetime import datetime

def generate_ticket_number(collection: Collection) -> str:
    count = collection.count_documents({})
    return f"TKT-{1000 + count + 1}"

def insert_ticket(collection: Collection, ticket_data: dict) -> str:
    ticket_data["ticket_number"] = generate_ticket_number(collection)
    ticket_data["created_at"] = datetime.now()
    ticket_data["status"] = "open"
    ticket_data["resolution_log"] = []
    ticket_data["closed_at"] = None
    ticket_data["feedback"] = None
    result = collection.insert_one(ticket_data)
    return str(result.inserted_id)

def update_ticket(collection: Collection, ticket_id: str, update_data: dict):
    if "status" in update_data and update_data["status"] == "closed":
        update_data["closed_at"] = datetime.now()
    result = collection.update_one(
        {"_id": ObjectId(ticket_id)},
        {"$set": update_data}
    )
    return result.modified_count

def get_tickets(collection: Collection, filter_query: dict = {}):
    return list(collection.find(filter_query))

def get_ticket_by_id(collection: Collection, ticket_id: str):
    return collection.find_one({"_id": ObjectId(ticket_id)})

def get_duplicate_leads(page=1, limit=100, original_lead_id=None, source=None, start_date=None, end_date=None):
    """Get duplicate leads with pagination and filtering."""
    # Prepare query
    query = {}
    
    # Filter by original lead ID if provided
    if original_lead_id:
        query["original_lead_id"] = original_lead_id
        
    # Filter by source if provided
    if source:
        query["import_source"] = source
    
    # Filter by date range
    if start_date or end_date:
        date_query = {}
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_query["$gte"] = start
            except ValueError:
                logger.warning(f"Invalid start_date format: {start_date}")
                
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                date_query["$lte"] = end
            except ValueError:
                logger.warning(f"Invalid end_date format: {end_date}")
                
        if date_query:
            query["duplicate_created_at"] = date_query
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Execute query
    dup_leads_coll = duplicate_leads_collection()  # Use the function to get collection
    cursor = dup_leads_coll.find(
        query,
        sort=[("duplicate_created_at", -1)],
        skip=skip,
        limit=limit
    )
    
    # Convert MongoDB documents to list of dicts
    duplicate_leads = list(cursor)
    
    # Convert _id to string and enhance with original lead information
    leads_coll = leads_collection()
    for lead in duplicate_leads:
        lead["id"] = str(lead.pop("_id")) if "_id" in lead else lead.get("id")
        
        # Get original lead information
        if lead.get("original_lead_id"):
            try:
                original_id = lead["original_lead_id"]
                original_lead = leads_coll.find_one({"_id": ObjectId(original_id)})
                if original_lead:
                    original_lead["id"] = str(original_lead.pop("_id")) if "_id" in original_lead else original_lead.get("id")
                    lead["original_lead"] = original_lead
            except Exception as e:
                logger.error(f"Error fetching original lead: {str(e)}", exc_info=True)
                lead["original_lead"] = {"error": "Could not retrieve original lead"}
    
    return duplicate_leads

def get_duplicate_leads_count(original_lead_id=None, source=None):
    """Get count of duplicate leads with filtering."""
    # Prepare query
    query = {}
    
    # Filter by original lead ID if provided
    if original_lead_id:
        query["original_lead_id"] = original_lead_id
        
    # Filter by source if provided
    if source:
        query["import_source"] = source
    
    # Execute count query
    dup_leads_coll = duplicate_leads_collection()
    return dup_leads_coll.count_documents(query)

# Import async database
try:
    from .async_db import async_db
    logger.info("Async database imported successfully")
except Exception as e:
    logger.error(f"Error importing async database: {e}")
    async_db = None

# Export list for easier imports
__all__ = [
    'get_database',
    'insert_lead',
    'insert_duplicate_lead',
    'update_lead_source',
    'find_duplicate_lead',
    'get_duplicate_leads',
    'get_duplicate_leads_count',
    'async_db'
]