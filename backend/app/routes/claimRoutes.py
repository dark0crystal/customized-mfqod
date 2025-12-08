"""
Claim Routes

API endpoints for managing item claims including creation, approval, and management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_session
from app.schemas.claim_schema import (
    ClaimCreate, ClaimUpdate, ClaimResponse, 
    ClaimWithDetails, ClaimWithImages, ClaimStatusUpdate
)
from app.services.claimService import ClaimService
from app.middleware.auth_middleware import get_current_user_required
from app.utils.permission_decorator import require_permission
from app.models import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================== 
# Dependency Injection
# ===========================

def get_claim_service(db: Session = Depends(get_session)) -> ClaimService:
    return ClaimService(db)


# =========================== 
# Claim Routes
# ===========================

@router.post("/", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    claim: ClaimCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Create a new claim for an item"""
    try:
        new_claim = claim_service.create_claim(claim, current_user.id)
        
        # Send notification email to item owner (if different from claimant)
        try:
            from app.services.notification_service import send_item_found_notification
            if new_claim.item and new_claim.item.user and new_claim.item.user.id != current_user.id:
                background_tasks.add_task(
                    send_item_found_notification,
                    user_email=new_claim.item.user.email,
                    user_name=f"{new_claim.item.user.first_name} {new_claim.item.user.last_name}".strip(),
                    item_title=new_claim.item.title,
                    item_url=f"/find/{new_claim.item.id}"
                )
        except Exception as e:
            logger.warning(f"Failed to send notification email: {e}")
        
        return new_claim
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating claim: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating claim: {str(e)}")


