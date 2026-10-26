# Docker Setup Guide

This guide explains how to run the application using Docker with production best practices.

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

The **frontend** is configured with environment variables for `docker-compose` (shell environment
or a `.env` file next to `docker-compose.yml`). They are read when the container starts, so the
same image works on any server:

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

### 2. Offline map tiles (optional, recommended)

The branch map uses a self-hosted OpenStreetMap basemap (no internet needed at runtime). Download it
once on a machine with internet access (about 165 MB for Oman):

```bash
scripts/download-map-tiles.sh            # -> storage/map/oman.pmtiles
```

Without the file the app works normally; the branch map just shows markers on a blank background.

### 3. Build and Run

**Production mode:**
```bash
# Build and start services
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

### 4. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/api/docs


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
- `./storage/map` - Offline map tiles (`oman.pmtiles`, read-only in the frontend container)
- `./backend/logs` - Application logs

Make sure these directories exist and have proper permissions:
```bash
mkdir -p storage/uploads/images storage/uploads/itemTypesImages backend/logs
chmod -R 755 storage backend/logs
```

## Monitoring and Health Checks

Both services include health checks:
- **Backend:** Checks `/api/health` endpoint
- **Frontend:** Checks `/healthz` (nginx)

View health status:
```bash
docker-compose ps
```

## Resource Limits

Default resource limits (adjust in `docker-compose.yml`):
- **Backend:** 2 CPU, 2GB RAM (reserved: 0.5 CPU, 512MB)
- **Frontend:** 1 CPU, 256MB RAM (reserved: 0.1 CPU, 32MB) -- static files served by nginx

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

### Rebuild from scratch
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Development Workflow

For development with hot reload:

1. Use development compose file:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

2. Code changes will automatically reload:
   - Backend: Uvicorn with `--reload`
   - Frontend: Vite dev server (runtime config from `frontend/public/config.js`)

3. Access services at:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

## Frontend container

The frontend is a static single-page app (Vite + React Router) served by **nginx** on port 3000:

- `frontend/Dockerfile`: stage 1 `node:20-alpine` (`npm ci`, `npm run build` -> `dist/`),
  stage 2 `nginx:1.27-alpine`, running as the unprivileged `nginx` user with a read-only filesystem.
- `frontend/docker-entrypoint.sh` writes `/config.js` from `API_URL`, `MAP_TILES_URL`,
  `MAP_TILES_TYPE`, `MAP_ATTRIBUTION`, `SHOW_EXTERNAL_MAP_LINKS` and renders
  `frontend/nginx/default.conf.template`.
- nginx: SPA fallback (every URL such as `/ar/dashboard/items/12` serves `index.html`), gzip,
  `immutable` caching for `/assets/*`, `no-cache` for `index.html` and `/config.js`, byte-range
  requests for `/map/*.pmtiles`, and security headers including a Content-Security-Policy that only
  allows this server and the backend (`API_URL`). The browser therefore refuses any request to the
  internet.

Changing `API_URL` only needs a restart: `docker-compose up -d frontend`.

## Air-gapped (offline) installation

The application needs no internet access at runtime: fonts, icons, images and map tiles are all
served locally. To install on a network without internet, build on a connected machine and copy
the images. See **[docs/installation-production.md](docs/installation-production.md#air-gapped-offline-deployment-docker)**
for the step-by-step guide (`docker save` -> transfer -> `docker load`).

## Production Deployment

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

