from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import logging
from app.dependencies import get_current_user
from app.database import get_database

logger = logging.getLogger(__name__)

meta_tokens_router = APIRouter()

class MetaTokenCreate(BaseModel):
    name: str
    access_token: str
    description: Optional[str] = ""
    is_active: bool = True

class MetaTokenUpdate(BaseModel):
    name: Optional[str] = None
    access_token: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class MetaTokenResponse(BaseModel):
    id: str
    name: str
    access_token: str
    description: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    last_used: Optional[datetime] = None
    success_count: int = 0
    error_count: int = 0

@meta_tokens_router.get("/meta-tokens", response_model=List[MetaTokenResponse])
async def get_meta_tokens(current_user: dict = Depends(get_current_user)):
    """Get all Meta access tokens"""
    try:
        db = get_database()
        tokens = list(db.meta_tokens.find())
        
        result = []
        for token in tokens:
            result.append({
                "id": str(token["_id"]),
                "name": token["name"],
                "access_token": token["access_token"][:20] + "..." if len(token["access_token"]) > 20 else token["access_token"],  # Mask token for security
                "description": token.get("description", ""),
                "is_active": token.get("is_active", True),
                "created_at": token.get("created_at", datetime.now()),
                "updated_at": token.get("updated_at", datetime.now()),
                "created_by": token.get("created_by", ""),
                "last_used": token.get("last_used"),
                "success_count": token.get("success_count", 0),
                "error_count": token.get("error_count", 0)
            })
        
        return result
    except Exception as e:
        logger.error(f"Error fetching Meta tokens: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch Meta tokens")

