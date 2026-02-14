# University Lost & Found System (Mfqod)

A web application for reporting and managing lost and found items, with support for organizations, branches, roles, and permissions.

---

## Prerequisites

- **Docker** (recommended): Docker Engine 20.10+ and Docker Compose 2.0+
- **Database**: PostgreSQL (recommended for production). Ensure it is running and reachable.
- **Environment**: Create `backend/.env` with at least `DATABASE_URL`, `SECRET_KEY`, and any auth/LDAP variables you need (see [Environment Configuration](docs/docker.md#environment-configuration)).

For non-Docker (local) setup, see [Installation & Production](docs/installation-production.md).

---

## Step-by-step setup

### Step 1: Clone and configure environment

```bash
git clone <repository-url>
cd customized-mfqod
```

Create the backend environment file:

```bash
cp SQU_LDAP_CONFIG.env backend/.env
```

Edit `backend/.env` and set:

- **DATABASE_URL** – PostgreSQL connection string (e.g. `postgresql://user:password@host:5432/dbname`). For Docker on Mac/Windows, use `host.docker.internal` as the host if the database runs on your machine.
- **SECRET_KEY** – A long random string for JWT/session security.
- **NEXT_PUBLIC_HOST_NAME** – Backend URL the frontend will call (e.g. `http://localhost:8000` for local/Docker).

Details: [Environment Configuration](docs/docker.md#environment-configuration) · [Installation & Production](docs/installation-production.md)

---

### Step 2: Ensure database exists and run migrations

Create the PostgreSQL database if it does not exist, then run migrations.

**With Docker (from project root):**

```bash
docker-compose run --rm backend alembic -c app/db/alembic.ini upgrade head
```

**Without Docker:**

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
alembic -c app/db/alembic.ini upgrade head
```

Details: [Database migrations](docs/migrations.md)

---

### Step 3: Start the application

**With Docker (recommended):**

```bash
docker-compose up --build -d
```

**Without Docker:** start backend and frontend separately (see [Installation & Production](docs/installation-production.md)).

---

### Step 4: Run setup scripts (one-time)

After the app is running (and migrations are applied), run these once:

**Permissions and roles** (creates default roles and permissions):

```bash
# Docker (from project root)
docker-compose run --rm backend python setup_permissions.py
# or: make setup-permissions
```

**Sultan Qaboos University organization** (adds the default organization):

```bash
# Docker (from project root)
docker-compose run --rm backend python setup_sultan_qaboos_organization.py
# or: make setup-squ-org
```

Details: [Docker – Running one-off scripts](docs/docker.md#running-one-off-backend-scripts)

---

### Step 5: Access the application

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:8000  
- **API docs (Swagger):** http://localhost:8000/api/docs  

---

## Useful commands (Docker)

| Action              | Command |
|---------------------|--------|
| Start services      | `docker-compose up -d` or `make up` |
| Rebuild and start   | `docker-compose up --build -d` |
| View logs           | `docker-compose logs -f` or `make logs` |
| Stop services       | `docker-compose down` or `make down` |
| Dev mode (hot reload) | `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build` or `make dev` |

---

## Documentation

| Topic | Description |
|-------|-------------|
| [**Docker**](docs/docker.md) | Docker setup, env vars, one-off scripts, production practices |
| [**Installation & production**](docs/installation-production.md) | Full installation, non-Docker setup, production deployment |
| [**Database migrations**](docs/migrations.md) | Alembic: creating and applying migrations |
| [**Authentication**](docs/authentication.md) | Login, sessions, and auth flow |
| [**Permissions & access**](docs/permissions-access.md) | Roles, permissions, and access control |
| [**Permissions (reference)**](docs/permissions.md) | List of permissions and usage |
| [**Items flow**](docs/items-flow.md) | How lost/found items move through the system |
| [**Manage branches**](docs/manage-branches.md) | Organizations, branches, and branch managers |
| [**Manage users**](docs/manage-users.md) | User management and roles |
| [**Password reset**](docs/password-reset.md) | Password reset and recovery |
| [**Search**](docs/search.md) | Search behavior and filters |
| [**Storage**](docs/storage.md) | File and image storage configuration |
| [**SMTP / email**](docs/smtp-email-notifications.md) | Email and notification setup |

---

## Project structure

```
customized-mfqod/
├── backend/          # FastAPI backend (Python)
├── frontend/         # Next.js frontend
├── docs/             # Documentation (linked above)
├── docker-compose.yml
├── DOCKER.md         # Short Docker quick reference
└── README.md         # This file
```

---

## Troubleshooting

- **Database connection errors:** Check `DATABASE_URL` in `backend/.env`. From inside Docker, use `host.docker.internal` (Mac/Windows) or your host IP (Linux) if the DB runs on the host. See [Database connection](docs/docker.md#database-connection).
- **Frontend can’t reach backend:** Ensure `NEXT_PUBLIC_HOST_NAME` matches the URL the browser uses to call the API (e.g. `http://localhost:8000`).
- **Permissions or roles missing:** Run `setup_permissions.py` as in Step 4.
- **More help:** [Docker troubleshooting](docs/docker.md#troubleshooting) · [Installation troubleshooting](docs/installation-production.md#troubleshooting).
