import os
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine
from app.models import Base

# =========================
# Setup database connection 
# =========================

load_dotenv()  # Loads variables from a `.env` file into environment variables

# Get the database URL 
DATABASE_URL = os.getenv("DATABASE_URL")

# Create the database engine with echo enabled (logs SQL to console for debugging)
engine = create_engine(DATABASE_URL, echo=True)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# A generator function that yields a database session to use in routes/services
def get_session():
    with SessionLocal() as session:
        yield session

# A utility function that creates all the tables defined in your SQLAlchemy models
def init_db():
    try:
        Base.metadata.create_all(engine)  # Reads all models and creates matching tables
        print("✅ Tables created successfully.")
    except Exception as e:
        print("❌ Failed to create tables.")
        print(f"Error: {e}")
