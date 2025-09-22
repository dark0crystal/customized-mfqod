from fastapi import FastAPI
from db.database import init_db
from fastapi.middleware.cors import CORSMiddleware
from routes import userRoutes, roleRoutes, itemRoutes ,authRoutes,ldapAuthRoutes,itemTypeRoutes,userStatusRoutes,permissionRoutes,branchRoutes,organizationRoute,imageRoutes
from routes.comprehensive_auth_routes import router as comprehensive_auth_router
from routes.imageRoutes import router as image_router
from fastapi.staticfiles import StaticFiles
from middleware.auth_middleware import add_security_headers
from services.sync_scheduler import start_scheduler, stop_scheduler
from utils.logging_config import setup_logging
import os
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

# CORS Configuration
origins = [
    "http://localhost:3000",  # Your Next.js frontend
    "http://127.0.0.1:3000",  # Alternative localhost
    "http://localhost:3001",  # In case you use different port
    # Add your production frontend URL here when deploying
    # "https://yourdomain.com"
]

# Add security headers middleware
app.middleware("http")(add_security_headers)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Your Next.js frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Create the directory if it doesn't exist
os.makedirs("uploads/images", exist_ok=True)
app.mount("/static/images", StaticFiles(directory="uploads/images"), name="images")

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    try:
        # Initialize database
        init_db()
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
app.include_router(ldapAuthRoutes.router, prefix="/api/ldap-auth", tags=["LDAP Auth (Legacy)"])
app.include_router(itemTypeRoutes.router, prefix="/api/item-types", tags=["Item Types"])
app.include_router(userStatusRoutes.router, prefix="/api/user-status", tags=["User Status"])
app.include_router(permissionRoutes.router, prefix="/api/permissions", tags=["Permissions"])
app.include_router(branchRoutes.router, prefix="/api/branches", tags=["Branches"])
app.include_router(organizationRoute.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(imageRoutes.router, prefix="/api/images", tags=["Images"])

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
