from FastApi import APIRouter
from app.schemas.user_schema import UserCreate

router = APIRouter()

@router.get("/")
def register(user:UserCreate):
    return user.email
    

