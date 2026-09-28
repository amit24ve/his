from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.database import get_database


access_router = APIRouter()

@access_router.get("/leads/access-check")
async def check_user_access(current_user: dict = Depends(get_current_user)):
    """
    Check if user has top-level access and/or manager access (has subordinates)
    Returns:
    - is_top_level: True if user role has level 0
    - has_subordinates: True if user has subordinates (is a manager)
    """
    try:
        db = get_database()
        
        # Get user roles
        user_roles = current_user.get('role_ids', [])
        if not user_roles:
            # Fallback to 'roles' field if role_ids is not available
            roles_field = current_user.get('roles', '')
            if roles_field:
                user_roles = [roles_field] if isinstance(roles_field, str) else roles_field
            else:
                return {
                    "is_top_level": False,
                    "has_subordinates": False,
                    "user_id": current_user.get('user_id', ''),
                    "roles": []
                }
        
        # Fetch all roles from database
        roles_collection = db['roles']
        all_roles = list(roles_collection.find())
        
        # Check if user is top-level (level 0)
        is_top_level = False
        user_role_details = []
        
        for user_role in user_roles:
            role_detail = next((role for role in all_roles 
                              if role.get('id') == user_role or
                              role['name'].lower() == user_role.lower()), None)
            
            if role_detail:
                user_role_details.append(role_detail)
                if role_detail.get('level') == 0:
                    is_top_level = True
        
        # Check if user has subordinates (is a manager)
        has_subordinates = False
        
        for user_role_detail in user_role_details:
            # Check if they are top-level (report_to: null)
            if user_role_detail.get('report_to') is None:
                has_subordinates = True
                break
            
            # Check if any other role reports to this role
            role_id = user_role_detail.get('id')
            if role_id:
                subordinate_exists = any(role.get('report_to') == role_id for role in all_roles)
                if subordinate_exists:
                    has_subordinates = True
                    break
        
        return {
            "is_top_level": is_top_level,
            "has_subordinates": has_subordinates,
            "user_id": current_user.get('user_id', ''),
            "roles": user_roles,
            "role_details": [{"name": r.get('name'), "level": r.get('level'), "report_to": r.get('report_to')} for r in user_role_details]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check access: {str(e)}")
