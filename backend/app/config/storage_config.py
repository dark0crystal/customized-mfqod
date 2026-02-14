"""
Storage path configuration for uploaded files.
Paths are resolved in a cwd-independent way so uploads work whether the app
is run from project root, backend/, or inside Docker with a mounted volume.
"""
import os

# When set (e.g. in Docker to /storage), use this as the storage root.
# Otherwise use project_root/storage, with project root derived from this file's location.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))  # backend/app/config
_APP_DIR = os.path.dirname(_THIS_DIR)                     # backend/app
_BACKEND_DIR = os.path.dirname(_APP_DIR)                  # backend
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)            # project root

STORAGE_BASE = os.environ.get(
    "STORAGE_BASE",
    os.path.join(_PROJECT_ROOT, "storage"),
)
UPLOAD_DIR = os.path.join(STORAGE_BASE, "uploads", "images")
ITEM_TYPES_IMAGES_DIR = os.path.join(STORAGE_BASE, "uploads", "itemTypesImages")
