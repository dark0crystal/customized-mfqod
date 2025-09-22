from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

# Import your database URL from your app config
# Adjust this import based on your project structure
try:
    from database import DATABASE_URL  # or wherever you define your DB URL
except ImportError:
    # If you can't import, define it here
    # Replace with your actual database URL
    DATABASE_URL = os.getenv("DATABASE_URL")

def clear_alembic_version():
    """Clear the alembic_version table to reset migration history using SQLAlchemy"""
    engine = create_engine(DATABASE_URL)
    try:
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS alembic_version;"))
            conn.commit()
            print("✅ Alembic version table cleared successfully")
    except Exception as e:
        print(f"❌ Error clearing alembic table: {e}")
    finally:
        engine.dispose()

if __name__ == "__main__":
    clear_alembic_version()