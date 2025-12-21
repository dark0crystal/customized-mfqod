"""
Claim Service

Handles all claim-related business logic including creation, retrieval,
updates, and claim management operations.
"""

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import HTTPException, status
import uuid

from app.models import Claim, User, Item, ItemStatus
from app.schemas.claim_schema import ClaimCreate, ClaimUpdate, ClaimResponse, ClaimWithDetails
from app.services.notification_service import send_claim_status_notification, send_new_claim_alert
from app.middleware.branch_auth_middleware import can_user_manage_item, is_branch_manager
from app.services import permissionServices
import logging
import asyncio

logger = logging.getLogger(__name__)


class ClaimService:
    def __init__(self, db: Session):
        self.db = db

    def create_claim(self, claim_data: ClaimCreate, user_id: str) -> Claim:
        """Create a new claim for an item"""
        try:
            # Check if item exists
            item = self.db.query(Item).filter(Item.id == claim_data.item_id).first()
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found"
                )
            

            # Create new claim
            new_claim = Claim(
                id=str(uuid.uuid4()),
                title=claim_data.title,
                description=claim_data.description,
                approval=False,  # Claims need approval by default
                user_id=user_id,
                item_id=claim_data.item_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )

            self.db.add(new_claim)
            self.db.commit()
            self.db.refresh(new_claim)

            # Update item's claims count
            self._update_item_claims_count(claim_data.item_id)

            # Send email notification to moderators about new claim
            try:
                asyncio.create_task(self._send_new_claim_notification(new_claim))
            except Exception as e:
                logger.error(f"Error sending new claim notification: {e}")
                # Don't fail the claim creation if email fails

            logger.info(f"Claim created successfully: {new_claim.id}")
            return new_claim

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating claim: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating claim"
            )

    def get_claims(self, skip: int = 0, limit: int = 100, user_id: Optional[str] = None, 
                   item_id: Optional[str] = None, approved_only: Optional[bool] = None) -> List[ClaimResponse]:
        """Get claims with optional filtering"""
        try:
            query = self.db.query(Claim).options(
                joinedload(Claim.user),
                joinedload(Claim.item)
            )

            # Apply filters
            if user_id:
                query = query.filter(Claim.user_id == user_id)
            
            if item_id:
                query = query.filter(Claim.item_id == item_id)
                
            if approved_only is not None:
                query = query.filter(Claim.approval == approved_only)

            try:
                claims = query.order_by(Claim.created_at.desc()).offset(skip).limit(limit).all()
            except Exception as query_error:
                logger.error(f"Error executing claims query: {query_error}")
                # Return empty list if query fails
                return []
            
            # Convert to ClaimResponse to handle is_assigned property safely
            # Handle errors gracefully - if one claim fails, skip it and continue
            claim_responses = []
            for claim in claims:
                try:
                    claim_response = self.claim_to_response(claim)
                    claim_responses.append(claim_response)
                except Exception as e:
                    logger.warning(f"Error converting claim {claim.id if claim else 'unknown'} to response: {e}")
                    # Continue processing other claims instead of failing the entire request
                    continue
            
            return claim_responses

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching claims: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error fetching claims: {str(e)}"
            )

    def get_claim_by_id(self, claim_id: str) -> Optional[Claim]:
        """Get a specific claim by ID"""
        try:
            return self.db.query(Claim).options(
                joinedload(Claim.user),
                joinedload(Claim.item)
            ).filter(Claim.id == claim_id).first()

        except Exception as e:
            logger.error(f"Error fetching claim {claim_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error fetching claim"
            )
    
    def can_user_edit_claim(self, user_id: str, claim_id: str) -> bool:
        """Check if a user can edit a claim"""
        claim = self.get_claim_by_id(claim_id)
        if not claim:
            return False
        
        # If claim is approved, no one can edit it (except admins for approval changes)
        if claim.approval:
            return False
        
        # Claim owner can always edit their own claim (if not approved)
        if claim.user_id == user_id:
            return True
        
        # Check if user has full access
        if permissionServices.has_full_access(self.db, user_id):
            return True
        
        # Check if user is a branch manager for the item's branch
        if claim.item_id:
            if can_user_manage_item(user_id, claim.item_id, self.db):
                return True
        
        return False
    
    def get_claim_with_details(self, claim_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get a claim with full details including images and edit permissions"""
        from app.services.imageService import ImageService
        
        claim = self.get_claim_by_id(claim_id)
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found"
            )
        
        # Get images for this claim
        image_service = ImageService(self.db)
        images = image_service.get_images_by_entity("claim", claim_id)
        image_urls = [{"id": img.id, "url": img.url} for img in images]
        
        # Extract user details
        user_name = None
        user_email = None
        if claim.user:
            if claim.user.first_name and claim.user.last_name:
                user_name = f"{claim.user.first_name} {claim.user.last_name}".strip()
            elif claim.user.first_name:
                user_name = claim.user.first_name
            elif claim.user.email:
                user_name = claim.user.email.split('@')[0]
            user_email = claim.user.email
        
        # Extract item details
        item_title = None
        item_description = None
        item_status = None
        item_branches = []
        if claim.item:
            item_title = claim.item.title
            item_description = claim.item.description
            item_status = claim.item.status
            # Get item branches
            from app.middleware.branch_auth_middleware import get_item_branches
            branch_ids = get_item_branches(claim.item_id, self.db)
            if branch_ids:
                from app.models import Branch
                branches = self.db.query(Branch).filter(Branch.id.in_(branch_ids)).all()
                item_branches = [
                    {
                        "id": branch.id,
                        "name_ar": branch.branch_name_ar,
                        "name_en": branch.branch_name_en
                    }
                    for branch in branches
                ]
        
        # Check if user can edit
        can_edit = False
        if user_id:
            can_edit = self.can_user_edit_claim(user_id, claim_id)
        
        return {
            "id": claim.id,
            "title": claim.title,
            "description": claim.description,
            "approval": claim.approval,
            "user_id": claim.user_id,
            "item_id": claim.item_id,
            "created_at": claim.created_at,
            "updated_at": claim.updated_at,
            "is_assigned": claim.item and claim.item.approved_claim_id == claim.id if claim.item else False,
            "user_name": user_name,
            "user_email": user_email,
            "item_title": item_title,
            "item_description": item_description,
            "item_status": item_status,
            "item_branches": item_branches,
            "images": image_urls,
            "can_edit": can_edit
        }

    def update_claim(self, claim_id: str, claim_update: ClaimUpdate, user_id: Optional[str] = None) -> Claim:
        """Update a claim"""
        try:
            # Load claim with item relationship to check assignment
            claim = self.db.query(Claim).options(
                joinedload(Claim.item)
            ).filter(Claim.id == claim_id).first()
            
            if not claim:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Claim not found"
                )

            # If updating title or description, check edit permissions
            if (claim_update.title is not None or claim_update.description is not None) and user_id:
                if not self.can_user_edit_claim(user_id, claim_id):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You do not have permission to edit this claim. Claims cannot be edited once approved."
                    )

            # Approval status changes are admin-only
            if claim_update.approval is not None and user_id:
                # Only users with full access or can_manage_claims permission can change approval status
                if not permissionServices.has_full_access(self.db, user_id):
                    # Check if user has can_manage_claims permission
                    if not permissionServices.check_user_permission(self.db, user_id, "can_manage_claims"):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only administrators can change claim approval status"
                        )

            # Update fields
            if claim_update.title is not None:
                claim.title = claim_update.title
            
            if claim_update.description is not None:
                claim.description = claim_update.description
                
            if claim_update.approval is not None:
                claim.approval = claim_update.approval

            claim.updated_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(claim)

            # Update item's claims count if approval status changed
            if claim_update.approval is not None:
                self._update_item_claims_count(claim.item_id)

            logger.info(f"Claim updated successfully: {claim_id}")
            return claim

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating claim {claim_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error updating claim"
            )

    def delete_claim(self, claim_id: str, user_id: Optional[str] = None) -> bool:
        """Delete a claim"""
        try:
            claim = self.db.query(Claim).filter(Claim.id == claim_id).first()
            
            if not claim:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Claim not found"
                )

            # Check permissions - users can only delete their own claims
            if user_id and claim.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only delete your own claims"
                )

            item_id = claim.item_id
            self.db.delete(claim)
            self.db.commit()

            # Update item's claims count
            if item_id:
                self._update_item_claims_count(item_id)

            logger.info(f"Claim deleted successfully: {claim_id}")
            return True

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting claim {claim_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error deleting claim"
            )

    def approve_claim(self, claim_id: str, custom_title: Optional[str] = None, custom_description: Optional[str] = None) -> Claim:
        """Approve a claim with optional custom message and assign it to the item"""
        # Get claim with item relationship loaded
        claim = self.db.query(Claim).options(
            joinedload(Claim.item)
        ).filter(Claim.id == claim_id).first()
        
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found"
            )
        
        if not claim.item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Claim is not associated with an item"
            )
        
        # Check if item already has an approved claim
        previous_approved_claim = None
        if claim.item.approved_claim_id and claim.item.approved_claim_id != claim_id:
            # Get the previous approved claim
            previous_approved_claim = self.db.query(Claim).filter(
                Claim.id == claim.item.approved_claim_id
            ).first()
            
            if previous_approved_claim:
                # Unapprove the previous claim
                previous_approved_claim.approval = False
                previous_approved_claim.updated_at = datetime.now(timezone.utc)
                logger.info(f"Unapproved previous claim {previous_approved_claim.id} for item {claim.item.id}")
        
        # Update claim approval status
        claim = self.update_claim(claim_id, ClaimUpdate(approval=True))
        
        # Reload claim with item to ensure we have the latest data
        claim = self.db.query(Claim).options(
            joinedload(Claim.item)
        ).filter(Claim.id == claim_id).first()
        
        # Assign this claim to the item as the correct claim
        if claim.item:
            # Set the new claim as approved
            claim.item.approved_claim_id = claim.id
            # Keep item status as pending (don't change to RECEIVED)
            # Only change status if it's not already pending
            if claim.item.status != ItemStatus.PENDING.value:
                claim.item.status = ItemStatus.PENDING.value
            claim.item.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            logger.info(f"Claim {claim_id} assigned to item {claim.item.id}, status kept as PENDING")
        
        # Send email notification to claimer
        try:
            asyncio.create_task(self._send_claim_status_notification(
                claim, "approved", custom_title, custom_description
            ))
        except Exception as e:
            logger.error(f"Error sending claim approval notification: {e}")
        
        return claim

    def check_existing_approved_claim(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Check if an item has an existing approved claim"""
        item = self.db.query(Item).filter(Item.id == item_id).first()
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        
        if not item.approved_claim_id:
            return None
        
        # Get the approved claim
        approved_claim = self.db.query(Claim).options(
            joinedload(Claim.user)
        ).filter(Claim.id == item.approved_claim_id).first()
        
        if not approved_claim:
            return None
        
        # Return claim details
        user_name = None
        if approved_claim.user:
            if approved_claim.user.first_name and approved_claim.user.last_name:
                user_name = f"{approved_claim.user.first_name} {approved_claim.user.last_name}".strip()
            elif approved_claim.user.first_name:
                user_name = approved_claim.user.first_name
            elif approved_claim.user.email:
                user_name = approved_claim.user.email.split('@')[0]
        
        return {
            "has_existing": True,
            "claim_id": approved_claim.id,
            "claim_title": approved_claim.title,
            "claimer_name": user_name,
            "claimer_email": approved_claim.user.email if approved_claim.user else None,
            "approved_at": approved_claim.updated_at.isoformat() if approved_claim.updated_at else None
        }

    def reject_claim(self, claim_id: str, custom_title: Optional[str] = None, custom_description: Optional[str] = None) -> Claim:
        """Reject a claim with optional custom message and clear assignment if it was assigned"""
        # Get claim with item relationship loaded
        claim = self.db.query(Claim).options(
            joinedload(Claim.item)
        ).filter(Claim.id == claim_id).first()
        
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found"
            )
        
        # Update claim approval status
        claim = self.update_claim(claim_id, ClaimUpdate(approval=False))
        
        # Reload claim with item to ensure we have the latest data
        claim = self.db.query(Claim).options(
            joinedload(Claim.item)
        ).filter(Claim.id == claim_id).first()
        
        # If this claim was the assigned one, clear the assignment and reset status
        if claim.item and claim.item.approved_claim_id == claim.id:
            claim.item.approved_claim_id = None
            # Reset status to pending if it was approved
            if claim.item.status == ItemStatus.APPROVED.value:
                claim.item.status = ItemStatus.PENDING.value
            claim.item.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            logger.info(f"Claim {claim_id} unassigned from item {claim.item.id}, status reset to PENDING")
        
        # Send email notification to claimer
        try:
            asyncio.create_task(self._send_claim_status_notification(
                claim, "pending", custom_title, custom_description
            ))
        except Exception as e:
            logger.error(f"Error sending claim rejection notification: {e}")
        
        return claim

    def get_user_claims(self, user_id: str, skip: int = 0, limit: int = 100) -> List[ClaimResponse]:
        """Get all claims by a specific user"""
        return self.get_claims(skip=skip, limit=limit, user_id=user_id)

    def get_item_claims(self, item_id: str, approved_only: Optional[bool] = None) -> List[ClaimResponse]:
        """Get all claims for a specific item"""
        return self.get_claims(item_id=item_id, approved_only=approved_only)
    
    def get_item_claims_with_details(self, item_id: str, approved_only: Optional[bool] = None) -> List[ClaimWithDetails]:
        """Get all claims for a specific item with user and item details"""
        try:
            claims = self.get_claims(item_id=item_id, approved_only=approved_only)
            claims_with_details = []
            
            for claim_response in claims:
                # Get the full claim object with relationships
                claim = self.db.query(Claim).options(
                    joinedload(Claim.user),
                    joinedload(Claim.item)
                ).filter(Claim.id == claim_response.id).first()
                
                if not claim:
                    continue
                
                # Extract user details
                user_name = None
                user_email = None
                if claim.user:
                    if claim.user.first_name and claim.user.last_name:
                        user_name = f"{claim.user.first_name} {claim.user.last_name}".strip()
                    elif claim.user.first_name:
                        user_name = claim.user.first_name
                    elif claim.user.email:
                        user_name = claim.user.email.split('@')[0]
                    user_email = claim.user.email
                
                # Extract item details
                item_title = None
                item_description = None
                item_status = None
                item_type = None
                if claim.item:
                    item_title = claim.item.title
                    item_description = claim.item.description
                    item_status = claim.item.status
                    # Extract item type if available
                    if claim.item.item_type:
                        item_type = {
                            "id": claim.item.item_type.id,
                            "name_ar": claim.item.item_type.name_ar,
                            "name_en": claim.item.item_type.name_en,
                            "description_ar": claim.item.item_type.description_ar,
                            "description_en": claim.item.item_type.description_en
                        }
                
                # Get images for this claim
                images = []
                try:
                    from app.services.imageService import ImageService
                    image_service = ImageService(self.db)
                    claim_images = image_service.get_images_by_entity("claim", claim.id)
                    images = [{"id": img.id, "url": img.url} for img in claim_images]
                except Exception as img_error:
                    logger.warning(f"Error fetching images for claim {claim.id}: {img_error}")
                    images = []
                
                # Create ClaimWithDetails
                claim_detail = ClaimWithDetails(
                    id=claim_response.id,
                    title=claim_response.title,
                    description=claim_response.description,
                    approval=claim_response.approval,
                    user_id=claim_response.user_id,
                    item_id=claim_response.item_id,
                    created_at=claim_response.created_at,
                    updated_at=claim_response.updated_at,
                    is_assigned=claim_response.is_assigned,
                    user_name=user_name,
                    user_email=user_email,
                    item_title=item_title,
                    item_description=item_description,
                    item_status=item_status,
                    images=images,
                    item_type=item_type
                )
                claims_with_details.append(claim_detail)
            
            return claims_with_details
            
        except Exception as e:
            logger.error(f"Error fetching item claims with details: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error fetching item claims with details: {str(e)}"
            )
    
    def claim_to_response(self, claim: Claim) -> ClaimResponse:
        """Convert Claim model to ClaimResponse with safe property access"""
        try:
            # Safely calculate is_assigned and get item_status
            is_assigned = False
            item_status = None
            try:
                if claim and claim.item_id:
                    # Only try to access item if item_id exists
                    # Use getattr to safely access the item relationship
                    item = getattr(claim, 'item', None)
                    if item is not None:
                        # Check if item relationship is loaded and accessible
                        approved_claim_id = getattr(item, 'approved_claim_id', None)
                        if approved_claim_id and claim.id:
                            is_assigned = str(approved_claim_id) == str(claim.id)
                        # Get item status
                        item_status = getattr(item, 'status', None)
            except (AttributeError, TypeError, ValueError) as item_error:
                # If accessing item fails, just set is_assigned to False and item_status to None
                logger.warning(f"Error accessing item for claim {claim.id if claim else 'unknown'}: {item_error}")
                is_assigned = False
                item_status = None
            except Exception as item_error:
                # Catch any other unexpected errors
                logger.warning(f"Unexpected error accessing item for claim {claim.id if claim else 'unknown'}: {item_error}")
                is_assigned = False
                item_status = None
            
            
            # Ensure all required fields are present and valid
            return ClaimResponse(
                id=str(claim.id) if claim.id else "",
                title=claim.title or "",
                description=claim.description or "",
                approval=claim.approval if claim.approval is not None else False,
                user_id=str(claim.user_id) if claim.user_id else None,
                item_id=str(claim.item_id) if claim.item_id else None,
                created_at=claim.created_at if claim.created_at else datetime.now(timezone.utc),
                updated_at=claim.updated_at if claim.updated_at else datetime.now(timezone.utc),
                is_assigned=is_assigned,
                item_status=item_status
            )
        except Exception as e:
            logger.error(f"Error converting claim to response: {e}")
            # Return basic response if conversion fails
            try:
                return ClaimResponse(
                    id=str(claim.id) if claim and claim.id else "",
                    title=claim.title if claim and claim.title else "",
                    description=claim.description if claim and claim.description else "",
                    approval=claim.approval if claim and claim.approval is not None else False,
                    user_id=str(claim.user_id) if claim and claim.user_id else None,
                    item_id=str(claim.item_id) if claim and claim.item_id else None,
                    created_at=claim.created_at if claim and claim.created_at else datetime.now(timezone.utc),
                    updated_at=claim.updated_at if claim and claim.updated_at else datetime.now(timezone.utc),
                    is_assigned=False
                )
            except Exception as fallback_error:
                logger.error(f"Error in fallback claim conversion: {fallback_error}")
                # Last resort - return minimal response
                raise

    def get_claims_statistics(self) -> Dict[str, Any]:
        """Get claims statistics"""
        try:
            total_claims = self.db.query(func.count(Claim.id)).scalar()
            approved_claims = self.db.query(func.count(Claim.id)).filter(Claim.approval == True).scalar()
            pending_claims = self.db.query(func.count(Claim.id)).filter(Claim.approval == False).scalar()

            return {
                "total_claims": total_claims or 0,
                "approved_claims": approved_claims or 0,
                "pending_claims": pending_claims or 0,
                "approval_rate": (approved_claims / total_claims * 100) if total_claims > 0 else 0
            }

        except Exception as e:
            logger.error(f"Error fetching claims statistics: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error fetching claims statistics"
            )

    def _update_item_claims_count(self, item_id: str) -> None:
        """Update the claims count for an item"""
        try:
            if not item_id:
                return

            claims_count = self.db.query(func.count(Claim.id)).filter(
                Claim.item_id == item_id
            ).scalar()

            item = self.db.query(Item).filter(Item.id == item_id).first()
            if item:
                item.claims_count = claims_count or 0
                item.updated_at = datetime.now(timezone.utc)
                self.db.commit()

        except Exception as e:
            logger.error(f"Error updating claims count for item {item_id}: {e}")
            # Don't raise exception as this is a secondary operation

    async def _send_new_claim_notification(self, claim: Claim) -> None:
        """Send notification to moderators and branch managers about new claim"""
        try:
            # Get claim details with related data
            claim_with_details = self.db.query(Claim).options(
                joinedload(Claim.user),
                joinedload(Claim.item)
            ).filter(Claim.id == claim.id).first()
            
            if not claim_with_details or not claim_with_details.user or not claim_with_details.item:
                logger.error(f"Missing data for claim notification: {claim.id}")
                return
            
            # Get moderator emails (users with can_manage_claims permission or full access)
            from app.models import Role, Permission, RolePermissions, Address, UserBranchManager
            
            # Get users with can_manage_claims permission
            moderators = self.db.query(User).join(
                Role, User.role_id == Role.id
            ).join(
                RolePermissions, Role.id == RolePermissions.role_id
            ).join(
                Permission, RolePermissions.permission_id == Permission.id
            ).filter(
                Permission.name == "can_manage_claims"
            ).distinct().all()
            
            # Also include users with full access (all permissions)
            all_users = self.db.query(User).all()
            moderator_ids = {m.id for m in moderators}
            for user in all_users:
                if user.id not in moderator_ids:
                    from app.services import permissionServices
                    if permissionServices.has_full_access(self.db, user.id):
                        moderators.append(user)
                        moderator_ids.add(user.id)
            
            # Get branch managers for the item's branch(es)
            item_branches = self.db.query(Address.branch_id).filter(
                Address.item_id == claim_with_details.item.id,
                Address.is_current == True
            ).distinct().all()
            
            branch_manager_ids = set()
            branch_managers = []
            if item_branches:
                branch_ids = [branch[0] for branch in item_branches if branch[0]]
                if branch_ids:
                    # Get branch managers for these branches
                    branch_managers_query = self.db.query(User).join(
                        UserBranchManager, User.id == UserBranchManager.user_id
                    ).filter(
                        UserBranchManager.branch_id.in_(branch_ids)
                    ).distinct().all()
                    
                    for manager in branch_managers_query:
                        if manager.id not in moderator_ids and manager.id not in branch_manager_ids:
                            branch_managers.append(manager)
                            branch_manager_ids.add(manager.id)
            
            # Combine moderators and branch managers, avoiding duplicates
            all_recipients = moderators + branch_managers
            recipient_emails = [recipient.email for recipient in all_recipients if recipient.email]
            
            if not recipient_emails:
                logger.warning("No recipient emails found for new claim notification")
                return
            
            # Get frontend base URL from email config (which reads from environment)
            from app.config.email_config import email_settings
            frontend_base_url = email_settings.FRONTEND_BASE_URL.rstrip("/") if email_settings.FRONTEND_BASE_URL else ""
            claim_url = f"{frontend_base_url}/dashboard/claims/{claim_with_details.id}" if frontend_base_url else f"/dashboard/claims/{claim_with_details.id}"
            item_url = f"{frontend_base_url}/dashboard/items/{claim_with_details.item.id}" if frontend_base_url else f"/dashboard/items/{claim_with_details.item.id}"
            
            # Send notification
            await send_new_claim_alert(
                moderator_emails=recipient_emails,
                claim_title=claim_with_details.title,
                claim_description=claim_with_details.description,
                item_title=claim_with_details.item.title,
                claimer_name=f"{claim_with_details.user.first_name} {claim_with_details.user.last_name}",
                claimer_email=claim_with_details.user.email,
                claim_url=claim_url,
                item_url=item_url
            )
            
            logger.info(f"New claim notification sent to {len(recipient_emails)} recipients ({len(moderators)} moderators, {len(branch_managers)} branch managers)")
            
        except Exception as e:
            logger.error(f"Error in _send_new_claim_notification: {e}")

    async def _send_claim_status_notification(
        self, 
        claim: Claim, 
        status: str, 
        custom_title: Optional[str] = None, 
        custom_description: Optional[str] = None
    ) -> None:
        """Send notification to claimer about status update"""
        try:
            # Get claim details with related data
            claim_with_details = self.db.query(Claim).options(
                joinedload(Claim.user),
                joinedload(Claim.item)
            ).filter(Claim.id == claim.id).first()
            
            if not claim_with_details or not claim_with_details.user or not claim_with_details.item:
                logger.error(f"Missing data for claim status notification: {claim.id}")
                return
            
            # Send notification to claimer
            await send_claim_status_notification(
                user_email=claim_with_details.user.email,
                user_name=f"{claim_with_details.user.first_name} {claim_with_details.user.last_name}",
                claim_title=claim_with_details.title,
                item_title=claim_with_details.item.title,
                status=status.title(),
                custom_title=custom_title,
                custom_description=custom_description,
                item_url=f"/search/{claim_with_details.item.id}"
            )
            
            logger.info(f"Claim status notification sent to {claim_with_details.user.email}")
            
        except Exception as e:
            logger.error(f"Error in _send_claim_status_notification: {e}")