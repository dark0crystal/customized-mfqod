from fastapi import APIRouter, HTTPException
from schemas.user_schema import UserCreate
from services import userServices

router = APIRouter()

# Register API
# When university users try to login to the system:
# 1. check our local database if the user already exsist in it , if not :
#   - check the university users from the active directory
#   - if exist : then fetch the user information
#  
@router.post("/login")
async def login(user: UserCreate):
    # Check if email and password are provided
    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Email and Password are required")

    # Check if user already exists in local DB 
    existing_user = await userServices.CheckUserExistenceDB(user.email)
    if existing_user:
        # generate a JWT
        token = CreateJwtToken(existing_user.id, existing_user.email)
        return {
            "message": "Login successful from DB",
            "token": token
        }
    elif not existing_user:
        active_dir_user = await userServices.CheckUserExistenceAD(user.email)
        # add user to local DB
        token = CreateJwtToken(existing_user.id, existing_user.email)
        return {
            "message": "Login successful from AD",
            "token": token
        }
        # raise HTTPException(status_code=400, detail="User already exists")

    return {"message": "User registered successfully"}