@router.get("/", response_model=List[ClaimResponse])
async def get_claims(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    item_id: Optional[str] = Query(None, description="Filter by item ID"),
    approved_only: Optional[bool] = Query(None, description="Filter by approval status"),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get claims with optional filtering"""
    try:
        # Regular users can only see their own claims unless querying for a specific item
        user_id = current_user.id if item_id is None else None
        
        claims = claim_service.get_claims(
            skip=skip, 
            limit=limit, 
            user_id=user_id,
            item_id=item_id,
            approved_only=approved_only
        )
        return claims
        
    except Exception as e:
        logger.error(f"Error retrieving claims: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving claims: {str(e)}")


@router.get("/all", response_model=List[ClaimResponse])
@require_permission("admin")
async def get_all_claims(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    approved_only: Optional[bool] = Query(None, description="Filter by approval status"),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get all claims (admin only)"""
    try:
        claims = claim_service.get_claims(
            skip=skip, 
            limit=limit,
            approved_only=approved_only
        )
        return claims
        
    except Exception as e:
        logger.error(f"Error retrieving all claims: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving claims: {str(e)}")


@router.get("/my-claims", response_model=List[ClaimResponse])
async def get_my_claims(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get current user's claims"""
    try:
        claims = claim_service.get_user_claims(current_user.id, skip=skip, limit=limit)
        return claims
        
    except Exception as e:
        logger.error(f"Error retrieving user claims: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving user claims: {str(e)}")


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get a specific claim by ID"""
    try:
        claim = claim_service.get_claim_by_id(claim_id)
        
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found"
            )
        
        # Users can only view their own claims or claims on their items
        if (claim.user_id != current_user.id and 
            (not claim.item or claim.item.user_id != current_user.id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Convert to ClaimResponse for safe serialization
        return claim_service.claim_to_response(claim)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving claim: {str(e)}")


@router.put("/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: str,
    claim_update: ClaimUpdate,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Update a claim"""
    try:
        updated_claim = claim_service.update_claim(claim_id, claim_update, current_user.id)
        return updated_claim
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating claim: {str(e)}")


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_claim(
    claim_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Delete a claim"""
    try:
        claim_service.delete_claim(claim_id, current_user.id)
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting claim: {str(e)}")


# =========================== 
# Claim Management Routes (Admin)
# ===========================

@router.patch("/{claim_id}/approve", response_model=ClaimResponse)
@require_permission("admin")
async def approve_claim(
    claim_id: str,
    status_update: ClaimStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Approve a claim with optional custom message (admin only)"""
    try:
        approved_claim = claim_service.approve_claim(
            claim_id, 
            custom_title=status_update.custom_title,
            custom_description=status_update.custom_description
        )
        
        return approved_claim
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error approving claim: {str(e)}")


@router.patch("/{claim_id}/reject", response_model=ClaimResponse)
@require_permission("admin")
async def reject_claim(
    claim_id: str,
    status_update: ClaimStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Reject a claim with optional custom message (admin only)"""
    try:
        rejected_claim = claim_service.reject_claim(
            claim_id,
            custom_title=status_update.custom_title,
            custom_description=status_update.custom_description
        )
        return rejected_claim
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error rejecting claim: {str(e)}")


# =========================== 
# Statistics Routes
# ===========================

@router.get("/stats/summary")
@require_permission("admin")
async def get_claims_stats(
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get claims statistics (admin only)"""
    try:
        stats = claim_service.get_claims_statistics()
        return stats
        
    except Exception as e:
        logger.error(f"Error retrieving claims statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")


# =========================== 
# Item-specific Claim Routes
# ===========================

@router.get("/item/{item_id}", response_model=List[ClaimWithDetails])
async def get_item_claims(
    item_id: str,
    request: Request,
    approved_only: Optional[bool] = Query(None, description="Filter by approval status"),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get all claims for a specific item with user and item details"""
    try:
        # Check if user has permission to view claims for this item
        # (item owner or admin can see all claims, others can only see approved claims)
        from app.services.itemService import ItemService
        item_service = ItemService(db)
        item = item_service.get_item_by_id(item_id)
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        
        # If user is not the item owner, they can only see approved claims
        if item.user_id != current_user.id and approved_only is None:
            approved_only = True
        
        claims = claim_service.get_item_claims_with_details(item_id, approved_only=approved_only)
        return claims
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving claims for item {item_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving item claims: {str(e)}")


# =========================== 
# Claim Image Upload Routes
# ===========================

@router.post("/{claim_id}/upload-image/")
async def upload_image_to_claim(
    claim_id: str,
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Upload an image to a specific claim"""
    try:
        # Verify claim exists and user has permission
        claim = claim_service.get_claim_by_id(claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")
        
        # Only claim owner can upload images to their claim
        if claim.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Use image service to handle the upload
        from app.services.imageService import ImageService
        image_service = ImageService(db)
        
        # Import image validation functions from imageRoutes
        import os
        import uuid
        import shutil
        from app.routes.imageRoutes import is_valid_image, generate_unique_filename, create_upload_directory
        
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
        
        # Create upload directory and generate unique filename
        create_upload_directory()
        unique_filename = generate_unique_filename(file.filename, detected_format)
        UPLOAD_DIR = "../storage/uploads/images"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save the file
        try:
            with open(file_path, "wb") as buffer:
                file.file.seek(0)
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
        # Create image record in database
        image_url = f"/static/images/{unique_filename}"
        try:
            image = image_service.upload_image(
                url=image_url,
                imageable_type="claim",
                imageable_id=claim_id
            )
        except Exception as e:
            # Clean up file if database operation fails
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Database operation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
        
        return {
            "success": True,
            "message": "Image uploaded successfully",
            "data": {
                "id": image.id,
                "url": image.url,
                "imageable_type": image.imageable_type,
                "imageable_id": image.imageable_id,
                "filename": unique_filename,
                "original_filename": file.filename
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/{claim_id}/images/")
async def get_claim_images(
    claim_id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get all images for a specific claim"""
    try:
        # Verify claim exists and user has permission
        claim = claim_service.get_claim_by_id(claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")
        
        # Users can view images if they own the claim or own the item being claimed
        if (claim.user_id != current_user.id and 
            (not claim.item or claim.item.user_id != current_user.id)):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get images from image service
        from app.services.imageService import ImageService
        image_service = ImageService(db)
        images = image_service.get_images_by_entity("claim", claim_id)
        
        return images
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving claim images: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving claim images: {str(e)}")