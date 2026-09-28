"""
User Hierarchy Service for synchronous operations
"""
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from app.database import db
from app.database.repositories.user_hierarchy_repository_sync import UserHierarchyRepositorySync

def users_collection():
    return db.users

class UserHierarchyServiceSync:
    @staticmethod
    def create_hierarchy(user_id: str, reporting_user_id: Optional[str] = None) -> Dict:
        """
        Create a new user hierarchy relationship
        
        Args:
            user_id: The ID of the user to add to hierarchy
            reporting_user_id: The ID of the user's manager/supervisor (None for top level)
            
        Returns:
            The created hierarchy record
        """
        # Check if user exists
        user = users_collection().find_one({"id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if reporting user exists (if provided)
        if reporting_user_id:
            reporting_user = users_collection().find_one({"id": reporting_user_id})
            if not reporting_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reporting user with ID {reporting_user_id} not found"
                )
        
        # Determine the level (0 for top level, or reporting_user's level + 1)
        level = 0
        if reporting_user_id:
            try:
                reporting_hierarchy = UserHierarchyRepositorySync.get_hierarchy(reporting_user_id)
                level = reporting_hierarchy["level"] + 1
            except ValueError:
                # If the reporting user is not in hierarchy yet, set them as level 0
                UserHierarchyRepositorySync.create_hierarchy(reporting_user_id, None, 0)
                level = 1
        
        try:
            # Create the hierarchy relationship
            hierarchy = UserHierarchyRepositorySync.create_hierarchy(user_id, reporting_user_id, level)
            return hierarchy
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    @staticmethod
    def update_hierarchy(user_id: str, reporting_user_id: Optional[str] = None) -> Dict:
        """
        Update a user's reporting relationship
        
        Args:
            user_id: The ID of the user to update
            reporting_user_id: The new reporting user ID (None for top level)
            
        Returns:
            The updated hierarchy record
        """
        # Check if user exists
        user = users_collection().find_one({"id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if reporting user exists (if provided)
        if reporting_user_id:
            reporting_user = users_collection().find_one({"id": reporting_user_id})
            if not reporting_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reporting user with ID {reporting_user_id} not found"
                )
        
        try:
            # Update the hierarchy relationship
            hierarchy = UserHierarchyRepositorySync.update_hierarchy(user_id, reporting_user_id)
            return hierarchy
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    @staticmethod
    def delete_hierarchy(user_id: str) -> Dict:
        """
        Delete a user from the hierarchy
        
        Args:
            user_id: The ID of the user to remove from hierarchy
            
        Returns:
            Success message
        """
        try:
            deleted = UserHierarchyRepositorySync.delete_hierarchy(user_id)
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
    def get_user_hierarchy(user_id: str) -> Dict:
        """
        Get a user's hierarchy record with details
        
        Args:
            user_id: The ID of the user
            
        Returns:
            The user's hierarchy with details
        """
        try:
            hierarchy = UserHierarchyRepositorySync.get_user_with_details(user_id, users_collection())
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
    def get_team_structure(user_id: str) -> Dict:
        """
        Get a user's complete team structure (seniors, peers, subordinates)
        
        Args:
            user_id: The ID of the user
            
        Returns:
            Dict with seniors, peers, and subordinates
        """
        try:
            team_structure = UserHierarchyRepositorySync.get_team_structure(user_id, users_collection())
            return team_structure
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
    
    @staticmethod
    def get_all_hierarchies() -> List[Dict]:
        """
        Get all users in the hierarchy
        
        Returns:
            List of all hierarchy records with user details
        """
        hierarchies = UserHierarchyRepositorySync.get_all_users_hierarchy(users_collection())
        return hierarchies
