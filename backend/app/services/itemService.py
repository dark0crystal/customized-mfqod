from sqlalchemy.orm import Session, joinedload, object_session
from sqlalchemy import and_, or_, func
from typing import Optional, List, Tuple
from datetime import datetime, timezone
import uuid
import asyncio
import logging

# Import Models
from app.models import Item, ItemType as ItemTypeModel, User, Claim, Address, Branch, Organization, Image
from app.schemas.item_schema import (
    CreateItemRequest, 
    UpdateItemRequest, 
    ItemFilterRequest,
    BulkDeleteRequest,
    BulkUpdateRequest,
    BulkApprovalRequest,
    LocationResponse,
    ItemResponse,
    ItemDetailResponse
)
from app.services.notification_service import send_new_item_alert
from app.middleware.branch_auth_middleware import get_user_accessible_items

logger = logging.getLogger(__name__)

class ItemService:
    
    def __init__(self, db: Session):
        self.db = db
    
    # =========================== 
    # Create Operations
    # ===========================
    
    def create_item(self, item_data: CreateItemRequest) -> ItemResponse:
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
        
        # Send email notification to moderators about new item
        try:
            asyncio.create_task(self._send_new_item_notification(new_item))
        except Exception as e:
            # Don't fail the item creation if email fails
            pass
        
        # Get the full item with relationships for response
        full_item = self.get_item_by_id(new_item.id)
        return self._item_to_response(full_item) if full_item else self._item_to_response(new_item)
    
    # =========================== 
    # Read Operations
    # ===========================
    
    def get_item_by_id(self, item_id: str, include_deleted: bool = False) -> Optional[Item]:
        """Get a single item by ID (returns Item model for internal use)"""
        query = self.db.query(Item).options(
            joinedload(Item.item_type),
            joinedload(Item.user),
            joinedload(Item.addresses).joinedload(Address.branch).joinedload(Branch.organization)
        ).filter(Item.id == item_id)
        
        if not include_deleted:
            query = query.filter(Item.temporary_deletion == False)
        
        return query.first()
    
    def get_item_detail_by_id(self, item_id: str, include_deleted: bool = False) -> Optional[ItemDetailResponse]:
        """Get a single item by ID with full details for API response"""
        item = self.get_item_by_id(item_id, include_deleted)
        return self._item_to_detail_response(item) if item else None
    
    def get_items(self, filters: ItemFilterRequest, user_id: Optional[str] = None) -> Tuple[List[ItemResponse], int]:
        """Get items with filtering and pagination"""
        query = self.db.query(Item).options(
            joinedload(Item.item_type),
            joinedload(Item.user),
            joinedload(Item.addresses).joinedload(Address.branch).joinedload(Branch.organization)
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
        
        if filters.branch_id:
            query = query.join(Address).filter(Address.branch_id == filters.branch_id, Address.is_current == True)
        
        if filters.date_from:
            query = query.filter(Item.created_at >= filters.date_from)
        
        if filters.date_to:
            query = query.filter(Item.created_at <= filters.date_to)
        
        # Apply branch-based access control if user_id is provided
        if user_id:
            try:
                accessible_items = get_user_accessible_items(user_id, self.db)
                if accessible_items:
                    # Filter out None values to avoid SQL errors
                    accessible_items = [item_id for item_id in accessible_items if item_id is not None]
                    if accessible_items:
                        query = query.filter(Item.id.in_(accessible_items))
                    else:
                        # User has no accessible items, return empty result
                        return [], 0
                else:
                    # User has no accessible items, return empty result
                    return [], 0
            except Exception as e:
                logger.error(f"Error getting accessible items for user {user_id}: {e}")
                # If we can't determine accessible items, return empty to be safe
                return [], 0
        
        # Get total count before pagination
        try:
            total = query.count()
        except Exception as e:
            logger.error(f"Error counting items: {e}")
            # If count fails, try to get items anyway and return 0 for total
            total = 0
        
        # Apply pagination
        try:
            items = query.offset(filters.skip).limit(filters.limit).all()
        except Exception as e:
            logger.error(f"Error fetching items: {e}")
            # If fetching fails, return empty list
            return [], total if total else 0
        
        # Convert to response objects with location data
        # Handle errors gracefully - if one item fails, skip it and continue
        item_responses = []
        for item in items:
            try:
                item_response = self._item_to_response(item)
                item_responses.append(item_response)
            except Exception as e:
                logger.warning(f"Error converting item {item.id if item else 'unknown'} to response: {e}")
                # Continue processing other items instead of failing the entire request
                continue
        
        return item_responses, total
    
    def get_items_by_user(self, user_id: str, include_deleted: bool = False, 
                         skip: int = 0, limit: int = 100) -> Tuple[List[ItemResponse], int]:
        """Get all items for a specific user"""
        try:
            if not self._user_exists(user_id):
                raise ValueError("User not found")
            
            # Eagerly load relationships to avoid lazy loading issues
            query = self.db.query(Item).options(
                joinedload(Item.item_type),
                joinedload(Item.user),
                joinedload(Item.addresses).joinedload(Address.branch).joinedload(Branch.organization)
            ).filter(Item.user_id == user_id)
            
            if not include_deleted:
                query = query.filter(Item.temporary_deletion == False)
            
            # Get total count before pagination
            try:
                total = query.count()
            except Exception as e:
                logger.error(f"Error counting items for user {user_id}: {e}")
                total = 0
            
            # Apply pagination
            try:
                items = query.offset(skip).limit(limit).all()
            except Exception as e:
                logger.error(f"Error fetching items for user {user_id}: {e}")
                return [], total if total else 0
            
            # Convert to response objects with location data
            # Handle errors gracefully - if one item fails, skip it and continue
            item_responses = []
            for item in items:
                try:
                    item_response = self._item_to_response(item)
                    item_responses.append(item_response)
                except Exception as e:
                    logger.warning(f"Error converting item {item.id if item else 'unknown'} to response: {e}")
                    # Continue processing other items instead of failing the entire request
                    continue
            
            return item_responses, total
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error in get_items_by_user for user {user_id}: {e}", exc_info=True)
            raise
    
    def search_items(self, search_term: str, filters: ItemFilterRequest, user_id: Optional[str] = None) -> Tuple[List[ItemResponse], int]:
        """Search items by title, description, or item ID"""
        search_term_normalized = search_term.strip()
        
        query = self.db.query(Item).options(
            joinedload(Item.item_type),
            joinedload(Item.user),
            joinedload(Item.addresses).joinedload(Address.branch).joinedload(Branch.organization)
        ).filter(
            or_(
                Item.title.ilike(f"%{search_term}%"),
                Item.description.ilike(f"%{search_term}%"),
                # Search by full item ID (case-insensitive)
                Item.id.ilike(f"%{search_term_normalized}%"),
                # Search by first 8 characters of ID (for shortened display IDs)
                func.upper(func.substring(Item.id, 1, 8)).ilike(f"%{search_term_normalized.upper()}%")
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
        
        if filters.branch_id:
            query = query.join(Address).filter(Address.branch_id == filters.branch_id, Address.is_current == True)
        
        if filters.date_from:
            query = query.filter(Item.created_at >= filters.date_from)
        
        if filters.date_to:
            query = query.filter(Item.created_at <= filters.date_to)
        
        # Apply branch-based access control if user_id is provided
        if user_id:
            accessible_items = get_user_accessible_items(user_id, self.db)
            if accessible_items:
                query = query.filter(Item.id.in_(accessible_items))
            else:
                # User has no accessible items, return empty result
                return [], 0
        
        total = query.count()
        items = query.offset(filters.skip).limit(filters.limit).all()
        
        # Convert to response objects with location data
        item_responses = [self._item_to_response(item) for item in items]
        
        return item_responses, total
    
    # =========================== 
    # Update Operations
    # ===========================
    
    def update_item(self, item_id: str, update_data: UpdateItemRequest) -> Optional[ItemResponse]:
        """Update an existing item"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Validate item type if being updated
        if update_data.item_type_id and not self._item_type_exists(update_data.item_type_id):
            raise ValueError("Item type not found")
        
        # Update fields that are provided
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(item, field, value)
        
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return self._item_to_response(item)
    
    def toggle_approval(self, item_id: str) -> Optional[ItemResponse]:
        """Toggle the approval status of an item"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        item.approval = not item.approval
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return self._item_to_response(item)
    
    def patch_item(self, item_id: str, update_data: dict) -> Optional[ItemResponse]:
        """Patch an item with location history tracking"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Check if location is being changed
        location_changed = update_data.get('locationChanged', False)
        original_location = update_data.get('originalLocation')
        
        # Update basic fields
        basic_fields = ['title', 'description', 'type']
        for field in basic_fields:
            if field in update_data:
                setattr(item, field, update_data[field])
        
        # Handle location update with history tracking
        if location_changed and original_location:
            # Mark all current addresses as not current
            current_addresses = self.db.query(Address).filter(
                Address.item_id == item_id,
                Address.is_current == True
            ).all()
            
            for addr in current_addresses:
                addr.is_current = False
                addr.updated_at = datetime.now(timezone.utc)
        
        # Create new address entry if location info is provided
        if 'location' in update_data or 'organization_name' in update_data or 'branch_name' in update_data:
            # Find or create branch if organization and branch names are provided
            branch_id = None
            if update_data.get('organization_name') and update_data.get('branch_name'):
                # Try to find existing organization and branch
                organization = self.db.query(Organization).filter(
                    Organization.organization_name == update_data['organization_name']
                ).first()
                
                if organization:
                    branch = self.db.query(Branch).filter(
                        Branch.branch_name == update_data['branch_name'],
                        Branch.organization_id == organization.id
                    ).first()
                    
                    if branch:
                        branch_id = branch.id
            
            # Create new address entry
            new_address = Address(
                id=str(uuid.uuid4()),
                item_id=item_id,
                branch_id=branch_id,
                full_location=update_data.get('location'),
                is_current=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            self.db.add(new_address)
        
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return self._item_to_response(item)
    
    def update_claims_count(self, item_id: str) -> Optional[ItemResponse]:
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
        
        return self._item_to_response(item)
    
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
    
    def restore_item(self, item_id: str) -> Optional[ItemResponse]:
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
        
        return self._item_to_response(item)
    
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
    
    def _build_location_info(self, item: Item) -> Optional[LocationResponse]:
        """Build location information from item addresses"""
        try:
            if not item.addresses:
                return None
            
            # Get the current address (or first address if no current one)
            current_address = None
            for address in item.addresses:
                if address.is_current:
                    current_address = address
                    break
            
            if not current_address and item.addresses:
                current_address = item.addresses[0]
            
            if not current_address or not current_address.branch:
                return None
            
            branch = current_address.branch
            organization = branch.organization if branch.organization else None
            
            # Build full location string using English names first, then Arabic
            organization_name = None
            if organization:
                organization_name = organization.name_en or organization.name_ar
            
            branch_name = branch.branch_name_en or branch.branch_name_ar if branch else None
            
            full_location = None
            if organization_name and branch_name:
                full_location = f"{branch_name}, {organization_name}"
            elif branch_name:
                full_location = branch_name
            elif organization_name:
                full_location = organization_name
            
            return LocationResponse(
                organization_name_ar=organization.name_ar if organization else None,
                organization_name_en=organization.name_en if organization else None,
                branch_name_ar=branch.branch_name_ar if branch else None,
                branch_name_en=branch.branch_name_en if branch else None,
                full_location=full_location
            )
        except Exception as e:
            # Log error but don't fail - return None if location can't be built
            logger.warning(f"Error building location info for item {item.id if item else 'unknown'}: {e}")
            return None
    
    def _item_to_response(self, item: Item) -> ItemResponse:
        """Convert Item model to ItemResponse with location data and images"""
        from app.schemas.item_schema import ImageResponse
        
        try:
            location = self._build_location_info(item)
        except Exception as e:
            logger.warning(f"Error building location for item {item.id if item else 'unknown'}: {e}")
            location = None
        
        # Get images for this item
        images = []
        try:
            # Access images property safely - ensure we're not triggering lazy loading issues
            # The images property uses object_session which might fail if session is detached
            session = object_session(item)
            if session and hasattr(item, 'images'):
                try:
                    item_images = item.images
                    if item_images is not None:
                        item_images = list(item_images) if item_images else []
                        images = [
                            ImageResponse(
                                id=img.id,
                                url=img.url,
                                description=img.description,
                                created_at=img.created_at,
                                updated_at=img.updated_at
                            )
                            for img in item_images
                            if img is not None and hasattr(img, 'id')
                        ]
                except Exception as img_error:
                    # If accessing images property fails, try direct query
                    logger.warning(f"Error accessing images property for item {item.id if item else 'unknown'}: {img_error}")
                    try:
                        # Fallback: query images directly
                        item_images = self.db.query(Image).filter(
                            Image.imageable_type == "item",
                            Image.imageable_id == item.id
                        ).all()
                        images = [
                            ImageResponse(
                                id=img.id,
                                url=img.url,
                                description=img.description,
                                created_at=img.created_at,
                                updated_at=img.updated_at
                            )
                            for img in item_images
                            if img is not None
                        ]
                    except Exception as query_error:
                        logger.warning(f"Error querying images directly for item {item.id if item else 'unknown'}: {query_error}")
                        images = []
        except Exception as e:
            # If there's an error getting images, just continue with empty list
            logger.warning(f"Error getting images for item {item.id if item else 'unknown'}: {e}")
            images = []
        
        try:
            return ItemResponse(
                id=str(item.id) if item.id else "",
                title=item.title or "",
                description=item.description or "",
                claims_count=item.claims_count or 0,
                temporary_deletion=item.temporary_deletion if item.temporary_deletion is not None else False,
                approval=item.approval if item.approval is not None else False,
                approved_claim_id=str(item.approved_claim_id) if item.approved_claim_id else None,
                item_type_id=str(item.item_type_id) if item.item_type_id else None,
                user_id=str(item.user_id) if item.user_id else None,
                created_at=item.created_at,
                updated_at=item.updated_at,
                location=location,
                images=images
            )
        except Exception as e:
            logger.error(f"Error creating ItemResponse for item {item.id if item else 'unknown'}: {e}")
            raise
    
    def _item_to_detail_response(self, item: Item) -> ItemDetailResponse:
        """Convert Item model to ItemDetailResponse with all related data"""
        from app.schemas.item_schema import ImageResponse
        
        location = self._build_location_info(item)
        
        # Get images for this item
        images = []
        try:
            item_images = item.images  # Using the property we added to the model
            images = [
                ImageResponse(
                    id=img.id,
                    url=img.url,
                    description=img.description,
                    created_at=img.created_at,
                    updated_at=img.updated_at
                )
                for img in item_images
            ]
        except Exception as e:
            # If there's an error getting images, just continue with empty list
            images = []
        
        # Get item type information
        item_type = None
        if item.item_type:
            item_type = {
                "id": item.item_type.id,
                "name_ar": item.item_type.name_ar,
                "name_en": item.item_type.name_en,
                "description_ar": item.item_type.description_ar,
                "description_en": item.item_type.description_en,
                "created_at": item.item_type.created_at,
                "updated_at": item.item_type.updated_at
            }
        
        return ItemDetailResponse(
            id=item.id,
            title=item.title,
            description=item.description,
            claims_count=item.claims_count,
            temporary_deletion=item.temporary_deletion,
            approval=item.approval,
            approved_claim_id=item.approved_claim_id,
            item_type_id=item.item_type_id,
            user_id=item.user_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
            location=location,
            images=images,
            item_type=item_type,
            user=item.user,
            addresses=item.addresses
        )
    
    async def _send_new_item_notification(self, item: Item) -> None:
        """Send notification to moderators about new item"""
        try:
            # Get item details with related data
            item_with_details = self.db.query(Item).options(
                joinedload(Item.user),
                joinedload(Item.item_type)
            ).filter(Item.id == item.id).first()
            
            if not item_with_details or not item_with_details.user:
                return
            
            # Get moderator emails (users with admin or moderator roles)
            moderators = self.db.query(User).filter(
                or_(User.role == "admin", User.role == "moderator")
            ).all()
            
            moderator_emails = [mod.email for mod in moderators if mod.email]
            
            if not moderator_emails:
                return
            
            # Send notification
            await send_new_item_alert(
                moderator_emails=moderator_emails,
                item_title=item_with_details.title,
                item_description=item_with_details.description,
                item_type=item_with_details.item_type.name_en or item_with_details.item_type.name_ar if item_with_details.item_type else "Unknown",
                poster_name=f"{item_with_details.user.first_name} {item_with_details.user.last_name}",
                poster_email=item_with_details.user.email,
                item_url=f"/dashboard/items/{item_with_details.id}"
            )
            
        except Exception as e:
            # Log but don't raise - item creation should still succeed
            pass