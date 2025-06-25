from fastapi import APIRouter, HTTPException
from schemas.user_schema import UserCreate
from services import userServices

router = APIRouter()

# Register API
@router.post("/register")
async def register(user: UserCreate):
    # Check if email and password are provided
    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Email and Password are required")

    # Check if user already exists (assuming async DB call)
    existing_user = await userServices.CheckUserExistence(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    return {"message": "User registered successfully"}
