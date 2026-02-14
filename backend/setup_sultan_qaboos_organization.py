#!/usr/bin/env python3
"""
Sultan Qaboos University Organization Setup Script

This script adds the organization "جامعة السلطان قابوس" / "Sultan Qaboos University"
to the organization table. Run once during deployment or when setting up a new environment.

Usage (local):
    cd backend
    python setup_sultan_qaboos_organization.py

Usage (Docker):
    From project root:
    docker-compose run --rm backend python setup_sultan_qaboos_organization.py
    # or: make setup-squ-org

Prerequisites:
    - DATABASE_URL environment variable must be set (e.g. in .env)
    - Database must exist and migrations applied (alembic upgrade head)
    - Table: organization must exist

What this script does:
    1. Inserts the Sultan Qaboos University organization (skips if already exists)

Run scripts (copy-paste from project root or backend as indicated):

    # Local (from backend directory):
    # cd backend && python setup_sultan_qaboos_organization.py

    # Docker (from project root):
    # docker-compose run --rm backend python setup_sultan_qaboos_organization.py

    # Make (from project root):
    # make setup-squ-org
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid

# Load environment variables
load_dotenv()

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL environment variable is not set")
    sys.exit(1)

# Create database engine
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# =============================================================================
# ORGANIZATION - Sultan Qaboos University
# =============================================================================
ORGANIZATION = {
    "name_ar": "جامعة السلطان قابوس",
    "name_en": "Sultan Qaboos University",
    "description_ar": None,
    "description_en": None,
}


def setup_organization(session):
    """Insert Sultan Qaboos University organization. Skips if already exists."""
    # Check if organization already exists (by Arabic or English name)
    result = session.execute(
        text("""
            SELECT id FROM organization
            WHERE name_ar = :name_ar OR name_en = :name_en
        """),
        {"name_ar": ORGANIZATION["name_ar"], "name_en": ORGANIZATION["name_en"]},
    ).fetchone()

    if result:
        print(f"  ⏭️  Skipped: Organization already exists (id: {result[0]})")
        return False

    current_time = datetime.now(timezone.utc)
    org_id = str(uuid.uuid4())

    session.execute(
        text("""
            INSERT INTO organization (id, name_ar, name_en, description_ar, description_en, created_at, updated_at)
            VALUES (:id, :name_ar, :name_en, :description_ar, :description_en, :created_at, :updated_at)
        """),
        {
            "id": org_id,
            "name_ar": ORGANIZATION["name_ar"],
            "name_en": ORGANIZATION["name_en"],
            "description_ar": ORGANIZATION["description_ar"],
            "description_en": ORGANIZATION["description_en"],
            "created_at": current_time,
            "updated_at": current_time,
        },
    )
    print(f"  ✅ Created organization: {ORGANIZATION['name_en']} ({ORGANIZATION['name_ar']})")
    return True


def main():
    print("=" * 60)
    print("🏛️  SULTAN QABOOS UNIVERSITY ORGANIZATION SETUP")
    print("=" * 60)
    print("\nThis script will add the organization:")
    print(f"  - Arabic:  {ORGANIZATION['name_ar']}")
    print(f"  - English: {ORGANIZATION['name_en']}\n")

    # Test database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful\n")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

    session = SessionLocal()
    try:
        print("📋 Adding organization...")
        setup_organization(session)
        session.commit()

        print("\n" + "=" * 60)
        print("🎉 Setup completed successfully!")
        print("=" * 60)
        print("\nNote: To show this organization in the Report Found Item form,")
        print("      create at least one branch for it and assign a branch manager.")

    except Exception as e:
        session.rollback()
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
