"""
Users API routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Optional, Any
from bson import ObjectId
from app.database.repositories.user_repository import UserRepository
from app.dependencies import get_current_user  # Use the correct auth function

def serialize_user_data(user_data):
    """Convert any ObjectId fields to strings for JSON serialization"""
    if not user_data:
        return user_data
    
    # Convert ObjectIds to strings
    for key, value in user_data.items():
        if isinstance(value, ObjectId):
            user_data[key] = str(value)
        elif isinstance(value, list):
            user_data[key] = [str(item) if isinstance(item, ObjectId) else item for item in value]
    
    return user_data

# Create router
users_router = APIRouter(prefix="/api/users", tags=["users"])

@users_router.get("/doctors")
async def get_doctors_by_hospital(
    hospital_id: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Return active users who have the 'doctor' role.
    Optionally filtered by hospital_id and/or search query (matches name).
    """
    try:
        from app.database import get_database
        db = get_database()

        query_filter = {"is_active": True}
        if hospital_id:
            query_filter["hospital_id"] = hospital_id

        users = list(db.users.find(
            query_filter,
            {"user_id": 1, "full_name": 1, "username": 1, "roles": 1,
             "department": 1, "hospital_id": 1, "hospital_name": 1, "_id": 0}
        ))

        # Keep only users whose roles include 'doctor'
        def has_doctor_role(u):
            rls = u.get("roles", [])
            if isinstance(rls, str):
                rls = [rls]
            return any(r.lower() == "doctor" for r in rls if isinstance(r, str))

        doctors = [u for u in users if has_doctor_role(u)]

        # Search filter on name
        if search:
            sl = search.lower()
            doctors = [d for d in doctors if sl in (d.get("full_name") or "").lower()
                       or sl in (d.get("username") or "").lower()]

        result = [
            {
                "id": d.get("user_id"),
                "name": d.get("full_name") or d.get("username") or "Unknown",
                "department": d.get("department") or "",
                "hospital_id": d.get("hospital_id"),
                "hospital_name": d.get("hospital_name"),
            }
            for d in doctors
        ]
        result.sort(key=lambda x: x["name"])
        return {"doctors": result, "total": len(result)}

    except Exception as e:
        print(f"Error fetching doctors: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch doctors")

@users_router.get("/", response_model=List[Dict])
async def get_all_users(except_role: Optional[str] = None):
    """
    Get all users with basic information for lead assignment
    
    Args:
        except_role: Optional role name to exclude from results (e.g., 'customer')
    """
    try:
        print(f"Getting all users - except_role: {except_role}")
        
        # Get all users from database directly
        from app.database import get_database
        db = get_database()
        
        # Build query filter
        query_filter = {"is_active": True}
        
        # Get users and roles data
        users = list(db.users.find(
            query_filter,  # Only active users
            {
                "user_id": 1,
                "full_name": 1,
                "username": 1,
                "email": 1,
                "role_ids": 1,
                "roles": 1,
                "reports_to": 1,
                "department": 1,
                "phone": 1,
                "is_active": 1,
                "hospital_id": 1,
                "hospital_name": 1,
                "_id": 0  # Exclude MongoDB _id
            }
        ))
        
        # Get roles data for mapping
        roles = list(db.roles.find({}, {"id": 1, "name": 1, "_id": 0}))
        role_map = {role["id"]: role["name"] for role in roles}
        
        # Enhance user data with role names and hierarchy info
        enhanced_users = []
        for user in users:
            # Get role name from role_ids
            role_name = "Unknown Role"
            if user.get('role_ids') and len(user['role_ids']) > 0:
                role_name = role_map.get(user['role_ids'][0], "Unknown Role")
            elif user.get('roles'):
                role_name = user['roles'][0] if isinstance(user['roles'], list) else user['roles']
            
            # Determine hierarchy level
            is_senior = user.get('reports_to') is None or user.get('reports_to') == ""
            
            # Get reporting manager name if exists
            reports_to_name = None
            if not is_senior and user.get('reports_to'):
                manager = next((u for u in users if u.get('user_id') == user.get('reports_to')), None)
                if manager:
                    reports_to_name = manager.get('full_name', manager.get('username', 'Unknown'))
            
            enhanced_user = {
                "id": user.get('user_id'),  # Use user_id as the main ID
                "user_id": user.get('user_id'),
                "name": user.get('full_name', user.get('username', 'Unknown')),
                "full_name": user.get('full_name'),
                "username": user.get('username'),
                "email": user.get('email'),
                "role_name": role_name,
                "role_ids": user.get('role_ids', []),
                "roles": user.get('roles', []),
                "reports_to": user.get('reports_to'),
                "reports_to_name": reports_to_name,
                "is_senior": is_senior,  # True if reports_to is None/empty
                "department": user.get('department'),
                "phone": user.get('phone'),
                "is_active": user.get('is_active', True),
                "hospital_id": user.get('hospital_id'),
                "hospital_name": user.get('hospital_name'),
                "display_name": f"{user.get('full_name', user.get('username', 'Unknown'))} - {role_name}"
            }
            
            # Filter out users with the specified except_role
            if except_role:
                # Check if user has the excluded role in any format
                user_roles = user.get('roles', [])
                if isinstance(user_roles, str):
                    user_roles = [user_roles]
                
                # Skip user if they have the excluded role
                if (role_name.lower() == except_role.lower() or 
                    except_role.lower() in [r.lower() for r in user_roles if isinstance(r, str)]):
                    print(f"Excluding user {enhanced_user['name']} with role {role_name}")
                    continue
            
            enhanced_users.append(enhanced_user)
        
        # Sort users: seniors first, then by role hierarchy
        role_priority = {"admin": 1, "manager": 2, "sales_manager": 3, "executive": 4, "team_member": 5}
        enhanced_users.sort(key=lambda x: (
            0 if x['is_senior'] else 1,  # Seniors first
            role_priority.get(x['role_name'].lower(), 999),  # Then by role priority
            x['name']  # Then alphabetically
        ))
        
        filter_msg = f" (excluding role: {except_role})" if except_role else ""
        print(f"Returning {len(enhanced_users)} users with hierarchy info{filter_msg}")
        return enhanced_users
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )

