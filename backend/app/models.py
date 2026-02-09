from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text, Enum, TypeDecorator, Float
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.declarative import declarative_base
import enum


Base = declarative_base()

class UserType(enum.Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    
    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive mapping for backward compatibility"""
        if isinstance(value, str):
            # Try to map common variations
            value_lower = value.lower()
            for member in cls:
                if member.value.lower() == value_lower:
                    return member
            return None

class ItemStatus(enum.Enum):
    """Item status enumeration"""
    CANCELLED = "cancelled"
    APPROVED = "approved"
    PENDING = "pending"
    DISPOSED = "disposed"
    
    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive mapping for backward compatibility"""
        if isinstance(value, str):
            value_lower = value.lower()
            for member in cls:
                if member.value.lower() == value_lower:
                    return member
        return None

class ClaimStatus(enum.Enum):
    """Claim status enumeration"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    
    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive mapping for backward compatibility"""
        if isinstance(value, str):
            value_lower = value.lower()
            for member in cls:
                if member.value.lower() == value_lower:
                    return member
        return None

class UserTypeConverter(TypeDecorator):
    """Custom SQLAlchemy type to handle UserType enum conversion"""
    impl = String
    
    def process_bind_param(self, value, dialect):
        if isinstance(value, UserType):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is not None:
            # Try direct lookup first
            try:
                return UserType(value)
            except ValueError:
                # Fallback to case-insensitive lookup
                for member in UserType:
                    if member.value.lower() == value.lower():
                        return member
                # If no match found, return the string value for debugging
                raise ValueError(f"Unknown UserType value: {value}")
        return value

class LoginAttemptStatus(enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    BLOCKED = "blocked"

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
    username: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    first_name: Mapped[str] = mapped_column(String)
    middle_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_name: Mapped[str] = mapped_column(String)
    phone_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    user_type: Mapped[UserType] = mapped_column(UserTypeConverter(), default=UserType.EXTERNAL)
    ad_dn: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ad_sync_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status_id: Mapped[Optional[str]] = mapped_column(ForeignKey("userstatus.id"), nullable=True)
    status: Mapped[Optional["UserStatus"]] = relationship("UserStatus", back_populates="users")
    role_id: Mapped[Optional[str]] = mapped_column(ForeignKey("role.id"), nullable=True)
    role: Mapped[Optional["Role"]] = relationship("Role", back_populates="users")
    items: Mapped[List["Item"]] = relationship("Item", back_populates="user")
    missing_items: Mapped[List["MissingItem"]] = relationship("MissingItem", back_populates="user")
    claims: Mapped[List["Claim"]] = relationship("Claim", back_populates="user")
    login_attempts: Mapped[List["LoginAttempt"]] = relationship("LoginAttempt", back_populates="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    managed_branches: Mapped[List["Branch"]] = relationship(
        "Branch",
        secondary="user_branch_managers",
        back_populates="managers"
    )

class UserBranchManager(Base):
    __tablename__ = "user_branch_managers"
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"), primary_key=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branch.id"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Role(Base):
    __tablename__ = "role"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    users: Mapped[List["User"]] = relationship("User", back_populates="role")

    permissions: Mapped[List["Permission"]] = relationship(
        "Permission",
        secondary="role_permissions",
        back_populates="roles"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class RolePermissions(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[str] = mapped_column(ForeignKey("role.id"), primary_key=True)
    permission_id: Mapped[str] = mapped_column(ForeignKey("permissions.id"), primary_key=True)


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    roles: Mapped[List["Role"]] = relationship(
        "Role",
        secondary="role_permissions",
        back_populates="permissions"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Item(Base):
    __tablename__ = "item"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    internal_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    claims_count: Mapped[int] = mapped_column(Integer, default=0)
    temporary_deletion: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String, default=ItemStatus.PENDING.value, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved_claim_id: Mapped[Optional[str]] = mapped_column(ForeignKey("claim.id"), nullable=True)
    disposal_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    item_type_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itemtype.id"), nullable=True)
    item_type: Mapped[Optional["ItemType"]] = relationship("ItemType", back_populates="items")
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="items")
    claims: Mapped[List["Claim"]] = relationship(
        "Claim", 
        back_populates="item", 
        primaryjoin="Item.id == Claim.item_id"
    )
    approved_claim: Mapped[Optional["Claim"]] = relationship("Claim", foreign_keys=[approved_claim_id])
    addresses: Mapped[List["Address"]] = relationship("Address", back_populates="item")
    missing_item_links: Mapped[List["MissingItemFoundItem"]] = relationship(
        "MissingItemFoundItem",
        back_populates="item"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Add images relationship (polymorphic)
    @property
    def images(self):
        """Get images for this item via polymorphic relationship"""
        from sqlalchemy.orm import object_session
        session = object_session(self)
        if session:
            return session.query(Image).filter(
                Image.imageable_type == "item",
                Image.imageable_id == self.id
            ).all()
        return []

class ItemType(Base):
    __tablename__ = "itemtype"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name_ar: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    items: Mapped[List["Item"]] = relationship("Item", back_populates="item_type")
    missing_items: Mapped[List["MissingItem"]] = relationship("MissingItem", back_populates="item_type")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Branch(Base):
    __tablename__ = "branch"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_name_ar: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    branch_name_en: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    phone1: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organization.id"))
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="branches")
    addresses: Mapped[List["Address"]] = relationship("Address", back_populates="branch")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    managers: Mapped[List["User"]] = relationship(
        "User",
        secondary="user_branch_managers",
        back_populates="managed_branches"
    )

class Organization(Base):
    __tablename__ = "organization"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name_ar: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    branches: Mapped[List["Branch"]] = relationship("Branch", back_populates="organization")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class Address(Base):
    __tablename__ = "address"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("item.id"), nullable=True)
    item: Mapped[Optional["Item"]] = relationship("Item", back_populates="addresses")
    branch_id: Mapped[Optional[str]] = mapped_column(ForeignKey("branch.id"), nullable=True)
    branch: Mapped[Optional["Branch"]] = relationship("Branch", back_populates="addresses")
    full_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    approval: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="claims")
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("item.id"), nullable=True)
    item: Mapped[Optional["Item"]] = relationship(
        "Item", 
        back_populates="claims",
        primaryjoin="Claim.item_id == Item.id"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    @property
    def is_assigned(self) -> bool:
        """Check if this claim is assigned as the correct claim for the item"""
        return self.item is not None and self.item.approved_claim_id == self.id
    

class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="login_attempts")
    email_or_username: Mapped[str] = mapped_column(String, index=True)
    ip_address: Mapped[str] = mapped_column(String)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[LoginAttemptStatus] = mapped_column(Enum(LoginAttemptStatus))
    failure_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"))
    user: Mapped["User"] = relationship("User")
    session_token: Mapped[str] = mapped_column(String, unique=True, index=True)
    ip_address: Mapped[str] = mapped_column(String)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class ADSyncLog(Base):
    __tablename__ = "ad_sync_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sync_type: Mapped[str] = mapped_column(String)  # 'user_sync', 'group_sync', 'health_check'
    status: Mapped[str] = mapped_column(String)  # 'success', 'failed', 'partial'
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    users_processed: Mapped[int] = mapped_column(Integer, default=0)
    users_updated: Mapped[int] = mapped_column(Integer, default=0)
    users_deactivated: Mapped[int] = mapped_column(Integer, default=0)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class RateLimitLog(Base):
    __tablename__ = "rate_limit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ip_address: Mapped[str] = mapped_column(String, index=True, nullable=False)
    endpoint: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rate_limit_key: Mapped[str] = mapped_column(String, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

class EmailVerification(Base):
    __tablename__ = "email_verifications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, index=True, nullable=False)
    otp_code: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class MissingItem(Base):
    __tablename__ = "missingitem"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    # status lifecycle now: pending -> approved/cancelled/visit
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    approval: Mapped[bool] = mapped_column(Boolean, default=True)
    temporary_deletion: Mapped[bool] = mapped_column(Boolean, default=False)
    item_type_id: Mapped[Optional[str]] = mapped_column(ForeignKey("itemtype.id"), nullable=True)
    item_type: Mapped[Optional["ItemType"]] = relationship("ItemType", back_populates="missing_items")
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="missing_items")
    assigned_found_items: Mapped[List["MissingItemFoundItem"]] = relationship(
        "MissingItemFoundItem",
        back_populates="missing_item",
        cascade="all, delete-orphan"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Add images relationship (polymorphic)
    @property
    def images(self):
        """Get images for this missing item via polymorphic relationship"""
        from sqlalchemy.orm import object_session
        session = object_session(self)
        if session:
            return session.query(Image).filter(
                Image.imageable_type == "missingitem",
                Image.imageable_id == self.id
            ).all()
        return []


class MissingItemFoundItem(Base):
    __tablename__ = "missing_item_found_item"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    missing_item_id: Mapped[str] = mapped_column(ForeignKey("missingitem.id"), nullable=False)
    item_id: Mapped[str] = mapped_column(ForeignKey("item.id"), nullable=False)
    branch_id: Mapped[Optional[str]] = mapped_column(ForeignKey("branch.id"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    missing_item: Mapped["MissingItem"] = relationship("MissingItem", back_populates="assigned_found_items")
    item: Mapped["Item"] = relationship("Item", back_populates="missing_item_links")
    branch: Mapped[Optional["Branch"]] = relationship("Branch")
    creator: Mapped[Optional["User"]] = relationship("User")


class TransferStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

class BranchTransferRequest(Base):
    __tablename__ = "branch_transfer_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id: Mapped[str] = mapped_column(ForeignKey("item.id"), nullable=False)
    item: Mapped["Item"] = relationship("Item")
    from_branch_id: Mapped[str] = mapped_column(ForeignKey("branch.id"), nullable=False)
    from_branch: Mapped["Branch"] = relationship("Branch", foreign_keys=[from_branch_id])
    to_branch_id: Mapped[str] = mapped_column(ForeignKey("branch.id"), nullable=False)
    to_branch: Mapped["Branch"] = relationship("Branch", foreign_keys=[to_branch_id])
    requested_by: Mapped[str] = mapped_column(ForeignKey("user.id"), nullable=False)
    requested_by_user: Mapped["User"] = relationship("User", foreign_keys=[requested_by])
    status: Mapped[TransferStatus] = mapped_column(Enum(TransferStatus), default=TransferStatus.PENDING)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(ForeignKey("user.id"), nullable=True)
    approved_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by])


class AuditActionType(enum.Enum):
    """Audit log action types"""
    ITEM_STATUS_CHANGED = "item_status_changed"
    ITEM_DELETED = "item_deleted"
    ITEM_RESTORED = "item_restored"
    TRANSFER_APPROVED = "transfer_approved"
    TRANSFER_REJECTED = "transfer_rejected"
    
    @classmethod
    def _missing_(cls, value):
        """Handle case-insensitive mapping for backward compatibility"""
        if isinstance(value, str):
            value_lower = value.lower()
            for member in cls:
                if member.value.lower() == value_lower:
                    return member
        return None


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action_type: Mapped[AuditActionType] = mapped_column(Enum(AuditActionType), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    user: Mapped["User"] = relationship("User")
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string for additional context (renamed from metadata to avoid SQLAlchemy reserved name)
    ip_address: Mapped[str] = mapped_column(String, nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

