# Storage Guide

This document describes how file storage (uploaded images) is set up in the application: directory layout, backend configuration, Docker volumes, and how to change or move the storage location.

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Backend Configuration](#backend-configuration)
4. [Docker Setup](#docker-setup)
5. [Creating Directories and Permissions](#creating-directories-and-permissions)
6. [How Uploads Work](#how-uploads-work)
7. [Changing the Storage Location](#changing-the-storage-location)
8. [Backups and Git](#backups-and-git)
9. [Troubleshooting](#troubleshooting)

---

## Overview

- **Purpose:** The storage folder holds all uploaded files: **item images** (photos for lost/found items) and **item-type images** (icons/images for item types).
- **Who uses it:** The **backend** (FastAPI) is responsible for writing and serving these files. The frontend only sends uploads to the API and displays image URLs.
- **Persistence:** When running with Docker, the storage directory on the host is mounted into the backend container so uploads survive container restarts and rebuilds.

---

## Directory Structure

### On the host (your machine)

By default, storage lives at the **project root**:

```
<project-root>/
  storage/
    uploads/
      images/              # Item images (lost/found)
      itemTypesImages/     # Item type images
  backend/
  frontend/
  docker-compose.yml
```

### Inside the backend container (Docker)

The backend runs with working directory `/app`. The code uses paths relative to the backend:

- `../storage/uploads/images` → resolves to **`/storage/uploads/images`** when the host folder is mounted at `/storage`.
- `../storage/uploads/itemTypesImages` → **`/storage/uploads/itemTypesImages`**.

So in the container, **`/storage`** is the root of the uploaded files (backed by the host `./storage` via the volume mount).

---

## Backend Configuration

Storage paths are defined in **one place** so they work regardless of how the app is run (project root, `backend/`, or Docker).

- **`backend/app/config/storage_config.py`**  
  Sets `STORAGE_BASE` from the env var `STORAGE_BASE` if present (e.g. in Docker: `/storage`), otherwise `project_root/storage` (project root is derived from the config file’s location).  
  Then: `UPLOAD_DIR = STORAGE_BASE/uploads/images`, `ITEM_TYPES_IMAGES_DIR = STORAGE_BASE/uploads/itemTypesImages`.

| Path constant              | When `STORAGE_BASE` not set       | When `STORAGE_BASE=/storage` (Docker) |
|---------------------------|------------------------------------|--------------------------------------|
| `UPLOAD_DIR`              | `<project_root>/storage/uploads/images` | `/storage/uploads/images`           |
| `ITEM_TYPES_IMAGES_DIR`   | `<project_root>/storage/uploads/itemTypesImages` | `/storage/uploads/itemTypesImages` |

### Files that use these paths

| File | Usage |
|------|--------|
| `backend/app/main.py` | Imports paths, creates directories, mounts FastAPI static file routes. |
| `backend/app/routes/imageRoutes.py` | `UPLOAD_DIR` — upload and serve item images. |
| `backend/app/routes/itemTypeRoutes.py` | `ITEM_TYPES_IMAGES_DIR` — upload and serve item type images. |
| `backend/app/routes/claimRoutes.py` | `UPLOAD_DIR` — claim-related image handling. |
| `backend/app/services/itemService.py` | `UPLOAD_DIR` — delete image files when items are removed. |
| `backend/app/services/itemTypeService.py` | `ITEM_TYPES_IMAGES_DIR` — resolve item type image paths. |

### Static URL routes

The backend serves uploaded files at:

- **Item images:** `/static/images/<filename>`
- **Item type images:** `/static/item-types-images/<filename>`

These are mounted in `main.py` from `UPLOAD_DIR` and `ITEM_TYPES_IMAGES_DIR` respectively.

---

## Docker Setup

### Volume mount (docker-compose.yml)

```yaml
backend:
  volumes:
    - ./storage:/storage:rw
```

- **Left side (`./storage`):** Path on the host (project root). Change this if you move the folder (e.g. `./frontend/storage`).
- **Right side (`/storage`):** Path inside the container. The backend is configured with `STORAGE_BASE=/storage` so uploads use this mount.

### Dockerfile (backend)

The backend Dockerfile creates the directories inside the image so the app can run even without a mount:

```dockerfile
RUN mkdir -p /storage/uploads/images \
    /storage/uploads/itemTypesImages \
    ...
```

If you change the container path (e.g. to `/data/uploads`), update this `RUN` and all backend path definitions to match.

---

## Creating Directories and Permissions

Before first run (or after moving storage), create the directories and set permissions:

```bash
# From project root
mkdir -p storage/uploads/images storage/uploads/itemTypesImages backend/logs
chmod -R 755 storage backend/logs
```

If you run into permission errors (e.g. backend cannot write):

```bash
sudo chown -R $(id -u):$(id -g) storage backend/logs
```

---

## How Uploads Work

1. **Item images:** Users upload photos when reporting or editing items. The frontend sends files to the backend API; the backend saves them under `UPLOAD_DIR` and stores the file path/URL in the database. Images are served at `/static/images/...`.
2. **Item type images:** Admins upload images for item types. The backend saves them under `ITEM_TYPES_IMAGES_DIR` and serves them at `/static/item-types-images/...`.
3. **Deletion:** When an item is deleted, the backend (e.g. `itemService.py`) can remove the corresponding file(s) from `UPLOAD_DIR`.

The frontend never writes directly to the storage folder; it only talks to the backend API.

---

## Changing the Storage Location

If you want to move the storage folder (e.g. under `frontend/` or to another path), update the following.

### 1. Docker

- **docker-compose.yml:** Change the volume host path, e.g.  
  `./frontend/storage:/storage:rw`
- **backend/Dockerfile:** If you change the path inside the container, update the `RUN mkdir -p ...` to create the new path.

### 2. Backend code (only if container path changes)

If the path inside the container is no longer `/storage`, update every file that uses the storage paths so they all use the same base (see [Backend Configuration](#backend-configuration)). Consider centralizing the base path in one place (e.g. a single constant or environment variable) to avoid inconsistencies.

### 3. Project and docs

- **.gitignore:** Update the ignored path if the folder moves (e.g. `frontend/storage/`).
- **docs/docker.md** and **DOCKER.md:** Update any `mkdir` and path examples.
- **docs/installation-production.md:** Update backup checklist paths if needed.

### Keeping backend paths unchanged

If you only move the folder on the **host** (e.g. to `frontend/storage`) but keep mounting it at **`/storage`** in the container, you do **not** need to change any backend code—only the volume in `docker-compose.yml`, plus `.gitignore` and documentation.

---

## Backups and Git

- **Backups:** Include `storage/uploads/` (or your chosen storage path) in your backup strategy. See `docs/installation-production.md` for a production checklist.
- **Git:** The `storage/` directory is listed in `.gitignore`, so uploaded files are not committed. Only the directory structure and this configuration are tracked.

---

## Troubleshooting

### Uploads fail or “Permission denied”

- Ensure the storage directories exist and the backend process (or container user) can write to them.
- Run the `chown` command from [Creating Directories and Permissions](#creating-directories-and-permissions) if the backend runs as a different user.

### Images not found (404) after upload

- Confirm the backend is serving static files: check that `main.py` mounts `UPLOAD_DIR` and `ITEM_TYPES_IMAGES_DIR` at `/static/images` and `/static/item-types-images`.
- In Docker, confirm the volume mount is correct: `docker compose exec backend ls -la /storage/uploads/images`.

### Uploads disappear after container restart

- If you did not mount a host directory to `/storage`, the container filesystem is ephemeral. Add (or fix) the volume in `docker-compose.yml`:  
  `./storage:/storage:rw`  
  and create `./storage/uploads/images` and `./storage/uploads/itemTypesImages` on the host.

### Moving storage and something still points to the old path

- Search the repo for `storage`, `UPLOAD_DIR`, and `ITEM_TYPES_IMAGES_DIR` and update every occurrence to the new base path (see [Backend Configuration](#backend-configuration) and [Changing the Storage Location](#changing-the-storage-location)).
