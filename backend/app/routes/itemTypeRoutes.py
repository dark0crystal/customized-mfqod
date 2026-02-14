# from fastapi import APIRouter, Depends, HTTPException, status
# from sqlalchemy.orm import Session
# from db.database import get_session
# from services.itemTypeService import ItemTypeService
# from schemas.item_type_schema import (
#     CreateItemTypeRequest,
#     UpdateItemTypeRequest,
#     ItemTypeResponse
# )

# router = APIRouter()

# # =================
# # Add new item type
# # =================
# @router.post("/", response_model=ItemTypeResponse, status_code=status.HTTP_201_CREATED)
# def create_item_type(
#     payload: CreateItemTypeRequest,
#     db: Session = Depends(get_session)
# ):
#     try:
#         return ItemTypeService(db).create_item_type(payload)
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))

# # =================
# # list all item types
# # =================
# @router.get("/", response_model=list[ItemTypeResponse])
# def list_item_types(db: Session = Depends(get_session)):
#     return ItemTypeService(db).list_item_types()

# # =================
# # Get specific item type
# # =================
# @router.get("/{item_type_id}", response_model=ItemTypeResponse)
# def get_item_type(item_type_id: str, db: Session = Depends(get_session)):
#     try:
#         return ItemTypeService(db).get_item_type_by_id(item_type_id)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))

# # =================
# # Update item type
# # =================
# @router.put("/{item_type_id}", response_model=ItemTypeResponse)
# def update_item_type(item_type_id: str, data: UpdateItemTypeRequest, db: Session = Depends(get_session)):
#     try:
#         return ItemTypeService(db).update_item_type(item_type_id, data)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))

# # =================
# # Delete Item Type
# # =================
# @router.delete("/{item_type_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_item_type(item_type_id: str, db: Session = Depends(get_session)):
#     try:
#         ItemTypeService(db).delete_item_type(item_type_id)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))


from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.orm import Session
from app.db.database import get_session
from app.services.itemTypeService import ItemTypeService
from app.schemas.item_type_schema import (
    CreateItemTypeRequest,
    UpdateItemTypeRequest,
    ItemTypeResponse
)
from app.utils.permission_decorator import require_permission, require_any_permission, require_all_permissions
from app.middleware.auth_middleware import get_current_user_required
from app.middleware.rate_limit_decorator import rate_limit_public
import os
import uuid
import shutil
import logging
from pathlib import Path
from PIL import Image
import io
from typing import Optional
from datetime import datetime, timezone

router = APIRouter()

# Configuration for item type images (use shared storage config)
from app.config.storage_config import ITEM_TYPES_IMAGES_DIR
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

logger = logging.getLogger(__name__)

def create_item_types_images_directory():
    """Create item types images directory if it doesn't exist"""
    try:
        os.makedirs(ITEM_TYPES_IMAGES_DIR, exist_ok=True)
    except Exception as e:
        logger.error(f"Failed to create item types images directory: {e}")
        raise

def get_file_extension(filename: str) -> str:
    """Get the file extension from a filename"""
    if not filename or '.' not in filename:
        return ''
    return '.' + filename.rsplit('.', 1)[-1].lower()

def get_extension_from_format(format_name: str) -> str:
    """Map Pillow format name to a file extension"""
    mapping = {
        "jpeg": ".jpg",
        "jpg": ".jpg",
        "png": ".png",
        "gif": ".gif",
        "bmp": ".bmp",
        "webp": ".webp"
    }
    if not format_name:
        return ""
    return mapping.get(format_name.lower(), "")

def validate_image_with_pillow(file_content: bytes) -> tuple[bool, str]:
    """Validate image using Pillow (PIL) library"""
    try:
        image_stream = io.BytesIO(file_content)
        with Image.open(image_stream) as img:
            img.verify()
            format_name = img.format.lower() if img.format else None
            image_stream.seek(0)
            with Image.open(image_stream) as img2:
                width, height = img2.size
                if width <= 0 or height <= 0 or width > 20000 or height > 20000:
                    return False, "Invalid image dimensions"
                return True, format_name
    except Exception as e:
        logger.error(f"Image validation failed: {e}")
        return False, f"Image validation failed: {str(e)}"

def is_valid_image(file: UploadFile) -> tuple[bool, str, Optional[str]]:
    """Validate if the uploaded file is a valid image"""
    if not file.filename:
        return False, "No filename provided", None

    if file.content_type not in ALLOWED_MIME_TYPES:
        return False, f"Unsupported MIME type: {file.content_type}", None

    try:
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)
        if size > MAX_FILE_SIZE:
            return False, f"File too large: {size} bytes (max: {MAX_FILE_SIZE} bytes)", None
        if size == 0:
            return False, "Empty file", None
    except Exception as e:
        logger.error(f"Error checking file size: {e}")
        return False, f"Error checking file size: {str(e)}", None

    try:
        file.file.seek(0)
        file_content = file.file.read()
        file.file.seek(0)
        is_valid, format_or_error = validate_image_with_pillow(file_content)
        if not is_valid:
            return False, format_or_error, None
        return True, "Valid image", format_or_error
    except Exception as e:
        logger.error(f"Error reading file content: {e}")
        return False, f"Error reading file content: {str(e)}", None

