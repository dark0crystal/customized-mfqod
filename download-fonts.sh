#!/bin/bash
# Download Google Fonts for offline use
# Run this script on the Linux server while internet is still available.
# Place the script in the project root and run: bash download-fonts.sh

set -e

FONT_DIR="./frontend/public/fonts"
mkdir -p "$FONT_DIR"

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo "==> Downloading Alexandria font (weights 100–900)..."
CSS=$(curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Alexandria:wght@100;200;300;400;500;600;700;800;900&display=swap")

for weight in 100 200 300 400 500 600 700 800 900; do
  URL=$(echo "$CSS" | awk "/font-weight: $weight/{found=1} found && /src:/{match(\$0,/https:\/\/[^)]+\.woff2/); if(RSTART){print substr(\$0,RSTART,RLENGTH); found=0}}")
  if [ -n "$URL" ]; then
    curl -s -o "$FONT_DIR/alexandria-$weight.woff2" "$URL"
    echo "  ✓ alexandria-$weight.woff2"
  else
    echo "  ✗ Could not find URL for alexandria-$weight (trying fallback)..."
    # Fallback: try to grab by order in the CSS
  fi
done

echo ""
echo "==> Downloading Lalezar font (weight 400)..."
CSS=$(curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Lalezar&display=swap")
URL=$(echo "$CSS" | awk '/src:/{match($0,/https:\/\/[^)]+\.woff2/); if(RSTART){print substr($0,RSTART,RLENGTH); exit}}')
if [ -n "$URL" ]; then
  curl -s -o "$FONT_DIR/lalezar-400.woff2" "$URL"
  echo "  ✓ lalezar-400.woff2"
else
  echo "  ✗ Could not download Lalezar — check internet connection"
  exit 1
fi

echo ""
echo "==> Verifying downloaded files..."
MISSING=0
for weight in 100 200 300 400 500 600 700 800 900; do
  FILE="$FONT_DIR/alexandria-$weight.woff2"
  if [ -f "$FILE" ] && [ -s "$FILE" ]; then
    echo "  ✓ alexandria-$weight.woff2 ($(du -h "$FILE" | cut -f1))"
  else
    echo "  ✗ MISSING: alexandria-$weight.woff2"
    MISSING=$((MISSING + 1))
  fi
done

FILE="$FONT_DIR/lalezar-400.woff2"
if [ -f "$FILE" ] && [ -s "$FILE" ]; then
  echo "  ✓ lalezar-400.woff2 ($(du -h "$FILE" | cut -f1))"
else
  echo "  ✗ MISSING: lalezar-400.woff2"
  MISSING=$((MISSING + 1))
fi

echo ""
if [ "$MISSING" -eq 0 ]; then
  echo "All fonts downloaded successfully to $FONT_DIR"
  echo "You can now build the app offline with: docker compose build"
else
  echo "WARNING: $MISSING font(s) failed to download. Re-run the script or download them manually."
  exit 1
fi
