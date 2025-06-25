from fastapi import FastAPI
from app.routes import userRoutes

app = FastAPI()

app.include_router(userRoutes.router ,prefix="/users" ,tags=["Users"])

