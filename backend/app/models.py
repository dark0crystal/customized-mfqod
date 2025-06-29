from sqlmodel import SQLModel , Field
import uuid
from enum import Enum
from typing import Optional
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
# 
# ==========================


class UserStatus(str, Enum):
    student = "student"
    professor = "professor"
    staff = "staff"
    guest = "guest"
    admin = "admin"

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
    status: UserStatus = Field(default=UserStatus.student) 
      # Foreign key and relationship with Role
    role_id: Optional[str] = Field(default=None, foreign_key="role.id")
    role: Optional["Role"] = Relationship(back_populates="users")
class Role(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None
    





class Item(SQLModel , table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
