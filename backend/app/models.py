from __future__ import annotations
from sqlmodel import Relationship, SQLModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# ==========================
# Database Models Using SQLModel ORM
# ==========================

class UserStatus(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(unique=True, index=True)  # e.g., 'student', 'staff'
    description: Optional[str] = None

    # Fixed: Remove List[] wrapper for SQLModel relationships
    users: list["User"] = Relationship(back_populates="status")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str = Field(index=True, unique=True, nullable=False)
    password: Optional[str] = Field(default=None)
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    phone_number: Optional[str] = None
    active: bool = Field(default=True)
    ad_dn: Optional[str] = None

    status_id: Optional[str] = Field(default=None, foreign_key="userstatus.id")
    status: Optional["UserStatus"] = Relationship(back_populates="users")

    role_id: Optional[str] = Field(default=None, foreign_key="role.id")
    role: Optional["Role"] = Relationship(back_populates="users")

    # Fixed: Remove List[] wrapper for SQLModel relationships
    items: list["Item"] = Relationship(back_populates="user")
    claims: list["Claim"] = Relationship(back_populates="user")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Role(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None

    # Fixed: Remove List[] wrapper for SQLModel relationships
    users: list["User"] = Relationship(back_populates="role")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Item(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str
    description: str
    claims_count: int = Field(default=0)
    temporary_deletion: bool = Field(default=False)
    approval: bool = Field(default=True)

    item_type_id: Optional[str] = Field(default=None, foreign_key="itemtype.id")
    item_type: Optional["ItemType"] = Relationship(back_populates="items")

    user_id: Optional[str] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="items")

    # Fixed: Remove List[] wrapper for SQLModel relationships
    claims: list["Claim"] = Relationship(back_populates="item")
    addresses: list["Address"] = Relationship(back_populates="item")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class ItemType(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True, nullable=False)
    description: Optional[str] = None

    # Fixed: Remove List[] wrapper for SQLModel relationships
    items: list["Item"] = Relationship(back_populates="item_type")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Branch(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    branch_name: str

    organization_id: str = Field(foreign_key="organization.id")
    organization: Optional["Organization"] = Relationship(back_populates="branches")
    # Fixed: Remove List[] wrapper for SQLModel relationships
    addresses: list["Address"] = Relationship(back_populates="branch")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    description: Optional[str] = None

    # Fixed: Remove List[] wrapper for SQLModel relationships
    branches: list["Branch"] = Relationship(back_populates="organization")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Address(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    item_id: str = Field(foreign_key="item.id")
    item: Optional["Item"] = Relationship(back_populates="addresses")

    branch_id: str = Field(foreign_key="branch.id")
    branch: Optional["Branch"] = Relationship(back_populates="addresses")

    is_current: bool = Field(default=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Image(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    url: str
    description: Optional[str] = None

    imageable_id: str = Field(index=True)
    imageable_type: str = Field(index=True)  # e.g., "item" or "claim"

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Claim(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str
    description: str
    approval: bool = Field(default=True)

    user_id: Optional[str] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="claims")

    item_id: Optional[str] = Field(default=None, foreign_key="item.id")
    item: Optional["Item"] = Relationship(back_populates="claims")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)