@users_router.get("/hierarchy", response_model=Dict)
async def get_users_hierarchy():
    """
    Get users organized by hierarchy levels
    """
    try:
        from app.database import get_database
        db = get_database()
        
        # Get all users
        users = list(db.users.find(
            {"is_active": True},
            {
                "user_id": 1, "full_name": 1, "username": 1, "role_ids": 1, 
                "roles": 1, "reports_to": 1, "_id": 0
            }
        ))
        
        # Get roles mapping
        roles = list(db.roles.find({}, {"id": 1, "name": 1, "_id": 0}))
        role_map = {role["id"]: role["name"] for role in roles}
        
        # Organize by hierarchy
        seniors = []  # reports_to is None
        subordinates = []  # reports_to has value
        
        for user in users:
            role_name = "Unknown Role"
            if user.get('role_ids') and len(user['role_ids']) > 0:
                role_name = role_map.get(user['role_ids'][0], "Unknown Role")
            elif user.get('roles'):
                role_name = user['roles'][0] if isinstance(user['roles'], list) else user['roles']
                
            user_data = {
                "user_id": user.get('user_id'),
                "name": user.get('full_name', user.get('username')),
                "role_name": role_name,
                "reports_to": user.get('reports_to')
            }
            
            if user.get('reports_to') is None or user.get('reports_to') == "":
                seniors.append(user_data)
            else:
                subordinates.append(user_data)
        
        return {
            "seniors": seniors,
            "subordinates": subordinates,
            "total_users": len(users)
        }
        
    except Exception as e:
        print(f"Error getting hierarchy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get hierarchy"
        )

