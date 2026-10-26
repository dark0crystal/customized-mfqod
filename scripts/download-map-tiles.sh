#!/usr/bin/env bash
# Download the offline base map for the branch map (Protomaps OpenStreetMap basemap, vector tiles).
#
# Run on a machine WITH internet access, then copy storage/map/oman.pmtiles to the offline server
# (same path, next to docker-compose.yml). The frontend container serves it from /map/oman.pmtiles.
#
# Why Protomaps and not tile.openstreetmap.org: the OSM tile usage policy forbids bulk-downloading
# their tiles. Protomaps publishes daily OSM builds as one .pmtiles file that may be extracted.
# Map data © OpenStreetMap contributors (ODbL), basemap by Protomaps.
#
# Usage:
#   scripts/download-map-tiles.sh [BUILD_DATE] [BBOX] [MAXZOOM]
#     BUILD_DATE  YYYYMMDD of a daily build listed at https://maps.protomaps.com/builds/
#                 (default: yesterday, falling back up to 7 days)
#     BBOX        minLon,minLat,maxLon,maxLat (default: Oman 51.9,16.6,59.9,26.5)
#     MAXZOOM     highest zoom level to include (default 15; ~165 MB for Oman.
#                 14 or 13 make the file several times smaller with less street detail)
#
#   Empty arguments mean "use the default"; BUILD_DATE, BBOX and MAXZOOM may also be set as
#   environment variables (positional arguments win).
#   Environment: OUTPUT (default storage/map/oman.pmtiles), PMTILES_VERSION (default 1.31.2),
#                PMTILES_BIN (use an already installed pmtiles CLI instead of downloading one)
#
# Example:
#   scripts/download-map-tiles.sh 20261025 51.9,16.6,59.9,26.5 15
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DATE="${1:-${BUILD_DATE:-}}"
BBOX="${2:-${BBOX:-51.9,16.6,59.9,26.5}}"
MAXZOOM="${3:-${MAXZOOM:-15}}"
OUTPUT="${OUTPUT:-$ROOT_DIR/storage/map/oman.pmtiles}"
PMTILES_VERSION="${PMTILES_VERSION:-1.31.2}"
MAX_SIZE_MB="${MAX_SIZE_MB:-400}"

die() { echo "error: $*" >&2; exit 1; }
command -v curl >/dev/null || die "curl is required"

if ! [[ "$BBOX" =~ ^-?[0-9.]+,-?[0-9.]+,-?[0-9.]+,-?[0-9.]+$ ]]; then die "BBOX must be minLon,minLat,maxLon,maxLat"; fi
if ! [[ "$MAXZOOM" =~ ^[0-9]+$ ]] || (( MAXZOOM > 15 )); then die "MAXZOOM must be 0-15"; fi

# ---- pmtiles CLI (https://github.com/protomaps/go-pmtiles) in a temporary directory
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

if [[ -n "${PMTILES_BIN:-}" ]]; then
  PMTILES="$PMTILES_BIN"
elif command -v pmtiles >/dev/null; then
  PMTILES="$(command -v pmtiles)"
else
  case "$(uname -s)" in
    Linux) OS=Linux ;;
    Darwin) OS=Darwin ;;
    *) die "unsupported OS $(uname -s); install the pmtiles CLI and set PMTILES_BIN" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) ARCH=x86_64 ;;
    arm64|aarch64) ARCH=arm64 ;;
    *) die "unsupported CPU $(uname -m); install the pmtiles CLI and set PMTILES_BIN" ;;
  esac
  # Release asset names: go-pmtiles-<v>_Darwin_<arch>.zip, go-pmtiles_<v>_Linux_<arch>.tar.gz
  if [[ "$OS" == Darwin ]]; then
    ASSET="go-pmtiles-${PMTILES_VERSION}_${OS}_${ARCH}.zip"; EXT=zip
  else
    ASSET="go-pmtiles_${PMTILES_VERSION}_${OS}_${ARCH}.tar.gz"; EXT=tar.gz
  fi
  echo "==> Downloading pmtiles CLI ${PMTILES_VERSION} (${OS}/${ARCH})"
  curl -fL --retry 3 -o "$WORK_DIR/$ASSET" \
    "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${ASSET}"
  mkdir -p "$WORK_DIR/bin"
  if [[ "$EXT" == zip ]]; then
    unzip -q -o "$WORK_DIR/$ASSET" -d "$WORK_DIR/bin"
  else
    tar -xzf "$WORK_DIR/$ASSET" -C "$WORK_DIR/bin"
  fi
  PMTILES="$WORK_DIR/bin/pmtiles"
  chmod +x "$PMTILES"
fi

# ---- pick a daily build
date_minus() { # $1 = days ago -> YYYYMMDD (GNU or BSD date)
  date -u -d "-$1 day" +%Y%m%d 2>/dev/null || date -u -v-"$1"d +%Y%m%d
}
if [[ -z "$BUILD_DATE" ]]; then
  for d in 1 2 3 4 5 6 7; do
    candidate="$(date_minus "$d")"
    if curl -fsI "https://build.protomaps.com/${candidate}.pmtiles" >/dev/null; then BUILD_DATE="$candidate"; break; fi
  done
  [[ -n "$BUILD_DATE" ]] || die "no Protomaps build found in the last 7 days; pass BUILD_DATE (see https://maps.protomaps.com/builds/)"
fi
[[ "$BUILD_DATE" =~ ^[0-9]{8}$ ]] || die "BUILD_DATE must be YYYYMMDD"
SOURCE="https://build.protomaps.com/${BUILD_DATE}.pmtiles"
curl -fsI "$SOURCE" >/dev/null || die "build not found: $SOURCE"

echo "==> Source:  $SOURCE"
echo "==> Area:    bbox=$BBOX maxzoom=$MAXZOOM"
echo "==> Output:  $OUTPUT"

# ---- dry run (size estimate) then extract (HTTP range requests; only the area is downloaded)
"$PMTILES" extract "$SOURCE" "$WORK_DIR/estimate.pmtiles" --bbox="$BBOX" --maxzoom="$MAXZOOM" --dry-run

mkdir -p "$(dirname "$OUTPUT")"
"$PMTILES" extract "$SOURCE" "$OUTPUT.part" --bbox="$BBOX" --maxzoom="$MAXZOOM"
"$PMTILES" verify "$OUTPUT.part"
mv -f "$OUTPUT.part" "$OUTPUT"

SIZE_MB=$(( $(wc -c < "$OUTPUT") / 1024 / 1024 ))
echo "==> Done: $OUTPUT (${SIZE_MB} MB)"
if (( SIZE_MB > MAX_SIZE_MB )); then
  echo "warning: larger than ${MAX_SIZE_MB} MB; consider a lower MAXZOOM (14 or 13)" >&2
fi
cat <<EOF

Next steps:
  - Docker:  the file is mounted by docker-compose.yml (./storage/map -> /usr/share/nginx/html/map).
             Copy storage/map/oman.pmtiles to the same path on the offline server.
  - Dev:     cp "$OUTPUT" frontend/public/map/oman.pmtiles   (git-ignored)
EOF
