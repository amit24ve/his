from datetime import datetime
from typing import Optional
import os

from app.database import _db


class TokenBlacklistRepository:
    """Repository for blacklisted tokens"""

    def __init__(self):
        self.collection = _db()["blacklisted_tokens"]
    
    def add_to_blacklist(
        self, 
        token: str, 
        user_id: str, 
        client_id: str = "default",  # Optional client_id support
        expires_at: Optional[datetime] = None, 
        blacklisted_at: Optional[datetime] = None
    ):
        """Add a token to the blacklist"""
        blacklisted_token = {
            "token": token,
            "user_id": user_id,
            "client_id": client_id,  # Store client info
            "expires_at": expires_at,
            "blacklisted_at": blacklisted_at or datetime.now()
        }
        
        # Insert the token into the blacklist
        self.collection.insert_one(blacklisted_token)
        return True
    
    def is_blacklisted(self, token: str, client_id: str = None) -> bool:
        """
        Check if a token is blacklisted
        If client_id is provided, only check tokens for that client
        """
        query = {"token": token}
        
        # If client_id is provided, check for that specific client
        if client_id:
            query["client_id"] = client_id
            
        return self.collection.find_one(query) is not None