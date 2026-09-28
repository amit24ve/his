import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):  # Change to inherit from BaseSettings
    # Application settings
    APP_NAME: str = "CRM"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # Secret key and JWT settings
    SECRET_KEY: str = os.getenv("SECRET_KEY","your_secret_key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Database settings
    MONGO_URI: str = "mongodb+srv://neelbert_test:Neelbert%40123.@cluster0.ijzzjo3.mongodb.net/?appName=Cluster0"
    DATABASE_NAME: str = "hospital"
    
    # Google Sheets API settings
    GOOGLE_SERVICE_ACCOUNT_FILE: str = os.getenv(
        "GOOGLE_SERVICE_ACCOUNT_FILE", 
        "./app/credentials/google_service_account.json"
    )
    
    # Meta Ads API settings
    META_APP_ID: str = os.getenv("META_APP_ID", "")
    META_APP_SECRET: str = os.getenv("META_APP_SECRET", "")
    META_WEBHOOK_VERIFY_TOKEN: str = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "")
    
    # Background task settings
    BACKGROUND_TASK_INTERVAL_MINUTES: int = 15
    class Config:
        env_file = ".env"
        env_prefix = "CRM_"
        case_sensitive = False

# Create settings instance
settings = Settings()

# Function to get settings for dependency injection
def get_settings() -> Settings:
    return settings