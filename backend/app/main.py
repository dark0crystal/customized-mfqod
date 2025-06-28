from fastapi import FastAPI
from routes import postRoutes
from routes import userRoutes


app = FastAPI()

app.include_router(userRoutes.router ,prefix="/users" ,tags=["Users"])
app.include_router(postRoutes.router ,prefix="/posts" ,tags=["Post"])


