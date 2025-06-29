
from fastapi import FastAPI
from db.database import init_db
from routes import itemRoutes
from routes import userRoutes


app = FastAPI()

init_db()

app.include_router(userRoutes.router ,prefix="/users" ,tags=["Users"])
app.include_router(itemRoutes.router ,prefix="/items" ,tags=["Item"])


