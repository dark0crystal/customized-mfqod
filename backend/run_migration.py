#!/usr/bin/env python3
"""Script to automatically run database migrations"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, text
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def fix_alembic_version_table(engine):
    """Fix alembic_version table to support longer revision IDs"""
    try:
        with engine.connect() as conn:
            # Check if table exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'alembic_version'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                logger.info("ℹ alembic_version table does not exist. It will be created by Alembic.")
                return True
            
            # Check current column size
            result = conn.execute(text("""
                SELECT character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = 'alembic_version' 
                AND column_name = 'version_num';
            """))
            current_size = result.scalar()
            
            if current_size and current_size >= 255:
                logger.info(f"✓ alembic_version.version_num is already {current_size} characters (sufficient)")
                return True
            
            logger.info(f"Current version_num column size: {current_size}")
            logger.info("Altering alembic_version.version_num to VARCHAR(255)...")
            
            # Alter the column to support longer revision IDs
            conn.execute(text("""
                ALTER TABLE alembic_version 
                ALTER COLUMN version_num TYPE VARCHAR(255);
            """))
            conn.commit()
            
            logger.info("✓ Successfully altered alembic_version.version_num to VARCHAR(255)")
            return True
            
    except Exception as e:
        logger.warning(f"⚠ Warning fixing alembic_version table: {e}")
        return False


def get_current_revision(engine, alembic_cfg):
    """Get the current database revision"""
    try:
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            current_rev = context.get_current_revision()
            return current_rev
    except Exception as e:
        logger.debug(f"Could not get current revision: {e}")
        return None


def get_head_revision(alembic_cfg):
    """Get the head revision from migration scripts"""
    try:
        script = ScriptDirectory.from_config(alembic_cfg)
        head_rev = script.get_current_head()
        return head_rev
    except Exception as e:
        logger.error(f"Could not get head revision: {e}")
        return None


def run_migrations(verbose=True):
    """
    Automatically detect and apply all pending database migrations.
    
    Args:
        verbose: If True, print detailed migration information
    
    Returns:
        bool: True if migrations completed successfully, False otherwise
    """
    # Get database URL
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        DATABASE_URL = "postgresql://postgres:mfqod@localhost:5433/mfqod"
        logger.warning("DATABASE_URL not found in environment, using default")
    
    # Create engine
    engine = create_engine(DATABASE_URL, echo=False)
    
    try:
        # Fix alembic_version table first
        if verbose:
            logger.info("Step 0: Checking alembic_version table...")
        fix_alembic_version_table(engine)
        
        # Get the path to alembic.ini
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), 'app/db/alembic.ini'))
        
        # Override sqlalchemy.url if DATABASE_URL is set
        if DATABASE_URL:
            alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
        
        # Check current and target revisions
        current_rev = get_current_revision(engine, alembic_cfg)
        head_rev = get_head_revision(alembic_cfg)
        
        if verbose:
            logger.info(f"Current database revision: {current_rev or 'None (fresh database)'}")
            logger.info(f"Target revision (head): {head_rev}")
        
        # If already at head, no migrations needed
        if current_rev == head_rev:
            logger.info("✓ Database is already at the latest migration (head)")
            return True
        
        # Apply all pending migrations up to head
        if verbose:
            logger.info("\nApplying pending migrations...")
        
        try:
            command.upgrade(alembic_cfg, "head")
            logger.info("✓ All migrations applied successfully!")
            
            # Verify we're at head
            new_current_rev = get_current_revision(engine, alembic_cfg)
            if new_current_rev == head_rev:
                logger.info(f"✓ Database is now at revision: {new_current_rev}")
                return True
            else:
                logger.warning(f"⚠ Database revision is {new_current_rev}, expected {head_rev}")
                return False
                
        except Exception as e:
            error_msg = str(e)
            if "already at" in error_msg.lower():
                logger.info(f"ℹ {error_msg}")
                return True
            elif "can't locate revision" in error_msg.lower():
                logger.error(f"✗ Migration error: {error_msg}")
                logger.error("This usually means there's a problem with the migration chain")
                return False
            else:
                logger.error(f"✗ Error applying migrations: {error_msg}")
                raise
    
    except Exception as e:
        logger.error(f"✗ Migration failed: {e}")
        return False
    
    finally:
        engine.dispose()


def main():
    """Main entry point for the migration script"""
    logger.info("=" * 60)
    logger.info("Starting automatic database migration")
    logger.info("=" * 60)
    
    success = run_migrations(verbose=True)
    
    if success:
        logger.info("\n" + "=" * 60)
        logger.info("✓ Migration process completed successfully!")
        logger.info("=" * 60)
        sys.exit(0)
    else:
        logger.error("\n" + "=" * 60)
        logger.error("✗ Migration process failed!")
        logger.error("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()

