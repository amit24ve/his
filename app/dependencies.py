import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, List, Any, Set, Optional
from app.config import settings
from datetime import datetime, timedelta
from jwt import PyJWTError as JWTError
from app.database.repositories.role_repository import RoleRepository
from app.database.repositories.user_repository import UserRepository
from app.utils.timezone_utils import get_ist_now, get_ist_timestamp



SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days
REFRESH_TOKEN_EXPIRE_DAYS = 30


# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Repositories
user_repo = UserRepository()
role_repo = RoleRepository()

def create_access_token(data: dict) -> str:
    """Create a new access token"""
    to_encode = data.copy()
    
    # Set token expiration using IST time
    expire = get_ist_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Create JWT token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Create a new refresh token"""
    to_encode = data.copy()
    
    # Set refresh token expiration using IST time
    expire = get_ist_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS) 
    to_encode.update({"exp": expire})
    
    # Create JWT token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """Get the current user from the JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Add debugging
        print(f"[DEBUG] Token: {token[:15]}... (truncated)")
        print(f"[DEBUG] SECRET_KEY: {SECRET_KEY[:5]}... (truncated)")
        
        try:
            # First try to decode normally
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            # If token is expired, try decoding without verification
            # THIS IS TEMPORARY - FOR DEVELOPMENT ONLY
            print("[WARNING] Token expired, bypassing verification temporarily")
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        
        user_id: str = payload.get("sub")
        
        if user_id is None:
            print("[DEBUG] Token payload missing 'sub' field")
            raise credentials_exception
        
        print(f"[DEBUG] User ID from token: {user_id}")
        
        # Get user from database
        user = user_repo.get_user_by_id(user_id)
        
        if user is None:
            print(f"[DEBUG] User with ID {user_id} not found in database")
            raise credentials_exception
            
        # Add token data to user object
        user["token_data"] = payload
        
        return user
        
    except JWTError as e:
        print(f"[{get_ist_timestamp()}] JWT decode error: {str(e)}")
        raise credentials_exception


async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current active user"""
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_user_id(current_user: Dict[str, Any] = Depends(get_current_user)) -> str:
    """Get current user ID as string"""
    # First try to get user_id from token data (preferred)
    if "token_data" in current_user and "sub" in current_user["token_data"]:
        return current_user["token_data"]["sub"]
    
    # Fallback: try user_id field from user document
    user_id = current_user.get("user_id")
    if user_id is not None:
        return str(user_id)
    
    # Last fallback: try _id field
    user_id = current_user.get("_id")
    if user_id is not None:
        return str(user_id)
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not extract user ID"
    )


class RoleChecker:
    """Check if user has required roles"""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    async def __call__(self, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        # Get user roles from token data
        user_roles = current_user.get("token_data", {}).get("roles", [])
        
        # Check if any of the user's roles is in the allowed roles
        for role in user_roles:
            if role in self.allowed_roles:
                return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required roles: {', '.join(self.allowed_roles)}"
        )


class PermissionChecker:
    """Check if user has required permissions"""
    def __init__(self, resource: str, required_actions: List[str]):
        self.resource = resource
        self.required_actions = required_actions
    
    async def __call__(self, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        # Get user roles
        role_ids = current_user.get("role_ids", [])
        if not role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no assigned roles"
            )
        
        # Special case: superadmin role always has all permissions
        user_roles = current_user.get("token_data", {}).get("roles", [])
        if "superadmin" in user_roles or "super_admin" in user_roles:
            return current_user
        
        # Get all permissions from roles
        has_permission = False
        roles = role_repo.get_roles_by_ids(role_ids)
        
        for role in roles:
            permission_ids = role.get("permissions", [])
            permissions = role_repo.get_permissions_by_ids(permission_ids)
            
            for perm in permissions:
                if perm["resource"] == self.resource:
                    # Check if the permission has all required actions
                    has_required_actions = all(action in perm["actions"] for action in self.required_actions)
                    if has_required_actions:
                        has_permission = True
                        break
            
            if has_permission:
                break
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for {self.resource}"
            )
        
        return current_user


# Common role-based dependencies
async def admin_required(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Check if user has admin role"""
    # Get roles from user object and token
    roles = current_user.get("roles", [])
    token_roles = current_user.get("token_data", {}).get("roles", [])
    
    # Debug roles
    print(f"[DEBUG] User roles from user object: {roles}")
    print(f"[DEBUG] User roles from token: {token_roles}")
    
    # FIX: Ensure roles is a list
    if isinstance(roles, str):
        # If roles is a string, convert it to a list with one item
        roles = [roles]
    elif not isinstance(roles, list):
        # If roles is neither a string nor a list, set it to an empty list
        roles = []
    
    # Ensure token_roles is a list (it already seems to be, but just to be safe)
    if not isinstance(token_roles, list):
        token_roles = [token_roles] if token_roles else []
    
    # Now both roles and token_roles are lists, so we can safely concatenate them
    all_roles = set(roles + token_roles)
    
    # Check for admin role
    if "admin" not in all_roles:
        print(f"[ERROR] User {current_user.get('username')} doesn't have admin role. Available roles: {all_roles}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create roles. Admin rights required."
        )
    
    return current_user


