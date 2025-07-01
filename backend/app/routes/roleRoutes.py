
from fastapi import APIRouter, HTTPException, Depends
from models import Role
from db.database import get_session
from utils.security import hash_password
from schemas.user_schema import UserCreate, UserRegister
from services import userServices
from sqlmodel import Session

router = APIRouter()

@router.get(
    "/roles",
    response_model=list[Role],
    summary="List all roles",
    description="""
Get a list of all roles from the system.

### Returns:
- A list of roles, each containing:
  - `id`: Unique identifier of the role
  - `name`: The name of the role (e.g., student, staff)
  - `description`: Optional description of the role
  - `created_at`: Timestamp when the role was created
  - `updated_at`: Timestamp when the role was last updated
"""
)
def list_roles(session: Session = Depends(get_session)):
    """
    Fetch all roles from the Role table.

    - **No authentication** required.
    - Useful for forms or dashboards that require a list of role options.
    """
    statement = select(Role)
    roles = session.exec(statement).all()
    return roles

