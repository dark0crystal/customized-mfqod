# Multi-stage build for production-optimized backend
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libldap2-dev \
    libsasl2-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create and use a dedicated virtual environment to avoid conflicts
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements first for better layer caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Create storage directories
# The code uses ../storage relative to /app (which resolves to /storage)
# Volume mount will overlay this directory
RUN mkdir -p /storage/uploads/images \
    /storage/uploads/itemTypesImages \
    logs && \
    chown -R appuser:appuser /app /storage logs

# Production stage
FROM base AS production

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check (relies on app responding on /api/health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Use gunicorn with uvicorn workers for production (inside the venv)
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]

# Development stage
FROM base AS development

# Install development dependencies
RUN pip install --no-cache-dir black isort flake8 mypy

# Keep root user for development (easier file permissions)
USER root

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

