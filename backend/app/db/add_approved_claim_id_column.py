"""Script to add approved_claim_id column to item table if it doesn't exist"""
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def add_approved_claim_id_column():
    """Add approved_claim_id column to item table if it doesn't exist"""
    engine = create_engine(DATABASE_URL)
    try:
        with engine.connect() as conn:
            # Check if column exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='item' AND column_name='approved_claim_id';
            """)
            result = conn.execute(check_query)
            if result.fetchone():
                print("✅ Column 'approved_claim_id' already exists in 'item' table")
                return
            
            # Add the column
            print("Adding 'approved_claim_id' column to 'item' table...")
            conn.execute(text("""
                ALTER TABLE item 
                ADD COLUMN approved_claim_id VARCHAR;
            """))
            
            # Create foreign key constraint if claim table exists
            try:
                conn.execute(text("""
                    ALTER TABLE item 
                    ADD CONSTRAINT fk_item_approved_claim 
                    FOREIGN KEY (approved_claim_id) 
                    REFERENCES claim(id);
                """))
                print("✅ Foreign key constraint created")
            except Exception as e:
                print(f"⚠️  Could not create foreign key constraint (may already exist): {e}")
            
            # Create index
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_item_approved_claim_id 
                    ON item(approved_claim_id);
                """))
                print("✅ Index created")
            except Exception as e:
                print(f"⚠️  Could not create index (may already exist): {e}")
            
            conn.commit()
            print("✅ Column 'approved_claim_id' added successfully to 'item' table")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    add_approved_claim_id_column()

