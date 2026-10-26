# syntax=docker/dockerfile:1
#
# MFQOD frontend: Vite + React Router static SPA served by nginx.
# Build from the repository root:
#   docker build -f frontend/Dockerfile -t mfqod-frontend:latest .
#
# The image is environment-independent: the backend URL and map settings are read at container
# start (docker-entrypoint.sh -> /config.js), so the same image can be docker save'd, moved to an
# air-gapped network and pointed at any backend without a rebuild. No runtime internet access needed.

# ---- Stage 1: build the static site --------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY frontend/ ./
# dist/ = index.html + hashed /assets + public/ (fonts, images). The dev config.js and any local
# map tiles are dropped: config.js is generated at start-up, tiles come from the ./storage/map volume.
RUN npm run build \
 && rm -f dist/config.js \
 && rm -rf dist/map

# ---- Stage 2: nginx ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

COPY frontend/nginx/nginx.conf /etc/nginx/nginx.conf
COPY frontend/nginx/default.conf.template frontend/nginx/security-headers.conf.template /etc/nginx/mfqod/
COPY frontend/docker-entrypoint.sh /usr/local/bin/mfqod-entrypoint.sh
COPY --from=builder /app/dist /usr/share/nginx/html

# chmod a+rX: files keep their build-context mode through COPY (e.g. a 0700 file in a checkout
# would be served as 403 because nginx runs as uid 101). Make all web content world-readable.
RUN chmod 0755 /usr/local/bin/mfqod-entrypoint.sh \
 && rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /usr/share/nginx/html/map \
 && chmod -R a+rX /usr/share/nginx/html /etc/nginx/mfqod /etc/nginx/nginx.conf

ENV API_URL=http://localhost:8000 \
    MAP_TILES_URL=/map/oman.pmtiles \
    MAP_TILES_TYPE=pmtiles \
    SHOW_EXTERNAL_MAP_LINKS=false

# Unprivileged: nginx only writes to /tmp (pid, temp files, generated config.js).
USER nginx
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/mfqod-entrypoint.sh"]
