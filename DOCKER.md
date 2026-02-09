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

# Backend API URL (used by frontend)
NEXT_PUBLIC_HOST_NAME=http://localhost:8000

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production

# CORS Origins (comma-separated, optional - defaults included)
CORS_ORIGINS=http://localhost:3000,http://frontend:3000
```

### 2. Build and Run

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

### 3. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/api/docs

## Production Best Practices Implemented

### Security
- ✅ Non-root users in containers
- ✅ Read-only filesystem for frontend (with tmpfs for temp files)
- ✅ Security options (no-new-privileges)
- ✅ Minimal base images (Alpine for frontend, slim for backend)
- ✅ No secrets in Dockerfiles
- ✅ Health checks for monitoring

### Performance
- ✅ Multi-stage builds for smaller images
- ✅ Layer caching optimization
- ✅ Resource limits and reservations
- ✅ Gunicorn with multiple workers for backend
- ✅ Next.js standalone output for optimized frontend

### Reliability
- ✅ Health checks with retries
- ✅ Restart policies (unless-stopped)
- ✅ Log rotation (max 10MB, 3 files)
- ✅ Graceful shutdown handling
- ✅ Service dependencies (frontend waits for backend)

### Maintainability
- ✅ Separate development and production configs
- ✅ Environment variable management
- ✅ Volume mounts for persistent data
- ✅ Network isolation
- ✅ Clear container naming

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
- `./backend/logs` - Application logs

Make sure these directories exist and have proper permissions:
```bash
mkdir -p storage/uploads/images storage/uploads/itemTypesImages backend/logs
chmod -R 755 storage backend/logs
```

## Monitoring and Health Checks

Both services include health checks:
- **Backend:** Checks `/api/health` endpoint
- **Frontend:** Checks root endpoint

View health status:
```bash
docker-compose ps
```

## Resource Limits

Default resource limits (adjust in `docker-compose.yml`):
- **Backend:** 2 CPU, 2GB RAM (reserved: 0.5 CPU, 512MB)
- **Frontend:** 1 CPU, 1GB RAM (reserved: 0.25 CPU, 256MB)

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
   - Frontend: Next.js dev server

3. Access services at:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

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
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

