#!/usr/bin/env python3
"""Script to fix the alembic_version table after deleting a migration file"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def fix_alembic_version():
    """Fix alembic_version table to point to the correct revision"""
    # Get database URL
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        DATABASE_URL = "postgresql://postgres:mfqod@localhost:5433/mfqod"
        logger.warning("DATABASE_URL not found in environment, using default")
    
    # Create engine
    engine = create_engine(DATABASE_URL, echo=False)
    
    try:
        with engine.connect() as conn:
            # Check current revision
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            current_rev = result.scalar()
            logger.info(f"Current database revision: {current_rev}")
            
            # If it's the deleted revision, update it
            if current_rev == 'b67628236aa0':
                logger.info("Found deleted revision 'b67628236aa0' in database")
                logger.info("Updating to 'a1b2c3d4e5f6' (the revision before the deleted one)")
                
                # Update to the previous revision (since b67628236aa0 was empty, we can safely go back)
                conn.execute(text("UPDATE alembic_version SET version_num = 'a1b2c3d4e5f6'"))
                conn.commit()
                
                logger.info("✓ Successfully updated alembic_version table")
                logger.info("You can now run: alembic upgrade head")
                return True
            else:
                logger.info(f"Database revision is {current_rev}, no fix needed")
                return True
                
    except Exception as e:
        logger.error(f"Error fixing alembic_version: {e}")
        return False
    finally:
        engine.dispose()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Fixing alembic_version table")
    logger.info("=" * 60)
    
    success = fix_alembic_version()
    
    if success:
        logger.info("\n" + "=" * 60)
        logger.info("✓ Fix completed successfully!")
        logger.info("=" * 60)
        sys.exit(0)
    else:
        logger.error("\n" + "=" * 60)
        logger.error("✗ Fix failed!")
        logger.error("=" * 60)
        sys.exit(1)