@meta_tokens_router.post("/meta-tokens")
async def create_meta_token(token_data: MetaTokenCreate, current_user: dict = Depends(get_current_user)):
    """Create a new Meta access token"""
    try:
        db = get_database()
        
        # Check if token name already exists
        existing_token = db.meta_tokens.find_one({"name": token_data.name})
        if existing_token:
            raise HTTPException(status_code=400, detail="Token name already exists")
        
        # Create token document
        token_doc = {
            "name": token_data.name,
            "access_token": token_data.access_token,
            "description": token_data.description,
            "is_active": token_data.is_active,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": current_user.get("user_id", "unknown"),
            "last_used": None,
            "success_count": 0,
            "error_count": 0
        }
        
        result = db.meta_tokens.insert_one(token_doc)
        
        logger.info(f"Created Meta token '{token_data.name}' by user {current_user.get('user_id')}")
        
        return {
            "message": "Meta token created successfully",
            "id": str(result.inserted_id),
            "name": token_data.name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Meta token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create Meta token")

@meta_tokens_router.put("/meta-tokens/{token_id}")
async def update_meta_token(token_id: str, token_data: MetaTokenUpdate, current_user: dict = Depends(get_current_user)):
    """Update a Meta access token"""
    try:
        from bson import ObjectId
        db = get_database()
        
        # Check if token exists
        existing_token = db.meta_tokens.find_one({"_id": ObjectId(token_id)})
        if not existing_token:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # Prepare update data
        update_data = {"updated_at": datetime.now()}
        if token_data.name is not None:
            # Check if new name conflicts with existing tokens
            name_conflict = db.meta_tokens.find_one({"name": token_data.name, "_id": {"$ne": ObjectId(token_id)}})
            if name_conflict:
                raise HTTPException(status_code=400, detail="Token name already exists")
            update_data["name"] = token_data.name
        
        if token_data.access_token is not None:
            update_data["access_token"] = token_data.access_token
        if token_data.description is not None:
            update_data["description"] = token_data.description
        if token_data.is_active is not None:
            update_data["is_active"] = token_data.is_active
        
        result = db.meta_tokens.update_one(
            {"_id": ObjectId(token_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Token not found or no changes made")
        
        logger.info(f"Updated Meta token {token_id} by user {current_user.get('user_id')}")
        
        return {"message": "Meta token updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating Meta token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update Meta token")

@meta_tokens_router.delete("/meta-tokens/{token_id}")
async def delete_meta_token(token_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a Meta access token"""
    try:
        from bson import ObjectId
        db = get_database()
        
        result = db.meta_tokens.delete_one({"_id": ObjectId(token_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Token not found")
        
        logger.info(f"Deleted Meta token {token_id} by user {current_user.get('user_id')}")
        
        return {"message": "Meta token deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting Meta token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete Meta token")

@meta_tokens_router.post("/meta-tokens/{token_id}/test")
async def test_meta_token(token_id: str, current_user: dict = Depends(get_current_user)):
    """Test a Meta access token by making a simple API call"""
    try:
        from bson import ObjectId
        import requests
        
        db = get_database()
        
        # Get token
        token_doc = db.meta_tokens.find_one({"_id": ObjectId(token_id)})
        if not token_doc:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # Test token with Meta API
        test_url = f"https://graph.facebook.com/v23.0/me"
        headers = {"Authorization": f"Bearer {token_doc['access_token']}"}
        
        response = requests.get(test_url, headers=headers, timeout=10)
        
        # Update token stats
        if response.status_code == 200:
            db.meta_tokens.update_one(
                {"_id": ObjectId(token_id)}, 
                {
                    "$set": {"last_used": datetime.now()},
                    "$inc": {"success_count": 1}
                }
            )
            return {
                "success": True,
                "message": "Token is valid and working",
                "response": response.json()
            }
        else:
            db.meta_tokens.update_one(
                {"_id": ObjectId(token_id)}, 
                {
                    "$set": {"last_used": datetime.now()},
                    "$inc": {"error_count": 1}
                }
            )
            return {
                "success": False,
                "message": f"Token test failed: {response.status_code}",
                "error": response.text
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing Meta token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to test Meta token")

def get_working_access_token(db) -> Optional[str]:
    """Get a working access token with failover support"""
    try:
        # Get all active tokens ordered by success rate (success_count / (success_count + error_count))
        pipeline = [
            {"$match": {"is_active": True}},
            {"$addFields": {
                "total_requests": {"$add": ["$success_count", "$error_count"]},
                "success_rate": {
                    "$cond": {
                        "if": {"$eq": [{"$add": ["$success_count", "$error_count"]}, 0]},
                        "then": 1,  # New tokens get priority
                        "else": {"$divide": ["$success_count", {"$add": ["$success_count", "$error_count"]}]}
                    }
                }
            }},
            {"$sort": {"success_rate": -1, "last_used": 1}}  # Best success rate first, then least recently used
        ]
        
        tokens = list(db.meta_tokens.aggregate(pipeline))
        
        for token in tokens:
            # Test token with a simple API call
            try:
                import requests
                test_url = f"https://graph.facebook.com/v23.0/me"
                headers = {"Authorization": f"Bearer {token['access_token']}"}
                response = requests.get(test_url, headers=headers, timeout=5)
                
                if response.status_code == 200:
                    # Update last_used and success count
                    db.meta_tokens.update_one(
                        {"_id": token["_id"]},
                        {
                            "$set": {"last_used": datetime.now()},
                            "$inc": {"success_count": 1}
                        }
                    )
                    logger.info(f"Using Meta token: {token['name']}")
                    return token['access_token']
                else:
                    # Update error count
                    db.meta_tokens.update_one(
                        {"_id": token["_id"]},
                        {"$inc": {"error_count": 1}}
                    )
                    logger.warning(f"Meta token {token['name']} failed with status {response.status_code}")
                    
            except Exception as e:
                logger.error(f"Error testing token {token['name']}: {str(e)}")
                # Update error count
                db.meta_tokens.update_one(
                    {"_id": token["_id"]},
                    {"$inc": {"error_count": 1}}
                )
                continue
        
        logger.error("No working Meta access tokens found")
        return None
        
    except Exception as e:
        logger.error(f"Error getting working access token: {str(e)}")
        return None

@meta_tokens_router.get("/meta-tokens/active/working")
async def get_active_working_token(current_user: dict = Depends(get_current_user)):
    """Get the current working access token"""
    try:
        db = get_database()
        token = get_working_access_token(db)
        
        if token:
            return {
                "success": True,
                "message": "Working token found",
                "has_token": True
            }
        else:
            return {
                "success": False,
                "message": "No working tokens available",
                "has_token": False
            }
    except Exception as e:
        logger.error(f"Error checking working token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check working token")
