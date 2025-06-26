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


async def CreateJwtToken():   

    return
