# Database Migrations Guide

This guide explains how to work with database migrations in this project using Alembic.

## Overview

Alembic automatically detects changes in `backend/app/models.py` and generates migration files. You don't need to manually create migration files.

## Prerequisites

- PostgreSQL database running and accessible
- Database connection configured in `backend/app/db/alembic.ini` or via `DATABASE_URL` environment variable

## Quick Start

### 1. Make Changes to Models

Edit `backend/app/models.py` to add, modify, or remove database models/fields.

Example: Adding a new field to the `Item` model:
```python
class Item(Base):
    # ... existing fields ...
    internal_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

### 2. Generate Migration Automatically

Run Alembic autogenerate to detect changes and create a migration file:

```bash
cd backend/app/db
alembic revision --autogenerate -m "add internal_description field"
```

Or from the backend directory:
```bash
cd backend
alembic -c app/db/alembic.ini revision --autogenerate -m "add internal_description field"
```

This will:
- Compare your models with the current database schema
- Generate a migration file in `backend/app/db/migrations/versions/`
- Create the necessary SQL statements to update the database

### 3. Review the Generated Migration

**Always review the generated migration file before applying it!**

Check the file in `backend/app/db/migrations/versions/` to ensure:
- The changes are correct
- No unintended drops or modifications
- Column types and constraints are as expected

### 4. Apply the Migration

Apply the migration to update your database:

```bash
cd backend/app/db
alembic upgrade head
```

Or from the backend directory:
```bash
cd backend
alembic -c app/db/alembic.ini upgrade head
```

## Common Commands

### Check Current Database Revision

```bash
cd backend/app/db
alembic current
```

### View Migration History

```bash
cd backend/app/db
alembic history
```

### View Detailed History

```bash
cd backend/app/db
alembic history --verbose
```

### Rollback Last Migration

```bash
cd backend/app/db
alembic downgrade -1
```

### Rollback to Specific Revision

```bash
cd backend/app/db
alembic downgrade <revision_id>
```

### Upgrade to Specific Revision

```bash
cd backend/app/db
alembic upgrade <revision_id>
```

### Create Empty Migration (Manual)

If you need to create a migration manually (not recommended):

```bash
cd backend/app/db
alembic revision -m "manual migration description"
```

## Using the Migration Script

The project includes a Python script to run migrations automatically:

```bash
cd backend
python run_migration.py
```

This script:
- Automatically detects pending migrations
- Applies them to the database
- Provides detailed logging

## Troubleshooting

### Migration Conflicts

If you have multiple migration heads (branches), you need to merge them:

```bash
cd backend/app/db
alembic merge heads -m "merge migration branches"
```

### Database Out of Sync

If your database schema doesn't match your models:

1. **Backup your database first!**
2. Generate a new migration: `alembic revision --autogenerate -m "sync schema"`
3. Review the migration carefully
4. Apply it: `alembic upgrade head`

### Reset All Migrations (Development Only)

⚠️ **Warning: This will delete all migration history. Use only in development!**

```bash
# Delete all migration files
rm -rf backend/app/db/migrations/versions/*.py

# Create a fresh initial migration
cd backend/app/db
alembic revision --autogenerate -m "initial migration"
```

## Best Practices

1. **Always review generated migrations** before applying them
2. **Test migrations on a development database** first
3. **Commit migration files** to version control
4. **Use descriptive migration messages** (e.g., "add user email verification")
5. **One migration per feature** - don't mix unrelated changes
6. **Backup production database** before running migrations

## Migration File Structure

Migration files are located in: `backend/app/db/migrations/versions/`

Each migration file contains:
- `upgrade()` function - applies the migration
- `downgrade()` function - rolls back the migration
- Revision identifiers for tracking the migration chain

## Environment Variables

You can override the database URL using the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5433/dbname"
alembic upgrade head
```

## Configuration Files

- **Alembic config**: `backend/app/db/alembic.ini`
- **Migration environment**: `backend/app/db/migrations/env.py`
- **Models**: `backend/app/models.py`

## Example Workflow

```bash
# 1. Edit models.py
# Add: internal_description field to Item model

# 2. Generate migration
cd backend/app/db
alembic revision --autogenerate -m "add internal_description to items"

# 3. Review the generated file
# Check: backend/app/db/migrations/versions/XXXX_add_internal_description_to_items.py

# 4. Apply migration
alembic upgrade head

# 5. Verify
alembic current
```

## Need Help?

- Check Alembic documentation: https://alembic.sqlalchemy.org/
- Review existing migration files for examples
- Check database logs for errors

