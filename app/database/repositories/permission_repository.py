from typing import Dict, List, Optional, Any
from datetime import datetime
from bson import ObjectId

class PermissionRepository:
    def __init__(self):
        from app.database import db
        self.collection = db["permissions"]
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] PermissionRepository initialized successfully")
    
    def create_permission(self, permission_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            # Add timestamps if not already present
            if "created_at" not in permission_data:
                permission_data["created_at"] = datetime.now()
            if "updated_at" not in permission_data:
                permission_data["updated_at"] = datetime.now()
            
            # Generate an ID if not provided
            if "id" not in permission_data:
                permission_data["id"] = str(ObjectId())
                
            # Insert permission
            result = self.collection.insert_one(permission_data)
            
            if result.acknowledged:
                # Get the created permission
                created_permission = self.collection.find_one({"_id": result.inserted_id})
                
                if created_permission:
                    # Convert MongoDB _id to string id for API response
                    return {
                        "id": str(created_permission["_id"]),
                        "name": created_permission["name"],
                        "code": created_permission["code"],
                        "description": created_permission.get("description"),
                        "resource": created_permission.get("resource"),
                        "created_at": created_permission.get("created_at"),
                        "updated_at": created_permission.get("updated_at"),
                        "created_by": created_permission.get("created_by")
                    }
                    
            return None
            
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error creating permission: {str(e)}")
            return None
    
    def get_permission_by_id(self, permission_id: str) -> Optional[Dict[str, Any]]:
        """Get permission by ID"""
        try:
            # Try to find by id field first
            permission = self.collection.find_one({"id": permission_id})
            
            # If not found, try by _id
            if not permission and ObjectId.is_valid(permission_id):
                permission = self.collection.find_one({"_id": ObjectId(permission_id)})
                
            if permission:
                # Ensure permission has id field
                permission["id"] = permission.get("id") or str(permission["_id"])
                return permission
                
            return None
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting permission by ID: {str(e)}")
            return None
    
    def get_permission_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get permission by code"""
        try:
            permission = self.collection.find_one({"code": code})
            if permission:
                # Ensure permission has id field
                permission["id"] = permission.get("id") or str(permission["_id"])
            return permission
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting permission by code: {str(e)}")
            return None
    
    def get_all_permissions(self) -> List[Dict[str, Any]]:
        """Get all permissions"""
        try:
            permissions = list(self.collection.find())
            # Ensure all permissions have id field and remove _id ObjectId
            result = []
            for permission in permissions:
                permission["id"] = permission.get("id") or str(permission["_id"])
                permission.pop("_id", None)
                result.append(permission)
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrieved {len(result)} permissions from database")
            return result
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting all permissions: {str(e)}")
            return []
    
    def get_permissions_by_resource(self, resource: str) -> List[Dict[str, Any]]:
        """Get permissions by resource"""
        try:
            permissions = list(self.collection.find({"resource": resource}))
            # Ensure all permissions have id field
            for permission in permissions:
                permission["id"] = permission.get("id") or str(permission["_id"])
            return permissions
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting permissions by resource: {str(e)}")
            return []
    
    def update_permission(self, permission_id: str, permission_data: Dict[str, Any]) -> bool:
        """Update a permission by ID"""
        try:
            # Update updated_at timestamp
            permission_data["updated_at"] = datetime.now()
            
            # Try updating by id field first
            result = self.collection.update_one({"id": permission_id}, {"$set": permission_data})
            
            # If not found, try by _id
            if result.matched_count == 0 and ObjectId.is_valid(permission_id):
                result = self.collection.update_one({"_id": ObjectId(permission_id)}, {"$set": permission_data})
                
            return result.modified_count > 0
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error updating permission: {str(e)}")
            return False
    
    def delete_permission(self, permission_id: str) -> bool:
        """Delete a permission by ID"""
        try:
            # Try deleting by id field first
            result = self.collection.delete_one({"id": permission_id})
            
            # If not found, try by _id
            if result.deleted_count == 0 and ObjectId.is_valid(permission_id):
                result = self.collection.delete_one({"_id": ObjectId(permission_id)})
                
            return result.deleted_count > 0
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error deleting permission: {str(e)}")
            return False
    
    def get_permissions_by_codes(self, permission_codes: List[str]) -> List[Dict[str, Any]]:
        """
        Get multiple permissions by their codes
        
        Args:
            permission_codes: List of permission codes
            
        Returns:
            List[Dict[str, Any]]: List of permission documents
        """
        try:
            permissions = list(self.collection.find({"code": {"$in": permission_codes}}))
            # Ensure all permissions have id field
            for permission in permissions:
                permission["id"] = permission.get("id") or str(permission["_id"])
            return permissions
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting permissions by codes: {str(e)}")
            return []