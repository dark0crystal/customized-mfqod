# University Lost & Found System — Backend

Backend API for the University Lost & Found System with dual authentication (Active Directory + Local), RBAC, and comprehensive item management.

---

## Quick Start

```bash
cd backend
cp env.example .env
# Edit .env with your configuration (database, JWT secret, LDAP, etc.)

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Setup permissions (required before first use)
python setup_permissions.py

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Docker / Make:**
```bash
make build && make up           # Start with Docker
make dev                       # Development mode with hot reload
make logs                      # View logs
```

See [DOCKER.md](../DOCKER.md) in the project root for full Docker setup.

When the backend runs in Docker, use the **host** (not the container) to open the API docs:
- **Swagger UI:** http://localhost:8000/api/docs  
- **ReDoc:** http://localhost:8000/api/redoc  
- **OpenAPI JSON:** http://localhost:8000/api/openapi.json  

Port 8000 is mapped from the container to the host, so these URLs work from your machine. If you use a different host (e.g. `http://127.0.0.1:8000` or a server IP), replace `localhost` accordingly.

---

## Project Structure (Clean Architecture)

```
app/
├── main.py                    # Entry point (uvicorn runs this)
├── config/                    # Configuration (auth, email, LDAP)
│   ├── auth_config.py         # JWT, passwords, rate limits
│   └── email_config.py        # SMTP, templates
│
├── models.py                  # SQLModel/SQLAlchemy models
│
├── schemas/                   # Request & response schemas (Pydantic DTOs)
│   ├── user_schema.py
│   ├── item_schema.py
│   ├── auth_schemas.py
│   └── ...
│
├── services/                  # Business logic layer
│   ├── auth_service.py        # Auth, AD integration
│   ├── userServices.py
│   ├── itemService.py
│   ├── enhanced_ad_service.py # LDAP/AD sync
│   └── ...
│
├── routes/                    # FastAPI route definitions
│   ├── comprehensive_auth_routes.py
│   ├── userRoutes.py
│   ├── itemRoutes.py
│   └── ...
│
├── db/                        # Database session, engine, migrations
│   ├── database.py
│   └── migrations/            # Alembic migrations
│
├── middleware/                # Auth, rate limiting, security headers
│   ├── auth_middleware.py
│   └── rate_limit_setup.py
│
├── utils/                     # Helpers (security, logging, permissions)
│   ├── security.py
│   └── permission_decorator.py
│
└── templates/email/           # Email templates
```

---

## Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Key variables:

| Category | Variables |
|----------|-----------|
| Database | `DATABASE_URL` |
| Auth | `SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` |
| LDAP/AD | `AD_SERVER`, `AD_BIND_USER`, `AD_BIND_PASSWORD`, `AD_BASE_DN` |
| Email | `EMAIL_ENABLED`, `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` |
| Frontend | `FRONTEND_BASE_URL` |

See `env.example` for the full list and descriptions.

---

## Database Migrations (Alembic)

Alembic is configured under `app/db/migrations/`. Target metadata uses SQLModel.

**Create a new migration:**
```bash
alembic revision --autogenerate -m "description of change"
```

**Apply migrations:**
```bash
alembic upgrade head
```

**Initial setup (env.py):**
- Import your models from `app.models` so Alembic can detect them
- Set `target_metadata = Base.metadata` (from app.models)

---

## Permissions & Roles Setup

Run **before** first use to create permissions and roles (`super_admin`, `moderator`, `user`).

**Option 1 — Python (recommended):**
```bash
cd backend
python setup_permissions.py
```

**Option 2 — SQL:**
```bash
cd backend
psql -U your_username -d your_database_name -f setup_permissions.sql
# Or with connection string:
psql "postgresql://user:password@localhost:5432/dbname" -f setup_permissions.sql
```

**Prerequisites:** Run migrations first (`alembic upgrade head`).

---

## Active Directory / LDAP

The system supports dual authentication:
- **Internal users** — authenticate via LDAP/Active Directory (SQU)
- **External users** — local accounts with email/password

**LDAP configuration** (in `.env`):
- `AD_SERVER` — LDAP host (e.g. `ldap.squ.edu.om`)
- `AD_PORT` — 636 for LDAPS, 389 for LDAP
- `AD_USE_SSL` — use SSL
- `AD_BASE_DN`, `AD_USER_DN`, `AD_GROUP_DN` — directory structure
- `AD_BIND_USER`, `AD_BIND_PASSWORD` — service account for binding
- `AD_DEFAULT_INTERNAL_ROLE`, `AD_DEFAULT_EXTERNAL_ROLE` — default roles for new users

**Features:**
- User sync from AD (scheduled or manual)
- Group membership mapping
- Account status checks (expired, disabled)
- Deactivation of expired/disabled accounts

---

## RBAC (Roles & Permissions)

Fine-grained access control using roles and permissions:

- **Permissions** — actions like `can_view_users`, `can_manage_items`, `can_manage_missing_items`
- **Roles** — `super_admin`, `moderator`, `user`
- **role_permissions** — many-to-many mapping

Instead of checking only the role, the code checks whether the user has a specific permission for the action. Use the `@require_permission("permission_name")` decorator on protected routes.

---

## FastAPI Notes

**APIRouter** — Used to define routes in separate modules and mount them in `main.py`. Keeps the app modular.

**HTTPException** — Use `raise HTTPException(...)` for errors instead of `return {...}`. FastAPI treats raised exceptions as error responses (4xx/5xx); plain `return` is interpreted as a 200 OK.

---

## Other Notes

**`__pycache__`** — Python stores compiled bytecode (`.pyc`) here. Safe to ignore in version control (add to `.gitignore`).

**API docs** — Swagger: http://localhost:8000/api/docs · ReDoc: http://localhost:8000/api/redoc · OpenAPI JSON: http://localhost:8000/api/openapi.json (same URLs when running in Docker; use the host and port that reach the backend).