@users_router.get("/me", response_model=Dict)
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get current user's profile information - updated route
    """
    try:
        print(f"DEBUG: /me endpoint called with current_user: {current_user}")
        from app.database import find_user_by_id_or_user_id
        
        # Get user ID from current_user token
        user_id = (current_user.get("user_id") or 
                  current_user.get("sub") or 
                  current_user.get("id") or
                  current_user.get("username"))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to determine user identity"
            )
        
        # Get user from database
        user = find_user_by_id_or_user_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Return user profile data
        user_profile = {
            "success": True,
            "user": {
                "id": user.get("user_id", str(user.get("_id", ""))),  # Convert ObjectId to string
                "user_id": user.get("user_id"),
                "username": user.get("username"),
                "full_name": user.get("full_name"),
                "email": user.get("email"),
                "phone": user.get("phone"),
                "role": user.get("role"),
                "roles": user.get("roles", []),
                "department": user.get("department"),
                "reports_to": user.get("reports_to"),
                "is_active": user.get("is_active", True),
                "created_at": user.get("created_at"),
                "updated_at": user.get("updated_at")
            }
        }
        
        # Ensure all ObjectIds are converted to strings
        user_profile = serialize_user_data(user_profile)
        
        return user_profile
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting current user profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )

@users_router.get("/{user_id}", response_model=Dict)
async def get_user_by_id(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get user by ID
    """
    try:
        # Check if user has permission to view other users
        user_roles = current_user.get('roles', [])
        # if current_user.get('id') != user_id and "admin" not in user_roles and "hr_manager" not in user_roles:
        #     raise HTTPException(
        #         status_code=status.HTTP_403_FORBIDDEN,
        #         detail="Not authorized to view other users"
        #     )
        
        # Get user from database using the new function that supports both ObjectId and user_id
        from app.database import find_user_by_id_or_user_id
        user = find_user_by_id_or_user_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Return safe user data (no password)
        safe_user = {
            "id": user.get("user_id", str(user.get("_id", ""))),  # Convert ObjectId to string
            "user_id": user.get("user_id", str(user.get("_id", ""))),  # Ensure user_id is available
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "full_name": user.get("full_name", ""),
            "is_active": user.get("is_active", False),
            "roles": user.get("roles", []),
            "role_ids": user.get("role_ids", []),
            "department": user.get("department", ""),
            "phone": user.get("phone", ""),
            "reports_to": user.get("reports_to", "")
        }

        # Ensure all ObjectIds are converted to strings
        safe_user = serialize_user_data(safe_user)
        
        return safe_user
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting user by ID: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user: {str(e)}"
        )

