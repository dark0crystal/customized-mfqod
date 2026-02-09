from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from app.db.database import get_session
from app.middleware.rate_limit_decorator import rate_limit_public

# Import dependencies
from app.services.missingItemService import MissingItemService
from app.schemas.missing_item_schema import (
    CreateMissingItemRequest,
    UpdateMissingItemRequest, 
    MissingItemFilterRequest,
    MissingItemResponse,
    MissingItemDetailResponse,
    MissingItemListResponse,
    DeleteMissingItemResponse,
    BulkOperationResponse,
    BulkDeleteMissingItemRequest,
    BulkUpdateMissingItemRequest,
    BulkApprovalMissingItemRequest,
    AssignFoundItemsRequest,
    AssignPendingItemRequest,
    MissingItemStatus
)

# Import permission decorators
from app.utils.permission_decorator import (
    require_permission,
    require_any_permission,
    require_all_permissions
)
from app.middleware.auth_middleware import get_current_user_required
from app.models import User

router = APIRouter()

# =========================== 
# Dependency Injection
# ===========================

def get_missing_item_service(db: Session = Depends(get_session)) -> MissingItemService:
    return MissingItemService(db)

# =========================== 
# Create Operations
# ===========================

@router.post("/", response_model=MissingItemResponse, status_code=201)
async def create_missing_item(
    missing_item_data: CreateMissingItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Create a new missing item
    Requires: Authentication (user must be logged in)
    """
    try:
        missing_item = missing_item_service.create_missing_item(missing_item_data)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating missing item: {str(e)}")

# =========================== 
# Read Operations
# ===========================

@router.get("/public", response_model=MissingItemListResponse)
@rate_limit_public()
async def get_public_missing_items(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of missing items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of missing items to return"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_session)
):
    """
    Get approved missing items for public viewing (no authentication required)
    Only returns approved missing items and excludes deleted missing items
    """
    try:
        # Parse and validate status if provided
        status_value = None
        if status:
            try:
                status_value = MissingItemStatus(status.lower()).value
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid status: {status}. Valid values are: pending, approved, cancelled, visit"
                )
        
        # Create MissingItemService directly to avoid any middleware issues
        missing_item_service = MissingItemService(db)
        
        filters = MissingItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=None,
            approved_only=True,  # Always only approved missing items for public access
            include_deleted=False,  # Never include deleted missing items for public access
            item_type_id=item_type_id,
            status=status_value
        )
        
        missing_items, total = missing_item_service.get_missing_items(filters)
        
        return MissingItemListResponse(
            missing_items=missing_items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving public missing items: {str(e)}")

@router.get("/", response_model=MissingItemListResponse)
async def get_missing_items(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of missing items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of missing items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    approved_only: bool = Query(False, description="Only return approved missing items"),
    include_deleted: bool = Query(False, description="Include soft-deleted missing items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user: User = Depends(get_current_user_required)
):
    """
    Get missing items with filtering and pagination
    Users can always view their own missing items. Viewing all missing items requires can_manage_missing_items permission.
    """
    try:
        # Access control: Users can always view their own missing items
        # Viewing all missing items requires can_manage_missing_items permission
        # This prevents unauthorized access to other users' missing item reports
        from app.services import permissionServices
        has_permission = permissionServices.has_full_access(db, current_user.id) or \
                        permissionServices.check_user_permission(db, current_user.id, "can_manage_missing_items")
        
        # Enforce access control: restrict to own items if no permission
        if not has_permission and user_id is None:
            user_id = current_user.id
        
        # Security: prevent users from viewing other users' items without permission
        if not has_permission and user_id != current_user.id:
            user_id = current_user.id
        
        # Parse and validate status if provided
        status_value = None
        if status:
            try:
                status_value = MissingItemStatus(status.lower()).value
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid status: {status}. Valid values are: pending, approved, cancelled, visit"
                )
        
        filters = MissingItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            status=status_value
        )
        
        missing_items, total = missing_item_service.get_missing_items(filters)
        
        return MissingItemListResponse(
            missing_items=missing_items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving missing items: {str(e)}")

@router.get("/search/", response_model=MissingItemListResponse)
async def search_missing_items(
    request: Request,
    q: str = Query(..., description="Search term"),
    skip: int = Query(0, ge=0, description="Number of missing items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of missing items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    approved_only: bool = Query(False, description="Only return approved missing items"),
    include_deleted: bool = Query(False, description="Include soft-deleted missing items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user: User = Depends(get_current_user_required)
):
    """
    Search missing items by title or description
    Users can always search their own missing items. Searching all missing items requires can_manage_missing_items permission.
    """
    try:
        # Same access control logic as get_missing_items: restrict to own items without permission
        from app.services import permissionServices
        has_permission = permissionServices.has_full_access(db, current_user.id) or \
                        permissionServices.check_user_permission(db, current_user.id, "can_manage_missing_items")
        
        # Enforce access control: restrict to own items if no permission
        if not has_permission and user_id is None:
            user_id = current_user.id
        
        # Security: prevent users from searching other users' items without permission
        if not has_permission and user_id != current_user.id:
            user_id = current_user.id
        
        # Parse and validate status if provided
        status_value = None
        if status:
            try:
                status_value = MissingItemStatus(status.lower()).value
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid status: {status}. Valid values are: pending, approved, cancelled, visit"
                )
        
        filters = MissingItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            status=status_value
        )
        
        missing_items, total = missing_item_service.search_missing_items(q, filters)
        
        return MissingItemListResponse(
            missing_items=missing_items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching missing items: {str(e)}")

@router.get("/users/{user_id}/missing-items", response_model=MissingItemListResponse)
async def get_user_missing_items(
    user_id: str,
    request: Request,
    skip: int = Query(0, ge=0, description="Number of missing items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of missing items to return"),
    include_deleted: bool = Query(False, description="Include soft-deleted missing items"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user: User = Depends(get_current_user_required)
):
    """
    Get all missing items for a specific user
    Users can always view their own missing items. Viewing other users' missing items requires can_manage_missing_items permission.
    """
    try:
        # Check if user is viewing their own missing items
        if user_id != current_user.id:
            # User is trying to view another user's missing items - require permission
            from app.services import permissionServices
            if not permissionServices.has_full_access(db, current_user.id):
                if not permissionServices.check_user_permission(db, current_user.id, "can_manage_missing_items"):
                    raise HTTPException(
                        status_code=403,
                        detail="Permission 'can_manage_missing_items' is required to view other users' missing items"
                    )
        
        missing_items, total = missing_item_service.get_missing_items_by_user(user_id, include_deleted, skip, limit)
        
        return MissingItemListResponse(
            missing_items=missing_items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user missing items: {str(e)}")

@router.get("/statistics/", response_model=dict)
@require_permission("can_view_analytics")
async def get_missing_item_statistics(
    request: Request,
    user_id: Optional[str] = Query(None, description="Get statistics for specific user"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Get missing item statistics
    Requires: can_view_analytics permission
    """
    try:
        stats = missing_item_service.get_missing_item_statistics(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")

@router.get("/pending-count", response_model=dict)
async def get_pending_missing_items_count(
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Get count of pending missing items (approval == False) accessible to the current user based on branch assignments
    Users can always view their own pending missing items count. Admins see all pending missing items.
    Access control is handled by the service layer.
    """
    try:
        count = missing_item_service.get_pending_missing_items_count(current_user.id)
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving pending missing items count: {str(e)}")

@router.get("/{missing_item_id}", response_model=MissingItemDetailResponse)
async def get_missing_item(
    missing_item_id: str,
    request: Request,
    include_deleted: bool = Query(False, description="Include soft-deleted missing items"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user: User = Depends(get_current_user_required)
):
    """
    Get a single missing item by ID with related data
    Users can always view their own missing items. Viewing other users' missing items requires can_manage_missing_items permission.
    """
    try:
        missing_item = missing_item_service.get_missing_item_detail_by_id(missing_item_id, include_deleted)
        if not missing_item:
            raise HTTPException(status_code=404, detail="Missing item not found")
        
        # Check if user is viewing their own missing item
        if missing_item.user_id != current_user.id:
            # User is trying to view another user's missing item - require permission
            from app.services import permissionServices
            if not permissionServices.has_full_access(db, current_user.id):
                if not permissionServices.check_user_permission(db, current_user.id, "can_manage_missing_items"):
                    raise HTTPException(
                        status_code=403,
                        detail="Permission 'can_manage_missing_items' is required to view other users' missing items"
                    )
        
        return missing_item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving missing item: {str(e)}")

# =========================== 
# Update Operations
# ===========================

@router.put("/{missing_item_id}", response_model=MissingItemResponse)
async def update_missing_item(
    missing_item_id: str,
    update_data: UpdateMissingItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user: User = Depends(get_current_user_required)
):
    """
    Update an existing missing item
    Users can edit their own missing items, but cannot edit approved items without can_manage_missing_items permission.
    """
    try:
        # Get the existing missing item to check ownership and status
        existing_item = missing_item_service.get_missing_item_by_id(missing_item_id)
        if not existing_item:
            raise HTTPException(status_code=404, detail="Missing item not found")
        
        # Access control logic for editing missing items:
        # 1. Owners can edit their own items (unless approved)
        # 2. Approved items require permission to edit (prevents tampering)
        # 3. Non-owners require permission to edit
        is_owner = existing_item.user_id == current_user.id
        
        from app.services import permissionServices
        has_permission = permissionServices.has_full_access(db, current_user.id) or \
                        permissionServices.check_user_permission(db, current_user.id, "can_manage_missing_items")
        
        # Business rule: Approved items are locked from owner edits (prevents status manipulation)
        if existing_item.status == "approved" and not has_permission:
            raise HTTPException(
                status_code=403,
                detail="Cannot edit approved missing items without 'can_manage_missing_items' permission"
            )
        
        # Security: Non-owners need permission to edit
        if not is_owner and not has_permission:
            raise HTTPException(
                status_code=403,
                detail="Permission 'can_manage_missing_items' is required to edit other users' missing items"
            )
        
        # Security: Prevent unauthorized status changes (only admins can change status)
        if not has_permission:
            update_dict = update_data.dict(exclude_unset=True)
            if "status" in update_dict:
                update_dict.pop("status")
                update_data = UpdateMissingItemRequest(**update_dict)
        
        missing_item = missing_item_service.update_missing_item(missing_item_id, update_data)
        return missing_item
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating missing item: {str(e)}")

@router.patch("/{missing_item_id}", response_model=MissingItemResponse)
@require_permission("can_manage_missing_items")
async def patch_missing_item(
    missing_item_id: str,
    update_data: dict,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Partially update an existing missing item with location history tracking
    Requires: can_manage_missing_items permission
    """
    try:
        missing_item = missing_item_service.patch_missing_item(missing_item_id, update_data)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error patching missing item: {str(e)}")

@router.patch("/{missing_item_id}/toggle-approval", response_model=MissingItemResponse)
@require_permission("can_manage_missing_items")
async def toggle_missing_item_approval(
    missing_item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Toggle the approval status of a missing item
    Requires: can_manage_missing_items permission
    """
    try:
        missing_item = missing_item_service.toggle_approval(missing_item_id)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling approval: {str(e)}")

@router.patch("/{missing_item_id}/update-status", response_model=MissingItemResponse)
@require_permission("can_manage_missing_items")
async def update_missing_item_status(
    missing_item_id: str,
    request: Request,
    status: str = Query(..., description="New status: pending, approved, cancelled, or visit"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Update the status of a missing item
    Requires: can_manage_missing_items permission
    """
    try:
        missing_item = missing_item_service.update_status(missing_item_id, status)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")


@router.post("/{missing_item_id}/assign-found-items", response_model=MissingItemDetailResponse)
@require_permission("can_manage_missing_items")
async def assign_found_items_to_missing(
    missing_item_id: str,
    request_body: AssignFoundItemsRequest,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Assign one or more found item posts to a missing item
    
    Business logic: Links found items to a missing item report, optionally:
    - Changes missing item status to 'visit' (if auto_status_change enabled)
    - Sends notification email to the missing item reporter
    - Creates relationship between missing and found items for tracking
    """
    try:
        missing_item = missing_item_service.assign_found_items(missing_item_id, request_body, current_user)
        return missing_item
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error assigning found items: {str(e)}")

@router.post("/{missing_item_id}/assign-pending-item", response_model=MissingItemDetailResponse)
@require_permission("can_manage_missing_items")
async def assign_pending_item_to_missing(
    missing_item_id: str,
    request_body: AssignPendingItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Assign a missing item to a pending item
    
    Business logic: When a pending found item matches a missing item report:
    - Links the missing item to the pending found item
    - Optionally changes missing item status to 'approved'
    - Sends notification to the missing item reporter
    - Used when admin confirms a match between missing and found items
    """
    try:
        missing_item = missing_item_service.assign_pending_item(missing_item_id, request_body, current_user)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error assigning pending item: {str(e)}")

# =========================== 
# Delete Operations
# ===========================

@router.delete("/{missing_item_id}", response_model=DeleteMissingItemResponse)
@require_permission("can_manage_missing_items")
async def delete_missing_item(
    missing_item_id: str,
    request: Request,
    permanent: bool = Query(False, description="Permanently delete the missing item"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Delete a missing item (soft delete by default, permanent if specified)
    Requires: can_manage_missing_items permission
    
    Soft delete: Marks item as deleted, can be restored
    Permanent delete: Removes item completely from database
    """
    try:
        missing_item_service.delete_missing_item(missing_item_id, permanent)
        
        return DeleteMissingItemResponse(
            message="Missing item permanently deleted" if permanent else "Missing item marked for deletion",
            missing_item_id=missing_item_id,
            permanent=permanent
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting missing item: {str(e)}")

@router.patch("/{missing_item_id}/restore", response_model=MissingItemResponse)
@require_permission("can_manage_missing_items")
async def restore_missing_item(
    missing_item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Restore a soft-deleted missing item
    Requires: can_manage_missing_items permission
    """
    try:
        missing_item = missing_item_service.restore_missing_item(missing_item_id)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error restoring missing item: {str(e)}")

# =========================== 
# Bulk Operations
# ===========================

@router.post("/bulk/delete", response_model=BulkOperationResponse)
@require_permission("can_manage_missing_items")
async def bulk_delete_missing_items(
    request: BulkDeleteMissingItemRequest,
    req: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Bulk delete multiple missing items
    Requires: can_manage_missing_items permission
    """
    try:
        result = missing_item_service.bulk_delete(request)
        
        return BulkOperationResponse(
            message="Bulk delete operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk delete: {str(e)}")

@router.put("/bulk/update", response_model=BulkOperationResponse)
@require_permission("can_manage_missing_items")
async def bulk_update_missing_items(
    request: BulkUpdateMissingItemRequest,
    req: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Bulk update multiple missing items
    Requires: can_manage_missing_items permission
    """
    try:
        result = missing_item_service.bulk_update(request)
        
        return BulkOperationResponse(
            message="Bulk update operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk update: {str(e)}")

@router.patch("/bulk/approval", response_model=BulkOperationResponse)
@require_permission("can_manage_missing_items")
async def bulk_approval_missing_items(
    request: BulkApprovalMissingItemRequest,
    req: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Bulk update approval status for multiple missing items
    Requires: can_manage_missing_items permission
    """
    try:
        result = missing_item_service.bulk_approval(request)
        
        return BulkOperationResponse(
            message="Bulk approval operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk approval: {str(e)}")
