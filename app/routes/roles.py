from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.database.schemas.role_schema import RoleCreate, RoleUpdate, RoleResponse, User, Role, role_entity
from app.database.repositories.role_repository import RoleRepository
import os
from app.dependencies import get_current_user, admin_required

roles_router = APIRouter(prefix="/api/roles", tags=["roles"])

TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")

def is_admin(user_data):
    roles = user_data.get("token_data", {}).get("roles", [])
    print(f"User roles from token: {roles}")
    return "admin" in roles

@roles_router.get("/", response_model=List[RoleResponse])
async def get_all_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    authorization: Optional[str] = Header(None)
):
    """List all roles"""
    try:
        timestamp = datetime.now().isoformat()
        print(f"[{timestamp}] Request received to list roles")
        role_repo = RoleRepository()
        roles = role_repo.list_roles(skip=skip, limit=limit)
        print(f"[{datetime.now().isoformat()}] Successfully retrieved {len(roles)} roles")
        return roles
    except Exception as e: 
        error_message = f"Error listing roles: {str(e)}"
        print(f"[{datetime.now().isoformat()}] {error_message}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message
        )

@roles_router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get a role by ID"""
    try:
        timestamp = datetime.now().isoformat()
        print(f"[{timestamp}] Admin user {ADMIN_USERNAME} fetching role {role_id}")
        role_repo = RoleRepository()
        role = role_repo.get_role(role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        return role
    except Exception as e:
        error_message = f"Error fetching role: {str(e)}"
        print(f"[{datetime.now().isoformat()}] {error_message}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message
        )

# Helper for RoleRepository: Get max role number from IDs like "Ro-001"
def get_max_role_number(self) -> int:
    """Find the max number for role_id in format Ro-00X (case-sensitive)"""
    pipeline = [
        {"$match": {"id": {"$regex": "^Ro-\\d{3}$"}}},
        {"$project": {"num": {"$toInt": {"$substr": ["$id", 3, 3]}}}},
        {"$sort": {"num": -1}},
        {"$limit": 1}
    ]
    result = list(self.collection.aggregate(pipeline))
    if result:
        return result[0]["num"]
    return 0

@roles_router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    current_user: Dict[str, Any] = Depends(admin_required)
):
    """Create a new role (admin only)"""
    try:
        print(f"[INFO] Creating role: {role_data.name}")
        role_repo = RoleRepository()

        # Duplicate name check
        existing_role = role_repo.get_role_by_name(role_data.name)
        if existing_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with name '{role_data.name}' already exists."
            )

        # Use aggregation for max number
        max_num = role_repo.get_max_role_number()
        new_id = f"Ro-{str(max_num + 1).zfill(3)}"

        # Prepare role data
        role_dict = role_data.dict()
        role_dict["id"] = new_id
        role_dict["created_at"] = datetime.now()
        role_dict["updated_at"] = datetime.now()
        role_dict["created_by"] = current_user.get("id", "unknown")

        # Ensure report_to is included if provided (for hierarchy)
        if hasattr(role_data, "report_to") and role_data.report_to:
            role_dict["report_to"] = role_data.report_to
        else:
            role_dict["report_to"] = None

        # Save to MongoDB (ensure collection uses role_dict["id"] as id)
        new_role = role_repo.create_role(role_dict)
        if not new_role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create role"
            )
        print(f"[INFO] Role created: {role_data.name} with id {new_id}")
        return role_entity(new_role)  # Use the updated helper!

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error creating role: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating role: {str(e)}"
        )

@roles_router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    current_user: Dict[str, Any] = Depends(admin_required)
):
    """Update an existing role (by id, not name!)"""
    try:
        print(f"[INFO] Updating role {role_id}")
        role_repo = RoleRepository()
        # FIX: Use get_role_by_id instead of get_role_by_name
        existing_role = role_repo.get_role_by_id(role_id)
        if not existing_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )

        update_data = role_update.dict(exclude_unset=True)
        if "name" in update_data:
            new_name = update_data["name"]
            role_with_same_name = role_repo.get_role_by_name(new_name)
            if role_with_same_name and getattr(role_with_same_name, "id", None) != role_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role with name '{new_name}' already exists."
                )

        if "id" in update_data:
            del update_data["id"]
        update_data["updated_at"] = datetime.now()
        try:
            update_data["updated_by"] = current_user.get("id")
        except Exception:
            pass

        # FIX: Use update_role (by id) instead of update_role_using_name
        update_success = role_repo.update_role(role_id, update_data)
        if not update_success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update role {role_id}"
            )
        updated_role = role_repo.get_role_by_id(role_id)
        if not updated_role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Role was updated but could not be retrieved"
            )
        print(f"[INFO] Successfully updated role {role_id}")
        return updated_role
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to update role: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating role: {str(e)}"
        )


@roles_router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a role"""
    bypass_admin_check = True
    if not bypass_admin_check and not is_admin(current_user):
        print(f"User does not have admin role. Available roles: {current_user.get('token_data', {}).get('roles', [])}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete roles. Admin rights required."
        )
    if bypass_admin_check:
        print(f"[WARNING] BYPASSING ADMIN CHECK for user {current_user.get('username')} - DEVELOPMENT ONLY!")
    try:
        timestamp = datetime.now().isoformat()
        print(f"[{timestamp}] User {current_user.get('username')} deleting role {role_id}")
        role_repo = RoleRepository()
        existing_role = role_repo.get_role_by_id(role_id)
        if not existing_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        if existing_role.get("name") in ["admin", "user"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete protected system roles"
            )
        deleted = role_repo.delete_role(role_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete role"
            )
        print(f"[{timestamp}] Successfully deleted role {role_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        error_message = f"Error deleting role: {str(e)}"
        print(f"[{datetime.now().isoformat()}] {error_message}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message
        )

@roles_router.get("/api/lead/users/sales", response_model=List[User])
def get_sales_users(role: Optional[str] = Query(None, description="Filter users by role")):
    """
    Get all sales team users, optionally filtered by role.
    - If role is specified, returns only users with that role
    - If no role is specified, returns all users who can be assigned leads
    """
    users = [
        User(id="1", username="alice", role=Role.sales, active=True),
        User(id="2", username="bob", role=Role.support, active=False),
        User(id="3", username="carol", role=Role.sales, active=True),
    ]
    if role:
        try:
            role_enum = Role(role)
            filtered_users = [user for user in users if user.role == role_enum]
            return filtered_users
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    return [user for user in users if user.active]

@roles_router.post("/api/lead/leads/assign")
def assign_lead(lead_assignment: dict):
    """
    Assign a lead to a user with specific role
    """
    lead_id = lead_assignment.get("lead_id")
    user_id = lead_assignment.get("user_id")
    role = lead_assignment.get("role")
    notes = lead_assignment.get("notes", "")
    if not lead_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing lead_id or user_id")
    return {"message": "Lead assigned successfully", "lead_id": lead_id, "user_id": user_id, "role": role, "notes": notes}





# Endpoint to get all senior roles (roles with no report_to)
@roles_router.get("/senior-roles", response_model=List[RoleResponse])
async def get_senior_roles():
    """Get all senior roles (roles that are not reporting to anyone)"""
    try:
        role_repo = RoleRepository()
        all_roles = role_repo.list_roles()
        senior_roles = [role for role in all_roles if not role.get("report_to")]
        return senior_roles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching senior roles: {str(e)}")

# Endpoint to get all junior roles for a given role_id (roles that report to this role)
@roles_router.get("/{role_id}/junior-roles", response_model=List[RoleResponse])
async def get_junior_roles(role_id: str):
    """Get all junior roles (roles that report to the given role_id)"""
    try:
        role_repo = RoleRepository()
        all_roles = role_repo.list_roles()
        junior_roles = [role for role in all_roles if role.get("report_to") == role_id]
        return junior_roles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching junior roles: {str(e)}")
    
    
# Endpoint to get the full role hierarchy as a tree
@roles_router.get("/hierarchy/tree", response_model=List[RoleResponse])
async def get_role_hierarchy_tree():
    """Get the full role hierarchy as a tree (each role with its juniors)"""
    try:
        role_repo = RoleRepository()
        all_roles = role_repo.list_roles()
        role_dict = {role["id"]: role for role in all_roles}

        # Build tree nodes
        def build_node(role):
            # Find juniors (children)
            juniors = [build_node(r) for r in all_roles if r.get("report_to") == role["id"]]
            node = dict(role)
            if juniors:
                node["juniors"] = juniors
            return node

        # Top-level (senior) roles
        roots = [build_node(role) for role in all_roles if not role.get("report_to")]
        return roots
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building role hierarchy: {str(e)}")


