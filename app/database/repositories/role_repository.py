# from typing import Dict, List, Optional, Any
# from datetime import datetime
# from bson import ObjectId

# class RoleRepository:
#     def __init__(self):
#         from app.database import db, roles_collection
#         self.collection = roles_collection
#         print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] RoleRepository initialized successfully")
#     # Add this method to fix the error
#     def list_roles(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
#         """
#         Get a list of all roles with pagination (compatibility method)
        
#         This method calls get_all_roles() for backward compatibility
#         """
#         try:
#             roles = self.get_all_roles()
#             # Apply pagination
#             paginated_roles = roles[skip:skip+limit] if roles else []
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrieved {len(paginated_roles)} roles from database (paginated)")
#             return paginated_roles
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error listing roles: {str(e)}")
#             return []
    
#     def create_role(self, role_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
#         try:
#             # Add timestamps if not already present
#             if "created_at" not in role_data:
#                 role_data["created_at"] = datetime.now()
#             if "updated_at" not in role_data:
#                 role_data["updated_at"] = datetime.now()
                
#             # Insert role
#             result = self.collection.insert_one(role_data)
            
#             if result.acknowledged:
#                 # Get the created role
#                 created_role = self.collection.find_one({"_id": result.inserted_id})
                
#                 if created_role:
#                     # Convert MongoDB _id to string id for API response
#                     return {
#                         "id": str(created_role["_id"]),
#                         "name": created_role["name"],
#                         "description": created_role.get("description"),
#                         "permissions": created_role.get("permissions", []),
#                         "created_at": created_role.get("created_at", datetime.now()),
#                         "updated_at": created_role.get("updated_at"),
#                         "created_by": created_role.get("created_by")
#                     }
                    
#             return None
            
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error creating role: {str(e)}")
#             return None
    
#     # Rest of your methods remain the same...
#     def get_role_by_id(self, role_id: str) -> Optional[Dict[str, Any]]:
#         """Get role by ID"""
#         try:
#             # Try to find by id field first
#             role = self.collection.find_one({"id": role_id})
            
#             # If not found, try by _id
#             if not role and ObjectId.is_valid(role_id):
#                 role = self.collection.find_one({"_id": ObjectId(role_id)})
                
#             if role:
#                 # Ensure role has id field
#                 role["id"] = role.get("id") or str(role["_id"])
#                 return role
                
#             return None
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting role by ID: {str(e)}")
#             return None
    
#     def get_role_by_name(self, name: str) -> Optional[Dict[str, Any]]:
#         """Get role by name"""
#         try:
#             role = self.collection.find_one({"name": name})
#             if role:
#                 # Ensure role has id field
#                 role["id"] = role.get("id") or str(role["_id"])
#             return role
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting role by name: {str(e)}")
#             return None
    
#     def get_all_roles(self) -> List[Dict[str, Any]]:
#         """Get all roles"""
#         try:
#             roles = list(self.collection.find())
#             current_time = datetime.now()
            
#             # Ensure all roles have required fields for RoleResponse model
#             for role in roles:
#                 # Ensure role has id field
#                 role["id"] = role.get("id") or str(role["_id"])
                
#                 # Ensure role has created_at field (required by RoleResponse)
#                 if "created_at" not in role:
#                     role["created_at"] = current_time
                    
#                     # Also update in database for future requests
#                     self.collection.update_one(
#                         {"_id": role["_id"]},
#                         {"$set": {"created_at": current_time}}
#                     )
                
#                 # Ensure permissions field exists (even if empty)
#                 if "permissions" not in role:
#                     role["permissions"] = []
                    
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrieved {len(roles)} roles from database")
#             return roles
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting all roles: {str(e)}")
#             return []
    
#     def update_role(self, role_id: str, role_data: Dict[str, Any]) -> bool:
#         """Update a role by ID"""
#         try:
#             # Update updated_at timestamp
#             role_data["updated_at"] = datetime.now()
            
#             # Try updating by id field first
#             result = self.collection.update_one({"id": role_id}, {"$set": role_data})
            
#             # If not found, try by _id
#             if result.matched_count == 0 and ObjectId.is_valid(role_id):
#                 result = self.collection.update_one({"_id": ObjectId(role_id)}, {"$set": role_data})
                
#             return result.modified_count > 0
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error updating role: {str(e)}")
#             return False
        
#     def get_role(self, role_id: str) -> Optional[Dict[str, Any]]:
#         """
#         Get role by ID (compatibility method)
        
#         Args:
#             role_id: ID of the role
            
#         Returns:
#             Optional[Dict[str, Any]]: Role document or None if not found
#         """
#         try:
#             # Simply call the existing get_role_by_id method
#             return self.get_role_by_id(role_id)
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error in get_role: {str(e)}")
#             return None
    
