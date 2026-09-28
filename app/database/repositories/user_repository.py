from datetime import datetime
from typing import Dict, List, Optional, Any
from bson import ObjectId
from pymongo.collection import Collection
from app.database import db, roles_collection, users_collection
import logging

# Set up logging
logger = logging.getLogger(__name__)


def convert_objectid_to_string(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert all ObjectId fields in a document to strings for JSON serialization"""
    if not doc:
        return doc
    
    # Convert _id to id field
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        # Remove the original _id to avoid confusion
        del doc["_id"]
    
    # Convert any other ObjectId fields to strings
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            doc[key] = str(value)
        elif isinstance(value, list):
            # Handle lists that might contain ObjectIds
            doc[key] = [str(item) if isinstance(item, ObjectId) else item for item in value]
        elif isinstance(value, dict):
            # Recursively handle nested dictionaries
            doc[key] = convert_objectid_to_string(value)
    
    return doc


class UserRepository:
    def __init__(self):
        self.collection: Collection = users_collection()
        
        # Ensure indexes safely
        try:
            # Import the safe_create_index function
            from app.database import safe_create_index
            safe_create_index(self.collection, [("username", 1)], unique=True, name="username_unique_idx")
            safe_create_index(self.collection, [("email", 1)], unique=True, name="email_unique_idx")
        except Exception as e:
            logger.warning(f"Could not create indexes for users collection: {e}")
            # Continue without indexes rather than failing
    
    def create_user(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            # Add timestamps
            user_data["created_at"] = datetime.now()
            user_data["updated_at"] = datetime.now()

            # --- Store roles as a string, e.g., roles: "painter" ---
            # Accept `roles` as a single string in user_data, or fallback to role_ids if present
            role_value = None

            # Prefer 'roles' if already present in user_data
            if "roles" in user_data and isinstance(user_data["roles"], str):
                role_value = user_data["roles"]
            # Otherwise, try to build from role_ids
            elif "role_ids" in user_data:
                role_ids = user_data.get("role_ids", [])
                if isinstance(role_ids, list) and len(role_ids) == 1:
                    # Lookup role name from role_id
                    role_doc = roles_collection.find_one({"id": role_ids[0]})
                    if role_doc and "name" in role_doc:
                        role_value = role_doc["name"]
                    else:
                        role_value = role_ids[0]
                elif isinstance(role_ids, str):
                    # If it's a string, use as is
                    role_value = role_ids

            # Set roles as a string in user_data
            if role_value:
                user_data["roles"] = role_value
            else:
                # Default fallback, set as empty string
                user_data["roles"] = ""

            # Insert user
            result = self.collection.insert_one(user_data)

            if result.acknowledged:
                # Get and return the full user document
                created_user = self.collection.find_one({"_id": result.inserted_id})
                if created_user:
                    return self.user_entity(created_user)

            return None

        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error creating user: {str(e)}")
            return None
    
    def user_entity(self, user) -> Dict[str, Any]:
        """Convert MongoDB user document to API response format"""
        # First convert any ObjectIds to strings
        user = convert_objectid_to_string(user)
        
        # Ensure roles is always a list
        roles = user.get("roles", [])
        if isinstance(roles, str):
            roles = [roles] if roles else []
        elif not isinstance(roles, list):
            roles = []
        
        return {
            "id": user.get("id", str(user.get("_id", ""))),
            "username": user["username"],
            "email": user["email"],
            "full_name": user.get("full_name", ""),
            "phone": user.get("phone"),
            "department": user.get("department"),
            "roles": roles,
            "role_ids": user.get("role_ids", []),
            "is_active": user.get("is_active", True),
            "reporting_user_id": user.get("reporting_user_id"),
            "hospital_id": user.get("hospital_id"),
            "hospital_name": user.get("hospital_name"),
            "created_at": user.get("created_at", datetime.now()),
            "updated_at": user.get("updated_at")
        }
        
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID - supports both ObjectId and user_id field"""
        try:
            # Try to find by user_id field first (for role-based IDs like USR-101)
            user = self.collection.find_one({"user_id": user_id})
            
            # If not found and it's a valid ObjectId, try _id field
            if not user and ObjectId.is_valid(user_id):
                user = self.collection.find_one({"_id": ObjectId(user_id)})
            
            if user:
                # Convert ObjectIds to strings for JSON serialization
                user = convert_objectid_to_string(user)
                
                # Ensure created_at is present
                if "created_at" not in user:
                    user["created_at"] = datetime.now()
                    
                # Ensure updated_at is present
                if "updated_at" not in user:
                    user["updated_at"] = datetime.now()
                
            return user
        except Exception as e:
            print(f"Error in get_user_by_id: {e}")
            return None
        
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        try:
            user = self.collection.find_one({"username": username})
            
            if user:
                # Convert ObjectIds to strings for JSON serialization
                user = convert_objectid_to_string(user)
                return user
                
            return None
            
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting user by username {username}: {str(e)}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        user = self.collection.find_one({"email": email})
        if user:
            user["id"] = str(user.pop("_id"))
        return user
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user information"""
        if not ObjectId.is_valid(user_id):
            return False
        result = self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    def update_last_login(self, user_id: str) -> bool:
        """Update user's last login time"""
        if not ObjectId.is_valid(user_id):
            return False
        result = self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.now()}}
        )
        return result.modified_count > 0
    
    def delete_user(self, user_id: str) -> bool:
        """Delete a user"""
        if not ObjectId.is_valid(user_id):
            return False
        result = self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    
    def list_users(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Get a list of users with pagination"""
        cursor = self.collection.find().skip(skip).limit(limit)
        
        users = []
        for user in cursor:
            # Convert ObjectIds to strings for JSON serialization
            user = convert_objectid_to_string(user)
            
            # Remove password for security
            if "password" in user:
                del user["password"]
                
            users.append(user)
            
        return users
    def get_user_id_by_object_id(self, object_id: str) -> Optional[str]:
        """Get user ID by ObjectId"""
        if not ObjectId.is_valid(object_id):
            return None
        user = self.collection.find_one({"_id": ObjectId(object_id)})
        if user:
            return str(user["user_id"])
        return None