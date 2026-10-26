# Docker Setup Guide

This guide explains how to run the Mfqod application using Docker with production best practices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Updating Docker with Latest Changes](#updating-docker-with-latest-changes)
4. [Environment Configuration](#environment-configuration)
5. [Development Workflow](#development-workflow)
6. [Production Best Practices](#production-best-practices)
7. [Database Connection](#database-connection)
8. [Storage and Volumes](#storage-and-volumes)
9. [Troubleshooting](#troubleshooting)
10. [Production Deployment](#production-deployment)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- External database (PostgreSQL recommended for production)

## Quick Start

### 1. Environment Configuration

Create a `.env` file in the `backend/` directory (or copy from `SQU_LDAP_CONFIG.env`):

```bash
cd backend
cp SQU_LDAP_CONFIG.env .env
# Edit .env with your configuration
```

### 2. Build and Run

**Production mode:**

```bash
# From project root
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Development mode (with hot reload):**

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### 3. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/api/docs

---

## Updating Docker with Latest Changes

When you make code changes (frontend, backend, config, etc.), Docker containers will not automatically pick them up. You need to rebuild the images.

### Standard rebuild (recommended)

Replaces existing images with fresh builds that include your latest changes:

```bash
# Rebuild and start in one command
docker-compose up --build -d
```

The `--build` flag forces Docker to rebuild images before starting containers.

### Full rebuild (no cache)

Use when you need a completely clean build (e.g. after dependency changes or persistent issues):

```bash
# Stop containers
docker-compose down

# Rebuild from scratch (ignores cached layers)
docker-compose build --no-cache

# Start containers
docker-compose up -d
```

### Clean rebuild (including volumes)

Reset everything and rebuild from scratch:

```bash
# Stop and remove containers, networks, and volumes
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

> **Warning:** `docker-compose down -v` removes volumes. Use only if you are sure you want to clear persisted data.

### Quick reference

| Scenario | Command |
|----------|---------|
| Code changes applied | `docker-compose up --build -d` |
| Dependency changes / stubborn cache | `docker-compose build --no-cache && docker-compose up -d` |
| Full reset | `docker-compose down -v` then `docker-compose build --no-cache` then `docker-compose up -d` |
| Development with hot reload | `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build` |

---

## Environment Configuration

**Important environment variables:**

```env
# Database (point to your external database)
# For Mac/Windows Docker Desktop, use host.docker.internal
# For Linux, use your host IP or host network mode
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/dbname


# Security
SECRET_KEY=your-super-secret-key-change-this-in-production

# CORS Origins (comma-separated, optional - defaults included)
CORS_ORIGINS=http://localhost:3000,http://frontend:3000
```

### Frontend runtime configuration

The frontend image is built once and configured when the container **starts** (the entrypoint
writes `/config.js`). Set these for `docker-compose` in the shell environment or in a `.env` file
next to `docker-compose.yml`:

```env
# Frontend (read at container START, written to /config.js -- no rebuild needed to change them)
# Backend URL as reached by the users' BROWSERS (NEXT_PUBLIC_HOST_NAME is still accepted)
API_URL=http://localhost:8000
# Offline branch map: pmtiles (default, ./storage/map/oman.pmtiles) | xyz | none
MAP_TILES_TYPE=pmtiles
MAP_TILES_URL=/map/oman.pmtiles
# "View on map" buttons open Google Maps (internet) -- keep false on an air-gapped network
SHOW_EXTERNAL_MAP_LINKS=false
```

| Variable | Default | Meaning |
|---|---|---|
| `API_URL` | `http://localhost:8000` (or `NEXT_PUBLIC_HOST_NAME`) | Backend base URL used by the browser. Also added to the CSP `connect-src`/`img-src`. |
| `MAP_TILES_TYPE` | `pmtiles` | `pmtiles` (self-hosted file), `xyz` (internal tile server), `none` (no base map) |
| `MAP_TILES_URL` | `/map/oman.pmtiles` | `.pmtiles` URL, or an XYZ template ending in `/{z}/{x}/{y}.png` |
| `MAP_ATTRIBUTION` | `© OpenStreetMap contributors · Protomaps` | Map attribution text |
| `SHOW_EXTERNAL_MAP_LINKS` | `false` | Show the Google Maps buttons on the branches page (needs internet) |
| `CSP_EXTRA_CONNECT_SRC`, `CSP_EXTRA_IMG_SRC` | empty | Extra Content-Security-Policy sources, space separated |

No rebuild is needed after changing them: `docker-compose up -d frontend`.

### Offline map tiles

The branch map renders a self-hosted OpenStreetMap basemap (Protomaps vector tiles). Create the
file once on a machine with internet access:

```bash
scripts/download-map-tiles.sh                       # latest build, Oman, max zoom 15 (~165 MB)
scripts/download-map-tiles.sh 20261025 51.9,16.6,59.9,26.5 14   # explicit date / bbox / max zoom
```

It writes `storage/map/oman.pmtiles`, which `docker-compose.yml` mounts read-only at
`/usr/share/nginx/html/map`. The file is not in git and not in the image.

## Development Workflow

For development with hot reload:

1. Use development compose file:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

2. Code changes will automatically reload:
   - Backend: Uvicorn with `--reload`
   - Frontend: Vite dev server (runtime config from `frontend/public/config.js`)

3. Access services at:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

## Production Best Practices Implemented

### Security

- Non-root users in containers
- Read-only filesystem for frontend (with tmpfs for temp files); nginx runs as the `nginx` user
- Content-Security-Policy: the browser may only load from this server and the backend
  (`default-src 'self'`), so nothing is ever fetched from the internet
- Security options (no-new-privileges)
- Minimal base images (Alpine for frontend, slim for backend)
- No secrets in Dockerfiles
- Health checks for monitoring

### Performance

- Multi-stage builds for smaller images
- Layer caching optimization
- Resource limits and reservations
- Gunicorn with multiple workers for backend
- Frontend is a static build served by nginx (gzip, immutable caching of hashed `/assets/*`,
  `no-cache` for `index.html` and `/config.js`)

### Reliability

- Health checks with retries
- Restart policies (unless-stopped)
- Log rotation (max 10MB, 3 files)
- Graceful shutdown handling
- Service dependencies (frontend waits for backend)

## Database Connection

### Connecting to External Database

**Mac/Windows (Docker Desktop):**

```env
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/dbname
```

**Linux:**

```env
# Option 1: Use host network mode (add to docker-compose.yml)
network_mode: "host"

# Option 2: Use host IP
DATABASE_URL=postgresql://user:password@172.17.0.1:5432/dbname

# Option 3: Use Docker service name if database is in another compose file
DATABASE_URL=postgresql://user:password@postgres:5432/dbname
```

## Storage and Volumes

The following directories are mounted as volumes for persistence:

- `./storage` - Uploaded images and files
- `./storage/map` - Offline map tiles (`oman.pmtiles`), mounted read-only into the frontend
- `./backend/logs` - Application logs

Create directories and set permissions:

```bash
mkdir -p storage/uploads/images storage/uploads/itemTypesImages storage/map backend/logs
chmod -R 755 storage backend/logs
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check container status
docker-compose ps
```

### Database connection issues

```bash
# Test database connection from container
docker-compose exec backend python -c "from app.db.database import engine; engine.connect()"
```

### Permission issues

```bash
# Fix storage permissions
sudo chown -R $(id -u):$(id -g) storage backend/logs
```

### Branch map is blank (markers but no streets)

`storage/map/oman.pmtiles` is missing or not readable. The frontend logs a warning at start-up
(`docker-compose logs frontend`). Run `scripts/download-map-tiles.sh` on a connected machine and
copy the file. Check: `curl -sI -H 'Range: bytes=0-99' http://localhost:3000/map/oman.pmtiles`
must return `206 Partial Content`.

### Frontend calls the wrong backend

Check `curl http://localhost:3000/config.js`. Change `API_URL` and restart the container
(`docker-compose up -d frontend`); browsers re-read `/config.js` on the next page load.

### Docker not reflecting latest code changes

```bash
# Rebuild without cache
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For servers **without internet access**, follow
[installation-production.md -> Air-gapped (offline) deployment](installation-production.md#air-gapped-offline-deployment-docker).

### Build and Push Images

```bash
# Build images
docker-compose build

# Tag for registry
docker tag mfqod-backend:latest your-registry/mfqod-backend:latest
docker tag mfqod-frontend:latest your-registry/mfqod-frontend:latest

# Push to registry
docker push your-registry/mfqod-backend:latest
docker push your-registry/mfqod-frontend:latest
```

### Environment-Specific Configuration

Create environment-specific compose files:

- `docker-compose.prod.yml` - Production overrides
- `docker-compose.staging.yml` - Staging overrides

Example:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Security Checklist

Before deploying to production:

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Update `DATABASE_URL` with secure credentials
- [ ] Configure `CORS_ORIGINS` with production domains
- [ ] Set up SSL/TLS (use reverse proxy like nginx)
- [ ] Review and restrict resource limits
- [ ] Enable firewall rules
- [ ] Set up log aggregation
- [ ] Configure backup strategy for volumes
- [ ] Review security options in docker-compose.yml
- [ ] Update all dependencies regularly

## Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [nginx documentation](https://nginx.org/en/docs/)
- [Protomaps basemaps / PMTiles](https://docs.protomaps.com/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
