import fastapi from FastAPI

app = FastAPI()

@app.post("/register")
def register():
    return{"message": "User Registered"}