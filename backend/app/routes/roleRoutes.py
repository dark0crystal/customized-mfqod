from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from models import Role
from db.database import get_session
from datetime import datetime
import uuid
from services import userServices  # Make sure your services have `check_role_existence` and `remove_role`

router = APIRouter()

# ==================================
# List All Roles
# ==================================
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

# ==================================
# Add New Role
# ==================================
@router.post("/add-new-role")
def add_new_role(role: Role, session: Session = Depends(get_session)):
    """
    Add a new role to the Role table.

    - **Checks** if a role with the same name already exists.
    - **Raises 409 Conflict** if role already exists.
    """
    existing_role = userServices.check_role_existence(session, role.name)
    if existing_role:
        raise HTTPException(status_code=409, detail="Role already exists in the system.")

    # Manually assign ID and timestamps
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
    "/roles/{role_id}",
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
    return userServices.remove_role(session, role_id)