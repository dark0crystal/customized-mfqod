# MFQOD — University Lost & Found

Full-stack application: **FastAPI** backend and **Next.js** frontend, with PostgreSQL , LDAP/Active Directory, and role-based access control.

## Prerequisites

| Tool | Version (used in Docker) | Notes |
|------|--------------------------|--------|
| Python | 3.11+ | Backend |
| Node.js | 20+ | Frontend (`npm ci` in Docker uses Node 20) |
| PostgreSQL | 14+ (typical) | Recommended for production-like setups; SQLite works for basic local dev |
| Docker & Docker Compose | 20.10+ / 2.0+ | Optional; see [DOCKER.md](DOCKER.md) |


---

## Quick start with Docker

1. **Configure the backend** — create `backend/.env` from the template:

   ```bash
   cd backend
   cp env.example .env
   ```

   Edit `DATABASE_URL`, `SECRET_KEY`, and other values as needed. For PostgreSQL on the host while containers run on Docker Desktop (Mac/Windows), you often use `host.docker.internal` in `DATABASE_URL` (details in [DOCKER.md](DOCKER.md)).

2. **Optional: frontend build-time API URL** — when building images, Compose reads `NEXT_PUBLIC_HOST_NAME` (defaults to `http://localhost:8000`). You can export it or add it to a root `.env` file used by Compose.

3. **Create storage and log directories** (if they do not exist):

   ```bash
   mkdir -p storage/uploads/images storage/uploads/itemTypesImages backend/logs
   ```

4. **Start the stack** (from the **repository root**):

   ```bash
   docker-compose up --build -d
   ```

   Development mode with hot reload:

   ```bash
   make dev
   ```

   Or: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build`

5. **First-time database setup** (run inside the backend container or locally against the same `DATABASE_URL`):

   ```bash
   docker-compose exec backend alembic upgrade head
   docker-compose exec backend python setup_permissions.py
   ```

**URLs**

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000  
- OpenAPI docs: http://localhost:8000/api/docs  

More detail: [DOCKER.md](DOCKER.md), [Makefile](Makefile) (`make help`).

---

## Local development (without Docker)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env
# Edit .env — at minimum SECRET_KEY and DATABASE_URL (SQLite default is fine to start)
alembic upgrade head
python setup_permissions.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

See [backend/Readme.md](backend/Readme.md) for architecture, LDAP, migrations, and permissions.

### 2. Frontend

In a second terminal:

```bash
cd frontend
cp env.example .env.local
# Ensure NEXT_PUBLIC_HOST_NAME matches your API (default http://localhost:8000)
npm install
npm run dev
```

Open http://localhost:3000.

---

## Environment files (summary)

| Location | Template | Purpose |
|----------|----------|---------|
| `backend/.env` | `backend/env.example` | Database, JWT, CORS, LDAP, email, etc. |
| `frontend/.env.local` | `frontend/env.example` | `NEXT_PUBLIC_HOST_NAME` → backend base URL |

Do not commit real `.env` or `.env.local` files.

---

## Further documentation

- [DOCKER.md](DOCKER.md) — production-oriented Docker setup, troubleshooting, resource limits  
- [backend/Readme.md](backend/Readme.md) — API structure, Alembic, RBAC, AD/LDAP  
- `docs/` — additional deployment and installation notes where present  