async def superadmin_required(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Check if user has superadmin role"""
    roles = current_user.get("roles", [])
    token_roles = current_user.get("token_data", {}).get("roles", [])

    if isinstance(roles, str):
        roles = [roles]
    elif not isinstance(roles, list):
        roles = []
    if not isinstance(token_roles, list):
        token_roles = [token_roles] if token_roles else []

    all_roles = {str(role).lower() for role in roles + token_roles}
    if "superadmin" not in all_roles and "super_admin" not in all_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user


def sales_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "sales"]))):
    """Requires sales team or admin role"""
    return current_user


def franchise_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "franchise"]))):
    """Requires franchise team or admin role"""
    return current_user


def support_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "support"]))):
    """Requires support team or admin role"""
    return current_user


def hr_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "hr"]))):
    """Requires HR team or admin role"""
    return current_user


async def get_hospital_filter(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Returns a MongoDB filter dict for hospital-based data isolation.
    - Superadmin: returns {} (sees all hospitals' data)
    - Hospital admin/non-admin: returns {"hospital_id": user's hospital_id} if set, else {}
    """
    # Collect all roles
    roles = current_user.get("roles", [])
    token_roles = current_user.get("token_data", {}).get("roles", [])
    if isinstance(roles, str):
        roles = [roles]
    if not isinstance(roles, list):
        roles = []
    if not isinstance(token_roles, list):
        token_roles = [token_roles] if token_roles else []
    all_roles = set(roles + token_roles)

    # Only superadmin sees all hospitals. Hospital admins remain scoped.
    if "superadmin" in all_roles or "super_admin" in all_roles:
        return {}

    # Non-admin: filter by assigned hospital_id
    hospital_id = current_user.get("hospital_id") or current_user.get("token_data", {}).get("hospital_id")
    if hospital_id:
        return {"hospital_id": hospital_id}

    # No hospital assigned — return empty filter (sees all, warn in logs)
    print(f"[WARNING] User {current_user.get('username')} has no hospital_id assigned. No hospital filter applied.")
    return {}


def get_current_user_hospital_id(current_user: Dict[str, Any] = Depends(get_current_user)) -> Optional[str]:
    """Extract hospital_id from the current user for use in create operations."""
    return (
        current_user.get("hospital_id")
        or current_user.get("token_data", {}).get("hospital_id")
    )


# Common permission-based dependencies
def can_manage_users(current_user: Dict[str, Any] = Depends(PermissionChecker("users", ["create", "update", "delete"]))):
    """Requires permission to manage users"""
    return current_user


def can_view_dashboard(current_user: Dict[str, Any] = Depends(PermissionChecker("dashboard", ["read"]))):
    """Requires permission to view dashboard"""
    return current_user
