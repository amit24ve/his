"""
Authentication service with synchronous operations
"""
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import os
import jwt
from passlib.context import CryptContext
from app.config import settings
from app.database.repositories.user_repository_sync import UserRepositorySync
from app.utils.timezone_utils import get_ist_now

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthServiceSync:
    """Authentication service with synchronous operations"""
    
    def __init__(self):
        self.user_repo = UserRepositorySync()
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.refresh_token_expire_days = settings.REFRESH_TOKEN_EXPIRE_DAYS
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Generate password hash"""
        return pwd_context.hash(password)
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user with username and password"""
        user = self.user_repo.get_user_by_username(username)
        
        if user is None:
            return None
        
        if not self.verify_password(password, user["hashed_password"]):
            return None
        
        if not user.get("is_active", True):
            return None
            
        return user
    
    def create_access_token(self, data: Dict) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        expire = get_ist_now() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": expire, "type": "access"})
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = get_ist_now() + timedelta(days=self.refresh_token_expire_days)
        to_encode.update({"exp": expire, "type": "refresh"})
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def register_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new user"""
        # Generate unique user_id if not provided
        if "user_id" not in user_data or not user_data["user_id"]:
            import random
            while True:
                user_id = f"USR-{random.randint(100, 999)}"
                if not self.user_repo.get_user_by_id(user_id):
                    break
            user_data["user_id"] = user_id

        # Hash password
        if "password" in user_data:
            hashed_password = self.get_password_hash(user_data["password"])
            user_data["hashed_password"] = hashed_password
            del user_data["password"]
        
        # Set default values
        user_data["is_active"] = True
        if "roles" not in user_data:
            user_data["roles"] = ["user"]
            
        # Create user
        user_id = self.user_repo.create_user(user_data)
        return self.user_repo.get_user_by_id(user_id)
    
    def update_user_password(self, user_id: str, new_password: str) -> bool:
        """Update user password"""
        hashed_password = self.get_password_hash(new_password)
        return self.user_repo.update_user(user_id, {"hashed_password": hashed_password})
