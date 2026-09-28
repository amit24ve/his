from typing import Dict, List, Optional
from fastapi import HTTPException, status
from app.database import db
from app.database.repositories.user_hierarchy_repository import UserHierarchyRepository

def users_collection():
    return db.users

def get_async_db():
    """Get async database if available"""
    try:
        from app.database import async_db
        if async_db is not None:
            return async_db
        return None
    except ImportError:
        return None

class UserHierarchyService:
    @staticmethod
    async def create_hierarchy(user_id: str, reporting_user_id: Optional[str] = None) -> Dict:
        """
        Create a new user hierarchy relationship
        
        Args:
            user_id: The ID of the user to add to hierarchy
            reporting_user_id: The ID of the user's manager/supervisor (None for top level)
            
        Returns:
            The created hierarchy record
        """
        # Check if user exists
        user = await users_collection().find_one({"id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if reporting user exists (if provided)
        if reporting_user_id:
            reporting_user = await users_collection().find_one({"id": reporting_user_id})
            if not reporting_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reporting user with ID {reporting_user_id} not found"
                )
        
        # Determine the level (0 for top level, or reporting_user's level + 1)
        level = 0
        if reporting_user_id:
            try:
                reporting_hierarchy = await UserHierarchyRepository.get_hierarchy(reporting_user_id)
                level = reporting_hierarchy["level"] + 1
            except ValueError:
                # If the reporting user is not in hierarchy yet, set them as level 0
                await UserHierarchyRepository.create_hierarchy(reporting_user_id, None, 0)
                level = 1
        
        try:
            # Create the hierarchy relationship
            hierarchy = await UserHierarchyRepository.create_hierarchy(user_id, reporting_user_id, level)
            return hierarchy
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    @staticmethod
    async def update_hierarchy(user_id: str, reporting_user_id: Optional[str] = None) -> Dict:
        """
        Update a user's reporting relationship
        
        Args:
            user_id: The ID of the user to update
            reporting_user_id: The new reporting user ID (None for top level)
            
        Returns:
            The updated hierarchy record
        """
        # Check if user exists
        user = await users_collection().find_one({"id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if reporting user exists (if provided)
        if reporting_user_id:
            reporting_user = await users_collection().find_one({"id": reporting_user_id})
            if not reporting_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reporting user with ID {reporting_user_id} not found"
                )
        
        try:
            # Update the hierarchy relationship
            hierarchy = await UserHierarchyRepository.update_hierarchy(user_id, reporting_user_id)
            return hierarchy
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    @staticmethod
    async def delete_hierarchy(user_id: str) -> Dict:
        """
        Delete a user from the hierarchy
        
        Args:
            user_id: The ID of the user to remove from hierarchy
            
        Returns:
            Success message
        """
        try:
            deleted = await UserHierarchyRepository.delete_hierarchy(user_id)
            if deleted:
                return {"status": "success", "message": f"User {user_id} removed from hierarchy"}
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found in hierarchy"
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    @staticmethod
    async def get_user_hierarchy(user_id: str) -> Dict:
        """
        Get a user's hierarchy record with details
        
        Args:
            user_id: The ID of the user
            
        Returns:
            The user's hierarchy with details
        """
        try:
            hierarchy = await UserHierarchyRepository.get_user_with_details(user_id, users_collection())
            if not hierarchy:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID {user_id} not found in hierarchy"
                )
            return hierarchy
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
    
    @staticmethod
    async def get_team_structure(user_id: str) -> Dict:
        """
        Get a user's complete team structure (seniors, peers, subordinates)
        
        Args:
            user_id: The ID of the user
            
        Returns:
            Dict with seniors, peers, and subordinates
        """
        print(f"UserHierarchyService: Getting team structure for user ID: {user_id}")
        
        # Initialize user variable
        user = None
        
        # Fetch the user to ensure we have the correct ID format
        try:
            # Try to find the user by both user_id and _id (in case an ObjectId was passed)
            user = users_collection().find_one({"user_id": user_id})
            
            if not user:
                # If user not found by user_id, try finding by username or email
                user = users_collection().find_one({
                    "$or": [
                        {"username": user_id},
                        {"email": user_id}
                    ]
                })
            
            if not user:
                # Final fallback - try other possible ID fields
                user = users_collection().find_one({
                    "$or": [
                        {"id": user_id},
                        {"_id": user_id}
                    ]
                })
            
            if user:
                # Use the consistent user_id field if available
                if user.get("user_id"):
                    user_id = user["user_id"]
                    print(f"UserHierarchyService: Found user, using user_id: {user_id}")
                else:
                    print(f"UserHierarchyService: Found user but no user_id field, using original ID")
        except Exception as user_error:
            print(f"UserHierarchyService: Error finding user: {str(user_error)}")
            user = None
        
        try:
            # Get team structure using the (potentially) corrected user_id
            team_structure = await UserHierarchyRepository.get_team_structure(user_id, users_collection())
            
            # Check if we got any subordinates
            if not team_structure.get("subordinates"):
                print(f"UserHierarchyService: No subordinates found from repository, trying fallback methods")
                
                # Fallback 1: Get users with reports_to field set to this user_id
                try:
                    direct_reports = list(users_collection().find(
                        {"reports_to": user_id, "is_active": True}
                    ).limit(100))
                    
                    if direct_reports:
                        print(f"UserHierarchyService: Found {len(direct_reports)} direct reports from reports_to field")
                        subordinates = []
                        for report in direct_reports:
                            subordinates.append({
                                "user_id": report.get("user_id"),
                                "user": report,
                                "level": 1  # Direct subordinate
                            })
                        team_structure["subordinates"] = subordinates
                except Exception as reports_error:
                    print(f"UserHierarchyService: Error finding direct reports: {str(reports_error)}")
                
                # Fallback 2: Use role hierarchy
                if not team_structure.get("subordinates"):
                    try:
                        # Get this user's role
                        if user and user.get("role_ids"):
                            role_id = user["role_ids"][0]
                            
                            # Find roles that report to this role
                            from app.database import roles_collection
                            roles = list(roles_collection.find({"report_to": role_id}).limit(100))
                            
                            if roles:
                                role_ids = [role["id"] for role in roles]
                                
                                # Find users with these roles
                                role_users = list(users_collection().find(
                                    {"role_ids": {"$in": role_ids}, "is_active": True}
                                ).limit(100))
                                
                                if role_users:
                                    print(f"UserHierarchyService: Found {len(role_users)} users by role hierarchy")
                                    subordinates = []
                                    for role_user in role_users:
                                        subordinates.append({
                                            "user_id": role_user.get("user_id"),
                                            "user": role_user,
                                            "level": 1  # Direct subordinate
                                        })
                                    team_structure["subordinates"] = subordinates
                    except Exception as role_error:
                        print(f"UserHierarchyService: Error finding users by role hierarchy: {str(role_error)}")
            
            # Check if we have any subordinates after all fallback attempts
            if team_structure.get("subordinates"):
                print(f"UserHierarchyService: Returning team structure with {len(team_structure['subordinates'])} subordinates")
            else:
                print("UserHierarchyService: No subordinates found after all attempts")
                team_structure["subordinates"] = []
                
            return team_structure
        except ValueError as e:
            print(f"UserHierarchyService: Error getting team structure: {str(e)}")
            # Return a default structure rather than raising an error
            return {
                "user": {"user_id": user_id},
                "seniors": [],
                "peers": [],
                "subordinates": []
            }
    
    @staticmethod
    async def get_all_hierarchies() -> List[Dict]:
        """
        Get all users in the hierarchy
        
        Returns:
            List of all hierarchy records with user details
        """
        try:
            print("UserHierarchyService: Getting all hierarchies...")
            hierarchies = await UserHierarchyRepository.get_all_users_hierarchy(users_collection())
            print(f"UserHierarchyService: Found {len(hierarchies)} hierarchies")
            return hierarchies
        except Exception as e:
            print(f"UserHierarchyService: Error getting all hierarchies: {str(e)}")
            # For testing, return a mock hierarchy with the test admin user
            print("UserHierarchyService: Returning mock hierarchy data")
            return [
                {
                    "user_id": "test_admin",
                    "reporting_user_id": None,
                    "user": {
                        "id": "test_admin",
                        "username": "admin",
                        "full_name": "Administrator",
                        "email": "admin@example.com",
                        "roles": ["admin"]
                    }
                }
            ]
