from datetime import datetime, timezone, timedelta
import os
from dotenv import load_dotenv
import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session
from schemas.user_schema import UserRegister
from models import Role, User
from sqlalchemy import select


# =============================
# Check Role Existence by Name
# =============================
def check_role_existence(session: Session, role_name: str) -> Role | None:
    statement = select(Role).where(Role.name == role_name)
    return session.execute(statement).scalars().first()


# =============================
# Add New Role
# =============================
def add_new_role(session: Session, role: Role) -> Role:
    new_role = Role(
        id=str(uuid.uuid4()),
        name=role.name,
        description=role.description,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    session.add(new_role)
    session.commit()
    session.refresh(new_role)
    return new_role

# =============================
# Remove Role
# =============================
def remove_role(session: Session, role_id: str):
    # Step 1: Try to fetch the role by ID
    statement = select(Role).where(Role.id == role_id)
    role = session.execute(statement).scalars().first()

    # Step 2: If role not found, raise 404 error
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    # Step 3: Delete the role
    session.delete(role)
    session.commit()

    # Step 4: Return confirmation
    return {"message": "Role deleted successfully", "role_id": role_id}


# ============================= 
# List All Roles
# ============================= 
def get_all_roles(session: Session) -> list[Role]:
    """
    Fetch all roles from the Role table.
    
    Args:
        session: Database session
        
    Returns:
        List of all roles in the system
    """
    statement = select(Role)
    roles = session.execute(statement).scalars().all()
    return roles
