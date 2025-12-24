"""
Database migration utilities for automatic migration management.
"""
import os
import logging
from dotenv import load_dotenv
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

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
                logger.debug("alembic_version table does not exist. It will be created by Alembic.")
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
                return True
            
            logger.debug("Altering alembic_version.version_num to VARCHAR(255)...")
            
            # Alter the column to support longer revision IDs
            conn.execute(text("""
                ALTER TABLE alembic_version 
                ALTER COLUMN version_num TYPE VARCHAR(255);
            """))
            conn.commit()
            
            logger.debug("Successfully altered alembic_version.version_num to VARCHAR(255)")
            return True
            
    except Exception as e:
        logger.warning(f"Warning fixing alembic_version table: {e}")
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


def run_migrations_automatically(verbose=False):
    """
    Automatically detect and apply all pending database migrations.
    
    This function can be called during application startup to ensure
    the database is always up to date.
    
    Args:
        verbose: If True, log detailed migration information
    
    Returns:
        bool: True if migrations completed successfully, False otherwise
    """
    # Get database URL
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not found in environment variables")
        return False
    
    # Create engine
    engine = create_engine(DATABASE_URL, echo=False)
    
    try:
        # Fix alembic_version table first
        fix_alembic_version_table(engine)
        
        # Get the path to alembic.ini
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        alembic_cfg = Config(os.path.join(backend_dir, 'app/db/alembic.ini'))
        
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
            if verbose:
                logger.info("Database is already at the latest migration (head)")
            return True
        
        # Apply all pending migrations up to head
        if verbose:
            logger.info("Applying pending migrations...")
        
        try:
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied successfully")
            
            # Verify we're at head
            new_current_rev = get_current_revision(engine, alembic_cfg)
            if new_current_rev == head_rev:
                if verbose:
                    logger.info(f"Database is now at revision: {new_current_rev}")
                return True
            else:
                logger.warning(f"Database revision is {new_current_rev}, expected {head_rev}")
                return False
                
        except Exception as e:
            error_msg = str(e)
            if "already at" in error_msg.lower():
                if verbose:
                    logger.info(f"Already at target revision: {error_msg}")
                return True
            elif "can't locate revision" in error_msg.lower():
                logger.error(f"Migration error: {error_msg}")
                logger.error("This usually means there's a problem with the migration chain")
                return False
            else:
                logger.error(f"Error applying migrations: {error_msg}")
                return False
    
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False
    
    finally:
        engine.dispose()


