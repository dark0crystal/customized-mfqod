"""
Rate Limiting Setup using slowapi with database logging
"""
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import logging

from app.config.auth_config import AuthConfig
from app.db.database import get_session
from app.models import RateLimitLog

logger = logging.getLogger(__name__)


def get_rate_limit_key(request: Request) -> str:
    """
    Generate a unique key for rate limiting based on IP address
    Supports X-Forwarded-For and X-Real-IP headers for proxy/load balancer scenarios
    """
    # Check for forwarded IP (when behind proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            ip_address = real_ip.strip()
        else:
            # Fallback to direct client IP
            if request.client:
                ip_address = request.client.host
            else:
                ip_address = "unknown"
    
    return ip_address


def log_rate_limit_to_db(request: Request, endpoint: Optional[str] = None):
    """
    Log rate limit request to database for tracking/auditing
    This runs asynchronously and doesn't block the request
    """
    try:
        db = next(get_session())
        try:
            ip_address = get_rate_limit_key(request)
            log_entry = RateLimitLog(
                rate_limit_key=f"rate_limit:{ip_address}",
                ip_address=ip_address,
                endpoint=endpoint or request.url.path
            )
            db.add(log_entry)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging rate limit to database: {str(e)}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in rate limit database logging: {str(e)}")


def should_exclude_path(path: str, config: AuthConfig) -> bool:
    """Check if path should be excluded from rate limiting"""
    for excluded_path in config.RATE_LIMIT_EXCLUDED_PATHS:
        if path.startswith(excluded_path):
            return True
    return False


# Create limiters using slowapi's in-memory storage
# Public endpoint limiter (30 requests per minute)
public_limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["30/minute"]
)

# Authenticated endpoint limiter (60 requests per minute)
authenticated_limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["60/minute"]
)


def get_limiter_for_endpoint(is_authenticated: bool = False) -> Limiter:
    """
    Get the appropriate limiter based on endpoint type
    """
    if is_authenticated:
        return authenticated_limiter
    return public_limiter
