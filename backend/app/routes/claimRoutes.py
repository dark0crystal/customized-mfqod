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
    ClaimWithDetails, ClaimWithImages, ClaimStatusUpdate, VisitNotificationRequest
)
from app.services.claimService import ClaimService
from app.middleware.auth_middleware import get_current_user_required
from app.utils.permission_decorator import require_permission
from app.models import User, Claim
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


@router.get("/{claim_id}")
async def get_claim(
    claim_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Get a specific claim by ID with full details"""
    try:
        claim = claim_service.get_claim_by_id(claim_id)
        
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found"
            )
        
        # Check access: users can view their own claims, claims on their items, or if they're branch managers/admins
        has_access = False
        if claim.user_id == current_user.id:
            has_access = True
        elif claim.item and claim.item.user_id == current_user.id:
            has_access = True
        else:
            # Check if user is branch manager or admin
            from app.middleware.branch_auth_middleware import can_user_manage_item
            from app.services import permissionServices
            if claim.item_id and can_user_manage_item(current_user.id, claim.item_id, db):
                has_access = True
            elif permissionServices.has_full_access(db, current_user.id):
                has_access = True
        
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get full claim details with images and edit permissions
        return claim_service.get_claim_with_details(claim_id, current_user.id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving claim: {str(e)}")


@router.put("/{claim_id}")
@router.patch("/{claim_id}")
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
        # Return full claim details after update
        return claim_service.get_claim_with_details(claim_id, current_user.id)
        
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

@router.get("/{claim_id}/check-existing-approved")
@require_permission("admin")
async def check_existing_approved_claim(
    claim_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Check if the item associated with this claim has an existing approved claim"""
    try:
        # Get the claim to find the item_id
        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")
        
        if not claim.item_id:
            return {"has_existing": False}
        
        result = claim_service.check_existing_approved_claim(claim.item_id)
        if result:
            return result
        return {"has_existing": False}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking existing approved claim for claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking existing approved claim: {str(e)}")


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
        
        # Check if user can edit the claim (owner, branch manager, or admin)
        from app.services.claimService import ClaimService
        claim_service = ClaimService(db)
        if not claim_service.can_user_edit_claim(current_user.id, claim_id):
            raise HTTPException(status_code=403, detail="Access denied: You do not have permission to upload images to this claim")
        
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
        
        # Check access: users can view if they own the claim, own the item, or are branch managers/admins
        has_access = False
        if claim.user_id == current_user.id:
            has_access = True
        elif claim.item and claim.item.user_id == current_user.id:
            has_access = True
        else:
            from app.middleware.branch_auth_middleware import can_user_manage_item
            from app.services import permissionServices
            if claim.item_id and can_user_manage_item(current_user.id, claim.item_id, db):
                has_access = True
            elif permissionServices.has_full_access(db, current_user.id):
                has_access = True
        
        if not has_access:
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


@router.delete("/{claim_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_claim_image(
    claim_id: str,
    image_id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Delete an image from a claim"""
    try:
        # Verify claim exists
        claim = claim_service.get_claim_by_id(claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")
        
        # Check if user can edit the claim (owner, branch manager, or admin)
        if not claim_service.can_user_edit_claim(current_user.id, claim_id):
            raise HTTPException(status_code=403, detail="Access denied: You do not have permission to delete images from this claim")
        
        # Get the image
        from app.models import Image
        image = db.query(Image).filter(
            Image.id == image_id,
            Image.imageable_type == "claim",
            Image.imageable_id == claim_id
        ).first()
        
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Delete the image file
        import os
        if image.url:
            # Extract filename from URL
            filename = image.url.split("/")[-1]
            file_path = os.path.join("../storage/uploads/images", filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete image file {file_path}: {e}")
        
        # Delete the image record
        db.delete(image)
        db.commit()
        
        logger.info(f"Image {image_id} deleted from claim {claim_id} by user {current_user.id}")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting claim image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting image: {str(e)}")


# =========================== 
# Visit Notification Routes
# ===========================

@router.post("/{claim_id}/send-visit-notification")
@require_permission("can_manage_claims")
async def send_visit_notification(
    claim_id: str,
    notification_request: VisitNotificationRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    claim_service: ClaimService = Depends(get_claim_service)
):
    """Send email notification to claim user requesting them to visit a branch/office"""
    try:
        # Verify claim exists
        claim = claim_service.get_claim_by_id(claim_id)
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found"
            )
        
        # Check access: users can send notifications if they can process claims
        # (already checked by permission decorator, but verify claim access)
        from app.middleware.branch_auth_middleware import can_user_manage_item
        from app.services import permissionServices
        
        has_access = False
        if claim.item_id and can_user_manage_item(current_user.id, claim.item_id, db):
            has_access = True
        elif permissionServices.has_full_access(db, current_user.id):
            has_access = True
        
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to send notifications for this claim"
            )
        
        # Verify claim has a user with email
        if not claim.user or not claim.user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Claim user does not have an email address"
            )
        
        # Fetch branch details if branch_id is provided
        branch_name = None
        branch_name_ar = None
        branch_name_en = None
        if notification_request.branch_id:
            from app.services.branchService import BranchService
            branch_service = BranchService(db)
            branch = branch_service.get_branch_by_id(notification_request.branch_id)
            
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Branch not found"
                )
            
            branch_name_ar = branch.branch_name_ar
            branch_name_en = branch.branch_name_en
            branch_name = branch_name_en or branch_name_ar or "the office"
        
        # Get user name
        user_name = None
        if claim.user.first_name and claim.user.last_name:
            user_name = f"{claim.user.first_name} {claim.user.last_name}".strip()
        elif claim.user.first_name:
            user_name = claim.user.first_name
        elif claim.user.email:
            user_name = claim.user.email.split('@')[0]
        else:
            user_name = "User"
        
        # Get item title
        item_title = claim.item.title if claim.item else "the item"
        item_id = claim.item_id if claim.item else None
        
        # Build reminder message
        reminder_message_parts = [
            f"Your claim for '{item_title}' requires your attention."
        ]
        
        if branch_name:
            reminder_message_parts.append(f"Please visit {branch_name} to complete the claim process.")
        else:
            reminder_message_parts.append("Please visit our office to complete the claim process.")
        
        if notification_request.note:
            reminder_message_parts.append(f"\n\nNote: {notification_request.note}")
        
        reminder_message = "\n".join(reminder_message_parts)
        
        # Get frontend base URL for generating links
        from app.config.email_config import email_settings
        frontend_base_url = email_settings.FRONTEND_BASE_URL.rstrip('/')
        
        # Prepare template data for email
        template_data = {
            "user_name": user_name,
            "reminder_type": "visit_office",
            "reminder_title": "Visit Request - Claim Notification",
            "reminder_message": reminder_message,
            "branch_name": branch_name,
            "branch_name_ar": branch_name_ar,
            "branch_name_en": branch_name_en,
            "item_title": item_title,
            "claim_title": claim.title,
            "note": notification_request.note,
            "claim_url": f"{frontend_base_url}/dashboard/claims/{claim_id}",
            "item_url": f"{frontend_base_url}/dashboard/items/{item_id}" if item_id else None
        }
        
        # Send email using notification service
        from app.services.notification_service import notification_service, NotificationType
        
        # Send email in background
        background_tasks.add_task(
            notification_service.send_templated_email,
            to_email=claim.user.email,
            notification_type=NotificationType.REMINDER,
            template_data=template_data,
            subject_override="Visit Request - Claim Notification"
        )
        
        logger.info(f"Visit notification email queued for claim {claim_id} to {claim.user.email}")
        
        return {
            "message": "Visit notification email queued for sending",
            "recipient": claim.user.email,
            "branch": branch_name,
            "status": "queued"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending visit notification for claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error sending visit notification: {str(e)}")