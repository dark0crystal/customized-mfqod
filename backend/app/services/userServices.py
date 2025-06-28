from jose import jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_EXPIRATION_MINUTES = 30
DBusers = [
    {"id":"gfsdaggfdsfs1", "name":"omar" , "email": "user1@example.com", "password": "password123"},
    {"id":"gdsagd3fasdf2","name":"said" ,"email": "user2@example.com", "password": "secret456"},
    {"id":"gsdfgasgasgi3","name":"mohd" ,"email": "admin@example.com", "password": "adminpass"},
]
ADusers = [
    {"email": "user1@example.com", "password": "password123"},
    {"email": "user2@example.com", "password": "secret456"},
    {"email": "admin@example.com", "password": "adminpass"},
]
async def CheckUserExistenceDB(email: str):
    for usr in DBusers:
        if email == usr["email"]:
            return usr  # return the user if found
    return None  # return None if not found


def CheckUserExistenceAD(email:str):
    for usr in ADusers:

        return 
# this function will create a new user in the local database   
def CreateNewUserInDB():

    return  

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