from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text
from typing import Optional, List
from datetime import datetime, timezone
import uuid

class Base(DeclarativeBase):
    pass

# like the user job title 
class UserStatus(Base):
    __tablename__ = "userstatus"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    users: Mapped[List["User"]] = relationship("User", back_populates="status")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class User(Base):
    __tablename__ = "user"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    first_name: Mapped[str] = mapped_column(String)
    middle_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_name: Mapped[str] = mapped_column(String)
    phone_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    ad_dn: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status_id: Mapped[Optional[str]] = mapped_column(ForeignKey("userstatus.id"), nullable=True)
    status: Mapped[Optional["UserStatus"]] = relationship("UserStatus", back_populates="users")
    role_id: Mapped[Optional[str]] = mapped_column(ForeignKey("role.id"), nullable=True)
    role: Mapped[Optional["Role"]] = relationship("Role", back_populates="users")
    items: Mapped[List["Item"]] = relationship("Item", back_populates="user")
    claims: Mapped[List["Claim"]] = relationship("Claim", back_populates="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Role(Base):
    __tablename__ = "role"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    users: Mapped[List["User"]] = relationship("User", back_populates="role")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Item(Base):
    __tablename__ = "item"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    claims_count: Mapped[int] = mapped_column(Integer, default=0)
    temporary_deletion: Mapped[bool] = mapped_column(Boolean, default=False)
    approval: Mapped[bool] = mapped_column(Boolean, default=True)
    item_type_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itemtype.id"), nullable=True)
    item_type: Mapped[Optional["ItemType"]] = relationship("ItemType", back_populates="items")
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="items")
    claims: Mapped[List["Claim"]] = relationship("Claim", back_populates="item")
    addresses: Mapped[List["Address"]] = relationship("Address", back_populates="item")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class ItemType(Base):
    __tablename__ = "itemtype"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    items: Mapped[List["Item"]] = relationship("Item", back_populates="item_type")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Branch(Base):
    __tablename__ = "branch"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_name: Mapped[str] = mapped_column(String)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organization.id"))
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="branches")
    addresses: Mapped[List["Address"]] = relationship("Address", back_populates="branch")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Organization(Base):
    __tablename__ = "organization"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    branches: Mapped[List["Branch"]] = relationship("Branch", back_populates="organization")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Address(Base):
    __tablename__ = "address"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id: Mapped[str] = mapped_column(ForeignKey("item.id"))
    item: Mapped[Optional["Item"]] = relationship("Item", back_populates="addresses")
    branch_id: Mapped[str] = mapped_column(ForeignKey("branch.id"))
    branch: Mapped[Optional["Branch"]] = relationship("Branch", back_populates="addresses")
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Image(Base):
    __tablename__ = "image"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    imageable_id: Mapped[str] = mapped_column(String, index=True)
    imageable_type: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Claim(Base):
    __tablename__ = "claim"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    approval: Mapped[bool] = mapped_column(Boolean, default=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="claims")
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("item.id"), nullable=True)
    item: Mapped[Optional["Item"]] = relationship("Item", back_populates="claims")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    