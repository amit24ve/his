from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from datetime import datetime

from app.database.schemas.permission import (
    PermissionCreate,
    PermissionUpdate,
    PermissionResponse
)
from app.database.repositories.permission_repository import PermissionRepository
from app.services.auth_service import AuthService

permission_router = APIRouter(prefix="/api/permissions", tags=["permissions"])

# Function to check if user has admin role
def is_admin(user_data):
    roles = user_data.get("roles", user_data.get("token_data", {}).get("roles", []))
    if isinstance(roles, str):
        roles = [roles]
    return "admin" in roles

@permission_router.get("/", response_model=List[PermissionResponse])
async def get_all_permissions(current_user: dict = Depends(AuthService.get_current_user)):
    """Get all permissions"""
    # Only admins can list permissions
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view permissions. Admin rights required."
        )
        
    permission_repo = PermissionRepository()
    permissions = permission_repo.get_all_permissions()
    return permissions

@permission_router.post("/", response_model=PermissionResponse)
async def create_permission(
    permission: PermissionCreate,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Create a new permission (admin only)"""
    # Only admins can create permissions
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create permissions. Admin rights required."
        )
    
    permission_repo = PermissionRepository()
    
    # Check if permission with same code already exists
    if permission_repo.get_permission_by_code(permission.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Permission with code '{permission.code}' already exists"
        )
    
    # Prepare permission data
    permission_data = permission.dict()
    permission_data["created_at"] = datetime.now()
    permission_data["created_by"] = current_user.get("username")
    
    # Create permission
    created_permission = permission_repo.create_permission(permission_data)
    if not created_permission:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create permission"
        )
    
    return created_permission

@permission_router.get("/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Get a permission by ID"""
    # Only admins can view permissions
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view permissions. Admin rights required."
        )
        
    permission_repo = PermissionRepository()
    permission = permission_repo.get_permission_by_id(permission_id)
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission with ID {permission_id} not found"
        )
        
    return permission

@permission_router.put("/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    permission_id: str,
    permission: PermissionUpdate,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Update a permission by ID"""
    # Only admins can update permissions
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update permissions. Admin rights required."
        )
        
    permission_repo = PermissionRepository()
    
    # Check if permission exists
    existing_permission = permission_repo.get_permission_by_id(permission_id)
    if not existing_permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission with ID {permission_id} not found"
        )
    
    # Prepare update data
    update_data = permission.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.now()
    
    # Update permission
    success = permission_repo.update_permission(permission_id, update_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update permission"
        )
    
    # Get updated permission
    updated_permission = permission_repo.get_permission_by_id(permission_id)
    return updated_permission

@permission_router.delete("/{permission_id}")
async def delete_permission(
    permission_id: str,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Delete a permission by ID"""
    # Only admins can delete permissions
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete permissions. Admin rights required."
        )
        
    permission_repo = PermissionRepository()
    
    # Check if permission exists
    existing_permission = permission_repo.get_permission_by_id(permission_id)
    if not existing_permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission with ID {permission_id} not found"
        )
    
    # Delete permission
    success = permission_repo.delete_permission(permission_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete permission"
        )
    
    return {"message": f"Permission {existing_permission['name']} deleted successfully"}