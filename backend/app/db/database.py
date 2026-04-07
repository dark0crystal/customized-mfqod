import os
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine, inspect, text
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


def ensure_missingitem_organization_id_column() -> None:
    """
    Align database with ORM: MissingItem.organization_id (Alembic d4e5f6a7b8c9).

    If deployments skip migrations, SELECT/INSERT on missingitem fail with 500 until
    this column exists. Safe to run repeatedly.
    """
    if not DATABASE_URL:
        return
    try:
        inspector = inspect(engine)
        if not inspector.has_table("missingitem"):
            return
        columns = {col["name"] for col in inspector.get_columns("missingitem")}
        if "organization_id" in columns:
            return

        logger.warning(
            "missingitem.organization_id is missing — applying schema patch. "
            "Prefer: alembic upgrade head (revision d4e5f6a7b8c9 or later)."
        )
        dialect = engine.dialect.name

        with engine.begin() as conn:
            if dialect == "postgresql":
                conn.execute(
                    text("ALTER TABLE missingitem ADD COLUMN organization_id VARCHAR")
                )
                conn.execute(
                    text(
                        """
                        DO $mfqod$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM pg_constraint
                                WHERE conname = 'fk_missingitem_organization_id'
                            ) THEN
                                ALTER TABLE missingitem
                                ADD CONSTRAINT fk_missingitem_organization_id
                                FOREIGN KEY (organization_id) REFERENCES organization(id);
                            END IF;
                        END
                        $mfqod$;
                        """
                    )
                )
            elif dialect == "sqlite":
                conn.execute(
                    text(
                        "ALTER TABLE missingitem ADD COLUMN organization_id VARCHAR"
                    )
                )
            else:
                conn.execute(
                    text(
                        "ALTER TABLE missingitem ADD COLUMN organization_id VARCHAR NULL"
                    )
                )
                try:
                    conn.execute(
                        text(
                            "ALTER TABLE missingitem ADD CONSTRAINT fk_missingitem_organization_id "
                            "FOREIGN KEY (organization_id) REFERENCES organization(id)"
                        )
                    )
                except Exception as fk_err:
                    logger.warning(
                        "Could not add fk_missingitem_organization_id: %s", fk_err
                    )

        logger.info("Schema patch applied: missingitem.organization_id")
    except Exception:
        logger.exception("Failed to apply missingitem.organization_id schema patch")
        raise


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
        # If core tables already exist, assume the database is initialized
        inspector = inspect(engine)
        if inspector.has_table("userstatus"):
            logger.info("Database tables already exist. Skipping automatic create_all.")
            ensure_missingitem_organization_id_column()
            return

        Base.metadata.create_all(engine)  # Reads all models and creates matching tables
        logger.info("✅ Database tables initialized successfully.")
        ensure_missingitem_organization_id_column()
    except Exception as e:
        logger.error("❌ Failed to create tables.")
        logger.error(f"Error: {e}")
        raise
