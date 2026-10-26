# MFQOD — University Lost & Found

Full-stack application: **FastAPI** backend and a **React** frontend (Vite + React Router single-page app, served as static files by nginx), with PostgreSQL, LDAP/Active Directory, and role-based access control.

The frontend runs **without internet access**. Fonts, icons, images and map tiles are all served locally, so it can be hosted on an isolated internal network. See [Air-gapped deployment](docs/installation-production.md#air-gapped-offline-deployment-docker).

## Prerequisites

| Tool | Version (used in Docker) | Notes |
|------|--------------------------|--------|
| Python | 3.11+ | Backend |
| Node.js | 20+ | Frontend build and dev server only. Production serves static files with nginx, so Node is not needed at runtime. |
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

2. **Optional: frontend runtime settings.** The frontend container reads `API_URL` when it **starts**, so changing it needs no rebuild. `API_URL` is the backend URL as reached by the users' browsers (default `http://localhost:8000`; the old `NEXT_PUBLIC_HOST_NAME` is still accepted). The other settings are `MAP_TILES_URL`, `MAP_TILES_TYPE`, `SHOW_EXTERNAL_MAP_LINKS` and `MAP_ATTRIBUTION`. Export them or put them in a root `.env` file that Compose reads.

   **Optional: offline map tiles.** On a machine with internet access, run `scripts/download-map-tiles.sh`. It creates `storage/map/oman.pmtiles`, which Compose mounts into the frontend. Without that file, the branch map has no base layer.

3. **Create storage and log directories** (if they do not exist):

   ```bash
   mkdir -p storage/uploads/images storage/uploads/itemTypesImages storage/map backend/logs
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
# Backend URL: edit public/config.js (API_URL, default http://127.0.0.1:8000)
npm install
npm run dev          # Vite dev server with hot reload
```

Open http://127.0.0.1:5180/ar.

Other frontend commands:

```bash
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run build        # production build -> frontend/dist/ (static files for any web server)
npm run preview      # serve the production build at http://127.0.0.1:4180
```

For offline map tiles in development, link `storage/map/oman.pmtiles` to `frontend/public/map/oman.pmtiles`.
See [frontend/README.md](frontend/README.md) for configuration and project layout.

---

## Environment files (summary)

| Location | Template | Purpose |
|----------|----------|---------|
| `backend/.env` | `backend/env.example` | Database, JWT, CORS, LDAP, email, etc. |
| `frontend/public/config.js` | (in git) | Runtime settings for `npm run dev`/`preview`: `API_URL`, map settings. In Docker, container env vars generate it. |
| `frontend/.env.local` (optional) | `frontend/env.example` | Build-time fallbacks `VITE_API_URL`, … (used only when `config.js` does not set a key) |

Do not commit real `.env` or `.env.local` files.

---

## Further documentation

- [DOCKER.md](DOCKER.md) — production-oriented Docker setup, troubleshooting, resource limits  
- [frontend/README.md](frontend/README.md) — frontend commands, runtime configuration, offline map  
- [docs/installation-production.md](docs/installation-production.md) — production install, including air-gapped (offline) Docker deployment  
- [backend/Readme.md](backend/Readme.md) — API structure, Alembic, RBAC, AD/LDAP  
- `docs/` — additional deployment and installation notes where present  
