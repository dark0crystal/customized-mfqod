import os
from dotenv import load_dotenv        
from sqlmodel import SQLModel, create_engine, Session  

# =========================
# Setup database connection 
# =========================

load_dotenv()  # Loads variables from a `.env` file into environment variables

# Get the database URL 
DATABASE_URL = os.getenv("DATABASE_URL")

# Create the database engine with echo enabled (logs SQL to console for debugging)
engine = create_engine(DATABASE_URL, echo=True)

# A generator function that yields a database session to use in routes/services
def get_session():
    with Session(engine) as session:
        yield session

# A utility function that creates all the tables defined in your SQLModel classes
def init_db():
    try:
        SQLModel.metadata.create_all(engine)  # Reads all models and creates matching tables
        print("✅ Tables created successfully.")
    except Exception as e:
        print("❌ Failed to create tables.")
        print(f"Error: {e}")
