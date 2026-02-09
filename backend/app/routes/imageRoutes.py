import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from app.db.database import get_session
from app.utils.permission_decorator import extract_user_from_token
from app.schemas.image_schema import UploadImageRequest
from app.services.imageService import ImageService
from app.middleware.auth_middleware import get_current_user_required
from app.models import User
from app.utils.permission_decorator import require_permission
import shutil
from pathlib import Path
from PIL import Image
import io
import logging
from fastapi.responses import FileResponse
from typing import Optional

router = APIRouter()

# Configuration
UPLOAD_DIR = "../storage/uploads/images"  # Relative to backend directory
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp"
}

# List of dangerous extensions to block, even if double extension (e.g. .jpg.exe)
DANGEROUS_EXTENSIONS = {
    ".exe", ".bat", ".sh", ".php", ".js", ".py", ".pl", ".rb", ".jar", ".msi", 
    ".vbs", ".scr", ".pif", ".cpl", ".cmd", ".com", ".dll", ".asp", ".aspx", 
    ".jsp", ".html", ".htm", ".svg"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def get_image_service(db: Session = Depends(get_session)) -> ImageService:
    return ImageService(db)

def create_upload_directory():
    """Create upload directory if it doesn't exist"""
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    except Exception as e:
        logging.error(f"Failed to create upload directory: {e}")
        raise

def get_file_extension(filename: str) -> str:
    """
    Get the file extension from a filename, even if there are multiple dots.
    Returns the extension with the leading dot, in lowercase.
    """
    if not filename or '.' not in filename:
        return ''
    return '.' + filename.rsplit('.', 1)[-1].lower()

def get_extension_from_format(format_name: str) -> str:
    """
    Map Pillow format name to a file extension.
    """
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

def has_dangerous_extension(filename: str) -> bool:
    """
    Check if the filename contains any dangerous extension, even as a double extension.
    For example, 'image.jpg.exe' or 'photo.png.sh' should be blocked.
    """
    lower_filename = filename.lower()
    parts = lower_filename.split('.')
    if len(parts) < 2:
        return False
    for ext in parts[1:]:
        if f".{ext}" in DANGEROUS_EXTENSIONS:
            return True
    print("not allooooowoo--------exten")
    return False

def validate_image_with_pillow(file_content: bytes) -> tuple[bool, str]:
    """
    Validate image using Pillow (PIL) library.
    Returns (is_valid, format_name)
    """
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
        logging.error(f"Image validation failed: {e}")
        return False, f"Image validation failed: {str(e)}"

def is_valid_image(file: UploadFile) -> tuple[bool, str, Optional[str]]:
    """
    Validate if the uploaded file is a valid image and not a disguised malware.
    Returns (is_valid, error_message, detected_format)
    """
    if not file.filename:
        return False, "No filename provided", None

    if has_dangerous_extension(file.filename):
        return False, f"Dangerous extension detected in filename: {file.filename}", None

    # Do NOT check file extension

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
        logging.error(f"Error checking file size: {e}")
        return False, f"Error checking file size: {str(e)}", None

    try:
        file.file.seek(0)
        file_content = file.file.read()
        file.file.seek(0)
        is_valid, format_or_error = validate_image_with_pillow(file_content)
        if not is_valid:
            return False, format_or_error, None
        # format_or_error is the format name
        return True, "Valid image", format_or_error
    except Exception as e:
        logging.error(f"Error reading file content: {e}")
        return False, f"Error reading file content: {str(e)}", None

def generate_unique_filename(original_filename: str, detected_format: Optional[str] = None) -> str:
    """
    Generate a unique filename with the correct extension.
    If detected_format is provided, use its extension; otherwise, use the original filename's extension.
    """
    if detected_format:
        ext = get_extension_from_format(detected_format)
    else:
        ext = get_file_extension(original_filename)
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{ext}"

@router.get("/{filename}")
async def serve_image(filename: str):
    """Serve images from uploads directory"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(file_path)

@router.get("/items/{item_id}/images/")
async def get_item_images(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    """Get images for an item, filtering hidden images based on user permissions"""
    # Try to get current user if authenticated
    user: Optional[User] = None
    try:
        user_id = extract_user_from_token(request)
        if user_id:
            from app.models import User
            user = db.query(User).filter(User.id == user_id).first()
    except:
        # User not authenticated, will get only non-hidden images
        pass
    
    images = image_service.get_images_by_item_id(item_id, user=user)
    return images

@router.post("/images/attach/", response_model=dict)
async def attach_image(
    image_data: UploadImageRequest,
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    try:
        image = image_service.upload_image(
            url=image_data.url,
            imageable_type=image_data.imageable_type,
            imageable_id=image_data.imageable_id
        )
        return {"id": image.id, "url": image.url, "imageable_type": image.imageable_type, "imageable_id": image.imageable_id}
    except Exception as e:
        logging.error(f"Attach image failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/items/{item_id}/upload-image/")
async def upload_image_to_item(
    item_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    try:
        # Authenticate user
        user_id = extract_user_from_token(request)
        
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

        create_upload_directory()

        unique_filename = generate_unique_filename(file.filename, detected_format)
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        try:
            with open(file_path, "wb") as buffer:
                file.file.seek(0)
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logging.error(f"Failed to save file: {e}")
            raise HTTPException(
                status_code=500, 
                detail={
                    "error": "FILE_SAVE_FAILED",
                    "message": f"Failed to save file: {str(e)}",
                    "details": {"filename": file.filename}
                }
            )

        image_url = f"/static/images/{unique_filename}"  # URL path matching static file serving

        try:
            image = image_service.upload_image(
                url=image_url,
                imageable_type="item",
                imageable_id=item_id
            )
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logging.error(f"Database operation failed: {e}")
            raise HTTPException(
                status_code=500, 
                detail={
                    "error": "DATABASE_ERROR",
                    "message": f"Database operation failed: {str(e)}",
                    "details": {"filename": file.filename, "item_id": item_id}
                }
            )

        return {
            "success": True,
            "message": "Image uploaded successfully",
            "data": {
                "id": image.id,
                "url": image.url,
                "imageable_type": image.imageable_type,
                "imageable_id": image.imageable_id,
                "filename": unique_filename,
                "original_filename": file.filename,
                "file_size": os.path.getsize(file_path),
                "detected_format": detected_format
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        logging.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/upload-multiple-images/")
async def upload_multiple_images(
    request: Request,
    imageable_type: str = Form(...),
    imageable_id: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    try:
        # Authenticate user
        user_id = extract_user_from_token(request)
        
        if len(files) > 10:
            raise HTTPException(
                status_code=400, 
                detail={
                    "error": "TOO_MANY_FILES",
                    "message": "Maximum 10 files allowed",
                    "details": {"file_count": len(files), "max_allowed": 10}
                }
            )

        uploaded_images = []
        uploaded_files = []

        create_upload_directory()

        for file in files:
            is_valid, error_message, detected_format = is_valid_image(file)
            if not is_valid:
                # Clean up already uploaded files before raising
                for file_path in uploaded_files:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "INVALID_FILE",
                        "message": f"Invalid file '{file.filename}': {error_message}",
                        "details": {
                            "filename": file.filename,
                            "supported_formats": ["JPG", "JPEG", "PNG", "GIF", "BMP", "WEBP"],
                            "max_size": "10MB"
                        }
                    }
                )

            unique_filename = generate_unique_filename(file.filename, detected_format)
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            try:
                with open(file_path, "wb") as buffer:
                    file.file.seek(0)
                    shutil.copyfileobj(file.file, buffer)
            except Exception as e:
                logging.error(f"Failed to save file '{file.filename}': {e}")
                # Clean up already uploaded files
                for fp in uploaded_files:
                    if os.path.exists(fp):
                        os.remove(fp)
                raise HTTPException(status_code=500, detail=f"Failed to save file '{file.filename}': {str(e)}")

            uploaded_files.append(file_path)

            image_url = f"/static/images/{unique_filename}"  # URL path matching static file serving

            try:
                image = image_service.upload_image(
                    url=image_url,
                    imageable_type=imageable_type,
                    imageable_id=imageable_id
                )
            except Exception as e:
                logging.error(f"Database operation failed for '{file.filename}': {e}")
                # Clean up all uploaded files
                for fp in uploaded_files:
                    if os.path.exists(fp):
                        os.remove(fp)
                raise HTTPException(status_code=500, detail=f"Database operation failed for '{file.filename}': {str(e)}")

            uploaded_images.append({
                "id": image.id,
                "url": image.url,
                "filename": unique_filename,
                "original_filename": file.filename
            })

        return {
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_images)} images",
            "data": {
                "uploaded_count": len(uploaded_images),
                "total_files": len(files),
                "images": uploaded_images
            }
        }

    except HTTPException:
        for file_path in uploaded_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        raise
    except Exception as e:
        for file_path in uploaded_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        logging.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/{image_id}")
async def delete_image(
    image_id: str,
    request: Request,
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    try:
        # Authenticate user
        user_id = extract_user_from_token(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        image = image_service.get_image_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        filename = os.path.basename(image.url)
        file_path = os.path.join(UPLOAD_DIR, filename)

        try:
            image_service.delete_image(image_id)
        except Exception as e:
            logging.error(f"Failed to delete image from database: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete image from database: {str(e)}")

        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logging.error(f"Failed to delete image file: {e}")
            # Don't raise here, just log

        return {"message": "Image deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

