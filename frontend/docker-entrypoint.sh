#!/bin/sh
# MFQOD frontend container entrypoint.
#
# 1. Writes /config.js (window.__APP_CONFIG__) from environment variables, so ONE built image can be
#    pointed at any backend / map source without a rebuild.
# 2. Renders the nginx server config (incl. the Content-Security-Policy, which allows only this
#    server, the backend and the configured map source).
# 3. Starts nginx in the foreground.
#
# Everything is written to /tmp/mfqod, so the container can run as a non-root user with a
# read-only root filesystem (docker-compose: read_only + tmpfs /tmp).
#
# Environment:
#   API_URL                  Backend base URL as seen by the BROWSER (default http://localhost:8000).
#                            Falls back to NEXT_PUBLIC_HOST_NAME (old Next.js variable).
#   MAP_TILES_URL            .pmtiles file or XYZ template (default /map/oman.pmtiles)
#   MAP_TILES_TYPE           pmtiles | xyz | none (default pmtiles)
#   MAP_ATTRIBUTION          Map attribution text (default "© OpenStreetMap contributors · Protomaps")
#   SHOW_EXTERNAL_MAP_LINKS  true | false (default false): "View on map" buttons that open Google Maps
#   CSP_EXTRA_CONNECT_SRC    Extra CSP connect-src sources, space separated (optional)
#   CSP_EXTRA_IMG_SRC        Extra CSP img-src sources, space separated (optional)
set -eu

RUNTIME_DIR=/tmp/mfqod
TEMPLATE_DIR=/etc/nginx/mfqod
mkdir -p "$RUNTIME_DIR"

API_URL="${API_URL:-${NEXT_PUBLIC_HOST_NAME:-http://localhost:8000}}"
while [ "${API_URL%/}" != "$API_URL" ]; do API_URL="${API_URL%/}"; done
MAP_TILES_URL="${MAP_TILES_URL:-/map/oman.pmtiles}"
MAP_TILES_TYPE="${MAP_TILES_TYPE:-pmtiles}"
MAP_ATTRIBUTION="${MAP_ATTRIBUTION:-© OpenStreetMap contributors · Protomaps}"
SHOW_EXTERNAL_MAP_LINKS="${SHOW_EXTERNAL_MAP_LINKS:-false}"

case "$MAP_TILES_TYPE" in
  pmtiles|xyz|none) ;;
  *) echo "mfqod: invalid MAP_TILES_TYPE '$MAP_TILES_TYPE', using 'pmtiles'" >&2; MAP_TILES_TYPE=pmtiles ;;
esac
case "$(printf '%s' "$SHOW_EXTERNAL_MAP_LINKS" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes|on) SHOW_EXTERNAL_MAP_LINKS=true ;;
  *) SHOW_EXTERNAL_MAP_LINKS=false ;;
esac

# Escape a value for a single-quoted JavaScript string literal (one line).
js_str() {
  printf '%s' "$1" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g" -e 's#</#<\\/#g'
}

# scheme://host[:port] of an absolute URL, empty for relative URLs. "{s}" (XYZ subdomain) -> "*".
origin_of() {
  printf '%s' "$1" | sed -n -E 's|^(https?://[^/?#]+).*|\1|p' | sed 's/{s}/*/g' | tr -cd 'A-Za-z0-9.:/*-'
}

# Keep CSP source lists safe inside the nginx config (no quotes, semicolons, $ or newlines).
csp_clean() {
  printf '%s' "$1" | tr '\r\n\t' '   ' | tr -cd "A-Za-z0-9.:/*_' -"
}

API_ORIGIN="$(origin_of "$API_URL")"
MAP_ORIGIN="$(origin_of "$MAP_TILES_URL")"

CSP_IMG_SRC=""
CSP_CONNECT_SRC=""
if [ -n "$API_ORIGIN" ]; then
  CSP_IMG_SRC=" $API_ORIGIN"
  CSP_CONNECT_SRC=" $API_ORIGIN"
fi
if [ -n "$MAP_ORIGIN" ] && [ "$MAP_ORIGIN" != "$API_ORIGIN" ]; then
  case "$MAP_TILES_TYPE" in
    xyz) CSP_IMG_SRC="$CSP_IMG_SRC $MAP_ORIGIN" ;;
    pmtiles) CSP_CONNECT_SRC="$CSP_CONNECT_SRC $MAP_ORIGIN" ;;
  esac
fi
if [ -n "${CSP_EXTRA_IMG_SRC:-}" ]; then CSP_IMG_SRC="$CSP_IMG_SRC $(csp_clean "$CSP_EXTRA_IMG_SRC")"; fi
if [ -n "${CSP_EXTRA_CONNECT_SRC:-}" ]; then CSP_CONNECT_SRC="$CSP_CONNECT_SRC $(csp_clean "$CSP_EXTRA_CONNECT_SRC")"; fi
export CSP_IMG_SRC CSP_CONNECT_SRC

cat > "$RUNTIME_DIR/config.js" <<EOF
// Generated at container start from environment variables (frontend/docker-entrypoint.sh). Do not edit.
window.__APP_CONFIG__ = {
  API_URL: '$(js_str "$API_URL")',
  MAP_TILES_URL: '$(js_str "$MAP_TILES_URL")',
  MAP_TILES_TYPE: '$(js_str "$MAP_TILES_TYPE")',
  MAP_ATTRIBUTION: '$(js_str "$MAP_ATTRIBUTION")',
  SHOW_EXTERNAL_MAP_LINKS: $SHOW_EXTERNAL_MAP_LINKS,
};
EOF

# Only the listed placeholders are substituted; nginx's own $variables are left alone.
envsubst '${CSP_IMG_SRC} ${CSP_CONNECT_SRC}' < "$TEMPLATE_DIR/security-headers.conf.template" > "$RUNTIME_DIR/security-headers.conf"
envsubst '${CSP_IMG_SRC} ${CSP_CONNECT_SRC}' < "$TEMPLATE_DIR/default.conf.template" > "$RUNTIME_DIR/default.conf"

echo "mfqod-frontend: API_URL=$API_URL MAP_TILES_TYPE=$MAP_TILES_TYPE MAP_TILES_URL=$MAP_TILES_URL SHOW_EXTERNAL_MAP_LINKS=$SHOW_EXTERNAL_MAP_LINKS"
if [ "$MAP_TILES_TYPE" = pmtiles ] && [ -z "$MAP_ORIGIN" ]; then
  tiles_file="/usr/share/nginx/html/${MAP_TILES_URL#/}"
  [ -f "$tiles_file" ] || echo "mfqod: WARNING map tiles not found at $tiles_file (mount ./storage/map). The branch map will have no base map." >&2
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec nginx -e /dev/stderr -g 'daemon off;'
