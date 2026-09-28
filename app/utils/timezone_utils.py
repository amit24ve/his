"""
Timezone utilities for consistent IST handling across the application.
All datetime operations should use these utilities to ensure proper IST timezone handling.
"""

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Union, Optional
import logging

logger = logging.getLogger(__name__)

# Indian Standard Time zone
IST = ZoneInfo("Asia/Kolkata")
IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> datetime:
    """Get current time in Indian Standard Time"""
    return datetime.now(IST)

def get_ist_date():
    """Get current date in Indian timezone"""
    return get_ist_now().date()

def convert_to_ist(dt: Union[datetime, str, None]) -> Optional[datetime]:
    """
    Convert any datetime to IST timezone.
    
    Args:
        dt: datetime object, ISO string, or None
        
    Returns:
        datetime object in IST timezone or None
    """
    if dt is None:
        return None
    
    if isinstance(dt, str):
        try:
            # Handle various ISO string formats
            if dt.endswith('Z'):
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            elif '+' in dt[-6:] or '-' in dt[-6:]:
                dt = datetime.fromisoformat(dt)
            else:
                # Assume it's a naive datetime in UTC
                dt = datetime.fromisoformat(dt).replace(tzinfo=timezone.utc)
        except ValueError as e:
            logger.warning(f"Failed to parse datetime string '{dt}': {e}")
            return None
    
    # If timezone naive, assume it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Convert to IST
    return dt.astimezone(IST)

def get_ist_timestamp() -> str:
    """
    Get current IST timestamp in ISO format with timezone info.
    
    Returns:
        ISO format string with IST timezone (+05:30)
    """
    return get_ist_now().isoformat()

def get_ist_timestamp_for_db() -> datetime:
    """
    Get current IST datetime object for database storage.
    
    Returns:
        datetime object in IST timezone
    """
    return get_ist_now()

def format_ist_datetime(dt: Union[datetime, str, None], format_str: str = "%Y-%m-%d %H:%M:%S IST") -> str:
    """
    Format datetime in IST timezone with custom format.
    
    Args:
        dt: datetime object, ISO string, or None
        format_str: format string (default includes IST suffix)
        
    Returns:
        formatted string or empty string if dt is None
    """
    if dt is None:
        return ""
    
    ist_dt = convert_to_ist(dt)
    if ist_dt is None:
        return ""
    
    return ist_dt.strftime(format_str)

def parse_date_to_ist(date_str: str) -> datetime:
    """
    Convert string date to datetime object at start of day in IST timezone.
    
    Args:
        date_str: date string in YYYY-MM-DD format
        
    Returns:
        datetime object at start of day in IST
    """
    parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
    return parsed_date.replace(tzinfo=IST)

def parse_datetime_to_ist(datetime_str: str) -> datetime:
    """
    Parse datetime string and convert to IST.
    
    Args:
        datetime_str: datetime string in ISO format
        
    Returns:
        datetime object in IST timezone
    """
    return convert_to_ist(datetime_str)

def make_datetime_serializable(obj):
    """
    Convert datetime objects to IST timezone and make them JSON serializable.
    Used for API responses.
    
    Args:
        obj: any object that might contain datetime objects
        
    Returns:
        JSON-serializable object with datetime converted to IST ISO strings
    """
    if isinstance(obj, dict):
        return {k: make_datetime_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_datetime_serializable(item) for item in obj]
    elif isinstance(obj, datetime):
        ist_dt = convert_to_ist(obj)
        return ist_dt.isoformat() if ist_dt else None
    else:
        return obj

def ensure_ist_timezone(dt: datetime) -> datetime:
    """
    Ensure datetime has IST timezone info.
    If timezone naive, assumes UTC and converts to IST.
    If already has timezone, converts to IST.
    
    Args:
        dt: datetime object
        
    Returns:
        datetime object in IST timezone
    """
    if dt.tzinfo is None:
        # Assume UTC if naive
        dt = dt.replace(tzinfo=timezone.utc)
    
    return dt.astimezone(IST)

# For backward compatibility
convert_utc_to_ist_string = lambda dt: format_ist_datetime(dt, "%Y-%m-%d %H:%M:%S IST")
