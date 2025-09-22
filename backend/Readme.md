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

📁 What is __pycache__?
__pycache__ is a special folder automatically created by Python to store compiled bytecode of your .py files.

When Python runs your code, it compiles it to .pyc (Python bytecode) files for faster execution in future runs.

These .pyc files are stored in the __pycache__ directory.

✅ It’s completely normal and safe — but you usually don't need to include it in version control (e.g., Git).

------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
Database Migrations Using alembic : 
#run the command to init the migrations % alembic init migrations   
1) changes I made in auto generated files to setup the migration 👍 : 
# first inide the the script.py.make:
    - I have added this line %  import sqlmodel
# inside env.py:
    - I have added this line % from sqlmodel import SQLModel
    - Also you need to import the Model you have created to be as database tables
     e.g. from models import User
    -Also I have changes this line form this:
     % target_metadata = None
     To this:
     % target_metadata = SQLModel.metadata


------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
Command to make migration:
   % alembic revision --autogenerate -m "commit message"
   
Command to apply the most recent migration:
   %alembic upgrade head


------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
Active Directory:


------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
Fine-Grained Control (Actions per Role) using Roles + Permissions — also known as RBAC with Permissions.

🧠 What It Means
With fine-grained control, instead of checking only the user’s role, you check whether the user has specific permissions to do certain actions — like:
 
These Are Examples: 

can_view_users

can_edit_users

can_delete_posts

can_publish_content

This way, two roles can have different sets of actions even if they sound similar.

roles table:
id | name
---|-------
1  | admin
2  | editor
3  | student

permissions table:
id | name
---|--------------------
1  | can_view_users
2  | can_edit_posts
3  | can_view_content

role_permissions table (many-to-many)
role_id | permission_id
--------|---------------
1       | 1
1       | 2
1       | 3
2       | 2
2       | 3
3       | 3
------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------ ------




