from fastapi import HTTPException
from sqlalchemy.orm import Session
from schemas.user_schema import UserRegister, UserLogin
from models import User, Role, UserStatus
from utils.security import hash_password, verify_password
from sqlalchemy import select
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt
import os
from dotenv import load_dotenv

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_EXPIRATION_MINUTES = 30

async def authenticate_user(user: UserLogin, session: Session):
    statement = select(User).where(User.email == user.email)
    db_user = session.execute(statement).scalars().first()

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    role_name = db_user.role.name if db_user.role else "user"
    token = await create_jwt_token(
        user_id=db_user.id,
        email=db_user.email,
        role=role_name,
        first_name=db_user.first_name,
        last_name=db_user.last_name,
    )
    return {"message": "Login successful", "token": token}

async def register_user(user: UserRegister, session: Session):
    # Check if user already exists
    exists = session.execute(select(User).where(User.email == user.email)).first()
    if exists:
        raise HTTPException(status_code=409, detail="User already exists")

    # Resolve status & role
    status = session.execute(select(UserStatus).where(UserStatus.name == user.status_name)).first()
    if not status:
        raise HTTPException(status_code=400, detail="Invalid status name")

    role = session.execute(select(Role).where(Role.name == user.role_name)).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role name")

    new_user = User(
        id=user.id or str(uuid.uuid4()),
        email=user.email,
        password=hash_password(user.password),
        first_name=user.first_name,
        middle_name=user.middle_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        status_id=status.id,
        role_id=role.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return {"message": "User registered successfully", "user_id": new_user.id}

async def create_jwt_token(user_id, email, role, first_name, last_name):
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "first_name": first_name,
        "last_name": last_name,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
