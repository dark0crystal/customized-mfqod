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

from app.models import Claim, User, Item
from app.schemas.claim_schema import ClaimCreate, ClaimUpdate, ClaimResponse
from app.services.notification_service import send_claim_status_notification, send_new_claim_alert
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
                   item_id: Optional[str] = None, approved_only: Optional[bool] = None) -> List[Claim]:
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

            return query.order_by(Claim.created_at.desc()).offset(skip).limit(limit).all()

        except Exception as e:
            logger.error(f"Error fetching claims: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error fetching claims"
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

            # Check if claim is approved and assigned to item - prevent editing by author
            is_approved_and_assigned = (
                claim.approval == True and 
                claim.item and 
                claim.item.approved_claim_id == claim.id
            )
            
            # If claim is approved and assigned, only allow approval status changes (by admin)
            # Block title/description changes by the author
            if is_approved_and_assigned and user_id and claim.user_id == user_id:
                # Author cannot edit approved/assigned claims (except approval which is admin-only)
                if claim_update.title is not None or claim_update.description is not None:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You cannot edit a claim that has been approved and assigned to an item"
                    )

            # Check permissions - users can only update their own claims (except approval)
            if user_id and claim.user_id != user_id and claim_update.approval is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only update your own claims"
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
        
        # Update claim approval status
        claim = self.update_claim(claim_id, ClaimUpdate(approval=True))
        
        # Reload claim with item to ensure we have the latest data
        claim = self.db.query(Claim).options(
            joinedload(Claim.item)
        ).filter(Claim.id == claim_id).first()
        
        # Assign this claim to the item as the correct claim
        if claim.item:
            # If another claim was previously assigned, it will be replaced
            claim.item.approved_claim_id = claim.id
            claim.item.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            logger.info(f"Claim {claim_id} assigned to item {claim.item.id}")
        
        # Send email notification to claimer
        try:
            asyncio.create_task(self._send_claim_status_notification(
                claim, "approved", custom_title, custom_description
            ))
        except Exception as e:
            logger.error(f"Error sending claim approval notification: {e}")
        
        return claim

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
        
        # If this claim was the assigned one, clear the assignment
        if claim.item and claim.item.approved_claim_id == claim.id:
            claim.item.approved_claim_id = None
            claim.item.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            logger.info(f"Claim {claim_id} unassigned from item {claim.item.id}")
        
        # Send email notification to claimer
        try:
            asyncio.create_task(self._send_claim_status_notification(
                claim, "rejected", custom_title, custom_description
            ))
        except Exception as e:
            logger.error(f"Error sending claim rejection notification: {e}")
        
        return claim

    def get_user_claims(self, user_id: str, skip: int = 0, limit: int = 100) -> List[Claim]:
        """Get all claims by a specific user"""
        return self.get_claims(skip=skip, limit=limit, user_id=user_id)

    def get_item_claims(self, item_id: str, approved_only: Optional[bool] = None) -> List[Claim]:
        """Get all claims for a specific item"""
        return self.get_claims(item_id=item_id, approved_only=approved_only)

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
        """Send notification to moderators about new claim"""
        try:
            # Get claim details with related data
            claim_with_details = self.db.query(Claim).options(
                joinedload(Claim.user),
                joinedload(Claim.item)
            ).filter(Claim.id == claim.id).first()
            
            if not claim_with_details or not claim_with_details.user or not claim_with_details.item:
                logger.error(f"Missing data for claim notification: {claim.id}")
                return
            
            # Get moderator emails (users with admin or moderator roles)
            moderators = self.db.query(User).filter(
                or_(User.role == "admin", User.role == "moderator")
            ).all()
            
            moderator_emails = [mod.email for mod in moderators if mod.email]
            
            if not moderator_emails:
                logger.warning("No moderator emails found for new claim notification")
                return
            
            # Send notification
            await send_new_claim_alert(
                moderator_emails=moderator_emails,
                claim_title=claim_with_details.title,
                claim_description=claim_with_details.description,
                item_title=claim_with_details.item.title,
                claimer_name=f"{claim_with_details.user.first_name} {claim_with_details.user.last_name}",
                claimer_email=claim_with_details.user.email,
                claim_url=f"/dashboard/claims/{claim_with_details.id}",
                item_url=f"/dashboard/items/{claim_with_details.item.id}"
            )
            
            logger.info(f"New claim notification sent to {len(moderator_emails)} moderators")
            
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