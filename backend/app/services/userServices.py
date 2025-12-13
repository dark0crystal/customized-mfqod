from typing import List, Optional, Dict, Any, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, and_
from app.schemas.user_schema import UserRegister, UserLogin, UserUpdate, UserResponse
from app.models import User, Role, UserStatus, UserSession, LoginAttempt
from app.utils.security import hash_password, verify_password
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt
import os
from dotenv import load_dotenv
import asyncio
import logging

logger = logging.getLogger(__name__)

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_EXPIRATION_MINUTES = 30  # Original token expiration
ACCESS_TOKEN_EXPIRATION_MINUTES = 30  # Short-lived access token
REFRESH_TOKEN_EXPIRATION_DAYS = 7     # Long-lived refresh token
AUTO_REFRESH_THRESHOLD_MINUTES = 10   # Refresh if less than 10 minutes remaining

# ==========================================
# ORIGINAL FUNCTIONS (EXACTLY AS YOU HAD THEM)
# ==========================================

async def authenticate_user(user: UserLogin, session: Session):
    """Original authenticate function - unchanged"""
    statement = select(User).where(User.email == user.identifier)
    db_user = session.execute(statement).scalars().first()

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    role_name = db_user.role.name if db_user.role else "user"
    role_id = db_user.role.id if db_user.role else None
    
    token = await create_jwt_token(
        user_id=db_user.id,
        email=db_user.email,
        role=role_name,
        role_id=role_id,
        first_name=db_user.first_name,
        last_name=db_user.last_name,
    )
        
    return {
        "message": "Login successful", 
        "token": token,
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "first_name": db_user.first_name,
            "last_name": db_user.last_name,
            "role": role_name,
            "role_id": role_id
        }
    }

async def register_user(user: UserRegister, session: Session):
    """Original register function - unchanged"""
    exists = session.execute(select(User).where(User.email == user.email)).scalars().first()
    if exists:
        raise HTTPException(status_code=409, detail="User already exists")

    status = session.execute(select(UserStatus).where(UserStatus.name == user.status_name)).scalars().first()
    if not status:
        raise HTTPException(status_code=400, detail="Invalid status name")

    # Always assign the 'user' role
    role = session.execute(select(Role).where(Role.name == "user")).scalars().first()
    if not role:
        raise HTTPException(status_code=400, detail="Default role 'user' not found")

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
    
    # Send welcome email notification
    try:
        from app.services.notification_service import send_welcome_email
        user_full_name = f"{new_user.first_name} {new_user.last_name}".strip()
        
        # Send welcome email in background
        asyncio.create_task(
            send_welcome_email(
                user_email=new_user.email,
                user_name=user_full_name
            )
        )
        logger.info(f"Welcome email queued for new user: {new_user.email}")
    except Exception as e:
        logger.error(f"Failed to queue welcome email for {new_user.email}: {e}")

    return {"message": "User registered successfully", "user_id": new_user.id}

