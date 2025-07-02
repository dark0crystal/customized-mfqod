from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import Optional, List, Tuple
from datetime import datetime, timezone
import uuid

# Import Models
from models import Item, ItemType as ItemTypeModel, User, Claim
from schemas.item_schema import (
    CreateItemRequest, 
    UpdateItemRequest, 
    ItemFilterRequest,
    BulkDeleteRequest,
    BulkUpdateRequest,
    BulkApprovalRequest
)

class ItemService:
    
    def __init__(self, db: Session):
        self.db = db
    
    # =========================== 
    # Create Operations
    # ===========================
    
    def create_item(self, item_data: CreateItemRequest) -> Item:
        """Create a new item"""
        # Validate user exists
        if not self._user_exists(item_data.user_id):
            raise ValueError("User not found")
        
        # Validate item type exists if provided
        if item_data.item_type_id and not self._item_type_exists(item_data.item_type_id):
            raise ValueError("Item type not found")
        
        new_item = Item(
            id=str(uuid.uuid4()),
            title=item_data.title,
            description=item_data.description,
            user_id=item_data.user_id,
            item_type_id=item_data.item_type_id,
            approval=item_data.approval,
            temporary_deletion=item_data.temporary_deletion,
            claims_count=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.db.add(new_item)
        self.db.commit()
        self.db.refresh(new_item)
        
        return new_item
    
    # =========================== 
    # Read Operations
    # ===========================
    
    def get_item_by_id(self, item_id: str, include_deleted: bool = False) -> Optional[Item]:
        """Get a single item by ID"""
        query = self.db.query(Item).options(
            joinedload(Item.item_type),
            joinedload(Item.user)
        ).filter(Item.id == item_id)
        
        if not include_deleted:
            query = query.filter(Item.temporary_deletion == False)
        
        return query.first()
    
    def get_items(self, filters: ItemFilterRequest) -> Tuple[List[Item], int]:
        """Get items with filtering and pagination"""
        query = self.db.query(Item).options(
            joinedload(Item.item_type),
            joinedload(Item.user)
        )
        
        # Apply filters
        if not filters.include_deleted:
            query = query.filter(Item.temporary_deletion == False)
        
        if filters.user_id:
            query = query.filter(Item.user_id == filters.user_id)
        
        if filters.approved_only:
            query = query.filter(Item.approval == True)
        
        if filters.item_type_id:
            query = query.filter(Item.item_type_id == filters.item_type_id)
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        items = query.offset(filters.skip).limit(filters.limit).all()
        
        return items, total
    
    def get_items_by_user(self, user_id: str, include_deleted: bool = False, 
                         skip: int = 0, limit: int = 100) -> Tuple[List[Item], int]:
        """Get all items for a specific user"""
        if not self._user_exists(user_id):
            raise ValueError("User not found")
        
        query = self.db.query(Item).filter(Item.user_id == user_id)
        
        if not include_deleted:
            query = query.filter(Item.temporary_deletion == False)
        
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        
        return items, total
    
    def search_items(self, search_term: str, filters: ItemFilterRequest) -> Tuple[List[Item], int]:
        """Search items by title or description"""
        query = self.db.query(Item).options(
            joinedload(Item.item_type),
            joinedload(Item.user)
        ).filter(
            or_(
                Item.title.ilike(f"%{search_term}%"),
                Item.description.ilike(f"%{search_term}%")
            )
        )
        
        # Apply additional filters
        if not filters.include_deleted:
            query = query.filter(Item.temporary_deletion == False)
        
        if filters.user_id:
            query = query.filter(Item.user_id == filters.user_id)
        
        if filters.approved_only:
            query = query.filter(Item.approval == True)
        
        if filters.item_type_id:
            query = query.filter(Item.item_type_id == filters.item_type_id)
        
        total = query.count()
        items = query.offset(filters.skip).limit(filters.limit).all()
        
        return items, total
    
    # =========================== 
    # Update Operations
    # ===========================
    
    def update_item(self, item_id: str, update_data: UpdateItemRequest) -> Optional[Item]:
        """Update an existing item"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Validate item type if being updated
        if update_data.item_type_id and not self._item_type_exists(update_data.item_type_id):
            raise ValueError("Item type not found")
        
        # Update fields that are provided
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(item, field, value)
        
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    def toggle_approval(self, item_id: str) -> Optional[Item]:
        """Toggle the approval status of an item"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        item.approval = not item.approval
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    def update_claims_count(self, item_id: str) -> Optional[Item]:
        """Update the claims count for an item"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Count actual claims
        claims_count = self.db.query(func.count(Claim.id)).filter(Claim.item_id == item_id).scalar()
        item.claims_count = claims_count
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    # =========================== 
    # Delete Operations
    # ===========================
    
    def delete_item(self, item_id: str, permanent: bool = False) -> bool:
        """Delete an item (soft delete by default)"""
        item = self.db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise ValueError("Item not found")
        
        if permanent:
            self.db.delete(item)
        else:
            item.temporary_deletion = True
            item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        return True
    
    def restore_item(self, item_id: str) -> Optional[Item]:
        """Restore a soft-deleted item"""
        item = self.db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise ValueError("Item not found")
        
        if not item.temporary_deletion:
            raise ValueError("Item is not deleted")
        
        item.temporary_deletion = False
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    # =========================== 
    # Bulk Operations
    # ===========================
    
    def bulk_delete(self, request: BulkDeleteRequest) -> dict:
        """Bulk delete items"""
        successful = 0
        failed = 0
        errors = []
        
        for item_id in request.item_ids:
            try:
                self.delete_item(item_id, request.permanent)
                successful += 1
            except Exception as e:
                failed += 1
                errors.append(f"Item {item_id}: {str(e)}")
        
        return {
            "processed_items": len(request.item_ids),
            "successful_items": successful,
            "failed_items": failed,
            "errors": errors
        }
    
    def bulk_update(self, request: BulkUpdateRequest) -> dict:
        """Bulk update items"""
        successful = 0
        failed = 0
        errors = []
        
        for item_id in request.item_ids:
            try:
                self.update_item(item_id, request.update_data)
                successful += 1
            except Exception as e:
                failed += 1
                errors.append(f"Item {item_id}: {str(e)}")
        
        return {
            "processed_items": len(request.item_ids),
            "successful_items": successful,
            "failed_items": failed,
            "errors": errors
        }
    
    def bulk_approval(self, request: BulkApprovalRequest) -> dict:
        """Bulk update approval status"""
        successful = 0
        failed = 0
        errors = []
        
        for item_id in request.item_ids:
            try:
                item = self.get_item_by_id(item_id)
                if not item:
                    raise ValueError("Item not found")
                
                item.approval = request.approval_status
                item.updated_at = datetime.now(timezone.utc)
                self.db.commit()
                successful += 1
            except Exception as e:
                failed += 1
                errors.append(f"Item {item_id}: {str(e)}")
        
        return {
            "processed_items": len(request.item_ids),
            "successful_items": successful,
            "failed_items": failed,
            "errors": errors
        }
    
    # =========================== 
    # Statistics
    # ===========================
    
    def get_item_statistics(self, user_id: Optional[str] = None) -> dict:
        """Get item statistics"""
        query = self.db.query(Item)
        
        if user_id:
            query = query.filter(Item.user_id == user_id)
        
        total_items = query.count()
        active_items = query.filter(Item.temporary_deletion == False).count()
        approved_items = query.filter(and_(Item.approval == True, Item.temporary_deletion == False)).count()
        pending_items = query.filter(and_(Item.approval == False, Item.temporary_deletion == False)).count()
        deleted_items = query.filter(Item.temporary_deletion == True).count()
        
        return {
            "total_items": total_items,
            "active_items": active_items,
            "approved_items": approved_items,
            "pending_items": pending_items,
            "deleted_items": deleted_items
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