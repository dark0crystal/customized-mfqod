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
    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Email and Password are required")

    existing_user = await userServices.CheckUserExistenceDB(user.email)

    if existing_user:
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

    ad_user = await userServices.CheckUserExistenceAD(user.email)
    if ad_user:
        new_user = userServices.CreateNewUserInDB(ad_user)
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

    raise HTTPException(status_code=404, detail="User not found")
