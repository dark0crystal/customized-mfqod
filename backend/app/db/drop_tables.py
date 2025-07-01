from sqlalchemy import create_engine, text
from sqlmodel import SQLModel
import os
from dotenv import load_dotenv 

load_dotenv() 

# Replace with your actual database URL
DATABASE_URL = os.getenv("DATABASE_URL")

def drop_all_tables():
    """Drop all tables to start fresh"""
    
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.connect() as conn:
            # Drop all tables in the correct order (reverse of creation)
            tables_to_drop = [
                "claim",
                "image", 
                "address",
                "item",
                "itemtype",
                "branch",
                "organization", 
                "user",
                "role",
                "userstatus",
                "alembic_version"
            ]
            
            for table in tables_to_drop:
                # Quote table names to handle reserved keywords
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE;'))
                print(f"✅ Dropped table: {table}")
            
            conn.commit()
            print("✅ All tables dropped successfully")
            
    except Exception as e:
        print(f"❌ Error dropping tables: {e}")
    
    finally:
        engine.dispose()

if __name__ == "__main__":
    drop_all_tables()