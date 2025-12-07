from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import Optional, List, Tuple
from datetime import datetime, timezone
import uuid
import asyncio

# Import Models
from app.models import MissingItem, ItemType as ItemTypeModel, User, Address, Branch, Organization, Image
from app.schemas.missing_item_schema import (
    CreateMissingItemRequest, 
    UpdateMissingItemRequest, 
    MissingItemFilterRequest,
    BulkDeleteMissingItemRequest,
    BulkUpdateMissingItemRequest,
    BulkApprovalMissingItemRequest,
    LocationResponse,
    MissingItemResponse,
    MissingItemDetailResponse
)
from app.services.notification_service import send_new_missing_item_alert

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
            joinedload(MissingItem.addresses).joinedload(Address.branch).joinedload(Branch.organization)
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
        
        # Missing items by status
        lost_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "lost"
        ).count()
        
        found_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "found"
        ).count()
        
        returned_count = base_query.filter(
            MissingItem.temporary_deletion == False,
            MissingItem.status == "returned"
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
            "lost_items": lost_count,
            "found_items": found_count,
            "returned_items": returned_count,
            "approved_items": approved_count,
            "pending_items": pending_count,
            "return_rate": (returned_count / lost_count * 100) if lost_count > 0 else 0.0
        }
    
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
        
        if status not in ["lost", "found", "returned"]:
            raise ValueError("Invalid status. Must be 'lost', 'found', or 'returned'")
        
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
                        "branch_name": addr.branch.branch_name_en if addr.branch else None,
                        "branch_name_ar": addr.branch.branch_name_ar if addr.branch else None,
                        "organization": {
                            "id": addr.branch.organization.id,
                            "name": addr.branch.organization.name_en if addr.branch.organization else None,
                            "name_ar": addr.branch.organization.name_ar if addr.branch.organization else None,
                            "name_en": addr.branch.organization.name_en if addr.branch.organization else None
                        } if addr.branch and addr.branch.organization else None
                    } if addr.branch else None
                }
                for addr in missing_item.addresses
            ]
        
        return MissingItemDetailResponse(
            **base_response.dict(),
            item_type=item_type,
            user=user,
            addresses=addresses
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