#     def delete_role(self, role_id):
#         """Delete a role by ID"""
#         try:
#             # Convert string ID to ObjectId if needed
#             if isinstance(role_id, str):
#                 role_id = ObjectId(role_id)
                
#             # Delete the role
#             result = self.collection.delete_one({"_id": role_id})
            
#             # Check if deletion was successful
#             if result.deleted_count > 0:
#                 print(f"[INFO] Successfully deleted role with ID {role_id}")
#                 return True
#             else:
#                 print(f"[ERROR] Role with ID {role_id} not found for deletion")
#                 return False
                
#         except Exception as e:
#             print(f"[ERROR] Failed to delete role: {str(e)}")
#             import traceback
#             traceback.print_exc()
#             return False
    
#     def get_roles_by_ids(self, role_ids: List[str]) -> List[Dict[str, Any]]:
#         """Get multiple roles by their IDs"""
#         roles = []
        
#         try:
#             for role_id in role_ids:
#                 # Try to get role by id field first
#                 role = self.collection.find_one({"id": role_id})
                
#                 # If not found, try by _id
#                 if not role and ObjectId.is_valid(role_id):
#                     role = self.collection.find_one({"_id": ObjectId(role_id)})
                    
#                 if role:
#                     # Ensure role has id field
#                     role["id"] = role.get("id") or str(role["_id"])
#                     roles.append(role)
#         except Exception as e:
#             print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting roles by IDs: {str(e)}")
            
#         return roles


from typing import Dict, List, Optional, Any
from datetime import datetime
from bson import ObjectId

