from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from schemas.user_schema import UserLogin, UserRegister
from services.userServices import (
    register_user,
    authenticate_user,
)
from db.database import get_session

router = APIRouter()
# ===================
# Login 
# ===================
@router.post("/login")
async def login(user: UserLogin, session: Session = Depends(get_session)):
    return await authenticate_user(user, session)
# ===================
# Register 
# ===================
@router.post("/register")
async def register(user: UserRegister, session: Session = Depends(get_session)):
    return await register_user(user, session)
