from fastapi import FastAPI
from db.database import init_db
from fastapi.middleware.cors import CORSMiddleware
from routes import userRoutes, roleRoutes, itemRoutes ,authRoutes,ldapAuthRoutes,itemTypeRoutes,userStatusRoutes,permissionRoutes

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:3000",  # Your Next.js frontend
    "http://127.0.0.1:3000",  # Alternative localhost
    "http://localhost:3001",  # In case you use different port
    # Add your production frontend URL here when deploying
    # "https://yourdomain.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows specific origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(userRoutes.router, prefix="/users", tags=["Users"])
app.include_router(itemRoutes.router, prefix="/items", tags=["Item"])
app.include_router(roleRoutes.router, prefix="/roles", tags=["Role"])
# app.include_router(authRoutes.router, prefix="/auth", tags=["Auth"])
app.include_router(ldapAuthRoutes.router, prefix="/ldap-auth", tags=["LdapAuth"])
app.include_router(itemTypeRoutes.router, prefix="/item-type", tags=["ItemType"])
app.include_router(userStatusRoutes.router, prefix="/user-status", tags=["UserStatus"])
app.include_router(permissionRoutes.router, prefix="/permissions", tags=["Permissions"])