@users_router.get("/subordinates/{user_id}", response_model=List[Dict])
async def get_user_subordinates(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get users that report to the given user (direct and indirect subordinates)
    """
    try:
        from app.database import get_database
        db = get_database()
        
        # Get all users
        users = list(db.users.find(
            {"is_active": True},
            {
                "user_id": 1, "full_name": 1, "username": 1, "role_ids": 1,
                "roles": 1, "reports_to": 1, "email": 1, "_id": 0
            }
        ))
        
        # Get roles mapping
        roles = list(db.roles.find({}, {"id": 1, "name": 1, "_id": 0}))
        role_map = {role["id"]: role["name"] for role in roles}
        
        # Find subordinates recursively
        def find_subordinates(manager_id: str, all_users: List[Dict]) -> List[Dict]:
            subordinates = []
            
            # Find direct reports
            direct_reports = [u for u in all_users if u.get('reports_to') == manager_id]
            
            for subordinate in direct_reports:
                # Get role name
                role_name = "Unknown Role"
                if subordinate.get('role_ids') and len(subordinate['role_ids']) > 0:
                    role_name = role_map.get(subordinate['role_ids'][0], "Unknown Role")
                elif subordinate.get('roles'):
                    role_name = subordinate['roles'][0] if isinstance(subordinate['roles'], list) else subordinate['roles']
                
                subordinate_data = {
                    "id": subordinate.get('user_id'),
                    "user_id": subordinate.get('user_id'),
                    "name": subordinate.get('full_name', subordinate.get('username', 'Unknown')),
                    "full_name": subordinate.get('full_name'),
                    "username": subordinate.get('username'),
                    "email": subordinate.get('email'),
                    "role_name": role_name,
                    "role_ids": subordinate.get('role_ids', []),
                    "roles": subordinate.get('roles', []),
                    "reports_to": subordinate.get('reports_to'),
                    "display_name": f"{subordinate.get('full_name', subordinate.get('username', 'Unknown'))} - {role_name}",
                    "level": "direct"
                }
                subordinates.append(subordinate_data)
                
                # Find indirect reports (subordinates of subordinates)
                indirect_reports = find_subordinates(subordinate.get('user_id'), all_users)
                for indirect in indirect_reports:
                    indirect["level"] = "indirect"
                subordinates.extend(indirect_reports)
            
            return subordinates
        
        # Get subordinates for the requested user
        subordinates = find_subordinates(user_id, users)
        
        # Sort by role hierarchy and name
        role_priority = {"admin": 1, "manager": 2, "sales_manager": 3, "executive": 4, "team_member": 5}
        subordinates.sort(key=lambda x: (
            role_priority.get(x['role_name'].lower(), 999),
            x['name']
        ))
        
        print(f"Found {len(subordinates)} subordinates for user {user_id}")
        return subordinates
        
    except Exception as e:
        print(f"Error getting subordinates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get subordinates"
        )

@users_router.get("/team-members/{user_id}", response_model=List[Dict])
async def get_user_team_members(user_id: str):
    """
    Get team members for a user (direct subordinates only)
    """
    try:
        from app.database import get_database
        db = get_database()
        
        print(f"Getting team members for user ID: {user_id}")
        
        # Get all users
        users = list(db.users.find(
            {"is_active": True},
            {
                "user_id": 1, "full_name": 1, "username": 1, "role_ids": 1,
                "roles": 1, "reports_to": 1, "email": 1, "department": 1, "phone": 1, "_id": 0
            }
        ))
        
        # Get roles mapping
        roles = list(db.roles.find({}, {"id": 1, "name": 1, "_id": 0}))
        role_map = {role["id"]: role["name"] for role in roles}
        
        # First try: Find direct subordinates from reports_to field
        team_members = []
        direct_reports = [u for u in users if u.get('reports_to') == user_id]
        
        for member in direct_reports:
            # Get role name
            role_name = "Unknown Role"
            if member.get('role_ids') and len(member['role_ids']) > 0:
                role_name = role_map.get(member['role_ids'][0], "Unknown Role")
            elif member.get('roles'):
                role_name = member['roles'][0] if isinstance(member['roles'], list) else member['roles']
            
            member_data = {
                "id": member.get('user_id'),
                "user_id": member.get('user_id'),
                "name": member.get('full_name', member.get('username', 'Unknown')),
                "full_name": member.get('full_name'),
                "username": member.get('username'),
                "email": member.get('email'),
                "phone": member.get('phone'),
                "department": member.get('department'),
                "role_name": role_name,
                "role": role_name,  # For compatibility
                "role_ids": member.get('role_ids', []),
                "roles": member.get('roles', []),
                "reports_to": member.get('reports_to'),
                "display_name": f"{member.get('full_name', member.get('username', 'Unknown'))} - {role_name}",
                "assigned_leads_count": 0  # Default value, would be populated from leads collection if needed
            }
            team_members.append(member_data)
        
        # If no direct reports found using reports_to field, try using hierarchy service
        if not team_members:
            try:
                from app.services.user_hierarchy_service import UserHierarchyService
                
                # Get team structure for the manager
                team_structure = await UserHierarchyService.get_team_structure(user_id)
                
                # Extract subordinates
                subordinates = team_structure.get("subordinates", [])
                
                for subordinate in subordinates:
                    sub_user = subordinate.get("user", {})
                    role_name = sub_user.get("roles", ["Unknown"])[0] if sub_user.get("roles") else "Unknown"
                    
                    member_data = {
                        "id": subordinate.get("user_id"),
                        "user_id": subordinate.get("user_id"),
                        "name": sub_user.get("full_name", sub_user.get("username", "Unknown")),
                        "full_name": sub_user.get("full_name"),
                        "username": sub_user.get("username"),
                        "email": sub_user.get("email"),
                        "role_name": role_name,
                        "role": role_name,  # For compatibility
                        "role_ids": sub_user.get("role_ids", []),
                        "roles": sub_user.get("roles", []),
                        "reports_to": user_id,
                        "display_name": f"{sub_user.get('full_name', sub_user.get('username', 'Unknown'))} - {role_name}",
                        "assigned_leads_count": 0  # Default value
                    }
                    team_members.append(member_data)
            except Exception as e:
                print(f"Failed to get team structure from hierarchy service: {str(e)}")
        
        # Sort by role hierarchy and name
        role_priority = {"admin": 1, "manager": 2, "sales_manager": 3, "executive": 4, "team_member": 5}
        team_members.sort(key=lambda x: (
            role_priority.get(x['role_name'].lower(), 999),
            x['name']
        ))
        
        print(f"Found {len(team_members)} team members for user {user_id}")
        return team_members
        
    except Exception as e:
        print(f"Error getting team members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get team members: {str(e)}"
        )
