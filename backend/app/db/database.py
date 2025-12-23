import os
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine
from app.models import Base
import logging

logger = logging.getLogger(__name__)

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
def init_db(run_migrations=False):
    """
    Initialize the database.
    
    Args:
        run_migrations: If True, automatically run Alembic migrations before creating tables.
                       This ensures the database schema is up to date.
    """
    # Optionally run migrations first
    if run_migrations:
        try:
            from app.db.migration_utils import run_migrations_automatically
            logger.info("Running automatic database migrations...")
            success = run_migrations_automatically(verbose=True)
            if not success:
                logger.warning("Migrations may have failed, but continuing with database initialization...")
        except Exception as e:
            logger.warning(f"Could not run migrations: {e}. Continuing with database initialization...")
    
    try:
        Base.metadata.create_all(engine)  # Reads all models and creates matching tables
        logger.info("✅ Database tables initialized successfully.")
    except Exception as e:
        logger.error("❌ Failed to create tables.")
        logger.error(f"Error: {e}")
        raise