def generate_unique_filename(original_filename: str, detected_format: Optional[str] = None) -> str:
    """Generate a unique filename with the correct extension"""
    if detected_format:
        ext = get_extension_from_format(detected_format)
    else:
        ext = get_file_extension(original_filename)
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{ext}"

# ================= 
# Add new item type
# ================= 
@router.post("/", response_model=ItemTypeResponse, status_code=status.HTTP_201_CREATED)
@require_permission("can_manage_item_types")
async def create_item_type(
    payload: CreateItemTypeRequest,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        return ItemTypeService(db).create_item_type(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ================= 
# Public endpoint for item types (no authentication required)
# ================= 
@router.get("/public", response_model=list[ItemTypeResponse])
@rate_limit_public()
async def get_public_item_types(
    request: Request,
    db: Session = Depends(get_session)
):
    """Get all item types for public viewing (no authentication required)"""
    try:
        return ItemTypeService(db).list_item_types()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving public item types: {str(e)}")

# ================= 
# List all item types (authenticated)
# ================= 
@router.get("/", response_model=list[ItemTypeResponse])
async def list_item_types(
    request: Request,
    db: Session = Depends(get_session),
    current_user = Depends(get_current_user_required)
):
    """
    List all item types
    Requires: Authentication (user must be logged in)
    """
    return ItemTypeService(db).list_item_types()

# ================= 
# Get specific item type
# ================= 
@router.get("/{item_type_id}", response_model=ItemTypeResponse)
async def get_item_type(
    item_type_id: str,
    request: Request,
    db: Session = Depends(get_session),
    current_user = Depends(get_current_user_required)
):
    """
    Get a specific item type by ID
    Requires: Authentication (user must be logged in)
    """
    try:
        return ItemTypeService(db).get_item_type_by_id(item_type_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ================= 
# Update item type
# ================= 
@router.put("/{item_type_id}", response_model=ItemTypeResponse)
@require_any_permission(["can_manage_item_types", "can_manage_item_types"])
async def update_item_type(
    item_type_id: str,
    data: UpdateItemTypeRequest,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        return ItemTypeService(db).update_item_type(item_type_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ================= 
# Delete Item Type
# ================= 
@router.delete("/{item_type_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_all_permissions(["can_manage_item_types", "can_manage_item_types"])
async def delete_item_type(
    item_type_id: str,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        ItemTypeService(db).delete_item_type(item_type_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ================= 
# Upload/Replace Image for Item Type
# ================= 
@router.post("/{item_type_id}/upload-image/", response_model=ItemTypeResponse)
@require_permission("can_manage_item_types")
async def upload_item_type_image(
    item_type_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_session)
):
    """Upload or replace image for an item type"""
    try:
        service = ItemTypeService(db)
        item_type = service.get_item_type_by_id(item_type_id)
        
        # Validate the image
        is_valid, error_message, detected_format = is_valid_image(file)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "INVALID_FILE",
                    "message": f"Invalid file: {error_message}",
                    "details": {
                        "supported_formats": ["JPG", "JPEG", "PNG", "GIF", "BMP", "WEBP"],
                        "max_size": "10MB",
                        "filename": file.filename
                    }
                }
            )
        
        create_item_types_images_directory()
        
        # Delete old image file if exists
        if item_type.image_url:
            old_image_path = item_type.image_url.replace("/static/item-types-images/", "")
            old_file_path = os.path.join(ITEM_TYPES_IMAGES_DIR, old_image_path)
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete old image file: {e}")
        
        # Generate unique filename and save file
        unique_filename = generate_unique_filename(file.filename, detected_format)
        file_path = os.path.join(ITEM_TYPES_IMAGES_DIR, unique_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                file.file.seek(0)
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "FILE_SAVE_FAILED",
                    "message": f"Failed to save file: {str(e)}",
                    "details": {"filename": file.filename}
                }
            )
        
        # Update item type with new image URL
        image_url = f"/static/item-types-images/{unique_filename}"
        item_type.image_url = image_url
        item_type.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(item_type)
        
        return item_type
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# ================= 
# Delete Image from Item Type
# ================= 
@router.delete("/{item_type_id}/image/", response_model=ItemTypeResponse)
@require_permission("can_manage_item_types")
async def delete_item_type_image(
    item_type_id: str,
    request: Request = None,
    db: Session = Depends(get_session)
):
    """Delete image from an item type"""
    try:
        service = ItemTypeService(db)
        item_type = service.get_item_type_by_id(item_type_id)
        
        if not item_type.image_url:
            raise HTTPException(status_code=404, detail="Item type has no image to delete")
        
        # Delete the image file
        image_path = item_type.image_url.replace("/static/item-types-images/", "")
        file_path = os.path.join(ITEM_TYPES_IMAGES_DIR, image_path)
        
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete image file: {e}")
        
        # Update item type to remove image URL
        item_type.image_url = None
        item_type.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(item_type)
        
        return item_type
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
