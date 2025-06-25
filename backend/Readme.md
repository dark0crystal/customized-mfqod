Clean Architecture Design pattern :

app/
│
├── main.py                 # Entry point (uvicorn runs this)
├── core/                  # Core configurations (e.g., settings, JWT, logging)
│   └── config.py
│
├── models/                # SQLAlchemy or Pydantic models
│   └── user.py
│
├── schemas/               # Request & response schemas (DTOs)
│   └── user_schema.py
│
├── services/              # Business logic layer
│   └── user_service.py
│
├── routes/                # Route definitions (FastAPI routers)
│   └── user_route.py
│
├── db/                    # Database session, engine, base class
│   └── session.py
│
└── utils/                 # Helpers (e.g., hashing, JWT)
    └── security.py


------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------

💡 What is APIRouter() in FastAPI?
APIRouter is a class provided by FastAPI that lets you define and organize your routes (endpoints) separately from the main app. It helps you break your app into modular components—especially useful for larger projects.

------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
 # Why use raise HTTPException(...) instead of return {...} in FastAPI?
    # ✅ 1. raise tells FastAPI "This is an error"
    # 🚫 But if you just do return {...}:
    #FastAPI thinks it’s a successful (200 OK) response.
    # It doesn’t know that something went wrong.
    # This confuses the client or frontend.
------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
