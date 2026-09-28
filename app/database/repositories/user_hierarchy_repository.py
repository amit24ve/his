"""
User Hierarchy Repository - Database operations for user hierarchy management
"""

from typing import Dict, List, Optional, Any
from app.database import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Helper function to get async database
def get_async_db():
    try:
        from app.database import async_db
        return async_db
    except ImportError:
        return None

class UserHierarchyRepository:
    """
    Repository class for user hierarchy database operations
    """
    
    @staticmethod
    async def create_hierarchy(user_id: str, reporting_user_id: Optional[str] = None, level: int = 0) -> Dict:
        """
        Create a new user hierarchy relationship
        
        Args:
            user_id: The ID of the user to add to hierarchy
            reporting_user_id: The ID of the user's manager/supervisor (None for top level)
            level: The hierarchy level (0 for top level)
            
        Returns:
            The created hierarchy record
            
        Raises:
            ValueError: If user already exists in hierarchy
        """
        try:
            # Check if user already exists in hierarchy
            existing = db.user_hierarchy.find_one({"user_id": user_id})
                
            if existing:
                raise ValueError(f"User {user_id} already exists in hierarchy")
            
            # Create hierarchy record
            hierarchy_record = {
                "user_id": user_id,
                "reporting_user_id": reporting_user_id,
                "level": level,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            result = db.user_hierarchy.insert_one(hierarchy_record)
                
            hierarchy_record["_id"] = str(result.inserted_id)
            
            logger.info(f"Created hierarchy for user {user_id}, reporting to {reporting_user_id}, level {level}")
            return hierarchy_record
            
        except Exception as e:
            logger.error(f"Error creating hierarchy for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    async def update_hierarchy(user_id: str, reporting_user_id: Optional[str] = None) -> Dict:
        """
        Update a user's reporting relationship
        
        Args:
            user_id: The ID of the user to update
            reporting_user_id: The new reporting user ID (None for top level)
            
        Returns:
            The updated hierarchy record
            
        Raises:
            ValueError: If user not found in hierarchy
        """
        try:
            # Determine new level based on reporting user
            level = 0
            if reporting_user_id:
                reporting_hierarchy = await UserHierarchyRepository.get_hierarchy(reporting_user_id)
                if reporting_hierarchy:
                    level = reporting_hierarchy["level"] + 1
                else:
                    # If reporting user not in hierarchy, assume they are level 0
                    level = 1
            
            # Update hierarchy record
            update_data = {
                "reporting_user_id": reporting_user_id,
                "level": level,
                "updated_at": datetime.now()
            }
            
            result = await db.user_hierarchy.update_one(
                {"user_id": user_id},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                raise ValueError(f"User {user_id} not found in hierarchy")
            
            # Return updated record
            updated_record = await db.user_hierarchy.find_one({"user_id": user_id})
            if updated_record:
                updated_record["_id"] = str(updated_record["_id"])
            
            logger.info(f"Updated hierarchy for user {user_id}, new reporting user: {reporting_user_id}")
            return updated_record
            
        except Exception as e:
            logger.error(f"Error updating hierarchy for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    async def delete_hierarchy(user_id: str) -> bool:
        """
        Delete a user from the hierarchy
        
        Args:
            user_id: The ID of the user to remove from hierarchy
            
        Returns:
            True if deleted, False if not found
        """
        try:
            result = await db.user_hierarchy.delete_one({"user_id": user_id})
            deleted = result.deleted_count > 0
            
            if deleted:
                logger.info(f"Deleted hierarchy for user {user_id}")
            else:
                logger.warning(f"User {user_id} not found in hierarchy for deletion")
                
            return deleted
            
        except Exception as e:
            logger.error(f"Error deleting hierarchy for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    async def get_hierarchy(user_id: str) -> Optional[Dict]:
        """
        Get a user's hierarchy record
        
        Args:
            user_id: The ID of the user
            
        Returns:
            The user's hierarchy record or None if not found
            
        Raises:
            ValueError: If user not found in hierarchy
        """
        try:
            hierarchy = db.user_hierarchy.find_one({"user_id": user_id})
                
            if not hierarchy:
                raise ValueError(f"User {user_id} not found in hierarchy")
            
            hierarchy["_id"] = str(hierarchy["_id"])
            return hierarchy
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error getting hierarchy for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    async def get_user_with_details(user_id: str, users_collection) -> Optional[Dict]:
        """
        Get a user's hierarchy record with user details
        
        Args:
            user_id: The ID of the user
            users_collection: Users collection reference
            
        Returns:
            The user's hierarchy with user details
        """
        try:
            hierarchy = await UserHierarchyRepository.get_hierarchy(user_id)
            if not hierarchy:
                return None
            
            # Get user details
            user = await users_collection.find_one({"user_id": user_id})
            if user:
                hierarchy["user"] = user
            
            return hierarchy
            
        except ValueError:
            return None
        except Exception as e:
            logger.error(f"Error getting user details for {user_id}: {str(e)}")
            return None
    
    @staticmethod
    async def get_team_structure(user_id: str, users_collection) -> Dict:
        """
        Get a user's complete team structure (seniors, peers, subordinates)
        
        Args:
            user_id: The ID of the user
            users_collection: Users collection reference
            
        Returns:
            Dict with seniors, peers, and subordinates
        """
        try:
            # Get user's hierarchy record
            user_hierarchy = await UserHierarchyRepository.get_hierarchy(user_id)
            if not user_hierarchy:
                # Return empty structure if user not in hierarchy
                return {
                    "user": {"user_id": user_id},
                    "seniors": [],
                    "peers": [],
                    "subordinates": []
                }
            
            user_level = user_hierarchy.get("level", 0)
            reporting_user_id = user_hierarchy.get("reporting_user_id")
            
            # Get seniors (users at higher levels in the same chain)
            seniors = []
            if reporting_user_id:
                # Get immediate senior
                senior_user = await users_collection.find_one({"user_id": reporting_user_id})
                if senior_user:
                    seniors.append({
                        "user_id": reporting_user_id,
                        "user": senior_user,
                        "level": user_level - 1
                    })
            
            # Get peers (users at same level with same reporting user)
            peers = []
            if reporting_user_id:
                peer_hierarchies = await db.user_hierarchy.find({
                    "reporting_user_id": reporting_user_id,
                    "level": user_level,
                    "user_id": {"$ne": user_id}
                }).to_list(length=100)
                
                for peer_hierarchy in peer_hierarchies:
                    peer_user = await users_collection.find_one({"user_id": peer_hierarchy["user_id"]})
                    if peer_user:
                        peers.append({
                            "user_id": peer_hierarchy["user_id"],
                            "user": peer_user,
                            "level": user_level
                        })
            
            # Get subordinates (users reporting to this user)
            subordinates = []
            subordinate_hierarchies = await db.user_hierarchy.find({
                "reporting_user_id": user_id
            }).to_list(length=100)
            
            for sub_hierarchy in subordinate_hierarchies:
                sub_user = await users_collection.find_one({"user_id": sub_hierarchy["user_id"]})
                if sub_user:
                    subordinates.append({
                        "user_id": sub_hierarchy["user_id"],
                        "user": sub_user,
                        "level": sub_hierarchy.get("level", user_level + 1)
                    })
            
            # Get current user details
            current_user = await users_collection.find_one({"user_id": user_id})
            
            return {
                "user": current_user or {"user_id": user_id},
                "seniors": seniors,
                "peers": peers,
                "subordinates": subordinates
            }
            
        except Exception as e:
            logger.error(f"Error getting team structure for user {user_id}: {str(e)}")
            # Return minimal structure on error
            return {
                "user": {"user_id": user_id},
                "seniors": [],
                "peers": [],
                "subordinates": []
            }
    
    @staticmethod
    async def get_all_users_hierarchy(users_collection) -> List[Dict]:
        """
        Get all users in the hierarchy with their details
        
        Args:
            users_collection: Users collection reference
            
        Returns:
            List of all hierarchy records with user details
        """
        try:
            hierarchies = await db.user_hierarchy.find({}).to_list(length=1000)
            
            result = []
            for hierarchy in hierarchies:
                hierarchy["_id"] = str(hierarchy["_id"])
                
                # Get user details
                user = await users_collection.find_one({"user_id": hierarchy["user_id"]})
                if user:
                    hierarchy["user"] = user
                
                result.append(hierarchy)
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting all hierarchies: {str(e)}")
            return []
    
    @staticmethod
    async def get_subordinates_recursive(user_id: str) -> List[str]:
        """
        Get all subordinates of a user recursively (direct and indirect)
        
        Args:
            user_id: The ID of the user
            
        Returns:
            List of all subordinate user IDs
        """
        try:
            all_subordinates = []
            
            # Get direct subordinates
            direct_subordinates = await db.user_hierarchy.find({
                "reporting_user_id": user_id
            }).to_list(length=100)
            
            for subordinate in direct_subordinates:
                sub_user_id = subordinate["user_id"]
                all_subordinates.append(sub_user_id)
                
                # Recursively get their subordinates
                indirect_subordinates = await UserHierarchyRepository.get_subordinates_recursive(sub_user_id)
                all_subordinates.extend(indirect_subordinates)
            
            return all_subordinates
            
        except Exception as e:
            logger.error(f"Error getting recursive subordinates for user {user_id}: {str(e)}")
            return []
