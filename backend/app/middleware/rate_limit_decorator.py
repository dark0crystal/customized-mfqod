"""
Rate Limiting Decorators for easy application to endpoints using slowapi
"""
from fastapi import Request
from typing import Optional
import logging

from app.middleware.rate_limit_setup import (
    public_limiter,
    authenticated_limiter,
    log_rate_limit_to_db,
    should_exclude_path
)
from app.config.auth_config import AuthConfig

logger = logging.getLogger(__name__)
config = AuthConfig()


# Export limiters for direct use with slowapi's @limiter.limit() decorator
__all__ = ['public_limiter', 'authenticated_limiter', 'rate_limit_public', 'rate_limit_authenticated', 'rate_limit_custom']


def rate_limit_public(limit: Optional[str] = None):
    """
    Returns slowapi limiter decorator for public endpoints
    Default: 30 requests per minute
    
    Usage:
        @router.get("/public")
        @rate_limit_public()
        async def get_public_items(request: Request, ...):
            ...
    """
    limit_str = limit or f"{config.PUBLIC_API_RATE_LIMIT_PER_MINUTE}/minute"
    return public_limiter.limit(limit_str)


def rate_limit_authenticated(limit: Optional[str] = None):
    """
    Returns slowapi limiter decorator for authenticated endpoints
    Default: 60 requests per minute
    
    Usage:
        @router.get("/items")
        @rate_limit_authenticated()
        async def get_items(request: Request, ...):
            ...
    """
    limit_str = limit or f"{config.AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE}/minute"
    return authenticated_limiter.limit(limit_str)


def rate_limit_custom(limit: str):
    """
    Returns slowapi limiter decorator with custom rate limit
    
    Usage:
        @router.get("/heavy-endpoint")
        @rate_limit_custom("10/minute")
        async def heavy_operation(request: Request, ...):
            ...
    """
    return authenticated_limiter.limit(limit)
