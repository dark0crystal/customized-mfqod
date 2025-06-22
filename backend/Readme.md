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
