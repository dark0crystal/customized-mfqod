from fastapi import APIRouter, HTTPException
from schemas.user_schema import UserCreate
from services import userServices

router = APIRouter()

# ===========================
# Login Endpoint
# ===========================
# This endpoint allows users to log in using either:
# - The local database (DB)
# - Or the university Active Directory (AD)
# ---------------------------
# Flow:
# 1. Validate input email & password
# 2. Check user in local DB
#    - If found, generate and return JWT
# 3. If not found, check user in AD
#    - If found, create new user in DB, then generate and return JWT
# 4. If not found in both, return error
# ===========================

@router.post("/login")
async def login(user: UserCreate):
    
    # Step 1: Validate email and password presence
    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Email and Password are required")

    # Step 2: Check if user exists in local DB
    existing_user = await userServices.CheckUserExistenceDB(user.email)

    if existing_user:
        # Step 2.1: Generate JWT for local DB user
        token = await userServices.CreateJwtToken(
            existing_user["id"],
            existing_user["email"],
            existing_user["role"],
            existing_user["first_name"],
            existing_user["last_name"]
        )
        return {
            "message": "Login successful from DB",
            "token": token
        }

    # Step 3: Check if user exists in Active Directory
    ad_user = await userServices.CheckUserExistenceAD(user.email)

    if ad_user:
        # Step 3.1: Create a new user in local DB using data from AD
        new_user = userServices.CreateNewUserInDB(ad_user)

        # Step 3.2: Generate JWT for the new user
        token = await userServices.CreateJwtToken(
            new_user["id"],
            new_user["email"],
            new_user["role"],
            new_user["first_name"],
            new_user["last_name"]
        )
        return {
            "message": "Login successful from AD",
            "token": token
        }

    # Step 4: If user not found anywhere, raise error
    raise HTTPException(status_code=404, detail="User not found")


# ===========================
# OutSide Uni Users Login Endpoint
# ===========================
# This Endpoint will allow users from out 