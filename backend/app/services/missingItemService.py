from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import Optional, List, Tuple
from datetime import datetime, timezone
import uuid
import asyncio
import logging

# Import Models
from app.models import (
    MissingItem,
    ItemType as ItemTypeModel,
    Item,
    MissingItemFoundItem,
    User,
    Address,
    Branch,
    Organization,
    Image,
    UserBranchManager,
)
from app.middleware.branch_auth_middleware import is_branch_manager
from app.services import permissionServices
from app.schemas.missing_item_schema import (
    CreateMissingItemRequest,
    UpdateMissingItemRequest,
    MissingItemFilterRequest,
    BulkDeleteMissingItemRequest,
    BulkUpdateMissingItemRequest,
    BulkApprovalMissingItemRequest,
    AssignFoundItemsRequest,
    AssignPendingItemRequest,
    LocationResponse,
    MissingItemResponse,
    MissingItemDetailResponse,
)
from app.services.notification_service import send_new_missing_item_alert, EmailNotificationService

logger = logging.getLogger(__name__)

class MissingItemService:
    
    def __init__(self, db: Session):
        self.db = db
    
    # =========================== 
    # Create Operations
    # ===========================
    
    def create_missing_item(self, missing_item_data: CreateMissingItemRequest) -> MissingItemResponse:
        """Create a new missing item"""
        # Validate user exists
        if not self._user_exists(missing_item_data.user_id):
            raise ValueError("User not found")
        
        # Validate item type exists if provided
        if missing_item_data.item_type_id and not self._item_type_exists(missing_item_data.item_type_id):
            raise ValueError("Item type not found")
        
        new_missing_item = MissingItem(
            id=str(uuid.uuid4()),
            title=missing_item_data.title,
            description=missing_item_data.description,
            user_id=missing_item_data.user_id,
            item_type_id=missing_item_data.item_type_id,
            status=missing_item_data.status,
            approval=missing_item_data.approval,
            temporary_deletion=missing_item_data.temporary_deletion,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.db.add(new_missing_item)
        self.db.commit()
        self.db.refresh(new_missing_item)
        
        # Send email notification to moderators about new missing item
        try:
            asyncio.create_task(self._send_new_missing_item_notification(new_missing_item))
        except Exception as e:
            # Don't fail the missing item creation if email fails
            pass
        
        # Get the full missing item with relationships for response
        full_missing_item = self.get_missing_item_by_id(new_missing_item.id)
        return self._missing_item_to_response(full_missing_item) if full_missing_item else self._missing_item_to_response(new_missing_item)
    
    # =========================== 
    # Read Operations
    # ===========================
    
    def get_missing_item_by_id(self, missing_item_id: str, include_deleted: bool = False) -> Optional[MissingItem]:
        """Get a single missing item by ID (returns MissingItem model for internal use)"""
        query = self.db.query(MissingItem).options(
            joinedload(MissingItem.item_type),
            joinedload(MissingItem.user),
            joinedload(MissingItem.addresses).joinedload(Address.branch).joinedload(Branch.organization),
            joinedload(MissingItem.assigned_found_items).joinedload(MissingItemFoundItem.item),
            joinedload(MissingItem.assigned_found_items).joinedload(MissingItemFoundItem.branch),
        ).filter(MissingItem.id == missing_item_id)
        
        if not include_deleted:
            query = query.filter(MissingItem.temporary_deletion == False)
        
        return query.first()
    
    def get_missing_item_detail_by_id(self, missing_item_id: str, include_deleted: bool = False) -> Optional[MissingItemDetailResponse]:
        """Get a single missing item by ID with full details for API response"""
        missing_item = self.get_missing_item_by_id(missing_item_id, include_deleted)
        return self._missing_item_to_detail_response(missing_item) if missing_item else None
    
    def get_missing_items(self, filters: MissingItemFilterRequest) -> Tuple[List[MissingItemResponse], int]:
        """Get missing items with filtering and pagination"""
        query = self.db.query(MissingItem).options(
            joinedload(MissingItem.item_type),
            joinedload(MissingItem.user),
            joinedload(MissingItem.addresses).joinedload(Address.branch).joinedload(Branch.organization)
        )
        
        # Apply filters
        if not filters.include_deleted:
            query = query.filter(MissingItem.temporary_deletion == False)
        
        if filters.user_id:
            query = query.filter(MissingItem.user_id == filters.user_id)
        
        if filters.approved_only:
            query = query.filter(MissingItem.approval == True)
        
        if filters.item_type_id:
            query = query.filter(MissingItem.item_type_id == filters.item_type_id)
        
        if filters.status:
            query = query.filter(MissingItem.status == filters.status)
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        missing_items = query.offset(filters.skip).limit(filters.limit).all()
        
        # Convert to response objects with location data
        missing_item_responses = [self._missing_item_to_response(missing_item) for missing_item in missing_items]
        
        return missing_item_responses, total
    
    def get_missing_items_by_user(self, user_id: str, include_deleted: bool = False, 
                                 skip: int = 0, limit: int = 100) -> Tuple[List[MissingItemResponse], int]:
        """Get all missing items for a specific user"""
        if not self._user_exists(user_id):
            raise ValueError("User not found")
        
        query = self.db.query(MissingItem).filter(MissingItem.user_id == user_id)
        
        if not include_deleted:
            query = query.filter(MissingItem.temporary_deletion == False)
        
        total = query.count()
        missing_items = query.offset(skip).limit(limit).all()
        
        # Convert to response objects with location data
        missing_item_responses = [self._missing_item_to_response(missing_item) for missing_item in missing_items]
        
        return missing_item_responses, total
    
    def search_missing_items(self, search_term: str, filters: MissingItemFilterRequest) -> Tuple[List[MissingItemResponse], int]:
        """Search missing items by title or description"""
        query = self.db.query(MissingItem).options(
            joinedload(MissingItem.item_type),
            joinedload(MissingItem.user),
            joinedload(MissingItem.addresses).joinedload(Address.branch).joinedload(Branch.organization)
        ).filter(
            or_(
                MissingItem.title.ilike(f"%{search_term}%"),
                MissingItem.description.ilike(f"%{search_term}%")
            )
        )
        
        # Apply filters
        if not filters.include_deleted:
            query = query.filter(MissingItem.temporary_deletion == False)
        
        if filters.user_id:
            query = query.filter(MissingItem.user_id == filters.user_id)
        
        if filters.approved_only:
            query = query.filter(MissingItem.approval == True)
        
        if filters.item_type_id:
            query = query.filter(MissingItem.item_type_id == filters.item_type_id)
        
        if filters.status:
            query = query.filter(MissingItem.status == filters.status)
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        missing_items = query.offset(filters.skip).limit(filters.limit).all()
        
        # Convert to response objects with location data
        missing_item_responses = [self._missing_item_to_response(missing_item) for missing_item in missing_items]
        
        return missing_item_responses, total
    
    def get_missing_item_statistics(self, user_id: Optional[str] = None) -> dict:
        """Get missing item statistics"""
        base_query = self.db.query(MissingItem)
        
        if user_id:
            base_query = base_query.filter(MissingItem.user_id == user_id)
        
        # Total missing items
        total_missing_items = base_query.filter(MissingItem.temporary_deletion == False).count()
        
        # Missing items by status (new lifecycle)
        pending_status_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "pending"
        ).count()
        
        approved_status_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "approved"
        ).count()
        
        cancelled_status_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "cancelled"
        ).count()
        
        visit_status_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "visit"
        ).count()
        
        # Approved vs pending
        approved_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.approval == True
        ).count()
        
        pending_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.approval == False
        ).count()
        
        return {
            "total_missing_items": total_missing_items,
            "pending_items_status": pending_status_count,
            "approved_items_status": approved_status_count,
            "cancelled_items_status": cancelled_status_count,
            "visit_items_status": visit_status_count,
            "approved_items": approved_count,
            "pending_items": pending_count,
            "return_rate": (approved_status_count / total_missing_items * 100) if total_missing_items > 0 else 0.0
        }
    
    def get_pending_missing_items_count(self, user_id: str) -> int:
        """Get count of pending missing items (approval == False) accessible to the user based on branch assignments"""
        # Start with base query for pending missing items
        query = self.db.query(MissingItem).filter(
            MissingItem.status == "pending",
            MissingItem.temporary_deletion == False
        )
        
        # Check if user has full access - if so, return all pending missing items
        is_admin = permissionServices.has_full_access(self.db, user_id)
        
        if is_admin:
            logger.info(f"User with full access {user_id} - returning all pending missing items count")
            return query.count()
        
        # Check if user is a branch manager - branch managers see pending missing items in their managed branches
        is_bm = is_branch_manager(user_id, self.db)
        
        if is_bm:
            # Get user's managed branches
            managed_branch_ids = [
                row[0] for row in self.db.query(UserBranchManager.branch_id).filter(
                    UserBranchManager.user_id == user_id
                ).all()
            ]
            
            if managed_branch_ids:
                # Get missing items in managed branches
                missing_item_ids_in_branches = [
                    row[0] for row in self.db.query(Address.missing_item_id).filter(
                        Address.branch_id.in_(managed_branch_ids),
                        Address.is_current == True,
                        Address.missing_item_id.isnot(None)
                    ).distinct().all()
                ]
                
                if missing_item_ids_in_branches:
                    # Filter to only pending missing items in managed branches
                    count = query.filter(MissingItem.id.in_(missing_item_ids_in_branches)).count()
                    logger.info(f"Branch manager {user_id} - returning {count} pending missing items from managed branches")
                    return count
                else:
                    logger.info(f"Branch manager {user_id} - no missing items in managed branches")
                    return 0
            else:
                logger.info(f"Branch manager {user_id} - no managed branches")
                return 0
        
        # Regular users see only their own pending missing items
        count = query.filter(MissingItem.user_id == user_id).count()
        logger.info(f"Regular user {user_id} - returning {count} own pending missing items")
        return count
    
    # =========================== 
    # Update Operations
    # ===========================
    
    def update_missing_item(self, missing_item_id: str, update_data: UpdateMissingItemRequest) -> MissingItemResponse:
        """Update an existing missing item"""
        missing_item = self.get_missing_item_by_id(missing_item_id)
        if not missing_item:
            raise ValueError("Missing item not found")
        
        # Validate item type exists if provided
        if update_data.item_type_id and not self._item_type_exists(update_data.item_type_id):
            raise ValueError("Item type not found")
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(missing_item, field, value)
        
        missing_item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(missing_item)
        
        return self._missing_item_to_response(missing_item)
    
    def patch_missing_item(self, missing_item_id: str, patch_data: dict) -> MissingItemResponse:
        """Partially update a missing item with location history tracking"""
        missing_item = self.get_missing_item_by_id(missing_item_id)
        if not missing_item:
            raise ValueError("Missing item not found")
        
        # Validate item type exists if provided
        if "item_type_id" in patch_data and patch_data["item_type_id"] and not self._item_type_exists(patch_data["item_type_id"]):
            raise ValueError("Item type not found")
        
        # Update fields
        for field, value in patch_data.items():
            if hasattr(missing_item, field):
                setattr(missing_item, field, value)
        
        missing_item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(missing_item)
        
        return self._missing_item_to_response(missing_item)
    
    def assign_found_items(self, missing_item_id: str, request: AssignFoundItemsRequest, current_user: User) -> MissingItemDetailResponse:
        """Link one or more found items to a missing item, optionally moving status to visit."""
        missing_item = self.get_missing_item_by_id(missing_item_id)
        if not missing_item:
            raise ValueError("Missing item not found")

        now = datetime.now(timezone.utc)

        # Permission: users with full access can assign anywhere; branch managers must own the branch
        is_admin = permissionServices.has_full_access(self.db, current_user.id)
        managed_branch_ids: List[str] = []
        if not is_admin:
            if not is_branch_manager(current_user.id, self.db):
                raise PermissionError("Only admins or branch managers can assign found items")
            managed_branch_ids = [
                row[0] for row in self.db.query(UserBranchManager.branch_id).filter(
                    UserBranchManager.user_id == current_user.id
                ).all()
            ]
            if request.branch_id not in managed_branch_ids:
                raise PermissionError("Branch managers can only assign items for their managed branches")

        branch = self.db.query(Branch).filter(Branch.id == request.branch_id).first()
        if not branch:
            raise ValueError("Branch not found")

        # Validate found items
        found_items = self.db.query(Item).filter(
            Item.id.in_(request.found_item_ids),
            Item.temporary_deletion == False
        ).all()
        found_ids_found = {item.id for item in found_items}
        missing_ids = set(request.found_item_ids) - found_ids_found
        if missing_ids:
            raise ValueError(f"Found item(s) not found: {', '.join(missing_ids)}")

        # Upsert links
        existing_links = {link.item_id: link for link in missing_item.assigned_found_items}
        for item in found_items:
            if item.id in existing_links:
                link = existing_links[item.id]
                link.branch_id = request.branch_id
                link.note = request.note
                link.created_by = current_user.id
                link.updated_at = now
            else:
                link = MissingItemFoundItem(
                    id=str(uuid.uuid4()),
                    missing_item_id=missing_item.id,
                    item_id=item.id,
                    branch_id=request.branch_id,
                    note=request.note,
                    created_by=current_user.id,
                    created_at=now,
                    updated_at=now
                )
                self.db.add(link)
                missing_item.assigned_found_items.append(link)

        missing_item.updated_at = now

        if request.notify:
            for link in missing_item.assigned_found_items:
                if link.item_id in request.found_item_ids:
                    link.notified_at = now

        # Optionally move to visit status after validation
        if request.set_status_to_visit:
            self._validate_visit_requirements(missing_item, request.note)
            missing_item.status = "visit"

        self.db.commit()
        self.db.refresh(missing_item)

        # Notification to reporter
        if request.notify and missing_item.user and missing_item.user.email:
            try:
                asyncio.create_task(
                    self._send_visit_notification(
                        missing_item,
                        branch,
                        found_items,
                        request.note,
                        current_user
                    )
                )
            except Exception:
                # Don't block main flow on notification errors
                pass

        return self._missing_item_to_detail_response(missing_item)

    def assign_pending_item(self, missing_item_id: str, request: AssignPendingItemRequest, current_user: User) -> MissingItemDetailResponse:
        """Assign a missing item to a pending item, optionally moving status to approved and notifying the reporter."""
        missing_item = self.get_missing_item_by_id(missing_item_id)
        if not missing_item:
            raise ValueError("Missing item not found")

        # Validate pending item exists and has pending status
        pending_item = self.db.query(Item).filter(
            Item.id == request.pending_item_id,
            Item.status == "pending",
            Item.temporary_deletion == False
        ).first()
        
        if not pending_item:
            raise ValueError("Pending item not found or does not have pending status")

        now = datetime.now(timezone.utc)

        # Check if link already exists
        existing_link = self.db.query(MissingItemFoundItem).filter(
            MissingItemFoundItem.missing_item_id == missing_item.id,
            MissingItemFoundItem.item_id == request.pending_item_id
        ).first()

        if existing_link:
            # Update existing link
            existing_link.note = request.note
            existing_link.created_by = current_user.id
            existing_link.updated_at = now
        else:
            # Create new link
            link = MissingItemFoundItem(
                id=str(uuid.uuid4()),
                missing_item_id=missing_item.id,
                item_id=request.pending_item_id,
                branch_id=None,  # No branch required for approved status
                note=request.note,
                created_by=current_user.id,
                created_at=now,
                updated_at=now
            )
            self.db.add(link)
            missing_item.assigned_found_items.append(link)

        # Optionally move to approved status
        if request.set_status_to_approved:
            missing_item.status = "approved"
            missing_item.updated_at = now

        if request.notify:
            # Mark as notified
            for link in missing_item.assigned_found_items:
                if link.item_id == request.pending_item_id:
                    link.notified_at = now

        self.db.commit()
        self.db.refresh(missing_item)

        # Send approval notification email
        if request.notify and missing_item.user and missing_item.user.email:
            try:
                asyncio.create_task(
                    self._send_approval_notification(
                        missing_item,
                        pending_item,
                        request.note,
                        current_user
                    )
                )
            except Exception:
                # Don't block main flow on notification errors
                pass

        return self.get_missing_item_detail_by_id(missing_item_id)

    def toggle_approval(self, missing_item_id: str) -> MissingItemResponse:
        """Toggle the approval status of a missing item"""
        missing_item = self.get_missing_item_by_id(missing_item_id)
        if not missing_item:
            raise ValueError("Missing item not found")
        
        missing_item.approval = not missing_item.approval
        missing_item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(missing_item)
        
        return self._missing_item_to_response(missing_item)
    
    def update_status(self, missing_item_id: str, status: str) -> MissingItemResponse:
        """Update the status of a missing item"""
        missing_item = self.get_missing_item_by_id(missing_item_id)
        if not missing_item:
            raise ValueError("Missing item not found")

        allowed_statuses = ["pending", "approved", "cancelled", "visit"]
        if status not in allowed_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(allowed_statuses)}")

        if status == "visit":
            self._validate_visit_requirements(missing_item, note=missing_item.assigned_found_items[0].note if missing_item.assigned_found_items else None)
        
        if status == "approved":
            # Check if missing item is linked to a pending item
            if not missing_item.assigned_found_items:
                raise ValueError("Cannot set status to approved. Please assign this missing item to a pending item first.")

        missing_item.status = status
        missing_item.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(missing_item)

        return self._missing_item_to_response(missing_item)
    
    # =========================== 
    # Delete Operations
    # ===========================
    
    def delete_missing_item(self, missing_item_id: str, permanent: bool = False) -> bool:
        """Delete a missing item (soft delete by default, permanent if specified)"""
        missing_item = self.get_missing_item_by_id(missing_item_id, include_deleted=True)
        if not missing_item:
            raise ValueError("Missing item not found")
        
        if permanent:
            # Delete associated addresses
            self.db.query(Address).filter(Address.missing_item_id == missing_item_id).delete()
            # Delete associated images
            self.db.query(Image).filter(
                Image.imageable_type == "missingitem",
                Image.imageable_id == missing_item_id
            ).delete()
            # Delete the missing item
            self.db.delete(missing_item)
        else:
            # Soft delete
            missing_item.temporary_deletion = True
            missing_item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        return True
    
    def restore_missing_item(self, missing_item_id: str) -> MissingItemResponse:
        """Restore a soft-deleted missing item"""
        missing_item = self.get_missing_item_by_id(missing_item_id, include_deleted=True)
        if not missing_item:
            raise ValueError("Missing item not found")
        
        if not missing_item.temporary_deletion:
            raise ValueError("Missing item is not deleted")
        
        missing_item.temporary_deletion = False
        missing_item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(missing_item)
        
        return self._missing_item_to_response(missing_item)
    
    # =========================== 
    # Bulk Operations
    # ===========================
    
    def bulk_delete(self, request: BulkDeleteMissingItemRequest) -> dict:
        """Bulk delete multiple missing items"""
        processed_items = 0
        successful_items = 0
        failed_items = 0
        errors = []
        
        for missing_item_id in request.missing_item_ids:
            try:
                processed_items += 1
                self.delete_missing_item(missing_item_id, request.permanent)
                successful_items += 1
            except Exception as e:
                failed_items += 1
                errors.append(f"Failed to delete missing item {missing_item_id}: {str(e)}")
        
        return {
            "processed_items": processed_items,
            "successful_items": successful_items,
            "failed_items": failed_items,
            "errors": errors
        }
    
    def bulk_update(self, request: BulkUpdateMissingItemRequest) -> dict:
        """Bulk update multiple missing items"""
        processed_items = 0
        successful_items = 0
        failed_items = 0
        errors = []
        
        for missing_item_id in request.missing_item_ids:
            try:
                processed_items += 1
                self.update_missing_item(missing_item_id, request.update_data)
                successful_items += 1
            except Exception as e:
                failed_items += 1
                errors.append(f"Failed to update missing item {missing_item_id}: {str(e)}")
        
        return {
            "processed_items": processed_items,
            "successful_items": successful_items,
            "failed_items": failed_items,
            "errors": errors
        }
    
    def bulk_approval(self, request: BulkApprovalMissingItemRequest) -> dict:
        """Bulk update approval status for multiple missing items"""
        processed_items = 0
        successful_items = 0
        failed_items = 0
        errors = []
        
        for missing_item_id in request.missing_item_ids:
            try:
                processed_items += 1
                missing_item = self.get_missing_item_by_id(missing_item_id)
                if missing_item:
                    missing_item.approval = request.approval_status
                    missing_item.updated_at = datetime.now(timezone.utc)
                    successful_items += 1
                else:
                    failed_items += 1
                    errors.append(f"Missing item {missing_item_id} not found")
            except Exception as e:
                failed_items += 1
                errors.append(f"Failed to update approval for missing item {missing_item_id}: {str(e)}")
        
        self.db.commit()
        
        return {
            "processed_items": processed_items,
            "successful_items": successful_items,
            "failed_items": failed_items,
            "errors": errors
        }
    
    # =========================== 
    # Helper Methods
    # ===========================
    
    def _validate_visit_requirements(self, missing_item: MissingItem, note: Optional[str]):
        """Ensure visit status has the required data (branch, found items, note)."""
        if not missing_item.assigned_found_items:
            raise ValueError("Assign at least one found item before setting status to visit")

        for link in missing_item.assigned_found_items:
            if not link.branch_id:
                raise ValueError("Branch is required on assigned found items before visit status")
            if not note and not link.note:
                raise ValueError("A note is required before setting status to visit")

    async def _send_visit_notification(self, missing_item: MissingItem, branch: Branch, items: List[Item], note: Optional[str], current_user: User):
        """Notify reporter that matching items are available at a branch."""
        if not missing_item.user or not missing_item.user.email:
            return

        email_service = EmailNotificationService()
        item_titles = ", ".join([itm.title for itm in items]) if items else "items"

        subject = f"Update on your missing item: {missing_item.title}"
        text_body = (
            f"Hello {missing_item.user.first_name},\n\n"
            f"We have identified possible matches for your reported missing item \"{missing_item.title}\".\n"
            f"Branch to visit: {branch.branch_name_en or branch.branch_name_ar or 'branch'}\n"
            f"Items: {item_titles}\n"
            f"Note: {note or 'No additional note provided.'}\n\n"
            "Please visit the branch with proof of ownership.\n"
            "This is an automated message."
        )
        html_body = text_body.replace("\n", "<br/>")

        await email_service.send_email(
            to_email=missing_item.user.email,
            subject=subject,
            html_content=html_body,
            text_content=text_body
        )

    async def _send_approval_notification(self, missing_item: MissingItem, pending_item: Item, note: Optional[str], current_user: User):
        """Notify reporter that their missing item has been approved and they received their item back."""
        if not missing_item.user or not missing_item.user.email:
            return

        email_service = EmailNotificationService()
        user_name = f"{missing_item.user.first_name} {missing_item.user.last_name}".strip() or "User"

        subject = f"Your missing item has been approved: {missing_item.title}"
        text_body = (
            f"Hello {missing_item.user.first_name},\n\n"
            f"Great news! Your missing item report \"{missing_item.title}\" has been approved.\n\n"
            f"Your item has been matched with the following item in our system:\n"
            f"Item: {pending_item.title}\n"
            f"{f'Note: {note}' if note else ''}\n\n"
            f"Your item has been received back and the case is now closed.\n\n"
            f"Thank you for using our lost and found system.\n\n"
            "This is an automated message."
        )
        html_body = (
            f"<p>Hello {missing_item.user.first_name},</p>"
            f"<p>Great news! Your missing item report <strong>\"{missing_item.title}\"</strong> has been approved.</p>"
            f"<p>Your item has been matched with the following item in our system:</p>"
            f"<div style='background-color: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;'>"
            f"<strong>Item:</strong> {pending_item.title}<br/>"
            f"{f'<strong>Note:</strong> {note}<br/>' if note else ''}"
            f"</div>"
            f"<p>Your item has been received back and the case is now closed.</p>"
            f"<p>Thank you for using our lost and found system.</p>"
            f"<p><em>This is an automated message.</em></p>"
        )

        await email_service.send_email(
            to_email=missing_item.user.email,
            subject=subject,
            html_content=html_body,
            text_content=text_body
        )

    def _user_exists(self, user_id: str) -> bool:
        """Check if user exists"""
        return self.db.query(User).filter(User.id == user_id).first() is not None
    
    def _item_type_exists(self, item_type_id: str) -> bool:
        """Check if item type exists"""
        return self.db.query(ItemTypeModel).filter(ItemTypeModel.id == item_type_id).first() is not None
    
    def _missing_item_to_response(self, missing_item: MissingItem) -> MissingItemResponse:
        """Convert MissingItem model to MissingItemResponse"""
        # Get location information
        location = None
        if missing_item.addresses:
            current_address = next((addr for addr in missing_item.addresses if addr.is_current), None)
            if current_address and current_address.branch:
                location = LocationResponse(
                    organization_name=current_address.branch.organization.name_en if current_address.branch.organization else None,
                    branch_name=current_address.branch.branch_name_en if current_address.branch else None,
                    full_location=current_address.full_location
                )
        
        # Get images
        images = []
        if hasattr(missing_item, 'images') and missing_item.images:
            images = [
                {
                    "id": img.id,
                    "url": img.url,
                    "description": img.description,
                    "created_at": img.created_at,
                    "updated_at": img.updated_at
                }
                for img in missing_item.images
            ]
        
        return MissingItemResponse(
            id=missing_item.id,
            title=missing_item.title,
            description=missing_item.description,
            status=missing_item.status,
            temporary_deletion=missing_item.temporary_deletion,
            approval=missing_item.approval,
            item_type_id=missing_item.item_type_id,
            user_id=missing_item.user_id,
            created_at=missing_item.created_at,
            updated_at=missing_item.updated_at,
            location=location,
            images=images
        )
    
    def _missing_item_to_detail_response(self, missing_item: MissingItem) -> MissingItemDetailResponse:
        """Convert MissingItem model to MissingItemDetailResponse"""
        base_response = self._missing_item_to_response(missing_item)
        
        # Get item type information
        item_type = None
        if missing_item.item_type:
            item_type = {
                "id": missing_item.item_type.id,
                "name_ar": missing_item.item_type.name_ar,
                "name_en": missing_item.item_type.name_en,
                "description_ar": missing_item.item_type.description_ar,
                "description_en": missing_item.item_type.description_en,
                "created_at": missing_item.item_type.created_at,
                "updated_at": missing_item.item_type.updated_at
            }
        
        # Get user information
        user = None
        if missing_item.user:
            user = {
                "id": missing_item.user.id,
                "email": missing_item.user.email,
                "first_name": missing_item.user.first_name,
                "last_name": missing_item.user.last_name
            }
        
        # Get addresses information
        addresses = []
        if missing_item.addresses:
            addresses = [
                {
                    "id": addr.id,
                    "is_current": addr.is_current,
                    "branch": {
                        "id": addr.branch.id,
                        "branch_name": addr.branch.branch_name_en,
                        "branch_name_ar": addr.branch.branch_name_ar,
                        "organization": {
                            "id": addr.branch.organization.id,
                            "name": addr.branch.organization.name_en if addr.branch.organization else None,
                            "name_ar": addr.branch.organization.name_ar if addr.branch.organization else None,
                            "name_en": addr.branch.organization.name_en if addr.branch.organization else None
                        } if addr.branch.organization else None
                    } if addr.branch else None
                }
                for addr in missing_item.addresses
            ]

        assigned_found_items = []
        if hasattr(missing_item, "assigned_found_items") and missing_item.assigned_found_items:
            assigned_found_items = [
                {
                    "id": link.id,
                    "item_id": link.item_id,
                    "item_title": link.item.title if link.item else None,
                    "branch_id": link.branch_id,
                    "branch_name": link.branch.branch_name_en if link.branch else None,
                    "note": link.note,
                    "notified_at": link.notified_at,
                    "created_by": link.created_by,
                    "created_at": link.created_at,
                    "updated_at": link.updated_at,
                }
                for link in missing_item.assigned_found_items
            ]
        
        return MissingItemDetailResponse(
            **base_response.dict(),
            item_type=item_type,
            user=user,
            addresses=addresses,
            assigned_found_items=assigned_found_items
        )
    
    async def _send_new_missing_item_notification(self, missing_item: MissingItem):
        """Send notification about new missing item"""
        try:
            # Get admin email - you can configure this in environment variables
            admin_email = "albusaidi9094@gmail.com"  # This should be configurable
            
            # Get user information
            user = self.db.query(User).filter(User.id == missing_item.user_id).first()
            if not user:
                return
            
            # Get item type information
            item_type_name = "Unknown"
            if missing_item.item_type_id:
                item_type = self.db.query(ItemTypeModel).filter(ItemTypeModel.id == missing_item.item_type_id).first()
                if item_type:
                    item_type_name = item_type.name
            
            # Send notification to admin
            await send_new_missing_item_alert(
                admin_emails=[admin_email],
                missing_item_title=missing_item.title,
                missing_item_description=missing_item.description,
                item_type=item_type_name,
                reporter_name=f"{user.first_name} {user.last_name}".strip(),
                reporter_email=user.email,
                missing_item_url=None  # You can add URL generation here if needed
            )
        except Exception as e:
            # Log error but don't raise it
            print(f"Failed to send missing item notification: {e}")