class RoleRepository:
    def __init__(self):
        from app.database import roles_collection
        self.collection = roles_collection()  # call the function to get the actual collection
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] RoleRepository initialized successfully")
    
    def list_roles(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        try:
            roles = self.get_all_roles()
            paginated_roles = roles[skip:skip+limit] if roles else []
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrieved {len(paginated_roles)} roles from database (paginated)")
            return paginated_roles
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error listing roles: {str(e)}")
            return []

    def create_role(self, role_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            if "created_at" not in role_data:
                role_data["created_at"] = datetime.now()
            if "updated_at" not in role_data:
                role_data["updated_at"] = datetime.now()
            result = self.collection.insert_one(role_data)
            if result.acknowledged:
                created_role = self.collection.find_one({"_id": result.inserted_id})
                if created_role:
                    return {
                        "id": created_role.get("id") or str(created_role["_id"]),
                        "name": created_role["name"],
                        "description": created_role.get("description"),
                        "permissions": created_role.get("permissions", []),
                        "created_at": created_role.get("created_at", datetime.now()),
                        "updated_at": created_role.get("updated_at"),
                        "created_by": created_role.get("created_by")
                    }
            return None
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error creating role: {str(e)}")
            return None

    def get_role_by_id(self, role_id: str) -> Optional[Dict[str, Any]]:
        try:
            # Primary: search by custom id field (Ro-XXX or any string)
            role = self.collection.find_one({"id": role_id})
            # Fallback: if it looks like a 24-hex ObjectId, search by _id
            if not role and ObjectId.is_valid(role_id):
                role = self.collection.find_one({"_id": ObjectId(role_id)})
            if role:
                # Ensure the id field is always a Ro-XXX (or at least a string)
                role["id"] = role.get("id") or str(role["_id"])
                return role
            return None
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting role by ID: {str(e)}")
            return None

    def get_role_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            role = self.collection.find_one({"name": name})
            if role:
                role["id"] = role.get("id") or str(role["_id"])
            return role
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting role by name: {str(e)}")
            return None

    def get_all_roles(self) -> List[Dict[str, Any]]:
        try:
            import re
            roles = list(self.collection.find())
            current_time = datetime.now()

            # Collect all already-assigned Ro-XXX numbers
            used_nums = set()
            for r in roles:
                m = re.match(r"Ro-(\d+)$", str(r.get("id", "")))
                if m:
                    used_nums.add(int(m.group(1)))

            def _next_available() -> int:
                """Return the lowest positive integer not yet in used_nums."""
                n = 1
                while n in used_nums:
                    n += 1
                used_nums.add(n)
                return n

            for role in roles:
                raw_id = str(role.get("id", ""))
                # Migrate if id is missing or still a raw 24-hex ObjectId
                if not raw_id or re.fullmatch(r"[0-9a-f]{24}", raw_id):
                    new_id = f"Ro-{str(_next_available()).zfill(3)}"
                    self.collection.update_one({"_id": role["_id"]}, {"$set": {"id": new_id}})
                    role["id"] = new_id

                if "created_at" not in role:
                    role["created_at"] = current_time
                    self.collection.update_one(
                        {"_id": role["_id"]},
                        {"$set": {"created_at": current_time}}
                    )
                if "permissions" not in role:
                    role["permissions"] = []

            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrieved {len(roles)} roles from database")
            return roles
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting all roles: {str(e)}")
            return []

    # def update_role(self, role_id: str, role_data: Dict[str, Any]) -> bool:
    #     try:
    #         role_data["updated_at"] = datetime.now()
    #         result = self.collection.update_one({"id": role_id}, {"$set": role_data})
    #         if result.matched_count == 0 and ObjectId.is_valid(role_id):
    #             result = self.collection.update_one({"_id": ObjectId(role_id)}, {"$set": role_data})
    #         return result.modified_count > 0
    #     except Exception as e:
    #         print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error updating role: {str(e)}")
    #         return False
    
    def update_role_using_name(self, role_name: str, role_data: Dict[str, Any]) -> bool:
        try:
            role_data["updated_at"] = datetime.now()
            result = self.collection.update_one({"name": role_name}, {"$set": role_data})
            if result.matched_count == 0:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] No role found with name {role_name} for update")
                return False
            return result.modified_count > 0
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error updating role by name: {str(e)}")
            return False
    
    def update_role(self, role_id: str, role_data: Dict[str, Any]) -> bool:
        try:
            role_data["updated_at"] = datetime.now()
            # Try update by custom 'id' (Ro-XXX)
            result = self.collection.update_one({"id": role_id}, {"$set": role_data})
            if result.matched_count == 0 and ObjectId.is_valid(role_id):
                # Fallback: update by MongoDB '_id' if role_id is an ObjectId string
                result = self.collection.update_one({"_id": ObjectId(role_id)}, {"$set": role_data})
            # Consider an update "successful" if any document was matched, even if not actually modified
            return result.matched_count > 0
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error updating role: {str(e)}")
            return False

    def get_role(self, role_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.get_role_by_id(role_id)
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error in get_role: {str(e)}")
            return None

    def get_role_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            role = self.collection.find_one({"name": name})
            if role:
                role["id"] = role.get("id") or str(role["_id"])
            return role
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting role by name: {str(e)}")
            return None
    
    def delete_role(self, role_id):
        try:
            # Try by id field first
            result = self.collection.delete_one({"id": role_id})
            # If not found, try by _id
            if result.deleted_count == 0 and ObjectId.is_valid(role_id):
                result = self.collection.delete_one({"_id": ObjectId(role_id)})
            if result.deleted_count > 0:
                print(f"[INFO] Successfully deleted role with ID {role_id}")
                return True
            else:
                print(f"[ERROR] Role with ID {role_id} not found for deletion")
                return False
        except Exception as e:
            print(f"[ERROR] Failed to delete role: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def get_roles_by_ids(self, role_ids: List[str]) -> List[Dict[str, Any]]:
        roles = []
        try:
            for role_id in role_ids:
                role = self.collection.find_one({"id": role_id})
                if not role and ObjectId.is_valid(role_id):
                    role = self.collection.find_one({"_id": ObjectId(role_id)})
                if role:
                    role["id"] = role.get("id") or str(role["_id"])
                    roles.append(role)
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting roles by IDs: {str(e)}")
        return roles

    # --- FIX: get_last_role method for Ro-XXX id format ---
    def get_last_role(self) -> Optional[Dict[str, Any]]:
        """
        Return the role with the highest numeric value in the id (e.g., Ro-001, Ro-002, ...)
        """
        try:
            import re
            # Only check roles with id like Ro-XXX
            roles = list(self.collection.find({"id": {"$regex": "^Ro-\\d{3}$"}}))
            max_num = -1
            last_role = None
            for role in roles:
                match = re.match(r"Ro-(\d{3})", role["id"])
                if match:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
                        last_role = role
            return last_role
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error in get_last_role: {str(e)}")
            return None\
                
    def get_max_role_number(self) -> int:
        """
        Returns the first positive integer NOT already used as a Ro-XXX id.
        This ensures new roles always start from Ro-001 if the collection is empty,
        or fill the first available gap.
        """
        import re
        all_roles = list(self.collection.find({"id": {"$regex": "^Ro-\\d+$"}}, {"id": 1}))
        used = set()
        for r in all_roles:
            m = re.match(r"Ro-(\d+)$", str(r.get("id", "")))
            if m:
                used.add(int(m.group(1)))
        n = 1
        while n in used:
            n += 1
        # Return n-1 because the caller does max_num + 1
        return n - 1