from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr

app = FastAPI()

# ✅ Step 1: Create request schema
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

# ✅ Step 2: Implement the route
@app.post("/register")
def register(payload: RegisterRequest):
    # In real world, you'd save to DB, hash password, etc.
    
    # Example: check if email already exists (simulated)
    if payload.email == "existing@example.com":
        raise HTTPException(status_code=400, detail="Email already registered")

    # Return success response
    return {
        "message": "User registered successfully",
        "user": {
            "email": payload.email,
            "full_name": payload.full_name
        }
    }
