from sqlalchemy.orm import Session, joinedload, object_session
from sqlalchemy import and_, or_, func
from typing import Optional, List, Tuple
from datetime import datetime, timezone
import uuid
import asyncio
import logging

# Import Models
from app.models import Item, ItemType as ItemTypeModel, User, Claim, Address, Branch, Organization, Image, ItemStatus
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
from app.middleware.branch_auth_middleware import get_user_accessible_items, is_branch_manager
from app.services import permissionServices

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
        
        # Handle status field
        status_value = item_data.status.value if hasattr(item_data.status, 'value') else item_data.status
        
        # Handle is_hidden field - use value from request or default to False
        is_hidden_value = item_data.is_hidden if item_data.is_hidden is not None else False
        
        new_item = Item(
            id=str(uuid.uuid4()),
            title=item_data.title,
            description=item_data.description,
            internal_description=item_data.internal_description,
            user_id=item_data.user_id,
            item_type_id=item_data.item_type_id,
            status=status_value,
            temporary_deletion=item_data.temporary_deletion,
            is_hidden=is_hidden_value,
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
        return self._item_to_response(full_item, item_data.user_id) if full_item else self._item_to_response(new_item, item_data.user_id)
    
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
    
    def get_item_detail_by_id(self, item_id: str, include_deleted: bool = False, user_id: Optional[str] = None) -> Optional[ItemDetailResponse]:
        """Get a single item by ID with full details for API response"""
        item = self.get_item_by_id(item_id, include_deleted)
        return self._item_to_detail_response(item, user_id) if item else None
    
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
        
        # Status filtering (new way)
        if filters.status:
            query = query.filter(Item.status == filters.status.value)
        elif filters.statuses:
            status_values = [s.value for s in filters.statuses]
            query = query.filter(Item.status.in_(status_values))
        
        # Backward compatibility: approved_only filter
        if filters.approved_only:
            query = query.filter(Item.status == ItemStatus.APPROVED.value)
        
        if filters.item_type_id:
            query = query.filter(Item.item_type_id == filters.item_type_id)
        
        if filters.branch_id:
            query = query.join(Address).filter(Address.branch_id == filters.branch_id, Address.is_current == True)
        
        if filters.date_from:
            query = query.filter(Item.created_at >= filters.date_from)
        
        if filters.date_to:
            query = query.filter(Item.created_at <= filters.date_to)
        
        # Branch-based access control: Filter items by user's branch assignments
        # Security: When user_id is provided, only show items from branches the user manages
        # When user_id is None, show all items (used for admin views or public search)
        # This prevents users from seeing items outside their branch scope
        if user_id:
            try:
                accessible_items = get_user_accessible_items(user_id, self.db)
                logger.info(f"User {user_id} has {len(accessible_items) if accessible_items else 0} accessible items")
                if accessible_items:
                    # Filter out None values to prevent SQL errors
                    accessible_items = [item_id for item_id in accessible_items if item_id is not None]
                    if accessible_items:
                        logger.info(f"Filtering items to {len(accessible_items)} accessible items for user {user_id}")
                        query = query.filter(Item.id.in_(accessible_items))
                    else:
                        # Security: Return empty if user has no accessible items
                        logger.info(f"User {user_id} has no accessible items (all None), returning empty")
                        return [], 0
                else:
                    # Security: Return empty if user has no accessible items
                    logger.info(f"User {user_id} has no accessible items, returning empty")
                    return [], 0
            except Exception as e:
                logger.error(f"Error getting accessible items for user {user_id}: {e}")
                # Security: Fail-safe - return empty if access control check fails
                return [], 0
        else:
            logger.info("No user_id provided, showing all items (no branch filtering)")
        
        # Get total count before pagination
        try:
            total = query.count()
        except Exception as e:
            logger.error(f"Error counting items: {e}")
            # If count fails, try to get items anyway and return 0 for total
            total = 0
        
        # Apply ordering (newest first) and pagination
        try:
            items = query.order_by(Item.created_at.desc()).offset(filters.skip).limit(filters.limit).all()
        except Exception as e:
            logger.error(f"Error fetching items: {e}")
            # If fetching fails, return empty list
            return [], total if total else 0
        
        # Convert to response objects with location data
        # Handle errors gracefully - if one item fails, skip it and continue
        item_responses = []
        for item in items:
            try:
                item_response = self._item_to_response(item, user_id)
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
            
            # Apply ordering (newest first) and pagination
            try:
                items = query.order_by(Item.created_at.desc()).offset(skip).limit(limit).all()
            except Exception as e:
                logger.error(f"Error fetching items for user {user_id}: {e}")
                return [], total if total else 0
            
            # Convert to response objects with location data
            # Handle errors gracefully - if one item fails, skip it and continue
            item_responses = []
            for item in items:
                try:
                    item_response = self._item_to_response(item, user_id)
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
        
        # Status filtering (new way) - must match get_items logic
        if filters.status:
            query = query.filter(Item.status == filters.status.value)
        elif filters.statuses:
            status_values = [s.value for s in filters.statuses]
            query = query.filter(Item.status.in_(status_values))
        
        # Backward compatibility: approved_only filter
        if filters.approved_only:
            query = query.filter(Item.status == ItemStatus.APPROVED.value)
        
        if filters.item_type_id:
            query = query.filter(Item.item_type_id == filters.item_type_id)
        
        if filters.branch_id:
            query = query.join(Address).filter(Address.branch_id == filters.branch_id, Address.is_current == True)
        
        if filters.date_from:
            query = query.filter(Item.created_at >= filters.date_from)
        
        if filters.date_to:
            query = query.filter(Item.created_at <= filters.date_to)
        
        # Apply branch-based access control if user_id is provided
        # When user_id is provided, it means we want to filter by branch access (managed items view)
        # When user_id is None, it means show all items (all items view)
        # IMPORTANT: This must be applied AFTER all other filters to ensure proper filtering
        if user_id:
            # Always apply branch-based filtering when user_id is provided
            # This ensures "My Managed Items" shows only items the user can access
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
                logger.error(f"Error getting accessible items for user {user_id} in search: {e}")
                # If we can't determine accessible items, return empty to be safe
                return [], 0
        
        total = query.count()
        items = query.order_by(Item.created_at.desc()).offset(filters.skip).limit(filters.limit).all()
        
        # Convert to response objects with location data
        item_responses = [self._item_to_response(item, user_id) for item in items]
        
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
        
        # Handle status field
        if 'status' in update_dict and update_dict['status'] is not None:
            status_value = update_dict['status'].value if hasattr(update_dict['status'], 'value') else update_dict['status']
            item.status = status_value
            del update_dict['status']
        
        # Update other fields
        for field, value in update_dict.items():
            setattr(item, field, value)
        
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        return self._item_to_response(item)
    
    def toggle_approval(self, item_id: str, user_id: Optional[str] = None, ip_address: str = "", user_agent: Optional[str] = None) -> Optional[ItemResponse]:
        """Toggle the approval status of an item (toggles between approved and pending)"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        old_status = item.status
        
        # Business rule: Toggle between approved and pending states only
        # Cancelled status is not affected by toggle operation
        if item.status == ItemStatus.APPROVED.value:
            item.status = ItemStatus.PENDING.value
            # Business rule: When unapproving an item, also unapprove the associated claim
            # This maintains data consistency - approved items must have approved claims
            if item.approved_claim_id:
                claim = self.db.query(Claim).filter(Claim.id == item.approved_claim_id).first()
                if claim:
                    claim.approval = False
                    claim.updated_at = datetime.now(timezone.utc)
                    logger.info(f"Unapproved claim {claim.id} for item {item_id} due to status change from approved to pending")
            # Clear approved_claim_id to maintain referential integrity
            item.approved_claim_id = None
        elif item.status == ItemStatus.PENDING.value:
            item.status = ItemStatus.APPROVED.value
        # Business rule: Cancelled status is immutable via toggle
        
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        # Log the status change if user_id is provided and status actually changed
        if user_id and old_status != item.status:
            try:
                from app.services.auditLogService import AuditLogService
                audit_service = AuditLogService(self.db)
                audit_service.create_item_status_change_log(
                    item_id=item_id,
                    old_status=old_status,
                    new_status=item.status,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except Exception as e:
                logger.error(f"Failed to create audit log for item status change: {e}")
        
        return self._item_to_response(item)
    
    def update_status(self, item_id: str, new_status: ItemStatus, user_id: Optional[str] = None, ip_address: str = "", user_agent: Optional[str] = None) -> Optional[ItemResponse]:
        """Update item status explicitly"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        old_status = item.status
        item.status = new_status.value
        item.updated_at = datetime.now(timezone.utc)
        
        # Business rule: When changing from approved to pending, unapprove associated claim
        # This maintains data consistency - approved items require approved claims
        if old_status == ItemStatus.APPROVED.value and new_status == ItemStatus.PENDING:
            if item.approved_claim_id:
                claim = self.db.query(Claim).filter(Claim.id == item.approved_claim_id).first()
                if claim:
                    claim.approval = False
                    claim.updated_at = datetime.now(timezone.utc)
                    logger.info(f"Unapproved claim {claim.id} for item {item_id} due to status change from approved to pending")
            # Clear approved_claim_id to maintain referential integrity
            item.approved_claim_id = None
        
        self.db.commit()
        self.db.refresh(item)
        
        # Log the status change if user_id is provided and status actually changed
        if user_id and old_status != new_status.value:
            try:
                from app.services.auditLogService import AuditLogService
                from app.models import AuditActionType
                audit_service = AuditLogService(self.db)
                audit_service.create_item_status_change_log(
                    item_id=item_id,
                    old_status=old_status,
                    new_status=new_status.value,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except Exception as e:
                logger.error(f"Failed to create audit log for item status change: {e}")
        
        return self._item_to_response(item)
    
    def approve_item(self, item_id: str, user_id: Optional[str] = None, ip_address: str = "", user_agent: Optional[str] = None) -> ItemResponse:
        """Approve an item (change status from pending to approved)
        Requires: item status must be 'pending' and item must have an approved claim
        """
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Check if item status is pending
        if item.status != ItemStatus.PENDING.value:
            raise ValueError(f"Item status must be 'pending' to approve. Current status: {item.status}")
        
        # Business rule: Items can only be approved if they have an approved claim
        # This ensures items are only approved after a valid claim has been processed
        if not item.approved_claim_id:
            raise ValueError("Item must have an approved claim before it can be approved")
        
        old_status = item.status
        
        # Change status to approved
        item.status = ItemStatus.APPROVED.value
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        # Log the status change if user_id is provided
        if user_id:
            try:
                from app.services.auditLogService import AuditLogService
                audit_service = AuditLogService(self.db)
                audit_service.create_item_status_change_log(
                    item_id=item_id,
                    old_status=old_status,
                    new_status=item.status,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except Exception as e:
                logger.error(f"Failed to create audit log for item approval: {e}")
        
        logger.info(f"Item {item_id} approved (status changed from pending to approved)")
        
        return self._item_to_response(item)
    
    def toggle_item_hidden_status(self, item_id: str) -> Optional[ItemResponse]:
        """Toggle the hidden status of an item (controls visibility of all images)"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Toggle is_hidden
        item.is_hidden = not item.is_hidden
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        logger.info(f"Item {item_id} hidden status toggled to {item.is_hidden}")
        
        return self._item_to_response(item)
    
    def set_item_hidden_status(self, item_id: str, is_hidden: bool) -> Optional[ItemResponse]:
        """Set the hidden status of an item (controls visibility of all images)"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Set is_hidden
        item.is_hidden = is_hidden
        item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(item)
        
        logger.info(f"Item {item_id} hidden status set to {is_hidden}")
        
        return self._item_to_response(item)
    
    def patch_item(self, item_id: str, update_data: dict, user_id: Optional[str] = None, ip_address: str = "", user_agent: Optional[str] = None) -> Optional[ItemResponse]:
        """Patch an item with location history tracking"""
        item = self.get_item_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        
        # Track old status for audit logging
        old_status = item.status
        
        # Check if location is being changed
        location_changed = update_data.get('locationChanged', False)
        original_location = update_data.get('originalLocation')
        
        # Update basic fields
        basic_fields = ['title', 'description', 'type']
        for field in basic_fields:
            if field in update_data:
                setattr(item, field, update_data[field])
        
        # Handle status update
        if 'status' in update_data:
            status_value = update_data['status']
            # Validate status value
            if status_value in [ItemStatus.PENDING.value, ItemStatus.APPROVED.value, ItemStatus.CANCELLED.value]:
                item.status = status_value
                # Update the associated claim's approval status to False when changing from approved to pending
                if old_status == ItemStatus.APPROVED.value and status_value == ItemStatus.PENDING.value:
                    if item.approved_claim_id:
                        claim = self.db.query(Claim).filter(Claim.id == item.approved_claim_id).first()
                        if claim:
                            claim.approval = False
                            claim.updated_at = datetime.now(timezone.utc)
                            logger.info(f"Unapproved claim {claim.id} for item {item_id} due to status change from approved to pending")
                    # Clear approved_claim_id when changing from approved to pending
                    item.approved_claim_id = None
            else:
                raise ValueError(f"Invalid status: {status_value}")
        
        # Handle temporary_deletion
        if 'temporary_deletion' in update_data:
            item.temporary_deletion = update_data['temporary_deletion']
        
        # Handle approved_claim_id
        if 'approved_claim_id' in update_data:
            approved_claim_id = update_data['approved_claim_id']
            
            # Business rule: Only one claim can be approved per item
            # When changing approved_claim_id, unapprove the previous claim
            if item.approved_claim_id and item.approved_claim_id != approved_claim_id:
                previous_claim = self.db.query(Claim).filter(Claim.id == item.approved_claim_id).first()
                if previous_claim:
                    previous_claim.approval = False
                    previous_claim.updated_at = datetime.now(timezone.utc)
                    logger.info(f"Unapproved previous claim {previous_claim.id} for item {item_id}")
            
            # Validate claim exists and belongs to this item before assigning
            if approved_claim_id:
                claim = self.db.query(Claim).filter(Claim.id == approved_claim_id).first()
                if not claim:
                    raise ValueError(f"Claim {approved_claim_id} not found")
                if claim.item_id != item_id:
                    raise ValueError(f"Claim {approved_claim_id} does not belong to item {item_id}")
                
                # Business rule: When assigning approved_claim_id, approve the claim
                # This maintains consistency - approved items have approved claims
                claim.approval = True
                claim.updated_at = datetime.now(timezone.utc)
                logger.info(f"Approved claim {approved_claim_id} for item {item_id}")
            
            item.approved_claim_id = approved_claim_id
        
        # Location history tracking: When item location changes, preserve history
        # Business rule: Only one address can be "current" per item at any time
        # Previous addresses are kept for audit trail but marked as not current
        if location_changed and original_location:
            # Mark all existing current addresses as not current
            current_addresses = self.db.query(Address).filter(
                Address.item_id == item_id,
                Address.is_current == True
            ).all()
            
            for addr in current_addresses:
                addr.is_current = False
                addr.updated_at = datetime.now(timezone.utc)
        
        # Create new address entry if location info is provided
        # Supports both new format (branch_id) and legacy format (organization_name/branch_name)
        branch_id = None
        if 'branch_id' in update_data and update_data['branch_id']:
            branch_id = update_data['branch_id']
        elif 'location' in update_data or 'organization_name' in update_data or 'branch_name' in update_data:
            # Find or create branch if organization and branch names are provided
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
        
        # Create new address entry if location info is provided
        if branch_id or 'location' in update_data:
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
        
        # Track if status changed for audit logging
        status_changed = 'status' in update_data and old_status != item.status
        
        self.db.commit()
        self.db.refresh(item)
        
        # Log the status change if user_id is provided and status actually changed
        if status_changed and user_id:
            try:
                from app.services.auditLogService import AuditLogService
                audit_service = AuditLogService(self.db)
                audit_service.create_item_status_change_log(
                    item_id=item_id,
                    old_status=old_status,
                    new_status=item.status,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except Exception as e:
                logger.error(f"Failed to create audit log for item status change in patch_item: {e}")
        
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
    
    def delete_item(self, item_id: str, permanent: bool = False, user_id: Optional[str] = None, ip_address: str = "", user_agent: Optional[str] = None) -> bool:
        """Delete an item (soft delete by default, permanent deletes all related data)"""
        item = self.db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise ValueError("Item not found")
        
        if permanent:
            # Permanent delete: Remove item and all related data
            # Order matters: Clear foreign key references before deleting referenced records
            # 1. Delete all images associated with this item
            self.db.query(Image).filter(
                Image.imageable_type == "item",
                Image.imageable_id == item_id
            ).delete()
            
            # 2. Get all claim IDs for this item before deletion
            claim_ids = [claim.id for claim in self.db.query(Claim).filter(Claim.item_id == item_id).all()]
            
            # 3. Clear approved_claim_id references from ALL items that reference these claims
            # Critical: Prevents foreign key constraint violations when deleting claims
            if claim_ids:
                self.db.query(Item).filter(Item.approved_claim_id.in_(claim_ids)).update(
                    {Item.approved_claim_id: None},
                    synchronize_session=False
                )
            
            # 4. Delete all claims associated with this item
            self.db.query(Claim).filter(Claim.item_id == item_id).delete()
            
            # 5. Delete all addresses associated with this item
            self.db.query(Address).filter(Address.item_id == item_id).delete()
            
            # 6. Delete all branch transfer requests for this item
            from app.models import BranchTransferRequest
            self.db.query(BranchTransferRequest).filter(
                BranchTransferRequest.item_id == item_id
            ).delete()
            
            # 7. Finally, delete the item itself
            self.db.delete(item)
        else:
            # Soft delete: Mark item as deleted but preserve data
            # Allows restoration and maintains referential integrity
            item.temporary_deletion = True
            item.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        
        # Log the deletion if user_id is provided
        if user_id:
            try:
                from app.services.auditLogService import AuditLogService
                audit_service = AuditLogService(self.db)
                audit_service.create_item_deletion_log(
                    item_id=item_id,
                    permanent=permanent,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except Exception as e:
                logger.error(f"Failed to create audit log for item deletion: {e}")
        
        return True
    
    def restore_item(self, item_id: str, user_id: Optional[str] = None, ip_address: str = "", user_agent: Optional[str] = None) -> Optional[ItemResponse]:
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
        
        # Log the restoration if user_id is provided
        if user_id:
            try:
                from app.services.auditLogService import AuditLogService
                audit_service = AuditLogService(self.db)
                audit_service.create_item_restoration_log(
                    item_id=item_id,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except Exception as e:
                logger.error(f"Failed to create audit log for item restoration: {e}")
        
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
        """Bulk update approval status (DEPRECATED: use bulk_update_status instead)"""
        successful = 0
        failed = 0
        errors = []
        
        for item_id in request.item_ids:
            try:
                item = self.get_item_by_id(item_id)
                if not item:
                    raise ValueError("Item not found")
                
                # Convert approval boolean to status
                if request.approval_status:
                    item.status = ItemStatus.APPROVED.value
                else:
                    # Only change to pending if not already cancelled
                    if item.status != ItemStatus.CANCELLED.value:
                        item.status = ItemStatus.PENDING.value
                
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
    
    def bulk_update_status(self, request) -> dict:
        """Bulk update item status"""
        from app.schemas.item_schema import BulkStatusRequest
        successful = 0
        failed = 0
        errors = []
        
        for item_id in request.item_ids:
            try:
                item = self.get_item_by_id(item_id)
                if not item:
                    raise ValueError("Item not found")
                
                item.status = request.status.value
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
        
        base_query = query.filter(Item.temporary_deletion == False)
        
        total_items = query.count()
        active_items = base_query.count()
        approved_items = base_query.filter(Item.status == ItemStatus.APPROVED.value).count()
        pending_items = base_query.filter(Item.status == ItemStatus.PENDING.value).count()
        cancelled_items = base_query.filter(Item.status == ItemStatus.CANCELLED.value).count()
        deleted_items = query.filter(Item.temporary_deletion == True).count()
        
        return {
            "total_items": total_items,
            "active_items": active_items,
            "approved_items": approved_items,
            "pending_items": pending_items,
            "cancelled_items": cancelled_items,
            "deleted_items": deleted_items
        }
    
    def get_pending_items_count(self, user_id: str) -> int:
        """Get count of pending items accessible to the user based on branch assignments
        
        Access control:
        - Super admins see all pending items
        - Branch managers see pending items in their managed branches
        - Regular users see 0 (no pending items access)
        """
        # Base query: All pending, non-deleted items
        query = self.db.query(Item).filter(
            Item.status == ItemStatus.PENDING.value,
            Item.temporary_deletion == False
        )
        
        # Security: Super admins bypass branch filtering
        is_admin = permissionServices.has_full_access(self.db, user_id)
        
        if is_admin:
            logger.info(f"Super admin user {user_id} - returning all pending items count")
            return query.count()
        
        # Security: Branch managers see only items from their managed branches
        is_bm = is_branch_manager(user_id, self.db)
        
        if is_bm:
            # Get user's managed branches and filter items by those branches
            from app.models import UserBranchManager, Address
            managed_branch_ids = [
                row[0] for row in self.db.query(UserBranchManager.branch_id).filter(
                    UserBranchManager.user_id == user_id
                ).all()
            ]
            
            if managed_branch_ids:
                # Get items in managed branches (only current addresses)
                item_ids_in_branches = [
                    row[0] for row in self.db.query(Address.item_id).filter(
                        Address.branch_id.in_(managed_branch_ids),
                        Address.is_current == True
                    ).distinct().all()
                ]
                
                if item_ids_in_branches:
                    # Filter out None values to prevent SQL errors
                    item_ids_in_branches = [item_id for item_id in item_ids_in_branches if item_id is not None]
                    if item_ids_in_branches:
                        return query.filter(Item.id.in_(item_ids_in_branches)).count()
            
            # Branch manager with no managed branches or no items in branches
            return 0
        
        # Regular users: Get accessible items (own items + items in managed branches)
        try:
            accessible_items = get_user_accessible_items(user_id, self.db)
            
            if accessible_items:
                # Filter out None values to prevent SQL errors
                accessible_items = [item_id for item_id in accessible_items if item_id is not None]
                if accessible_items:
                    return query.filter(Item.id.in_(accessible_items)).count()
            
            return 0
        except Exception as e:
            logger.error(f"Error getting pending items count for user {user_id}: {e}")
            return 0
    
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
    
    def _item_to_response(self, item: Item, user_id: Optional[str] = None) -> ItemResponse:
        """Convert Item model to ItemResponse with location data and images"""
        from app.schemas.item_schema import ImageResponse
        
        try:
            location = self._build_location_info(item)
        except Exception as e:
            logger.warning(f"Error building location for item {item.id if item else 'unknown'}: {e}")
            location = None
        
        # Get images for this item
        all_images = []
        try:
            # Access images property safely - ensure we're not triggering lazy loading issues
            # The images property uses object_session which might fail if session is detached
            session = object_session(item)
            if session and hasattr(item, 'images'):
                try:
                    item_images = item.images
                    if item_images is not None:
                        item_images = list(item_images) if item_images else []
                        all_images = [
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
                        all_images = [
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
                        all_images = []
        except Exception as e:
            # If there's an error getting images, just continue with empty list
            logger.warning(f"Error getting images for item {item.id if item else 'unknown'}: {e}")
            all_images = []
        
        # Filter images based on is_hidden and user permissions
        images = self._filter_images_by_permission(item, all_images, user_id)
        
        try:
            return ItemResponse(
                id=str(item.id) if item.id else "",
                title=item.title or "",
                description=item.description or "",
                internal_description=item.internal_description,
                claims_count=item.claims_count or 0,
                temporary_deletion=item.temporary_deletion if item.temporary_deletion is not None else False,
                status=item.status if item.status else ItemStatus.PENDING.value,
                is_hidden=item.is_hidden if item.is_hidden is not None else False,
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
    
    def _filter_images_by_permission(self, item: Item, all_images: List, user_id: Optional[str] = None) -> List:
        """Filter images based on is_hidden and user permissions
        
        Security: Hidden items' images are only visible to users with can_manage_items permission
        This allows admins to hide sensitive images while preserving them in the database
        """
        from app.schemas.item_schema import ImageResponse
        
        # Public items: All images are visible
        if not item.is_hidden:
            return all_images
        
        # Hidden items: Check user permissions
        if user_id:
            # Security check: Only users with can_manage_items can see hidden item images
            has_permission = permissionServices.check_user_permission(
                self.db, user_id, "can_manage_items"
            ) or permissionServices.has_full_access(self.db, user_id)
            
            if has_permission:
                return all_images
        
        # Security: Users without permission cannot see hidden item images
        return []
    
    def _item_to_detail_response(self, item: Item, user_id: Optional[str] = None) -> ItemDetailResponse:
        """Convert Item model to ItemDetailResponse with all related data"""
        from app.schemas.item_schema import ImageResponse
        
        location = self._build_location_info(item)
        
        # Get images for this item
        all_images = []
        try:
            item_images = item.images  # Using the property we added to the model
            all_images = [
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
            all_images = []
        
        # Filter images based on is_hidden and user permissions
        images = self._filter_images_by_permission(item, all_images, user_id)
        
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
            internal_description=item.internal_description,
            claims_count=item.claims_count,
            temporary_deletion=item.temporary_deletion,
            status=item.status if item.status else ItemStatus.PENDING.value,
            is_hidden=item.is_hidden if item.is_hidden is not None else False,
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
            
            # Get moderator emails (users with can_manage_items permission or full access)
            from app.models import Role, Permission, RolePermissions
            from sqlalchemy import and_
            
            # Get users with can_manage_items permission
            moderators = self.db.query(User).join(
                Role, User.role_id == Role.id
            ).join(
                RolePermissions, Role.id == RolePermissions.role_id
            ).join(
                Permission, RolePermissions.permission_id == Permission.id
            ).filter(
                Permission.name == "can_manage_items"
            ).distinct().all()
            
            # Also include users with full access (all permissions)
            all_users = self.db.query(User).all()
            for user in all_users:
                if user.id not in [m.id for m in moderators]:
                    from app.services import permissionServices
                    if permissionServices.has_full_access(self.db, user.id):
                        moderators.append(user)
            
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