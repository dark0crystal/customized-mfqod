from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from app.services import roleServices
from app.models import Role
from app.db.database import get_session
from datetime import datetime
import uuid
from app.services import userServices  # Make sure your services have `check_role_existence` and `remove_role`
from app.schemas.role_schema import RoleRequestSchema, RoleSchema
router = APIRouter()

# ================================== 
# List All Roles
# ================================== 
@router.get(
    "/all",
    response_model=list[RoleSchema],
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
    return roleServices.get_all_roles(session)
# ==================================
# Add New Role
# ==================================

# 3ddcf133-53ec-45ce-8f42-07317169a96f

# f8586c40-2dd4-438d-a865-b9dbf6b18ebe
@router.post(
    "/add-new-role",
    response_model=RoleSchema,
    summary="Add a new role"
)
def add_new_role(role: RoleRequestSchema, session: Session = Depends(get_session)):
    existing_role = roleServices.check_role_existence(session, role.name)
    if existing_role:
        raise HTTPException(status_code=409, detail="Role already exists in the system.")
    
    new_role = Role(
        id=str(uuid.uuid4()),
        name=role.name,
        description=role.description,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    session.add(new_role)
    session.commit()
    session.refresh(new_role)
    
    return new_role
# ==================================
# Remove Role by ID
# ==================================
@router.delete(
    "/{role_id}",
    summary="Delete a role",
    description="""
Remove a role from the system by its ID.

### Path parameter:
- `role_id`: ID of the role to delete

### Returns:
- A confirmation message
"""
)
def delete_role(role_id: str, session: Session = Depends(get_session)):
    """
    Remove a role from the Role table.

    - **Raises 404** if role not found.
    """
    return roleServices.remove_role(session, role_id)