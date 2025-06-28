from jose import jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_EXPIRATION_MINUTES = 30
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
async def CheckUserExistenceDB(email: str):
    for usr in DBusers:
        if email == usr["email"]:
            return usr  # return the user if found
    return None  # return None if not found


async def CheckUserExistenceAD(email: str):
    for usr in ADusers:
        if usr["email"] == email:
            return usr
    return None

# this function will create a new user in the local database   


def CreateNewUserInDB(ad_user):
    new_user = {
        "id": str(uuid.uuid4()),  
        "first_name": ad_user["first_name"],
        "last_name": ad_user["last_name"],
        "email": ad_user["email"],
        "password": ad_user["password"],
        "role": ad_user["role"]
    }
    DBusers.append(new_user)
    return new_user

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