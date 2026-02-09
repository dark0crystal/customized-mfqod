from fastapi import FastAPI, Query, HTTPException, Depends, Request
from fastapi import Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import init_db, get_session
from app.routes import userRoutes, roleRoutes, itemRoutes, itemTypeRoutes, userStatusRoutes, permissionRoutes, branchRoutes, organizationRoute, imageRoutes, addressRoutes, notificationRoutes, claimRoutes, analyticsRoutes, missingItemRoutes, transferRequestRoutes, auditLogRoutes
from app.routes.comprehensive_auth_routes import router as comprehensive_auth_router
from app.routes.imageRoutes import router as image_router
from fastapi.staticfiles import StaticFiles
from app.middleware.auth_middleware import add_security_headers
from app.middleware.rate_limit_decorator import rate_limit_public
from app.middleware.rate_limit_setup import public_limiter, authenticated_limiter, should_exclude_path
from app.config.auth_config import AuthConfig
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.services.sync_scheduler import start_scheduler, stop_scheduler
from app.utils.logging_config import setup_logging
import os
import sys

import logging

# Setup comprehensive logging
setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="University Lost & Found System",
    description="Comprehensive lost and found system with dual authentication (AD + local)",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize rate limiting 
config = AuthConfig()
if config.ENABLE_GLOBAL_RATE_LIMIT:
    app.state.limiter = public_limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    logger.info(f"Global rate limiting enabled - Public: {config.PUBLIC_API_RATE_LIMIT_PER_MINUTE}/min, Authenticated: {config.AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE}/min")

# CORS Configuration
# Get allowed origins from environment variable or use defaults
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    origins = [
        "http://localhost:3000",  # Your Next.js frontend
        "http://127.0.0.1:3000",  # Alternative localhost
        "http://localhost:3001",  # In case you use different port
        "http://localhost:3002",  # Current frontend port
        "http://127.0.0.1:3002",  # Alternative localhost for current port
        "http://frontend:3000",  # Docker service name for internal networking
        # Add your production frontend URL here
        # "https://yourdomain.com"
    ]

# Add security headers middleware (applied first due to reverse order)
app.middleware("http")(add_security_headers)

# Configure CORS middleware (added last, so it executes first)
# This ensures CORS headers are added before security headers can interfere
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Your Next.js frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  # Added PATCH method
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Global exception handler to ensure CORS headers are included in error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: FastAPIRequest, exc: HTTPException):
    """Handle HTTP exceptions and ensure CORS headers are included"""
    origin = request.headers.get("origin")
    
    # Check if origin is in allowed origins
    if origin in origins:
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    
    # If origin not in allowed list, return standard response (CORS middleware will handle it)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: FastAPIRequest, exc: RequestValidationError):
    """Handle validation errors and ensure CORS headers are included"""
    origin = request.headers.get("origin")
    
    if origin in origins:
        response = JSONResponse(
            status_code=422,
            content={"detail": exc.errors(), "body": exc.body}
        )
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body}
    )

# Create the directory if it doesn't exist
UPLOAD_DIR = "../storage/uploads/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static/images", StaticFiles(directory=UPLOAD_DIR), name="images")

# Create the directory for item type images if it doesn't exist
ITEM_TYPES_IMAGES_DIR = "../storage/uploads/itemTypesImages"
os.makedirs(ITEM_TYPES_IMAGES_DIR, exist_ok=True)
app.mount("/static/item-types-images", StaticFiles(directory=ITEM_TYPES_IMAGES_DIR), name="item-types-images")

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    try:
        # Check if automatic migrations are enabled (default: False for safety)
        auto_run_migrations = os.getenv("AUTO_RUN_MIGRATIONS", "false").lower() == "true"
        
        # Initialize database (with optional automatic migrations)
        init_db(run_migrations=auto_run_migrations)
        logger.info("Database initialized successfully")
        
        # Start background job scheduler
        await start_scheduler()
        logger.info("Background scheduler started successfully")
        
        # Create logs directory
        os.makedirs("logs", exist_ok=True)
        
        logger.info("University Lost & Found System started successfully")
        
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    try:
        await stop_scheduler()
        logger.info("Background scheduler stopped")
        logger.info("University Lost & Found System shutdown completed")
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")

# API Routes
app.include_router(comprehensive_auth_router, prefix="/api", tags=["Enhanced Authentication"])
app.include_router(userRoutes.router, prefix="/api/users", tags=["Users"])
app.include_router(itemRoutes.router, prefix="/api/items", tags=["Items"])
app.include_router(roleRoutes.router, prefix="/api/roles", tags=["Roles"])
app.include_router(itemTypeRoutes.router, prefix="/api/item-types", tags=["Item Types"])
app.include_router(userStatusRoutes.router, prefix="/api/user-status", tags=["User Status"])
app.include_router(permissionRoutes.router, prefix="/api/permissions", tags=["Permissions"])
app.include_router(branchRoutes.router, prefix="/api/branches", tags=["Branches"])
app.include_router(organizationRoute.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(addressRoutes.router, prefix="/api/addresses", tags=["Addresses"])
app.include_router(imageRoutes.router, prefix="/api/images", tags=["Images"])
app.include_router(notificationRoutes.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(claimRoutes.router, prefix="/api/claims", tags=["Claims"])
app.include_router(missingItemRoutes.router, prefix="/api/missing-items", tags=["Missing Items"])
app.include_router(analyticsRoutes.router, prefix="/api", tags=["Analytics"])
app.include_router(transferRequestRoutes.router, prefix="/api/transfer-requests", tags=["Transfer Requests"])
app.include_router(auditLogRoutes.router, prefix="/api/audit-logs", tags=["Audit Logs"])


# Health check endpoint
@app.get("/api/health", tags=["System"])
async def health_check():
    """System health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": "2025-01-09T12:00:00Z"
    }

# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """Root endpoint with system information"""
    return {
        "message": "University Lost & Found System API",
        "version": "2.0.0",
        "docs_url": "/api/docs",
        "features": [
            "Dual Authentication (Active Directory + Local)",
            "Role-Based Access Control",
            "Automated User Sync",
            "Security Monitoring",
            "Comprehensive Logging"
        ]
        }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        log_level="info",
    )
