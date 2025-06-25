users = [
    {"email": "user1@example.com", "password": "password123"},
    {"email": "user2@example.com", "password": "secret456"},
    {"email": "admin@example.com", "password": "adminpass"},
]

async def CheckUserExistence(email: str):
    for usr in users:
        if email == usr["email"]:
            return usr  # return the user if found
    return None  # return None if not found