async def create_jwt_token(user_id, email, role, role_id, first_name, last_name):
    """Original JWT token creation - unchanged"""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "role_id": role_id,
        "first_name": first_name,
        "last_name": last_name,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES),
        "iat": datetime.utcnow(),
        "type": "access_token"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def verify_jwt_token(token: str):
    """Original JWT verification - unchanged"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_from_token(token: str, session: Session):
    """Original get current user function - unchanged"""
    payload = await verify_jwt_token(token)
    user_id = payload.get("sub")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    statement = select(User).where(User.id == user_id)
    db_user = session.execute(statement).scalars().first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": db_user.id,
        "email": db_user.email,
        "first_name": db_user.first_name,
        "last_name": db_user.last_name,
        "role": db_user.role.name if db_user.role else "user",
        "role_id": db_user.role.id if db_user.role else None
    }

def _user_to_response(user: User) -> Dict[str, Any]:
    """Convert User model to response dictionary - unchanged"""
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "last_name": user.last_name,
        "name": f"{user.first_name} {user.middle_name or ''} {user.last_name}".strip(),
        "phone_number": user.phone_number,
        "role": user.role.name if user.role else None,
        "role_id": user.role_id,
        "status": user.status.name if user.status else None,
        "status_id": user.status_id,
        "active": user.active,
        "user_type": user.user_type.value if user.user_type else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "ad_sync_date": user.ad_sync_date.isoformat() if user.ad_sync_date else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None
    }

async def search_users(
    session: Session,
    email: Optional[str] = None,
    name: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 10
) -> Dict[str, Any]:
    """Search users with various filters and pagination - unchanged"""
    
    query = select(User)
    
    # Build filters
    filters = []
    
    if email:
        filters.append(User.email.ilike(f"%{email}%"))
    
    if name:
        name_filter = or_(
            User.first_name.ilike(f"%{name}%"),
            User.middle_name.ilike(f"%{name}%"),
            User.last_name.ilike(f"%{name}%"),
            func.concat(User.first_name, ' ', User.last_name).ilike(f"%{name}%")
        )
        filters.append(name_filter)
    
    if role:
        query = query.join(Role).where(Role.name.ilike(f"%{role}%"))
    
    if status:
        query = query.join(UserStatus).where(UserStatus.name.ilike(f"%{status}%"))
    
    if filters:
        query = query.where(and_(*filters))
    
    # Get total count
    count_query = select(func.count(User.id))
    if filters:
        count_query = count_query.where(and_(*filters))
    if role:
        count_query = count_query.join(Role).where(Role.name.ilike(f"%{role}%"))
    if status:
        count_query = count_query.join(UserStatus).where(UserStatus.name.ilike(f"%{status}%"))
    
    total_count = session.execute(count_query).scalar()
    
    # Apply pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    # Execute query
    users = session.execute(query).scalars().all()
    
    # Convert to response format
    user_list = [_user_to_response(user) for user in users]
    
    return {
        "users": user_list,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit
    }

async def get_user_by_id(user_id: str, session: Session) -> Dict[str, Any]:
    """Get a specific user by ID - unchanged"""
    statement = select(User).where(User.id == user_id)
    user = session.execute(statement).scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return _user_to_response(user)

async def update_user(user_id: str, user_update: UserUpdate, session: Session) -> Dict[str, Any]:
    """Update user information - unchanged"""
    statement = select(User).where(User.id == user_id)
    db_user = session.execute(statement).scalars().first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if email is being updated and if it already exists
    if user_update.email and user_update.email != db_user.email:
        existing_email = session.execute(
            select(User).where(User.email == user_update.email)
        ).scalars().first()
        if existing_email:
            raise HTTPException(status_code=409, detail="Email already exists")
    
    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Handle password update
    if "password" in update_data:
        update_data["password"] = hash_password(update_data["password"])
    
    # Handle role update
    if "role_name" in update_data:
        role = session.execute(
            select(Role).where(Role.name == update_data["role_name"])
        ).scalars().first()
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role name")
        update_data["role_id"] = role.id
        del update_data["role_name"]
    
    # Handle status update
    if "status_name" in update_data:
        status = session.execute(
            select(UserStatus).where(UserStatus.name == update_data["status_name"])
        ).scalars().first()
        if not status:
            raise HTTPException(status_code=400, detail="Invalid status name")
        update_data["status_id"] = status.id
        del update_data["status_name"]
    
    # Update timestamp
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Apply updates
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    session.commit()
    session.refresh(db_user)
    
    return {
        "message": "User updated successfully",
        "user": _user_to_response(db_user)
    }

async def delete_user(user_id: str, session: Session) -> Dict[str, Any]:
    """Delete a user (soft delete by updating status)"""
    logger.info(f"Attempting to soft delete user: {user_id}")
    
    try:
        statement = select(User).where(User.id == user_id)
        user = session.execute(statement).scalars().first()
        
        if not user:
            logger.warning(f"User not found for soft delete: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Soft delete (update status to "deleted")
        deleted_status = session.execute(
            select(UserStatus).where(UserStatus.name == "deleted")
        ).scalars().first()
        
        if not deleted_status:
            logger.info("Creating missing 'deleted' status")
            # Create it if it doesn't exist
            deleted_status = UserStatus(name="deleted", description="User account is deleted")
            session.add(deleted_status)
            session.commit()
            session.refresh(deleted_status)
        
        user.status_id = deleted_status.id
        user.updated_at = datetime.now(timezone.utc)
        session.commit()
        logger.info(f"User {user_id} soft deleted successfully")
        return {"message": "User deleted successfully (soft delete)"}
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error soft deleting user {user_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

async def permanently_delete_user(user_id: str, session: Session) -> Dict[str, Any]:
    """
    Permanently delete a user but preserve their contributions by anonymizing them.
    """
    statement = select(User).where(User.id == user_id)
    user = session.execute(statement).scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        # 1. Anonymize Items (Posts)
        # Set user_id to NULL for all items posted by this user
        for item in user.items:
            item.user_id = None
            
        # 2. Anonymize Missing Items
        # Set user_id to NULL for all missing items posted by this user
        for missing_item in user.missing_items:
            missing_item.user_id = None
            
        # 3. Anonymize Claims
        # Set user_id to NULL for all claims made by this user
        for claim in user.claims:
            claim.user_id = None
            
        # 4. Remove from Managed Branches
        # This relationship is handled via secondary table, clearing the list removes associations
        user.managed_branches = []
        
        # 5. Delete Login Attempts
        # These are less critical to preserve anonymously, so we can delete them
        # Alternatively, we could set user_id to NULL if we wanted to keep the IP logs
        for attempt in user.login_attempts:
            session.delete(attempt)
            
        # 6. Delete User Sessions
        # Find and delete any active sessions
        session_statement = select(UserSession).where(UserSession.user_id == user_id)
        user_sessions = session.execute(session_statement).scalars().all()
        for user_session in user_sessions:
            session.delete(user_session)

        # 7. Delete the User record
        session.delete(user)
        
        session.commit()
        return {"message": "User permanently deleted and data anonymized"}
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error permanently deleting user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to permanently delete user: {str(e)}")

async def get_all_users(session: Session, page: int = 1, limit: int = 10) -> Dict[str, Any]:
    """Get all users with pagination - unchanged"""
    return await search_users(session, page=page, limit=limit)

async def get_user_by_email(email: str, session: Session) -> Dict[str, Any]:
    """Get user by exact email match - unchanged"""
    statement = select(User).where(User.email == email)
    user = session.execute(statement).scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return _user_to_response(user)

async def get_users_by_role(role_name: str, session: Session, page: int = 1, limit: int = 10) -> Dict[str, Any]:
    """Get users by role - unchanged"""
    return await search_users(session, role=role_name, page=page, limit=limit)

async def get_users_by_status(status_name: str, session: Session, page: int = 1, limit: int = 10) -> Dict[str, Any]:
    """Get users by status - unchanged"""
    return await search_users(session, status=status_name, page=page, limit=limit)

async def activate_user(user_id: str, session: Session) -> Dict[str, Any]:
    """Activate a user account - unchanged"""
    statement = select(User).where(User.id == user_id)
    user = session.execute(statement).scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    active_status = session.execute(
        select(UserStatus).where(UserStatus.name == "active")
    ).scalars().first()
    
    if not active_status:
        # Create it if it doesn't exist
        active_status = UserStatus(name="active", description="User account is active")
        session.add(active_status)
        session.commit()
        session.refresh(active_status)
    
    user.status_id = active_status.id
    user.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(user)
    
    return {
        "message": "User activated successfully",
        "user": _user_to_response(user)
    }

async def deactivate_user(user_id: str, session: Session) -> Dict[str, Any]:
    """Deactivate a user account - unchanged"""
    statement = select(User).where(User.id == user_id)
    user = session.execute(statement).scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    inactive_status = session.execute(
        select(UserStatus).where(UserStatus.name == "inactive")
    ).scalars().first()
    
    if not inactive_status:
        # Create it if it doesn't exist
        inactive_status = UserStatus(name="inactive", description="User account is inactive")
        session.add(inactive_status)
        session.commit()
        session.refresh(inactive_status)
    
    user.status_id = inactive_status.id
    user.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(user)
    
    return {
        "message": "User deactivated successfully",
        "user": _user_to_response(user)
    }

# ==========================================
# NEW ENHANCED TOKEN FUNCTIONS (ADDITIONS)
# ==========================================

async def create_access_token(user_id: str, email: str, role: str, role_id: str, 
                            first_name: str, last_name: str) -> str:
    """Create short-lived access token"""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "role_id": role_id,
        "first_name": first_name,
        "last_name": last_name,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRATION_MINUTES),
        "iat": datetime.utcnow(),
        "type": "access_token"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def create_refresh_token(user_id: str) -> str:
    """Create long-lived refresh token"""
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
        "type": "refresh_token"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def create_token_pair(user_id: str, email: str, role: str, role_id: str, 
                          first_name: str, last_name: str) -> Dict[str, str]:
    """Create both access and refresh tokens"""
    access_token = await create_access_token(user_id, email, role, role_id, first_name, last_name)
    refresh_token = await create_refresh_token(user_id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRATION_MINUTES * 60  # in seconds
    }

async def refresh_access_token(refresh_token: str, session: Session) -> Dict[str, str]:
    """Generate new access token using refresh token"""
    try:
        # Verify refresh token
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if payload.get("type") != "refresh_token":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Get user details
        statement = select(User).where(User.id == user_id)
        user = session.execute(statement).scalars().first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create new access token
        role_name = user.role.name if user.role else "user"
        role_id = user.role.id if user.role else None
        
        new_access_token = await create_access_token(
            user.id, user.email, role_name, role_id, user.first_name, user.last_name
        )
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRATION_MINUTES * 60
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

async def get_current_user_with_auto_refresh(token: str, session: Session) -> Tuple[Dict[str, Any], Optional[str]]:
    """Get current user and optionally return new token if auto-refresh triggered"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check if token is close to expiration
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
            time_until_expiry = exp_datetime - datetime.now(timezone.utc)
            
            # If less than threshold time remaining, create new token
            if time_until_expiry.total_seconds() < (AUTO_REFRESH_THRESHOLD_MINUTES * 60):
                user_id = payload.get("sub")
                
                # Get fresh user data
                statement = select(User).where(User.id == user_id)
                user = session.execute(statement).scalars().first()
                
                if user:
                    role_name = user.role.name if user.role else "user"
                    role_id = user.role.id if user.role else None
                    
                    new_token = await create_access_token(
                        user.id, user.email, role_name, role_id, 
                        user.first_name, user.last_name
                    )
                    
                    user_data = {
                        "id": user.id,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": role_name,
                        "role_id": role_id
                    }
                    
                    return user_data, new_token
        
        # Token is still valid, no refresh needed
        user_id = payload.get("sub")
        statement = select(User).where(User.id == user_id)
        user = session.execute(statement).scalars().first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role.name if user.role else "user",
            "role_id": user.role.id if user.role else None
        }
        
        return user_data, None
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_token_expiry_info(token: str) -> Dict[str, Any]:
    """Get token expiration information without full verification"""
    try:
        # Decode without verification to get expiry info
        unverified_payload = jwt.get_unverified_claims(token)
        exp_timestamp = unverified_payload.get("exp")
        
        if exp_timestamp:
            exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
            current_time = datetime.now(timezone.utc)
            time_remaining = exp_datetime - current_time
            
            return {
                "expires_at": exp_datetime.isoformat(),
                "seconds_remaining": int(time_remaining.total_seconds()),
                "minutes_remaining": int(time_remaining.total_seconds() / 60),
                "is_expired": time_remaining.total_seconds() <= 0,
                "needs_refresh": time_remaining.total_seconds() < (AUTO_REFRESH_THRESHOLD_MINUTES * 60)
            }
    except Exception:
        pass
    
    return {
        "expires_at": None,
        "seconds_remaining": 0,
        "minutes_remaining": 0,
        "is_expired": True,
        "needs_refresh": True
    }

async def validate_and_refresh_if_needed(token: str, session: Session) -> Tuple[Dict[str, Any], Optional[str]]:
    """Validate token and refresh if needed - unified function for all strategies"""
    token_info = get_token_expiry_info(token)
    
    if token_info["is_expired"]:
        raise HTTPException(status_code=401, detail="Token has expired")
    
    if token_info["needs_refresh"]:
        # Auto-refresh if close to expiration
        user_data, new_token = await get_current_user_with_auto_refresh(token, session)
        return user_data, new_token
    else:
        # Token is still valid
        user_data = await get_current_user_from_token(token, session)
        return user_data, None