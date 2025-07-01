from jose import jwt
import os
from dotenv import load_dotenv
import uuid
from sqlmodel import Session
from schemas.user_schema import UserRegister
from models import User
from sqlmodel import select
from datetime import datetime, timezone,timedelta
# from ldap3 import Server, Connection, ALL, NTLM, SIMPLE

load_dotenv()
# =====
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_EXPIRATION_MINUTES = 30
# =====
# Example AD config - replace these with your university's actual info
# LDAP_SERVER = "ldap://ad.university.edu"
# LDAP_DOMAIN = "UNIVERSITY"  # e.g., 'UNIVERSITY'
# LDAP_SEARCH_BASE = "dc=university,dc=edu"  # Your domain components
# =====

DBusers = [
    {"id":"gfsdaggfdsfs1", "first_name":"omar","last_name":"alomani" , "email": "user@example.com", "password": "password123","role":"user"},
    {"id":"gdsagd3fasdf2","first_name":"said","last_name":"alomairi" ,"email": "manager@example.com", "password": "secret456","role":"manegar"},
    {"id":"gsdfgasgasgi3","first_name":"mohd","last_name":"alsadi" ,"email": "admin@example.com", "password": "adminpass","role":"admin"},
]
ADusers = [
    {"id":"gfsdaggfdsfs1", "first_name":"omar","last_name":"alomani" , "email": "user2@example.com", "password": "password1w23","role":"user"},
    {"id":"gfsdaggfdsfs1", "first_name":"omar","last_name":"alomani" , "email": "user1@example.com", "password": "password1wfsda23","role":"manegar"},
    {"id":"gfsdaggfdsfs1", "first_name":"omar","last_name":"alomani" , "email": "admin@example.com", "password": "password1dsfa23","role":"admin"},
]

def CheckUserExistenceDB(session: Session, email: str) -> bool:
    statement = select(User).where(User.email == email)
    result = session.exec(statement).first()
    return result is not None


async def CheckUserExistenceAD(email: str):
    for usr in ADusers:
        if usr["email"] == email:
            return usr
    return None

# this function will create a new user in the local database   


def createNewUserInDB(session: Session, user_data: UserRegister, hashed_password: str) -> User:
    user = User(
        id=user_data.id or str(uuid.uuid4()),
        email=user_data.email,
        password=hashed_password,
        first_name=user_data.first_name,
        middle_name=user_data.middle_name,
        last_name=user_data.last_name,
        phone_number=user_data.phone_number,
        status=user_data.status,
        role_id=None,  # Set role if needed
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

# userId , email, role, first_name, last_name
async def CreateJwtToken(user_id: str, email: str, role: str, first_name: str, last_name: str):
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "first_name": first_name,
        "last_name": last_name,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES)
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


# def authenticate_with_ad(email: str, password: str):
#     # Extract username from email (if needed)
#     username = email.split("@")[0]
#     user_dn = f"{LDAP_DOMAIN}\\{username}"  # Or use full DN if required

#     # Connect to the LDAP server
#     server = Server(LDAP_SERVER, get_info=ALL)

#     try:
#         # Attempt to bind (authenticate)
#         conn = Connection(server, user=user_dn, password=password, authentication=NTLM, auto_bind=True)

#         if conn.bound:
#             # Optional: you can search for user details
#             conn.search(LDAP_SEARCH_BASE, f"(sAMAccountName={username})", attributes=["displayName", "mail"])
#             user_info = conn.entries[0] if conn.entries else None
#             return {
#                 "status": "success",
#                 "user": str(user_info) if user_info else "Authenticated, no additional info"
#             }

#     except Exception as e:
#         raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

#     raise HTTPException(status_code=401, detail="Authentication failed.")