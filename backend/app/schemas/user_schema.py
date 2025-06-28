from pydantic import BaseModel

class UserCreate(BaseModel):
    user_id:str
    email:str
    password:str
    first_name:str
    last_name:str
    role:str


