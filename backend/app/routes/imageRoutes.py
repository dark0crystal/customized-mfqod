import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from db.database import get_session
from schemas.image_schema import UploadImageRequest
from services.imageService import ImageService
import shutil
from pathlib import Path

router = APIRouter()

# Configuration
UPLOAD_DIR = "uploads/images"  # Change this to your desired directory
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def get_image_service(db: Session = Depends(get_session)) -> ImageService:
    return ImageService(db)

def create_upload_directory():
    """Create upload directory if it doesn't exist"""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

def is_valid_image(file: UploadFile) -> bool:
    """Validate if the uploaded file is a valid image"""
    if not file.filename:
        return False
    
    # Check file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        return False
    
    # Check file size
    if file.size and file.size > MAX_FILE_SIZE:
        return False
    
    return True

def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename to avoid conflicts"""
    file_extension = Path(original_filename).suffix.lower()
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{file_extension}"

@router.post("/images/attach/", response_model=dict)
async def attach_image(
    image_data: UploadImageRequest,
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    """
    Attach an image to an entity (e.g., item) by URL, imageable_type, and imageable_id.
    """
    try:
        image = image_service.upload_image(
            url=image_data.url,
            imageable_type=image_data.imageable_type,
            imageable_id=image_data.imageable_id
        )
        return {"id": image.id, "url": image.url, "imageable_type": image.imageable_type, "imageable_id": image.imageable_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/items/{item_id}/upload-image/")
async def upload_image_to_item(
    item_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    """
    Upload an image file to local directory and attach it to an item.
    This endpoint matches what your frontend is calling.
    """
    try:
        # Validate the uploaded file
        if not is_valid_image(file):
            raise HTTPException(
                status_code=400, 
                detail="Invalid file format or size. Supported formats: JPG, JPEG, PNG, GIF, BMP, WEBP. Max size: 10MB"
            )
        
        # Create upload directory if it doesn't exist
        create_upload_directory()
        
        # Generate unique filename
        unique_filename = generate_unique_filename(file.filename)
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save the file to local directory
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create the URL path (adjust based on how you serve static files)
        image_url = f"/static/images/{unique_filename}"  # Adjust this path as needed
        
        # Save image info to database
        image = image_service.upload_image(
            url=image_url,
            imageable_type="item",
            imageable_id=item_id
        )
        
        return {
            "id": image.id,
            "url": image.url,
            "imageable_type": image.imageable_type,
            "imageable_id": image.imageable_id,
            "file_path": file_path,
            "image_path": image_url,
            "filename": unique_filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file if database operation fails
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/upload-multiple-images/")
async def upload_multiple_images(
    imageable_type: str = Form(...),
    imageable_id: str = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    """
    Upload multiple image files at once.
    """
    if len(files) > 10:  # Limit number of files
        raise HTTPException(status_code=400, detail="Maximum 10 files allowed")
    
    uploaded_images = []
    uploaded_files = []  # Keep track for cleanup on error
    
    try:
        create_upload_directory()
        
        for file in files:
            # Validate each file
            if not is_valid_image(file):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid file: {file.filename}. Supported formats: JPG, JPEG, PNG, GIF, BMP, WEBP. Max size: 10MB"
                )
            
            # Generate unique filename and save
            unique_filename = generate_unique_filename(file.filename)
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uploaded_files.append(file_path)
            
            # Create URL and save to database
            image_url = f"/static/images/{unique_filename}"
            
            image = image_service.upload_image(
                url=image_url,
                imageable_type=imageable_type,
                imageable_id=imageable_id
            )
            
            uploaded_images.append({
                "id": image.id,
                "url": image.url,
                "filename": unique_filename,
                "original_filename": file.filename
            })
        
        return {
            "message": f"Successfully uploaded {len(uploaded_images)} images",
            "images": uploaded_images
        }
        
    except HTTPException:
        # Clean up uploaded files on error
        for file_path in uploaded_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        raise
    except Exception as e:
        # Clean up uploaded files on error
        for file_path in uploaded_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    db: Session = Depends(get_session),
    image_service: ImageService = Depends(get_image_service)
):
    """
    Delete an image from both database and file system.
    """
    try:
        # Get image info from database
        image = image_service.get_image_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Extract filename from URL and construct file path
        filename = os.path.basename(image.url)
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Delete from database first
        image_service.delete_image(image_id)
        
        # Delete file from file system
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return {"message": "Image deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")