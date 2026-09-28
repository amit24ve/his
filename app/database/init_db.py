from app.database.repositories.role_repository import RoleRepository
from app.database.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService


from datetime import datetime
import pymongo
from bson import ObjectId
from app.database import db

def init_roles():
    """Initialize default roles"""
    repo = RoleRepository()
    permissions_collection = db["permissions"]
    
    # Default roles with descriptions
    default_permissions = [
        {
            "code": "users:create",
            "name": "Create Users",
            "description": "Create new users in the system",
            "resource": "users"
        },
        {
            "code": "users:read",
            "name": "Read Users",
            "description": "View user information",
            "resource": "users"
        },
        {
            "code": "users:update",
            "name": "Update Users",
            "description": "Update user information",
            "resource": "users"
        },
        {
            "code": "users:delete",
            "name": "Delete Users",
            "description": "Delete users from the system",
            "resource": "users"
        },
        {
            "code": "roles:create",
            "name": "Create Roles",
            "description": "Create new roles in the system",
            "resource": "roles"
        },
        {
            "code": "roles:read",
            "name": "Read Roles",
            "description": "View role information",
            "resource": "roles"
        },
        {
            "code": "roles:update",
            "name": "Update Roles",
            "description": "Update role information",
            "resource": "roles"
        },
        {
            "code": "roles:delete",
            "name": "Delete Roles",
            "description": "Delete roles from the system",
            "resource": "roles"
        }
    ]
    roles = [
        {
            "name": "admin",
            "description": "System administrator with full access to all features",
            "permissions": []  # Admin has implicit full permissions
        },
        {
            "name": "sales",
            "description": "Sales team member with access to leads and sales data",
            "permissions": []
        },
        {
            "name": "franchise",
            "description": "Franchise team member with access to franchise management",
            "permissions": []
        },
        {
            "name": "support",
            "description": "Support team member with access to tickets and customer issues",
            "permissions": []
        },
        {
            "name": "hr",
            "description": "HR team member with access to staff and HR functions",
            "permissions": []
        },
        {
            "name": "user",
            "description": "Basic user with limited access",
            "permissions": []
        }
    ]
    
    # Create roles if they don't exist
    for role_data in roles:
        existing_role = repo.get_role_by_name(role_data["name"])
        if not existing_role:
            repo.create_role(role_data)
            print(f"Created role: {role_data['name']}")
        else:
            print(f"Role already exists: {role_data['name']}")
            
    for permission in default_permissions:
        existing_permission = permissions_collection.find_one({"code": permission["code"]})
        if not existing_permission:
            # Add id and timestamps
            permission["id"] = str(ObjectId())
            permission["created_at"] = datetime.now()
            permissions_collection.insert_one(permission)
            
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Default permissions initialized")

def init_permissions():
    """Initialize default permissions"""
    repo = RoleRepository()
    
    # Default permissions by resource and actions
    permissions = [
        # Dashboard permissions
        {
            "resource": "dashboard",
            "actions": ["read"]
        },
        # Users permissions
        {
            "resource": "users",
            "actions": ["create", "read", "update", "delete"]
        },
        # Leads permissions
        {
            "resource": "leads",
            "actions": ["create", "read", "update", "delete", "assign"]
        },
        # Franchise permissions
        {
            "resource": "franchise",
            "actions": ["create", "read", "update", "delete", "approve"]
        },
        # Customer permissions
        {
            "resource": "customers",
            "actions": ["create", "read", "update", "delete"]
        },
        # Tickets permissions
        {
            "resource": "tickets",
            "actions": ["create", "read", "update", "delete", "assign", "resolve"]
        },
        # User Hierarchy permissions
        {
            "resource": "hierarchy",
            "actions": ["create", "read", "update", "delete", "manage"]
        }
    ]
    
    # Create permissions
    created_permission_ids = {}
    for perm_data in permissions:
        # Check if similar permission exists
        resource = perm_data["resource"]
        permission_id = repo.create_permission(perm_data)
        if permission_id:
            created_permission_ids[resource] = permission_id
            print(f"Created permission for: {resource}")
        else:
            print(f"Permission already exists for: {resource}")
    
    # Assign permissions to roles
    role_permissions = {
        "sales": ["dashboard", "leads", "customers"],
        "franchise": ["dashboard", "franchise"],
        "support": ["dashboard", "tickets", "customers"],
        "hr": ["dashboard", "users"],
        "user": ["dashboard"]
    }
    
    for role_name, resources in role_permissions.items():
        role = repo.get_role_by_name(role_name)
        if role:
            # Add permissions to role
            permission_ids = []
            for resource in resources:
                if resource in created_permission_ids:
                    permission_ids.append(created_permission_ids[resource])
            
            if permission_ids:
                repo.update_role(role["id"], {"permissions": permission_ids})
                print(f"Updated permissions for role: {role_name}")


def create_admin_user():
    """Create admin user if it doesn't exist"""
    user_repo = UserRepository()
    auth_service = AuthService()
    
    admin_username = "admin"
    admin_email = "admin@bharatcrm.com"
    admin_password = "Admin@123"  # In production, use a secure password and store in secrets
    
    # Check if admin exists
    existing_admin = user_repo.get_user_by_username(admin_username)
    if not existing_admin:
        try:
            admin_user = auth_service.register_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                full_name="System Administrator",
                role_names=["admin"]
            )
            print(f"Created admin user: {admin_username}")
        except Exception as e:
            print(f"Error creating admin: {str(e)}")
    else:
        print("Admin user already exists")
    

def init_user_hierarchy_collection():
    """Initialize user hierarchy collection with indexes"""
    print("Setting up user hierarchy collection...")
    user_hierarchy_collection = db["user_hierarchy"]
    
    # Create indexes
    user_hierarchy_collection.create_index("user_id", unique=True)
    user_hierarchy_collection.create_index("reporting_user_id")
    user_hierarchy_collection.create_index("level")
    
    print("User hierarchy collection setup complete!")

def initialize_db():
    """Run all initialization scripts"""
    print("Initializing database...")
    # init_roles() — disabled: roles are created manually via the UI
    init_permissions()
    create_admin_user()
    init_user_hierarchy_collection()
    print("Database initialization complete!")


if __name__ == "__main__":
    initialize_db()