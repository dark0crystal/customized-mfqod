from __future__ import annotations
from sqlmodel import Relationship, SQLModel , Field
import uuid
from enum import Enum
from typing import List, Optional
from datetime import datetime, timezone
# ==========================
# Database Models Using SQLmodel ORM
# ==========================

# ==========================
# Notes📓
# ==========================
# default_factory=lambda: str(uuid.uuid4())
# 💡 What it means:
# This sets a default value for a field (typically id) by automatically generating a new UUID each time a new object is created.
# 🧠 Breakdown:
# default_factory: This tells SQLModel (or Pydantic) to call a function to generate the default value.
# lambda: str(uuid.uuid4()):
# A small anonymous function (lambda) that returns a new UUID.
# uuid.uuid4() generates a random UUID.
# str(...) converts it into a string.
# ==========================
# table=True in SQLModel
# You're telling SQLModel that this class should be mapped to a table in the database.
# 🧠 Why it matters:
# SQLModel can be used to define both tables (for the database) and data schemas (like request/response bodies in FastAPI).
# Adding table=True tells SQLModel:
# "This class is a real database table, and it should be created in the database."
# ==========================
# 🧠What is from __future__ import annotations?
# It’s a special import in Python that changes how type hints are handled.
# Normally, when you write type hints, Python evaluates them immediately. That means the classes or types you refer to in annotations must be already defined in your code when Python runs.
# Why use from __future__ import annotations?
# 🍸 This import tells Python:
# "Don’t evaluate type hints right away. Instead, store them as strings and evaluate them later only if needed."
# ==========================


class UserStatus(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(unique=True, index=True)  # e.g., 'student', 'staff'
    description: Optional[str] = None

    users: List["User"] = Relationship(back_populates="status")

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

      # Foreign key and relationship with Role
    role_id: Optional[str] = Field(default=None, foreign_key="role.id")
    role: Optional["Role"] = Relationship(back_populates="users")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

    items: List[Item] = Relationship(back_populates="user")
    claims: List[Claim] = Relationship(back_populates="user")


class Role(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class Item(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str
    description: str
    claims_count: str
    temporary_deletion: bool = Field(default=False)
    approval: bool = Field(default=True)

    item_type_id: Optional[str] = Field(default=None, foreign_key="itemtype.id")
    item_type: Optional["ItemType"] = Relationship(back_populates="items")

    user_id: Optional[str] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="items")

    claims: List["Claim"] = Relationship(back_populates="item")
    addresses: List["Address"] = Relationship(back_populates="item")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

# Item Type is created a type that is dynamic and fully controlled by the admin from the dashboard
class ItemType(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True, nullable=False)
    description: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class Branch(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    branch_name: str

    organization_id: str = Field(foreign_key="organization.id")
    organization: Optional["Organization"] = Relationship(back_populates="branches")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    description: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

    branches: List["Branch"] = Relationship(back_populates="organization")

class Address(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    item_id: str = Field(foreign_key="item.id")
    item: Optional["Item"] = Relationship(back_populates="addresses")

    branch_id: str = Field(foreign_key="branch.id")
    branch: Optional["Branch"] = Relationship()

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
    user: Optional[User] = Relationship(back_populates="claims")

    item_id: Optional[str] = Field(default=None, foreign_key="item.id")
    item: Optional[Item] = Relationship(back_populates="claims")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
