from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import Dict, Any, List
from datetime import datetime
from app.database.repositories.user_repository import UserRepository
from app.database.repositories.role_repository import RoleRepository
from app.dependencies import get_current_user
from app.database import users_collection

# Create admin router
admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])

# @admin_router.post("/grant-admin/{username}", status_code=status.HTTP_200_OK)
# async def grant_admin_rights(username: str, request: Request):
#     """Grant admin rights to a user - development endpoint with IP restriction"""
#     try:
#         # Security check: Only allow local requests
#         client_ip = request.client.host
#         if client_ip not in ["127.0.0.1", "localhost", "::1"]:
#             raise HTTPException(
#                 status_code=status.HTTP_403_FORBIDDEN,
#                 detail=f"This endpoint can only be accessed locally. Your IP: {client_ip}"
#             )
            
#         # Find the user
#         user_repo = UserRepository()
#         role_repo = RoleRepository()
        
#         user = user_repo.get_user_by_username(username)
#         if not user:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail=f"User {username} not found"
#             )
            
#         print(f"[INFO] Found user {username} with ID {user['id']}")
            
#         # First check if admin role exists, create if not
#         admin_role = role_repo.get_role_by_name("admin")
#         if not admin_role:
#             print("[INFO] Admin role not found, creating it...")
#             role_data = {
#                 "name": "admin",
#                 "description": "Administrator with full system access",
#                 "permissions": [],
#                 "created_at": datetime.now(),
#                 "updated_at": datetime.now(),
#                 "created_by": user["id"]
#             }
#             admin_role = role_repo.create_role(role_data)
            
#             if not admin_role:
#                 raise HTTPException(
#                     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                     detail="Failed to create admin role"
#                 )
                
#             print(f"[INFO] Created admin role with ID {admin_role['id']}")
            
#         # Now get the role IDs for the user and add admin if not already there
#         user_role_ids = user.get("role_ids", [])
#         if not user_role_ids:
#             user_role_ids = []
            
#         if admin_role["id"] not in user_role_ids:
#             user_role_ids.append(admin_role["id"])
            
#             # Update the user with the new role
#             update_result = user_repo.update_user(user["id"], {"role_ids": user_role_ids})
            
#             if not update_result:
#                 raise HTTPException(
#                     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                     detail="Failed to update user roles"
#                 )
                
#             print(f"[INFO] Added admin role to user {username}")
#             return {"message": f"Admin rights granted to {username}"}
#         else:
#             print(f"[INFO] User {username} already has admin rights")
#             return {"message": f"User {username} already has admin rights"}
            
#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"[ERROR] Failed to grant admin rights: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Error granting admin rights: {str(e)}"
#         )
        
  # Adjust as per your DB structure

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

ALLOWED_IPS = {"127.0.0.1", "localhost", "::1", "YOUR_REMOTE_IP"}  # Add your public IP here for testing

@admin_router.post("/grant-admin/{username}")
async def grant_admin(username: str, request: Request):
    client_host = request.client.host
    if client_host not in ALLOWED_IPS:
        raise HTTPException(status_code=403, detail="Forbidden: Only accessible from allowed IPs or localhost")
    
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("is_admin", False):
        return {"message": f"{username} is already an admin."}

    users_collection.update_one({"username": username}, {"$set": {"is_admin": True}})
    return {"message": f"Granted admin rights to {username}."}

@admin_router.post("/become-admin", status_code=status.HTTP_200_OK)
async def become_admin(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Grant admin rights to the currently logged in user - DEVELOPMENT ONLY"""
    try:
        # Security check: Only allow local requests
        client_ip = request.client.host
        if client_ip not in ["127.0.0.1", "localhost", "::1"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint can only be accessed locally. Your IP: {client_ip}"
            )
            
        # Get repositories
        user_repo = UserRepository()
        role_repo = RoleRepository()
        
        username = current_user.get("username")
        user_id = current_user.get("id")
        
        print(f"[INFO] Granting admin rights to currently logged-in user: {username} (ID: {user_id})")
            
        # First check if admin role exists, create if not
        admin_role = role_repo.get_role_by_name("admin")
        if not admin_role:
            print("[INFO] Admin role not found, creating it...")
            role_data = {
                "name": "admin",
                "description": "Administrator with full system access",
                "permissions": [],
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "created_by": user_id
            }
            admin_role = role_repo.create_role(role_data)
            
            if not admin_role:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create admin role"
                )
                
            print(f"[INFO] Created admin role with ID {admin_role['id']}")
            
        # Now get the role IDs for the user and add admin if not already there
        user_role_ids = current_user.get("role_ids", [])
        if not user_role_ids:
            user_role_ids = []
            
        if admin_role["id"] not in user_role_ids:
            user_role_ids.append(admin_role["id"])
            
            # Update the user with the new role
            update_result = user_repo.update_user(user_id, {"role_ids": user_role_ids})
            
            if not update_result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user roles"
                )
                
            print(f"[INFO] Added admin role to user {username}")
            
            # Return instructions for next steps
            return {
                "message": f"Admin rights granted to {username}",
                "next_steps": "You need to logout and login again to get a new token with admin privileges."
            }
        else:
            print(f"[INFO] User {username} already has admin rights")
            return {"message": f"User {username} already has admin rights"}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to grant admin rights: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error granting admin rights: {str(e)}"
        )

# For emergency situations only - REMOVE THIS IN PRODUCTION!
@admin_router.get("/bypass-admin-check", status_code=status.HTTP_200_OK)
async def bypass_admin_check(request: Request):
    """Temporarily bypass admin check - EMERGENCY USE ONLY"""
    try:
        # Security check: Only allow local requests
        client_ip = request.client.host
        if client_ip not in ["127.0.0.1", "localhost", "::1"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint can only be accessed locally"
            )
            
        # Create a temporary file to signal admin check bypass
        import os
        bypass_file = os.path.join(os.path.dirname(__file__), "..", ".admin_bypass")
        with open(bypass_file, "w") as f:
            f.write(f"Temporary bypass created at {datetime.now().isoformat()}")
            
        return {
            "message": "Admin check bypass enabled for 10 minutes",
            "warning": "This is for emergency use only and will expire automatically",
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating bypass: {str(e)}"
        )