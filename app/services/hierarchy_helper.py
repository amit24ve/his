"""
Hierarchy Helper Service - Provides hierarchy-based access control for all modules
"""

from typing import List, Dict, Any, Optional
from app.database import db
from app.services.user_hierarchy_service import UserHierarchyService
import logging

logger = logging.getLogger(__name__)

class HierarchyHelper:
    """
    Helper class to provide hierarchy-based access control across all CRM modules
    """
    
    @staticmethod
    async def get_accessible_user_ids(user_id: str, include_self: bool = True) -> List[str]:
        """
        Get list of user IDs that the given user can access based on hierarchy levels.
        Each level can only see their own level and below.
        
        Args:
            user_id: The ID of the user requesting access
            include_self: Whether to include the user's own ID in the result
            
        Returns:
            List of accessible user IDs (same level and below only)
        """
        try:
            accessible_user_ids = []
            
            # Always include self if requested
            if include_self:
                accessible_user_ids.append(user_id)
            
            # Fast check: If user is admin, they can access everyone
            if await HierarchyHelper.is_user_admin(user_id):
                from app.database import users_collection
                all_users = list(users_collection().find(
                    {"is_active": True}, 
                    {"user_id": 1, "_id": 0}
                ).limit(1000))
                
                admin_accessible = [user.get("user_id") for user in all_users if user.get("user_id")]
                logger.info(f"Admin user {user_id} can access {len(admin_accessible)} users")
                return admin_accessible
            
            # Get the user's hierarchy level using role-based hierarchy
            from app.database import get_database
            db = get_database()
            
            user_level = HierarchyHelper._get_user_hierarchy_level(db, user_id)
            logger.info(f"User {user_id} is at hierarchy level {user_level}")
            
            if user_level is None:
                logger.warning(f"Could not determine hierarchy level for user {user_id}")
                return accessible_user_ids  # Only self
            
            # Get all users at same level or below
            all_users = list(db.users.find({"is_active": True}, {"user_id": 1}))
            
            for user in all_users:
                other_user_id = user.get("user_id")
                if other_user_id and other_user_id != user_id:
                    other_user_level = HierarchyHelper._get_user_hierarchy_level(db, other_user_id)
                    
                    # User can access others at same level or below (higher level numbers)
                    if other_user_level is not None and other_user_level >= user_level:
                        accessible_user_ids.append(other_user_id)
                
            logger.info(f"User {user_id} (level {user_level}) can access {len(accessible_user_ids)} users")
            return accessible_user_ids
                
        except Exception as e:
            logger.error(f"Error in get_accessible_user_ids for user {user_id}: {str(e)}")
            return [user_id] if include_self else []  # Fallback to self only

    @staticmethod
    def _get_user_hierarchy_level(db, user_id: str) -> int:
        """
        Get the hierarchy level of a user based on role relationships.
        Level 0: Top-level roles (report_to = None)
        Level 1: Roles that report to Level 0 roles
        Level 2: Roles that report to Level 1 roles, etc.
        """
        try:
            # Get user and their roles
            from app.routes.assigned_leads import get_user_role_hierarchy
            user, user_roles = get_user_role_hierarchy(db, user_id)
            
            if not user_roles:
                return None
            
            # Find the highest level (lowest number) among user's roles
            min_level = float('inf')
            
            for role in user_roles:
                role_level = HierarchyHelper._get_role_hierarchy_level(db, role, set())
                if role_level is not None and role_level < min_level:
                    min_level = role_level
            
            return min_level if min_level != float('inf') else None
            
        except Exception as e:
            logger.error(f"Error getting hierarchy level for user {user_id}: {str(e)}")
            return None
    
    @staticmethod
    def _get_role_hierarchy_level(db, role: dict, visited_roles: set) -> int:
        """
        Get the hierarchy level of a role. Use visited_roles to prevent infinite loops.
        """
        try:
            role_id = role.get("id")
            if not role_id or role_id in visited_roles:
                return None
            
            visited_roles.add(role_id)
            
            report_to = role.get("report_to")
            
            # If no report_to or report_to is null, this is a top-level role (level 0)
            if not report_to or report_to == "null":
                return 0
            
            # Find the parent role
            parent_role = db.roles.find_one({"id": report_to})
            if not parent_role:
                return 0  # If parent not found, treat as top-level
            
            # Get parent's level and add 1
            parent_level = HierarchyHelper._get_role_hierarchy_level(db, parent_role, visited_roles)
            return (parent_level + 1) if parent_level is not None else None
            
        except Exception as e:
            logger.error(f"Error getting role hierarchy level: {str(e)}")
            return None
            
    @staticmethod
    async def _get_subordinates_fast(user_id: str) -> List[str]:
        """
        Fast method to get subordinates using simple database queries
        """
        subordinate_user_ids = []
        
        try:
            from app.database import users_collection
            
            # Method 1: Direct reports using reports_to field
            direct_reports = list(users_collection().find(
                {"reports_to": user_id, "is_active": True}, 
                {"user_id": 1, "_id": 0}
            ).limit(50))
            
            for report in direct_reports:
                user_id_field = report.get("user_id")
                if user_id_field:
                    subordinate_user_ids.append(user_id_field)
            
            return subordinate_user_ids
            
        except Exception as e:
            logger.warning(f"Error in fast subordinates lookup for user {user_id}: {str(e)}")
            return []

    @staticmethod
    async def _get_subordinates_fallback(user_id: str) -> List[str]:
        """
        Fallback method to get subordinates using direct database queries
        """
        subordinate_user_ids = []
        
        try:
            from app.database import async_db, users_collection, roles_collection
            
            # Method 1: Check for users with reports_to field pointing to this user
            if async_db is not None:
                direct_reports = await async_db.users.find(
                    {"reports_to": user_id, "is_active": True}
                ).to_list(length=100)
            else:
                # Fallback to synchronous database
                direct_reports = list(users_collection().find(
                    {"reports_to": user_id, "is_active": True}
                ).limit(100))
            
            for report in direct_reports:
                user_id_field = report.get("user_id") or report.get("id") or str(report.get("_id"))
                if user_id_field:
                    subordinate_user_ids.append(user_id_field)
            
            # Method 2: Check role hierarchy
            if async_db is not None:
                current_user = await async_db.users.find_one({"user_id": user_id})
            else:
                current_user = users_collection().find_one({"user_id": user_id})
                
            if current_user and current_user.get("role_ids"):
                current_role_id = current_user["role_ids"][0]
                
                # Find roles that report to this user's role
                if async_db is not None:
                    subordinate_roles = await async_db.roles.find({"report_to": current_role_id}).to_list(length=100)
                else:
                    subordinate_roles = list(roles_collection.find({"report_to": current_role_id}).limit(100))
                
                if subordinate_roles:
                    subordinate_role_ids = [role["id"] for role in subordinate_roles]
                    
                    # Find users with these subordinate roles
                    if async_db is not None:
                        role_users = await async_db.users.find(
                            {"role_ids": {"$in": subordinate_role_ids}, "is_active": True}
                        ).to_list(length=100)
                    else:
                        role_users = list(users_collection().find(
                            {"role_ids": {"$in": subordinate_role_ids}, "is_active": True}
                        ).limit(100))
                    
                    for role_user in role_users:
                        user_id_field = role_user.get("user_id") or role_user.get("id") or str(role_user.get("_id"))
                        if user_id_field and user_id_field not in subordinate_user_ids:
                            subordinate_user_ids.append(user_id_field)
            
            return subordinate_user_ids
            
        except Exception as e:
            logger.warning(f"Error in subordinates fallback for user {user_id}: {str(e)}")
            return []
    
    @staticmethod
    async def is_user_admin(user_id: str) -> bool:
        """
        Check if a user has admin privileges
        """
        try:
            from app.database import users_collection, roles_collection
            
            # Use synchronous database operations
            user = users_collection().find_one({"user_id": user_id})
                
            if not user:
                return False
                
            # Check if user has admin role
            roles = user.get("roles", [])
            if "admin" in roles:
                return True
                
            # Check role_ids for admin role
            if user.get("role_ids"):
                for role_id in user["role_ids"]:
                    role = roles_collection.find_one({"id": role_id})
                        
                    if role and role.get("name", "").lower() == "admin":
                        return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking admin status for user {user_id}: {str(e)}")
            return False
    
    @staticmethod
    async def can_access_resource(user_id: str, resource_owner_id: str) -> bool:
        """
        Check if a user can access a resource owned by another user
        
        Args:
            user_id: The ID of the user requesting access
            resource_owner_id: The ID of the user who owns the resource
            
        Returns:
            True if access is allowed, False otherwise
        """
        try:
            # User can always access their own resources
            if user_id == resource_owner_id:
                return True
            
            # Admin users can access everything
            if await HierarchyHelper.is_user_admin(user_id):
                return True
            
            # Check if the resource owner is in the user's accessible list
            accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
            return resource_owner_id in accessible_user_ids
            
        except Exception as e:
            logger.error(f"Error checking resource access: user={user_id}, owner={resource_owner_id}, error={str(e)}")
            return False
    
    @staticmethod
    def create_hierarchy_filter(user_id: str, accessible_user_ids: List[str], owner_field: str = "assigned_to") -> Dict[str, Any]:
        """
        Create a MongoDB filter for hierarchy-based access control
        
        Args:
            user_id: The ID of the user requesting access
            accessible_user_ids: List of user IDs the user can access
            owner_field: The field name that contains the owner/assignee ID
            
        Returns:
            MongoDB filter dict
        """
        return {
            "$or": [
                {owner_field: {"$in": accessible_user_ids}},
                {"created_by": {"$in": accessible_user_ids}},
                {"assigned_by": {"$in": accessible_user_ids}}
            ]
        }
    
    @staticmethod
    def create_multi_field_hierarchy_filter(user_id: str, accessible_user_ids: List[str], 
                                          owner_fields: List[str] = None) -> Dict[str, Any]:
        """
        Create a MongoDB filter for hierarchy-based access control with multiple owner fields
        
        Args:
            user_id: The ID of the user requesting access
            accessible_user_ids: List of user IDs the user can access
            owner_fields: List of field names that can contain owner/assignee IDs
            
        Returns:
            MongoDB filter dict
        """
        if owner_fields is None:
            owner_fields = ["assigned_to", "assigned_user_id", "owner_id", "user_id"]
        
        conditions = []
        
        # Add conditions for each owner field
        for field in owner_fields:
            conditions.append({field: {"$in": accessible_user_ids}})
        
        # Add common created_by condition
        conditions.append({"created_by": {"$in": accessible_user_ids}})
        
        return {"$or": conditions}
