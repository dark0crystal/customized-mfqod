"""Script to add cancelled column to item table if it doesn't exist"""
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def add_cancelled_column():
    """Add cancelled column to item table if it doesn't exist"""
    engine = create_engine(DATABASE_URL)
    try:
        with engine.connect() as conn:
            # Check if column exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='item' AND column_name='cancelled';
            """)
            result = conn.execute(check_query)
            if result.fetchone():
                print("✅ Column 'cancelled' already exists in 'item' table")
                return
            
            # Add the column
            print("Adding 'cancelled' column to 'item' table...")
            conn.execute(text("""
                ALTER TABLE item 
                ADD COLUMN cancelled BOOLEAN DEFAULT FALSE NOT NULL;
            """))
            
            conn.commit()
            print("✅ Column 'cancelled' added successfully to 'item' table")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    add_cancelled_column()





