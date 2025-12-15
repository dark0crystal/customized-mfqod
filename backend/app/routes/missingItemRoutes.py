from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from app.db.database import get_session

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
    AssignFoundItemsRequest
)

# Import permission decorators
from app.utils.permission_decorator import (
    require_permission,
    require_any_permission,
    require_all_permissions
)
from app.middleware.auth_middleware import get_current_user_required

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
@require_permission("can_create_missing_items")
async def create_missing_item(
    missing_item_data: CreateMissingItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Create a new missing item
    Requires: can_create_missing_items permission
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

@router.get("/public-test")
async def get_public_test():
    """Test endpoint with no authentication required"""
    return {"message": "Public missing items test endpoint works!", "status": "success"}

@router.get("/public", response_model=MissingItemListResponse)
async def get_public_missing_items(
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
        # Create MissingItemService directly to avoid any middleware issues
        missing_item_service = MissingItemService(db)
        
        filters = MissingItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=None,
            approved_only=True,  # Always only approved missing items for public access
            include_deleted=False,  # Never include deleted missing items for public access
            item_type_id=item_type_id,
            status=status
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
@require_permission("can_view_missing_items")
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
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Get missing items with filtering and pagination
    Requires: can_view_missing_items permission
    """
    try:
        filters = MissingItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            status=status
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
@require_permission("can_view_missing_items")
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
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Search missing items by title or description
    Requires: can_view_missing_items permission
    """
    try:
        filters = MissingItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            status=status
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
@require_any_permission(["can_view_missing_items", "can_view_own_missing_items"])
async def get_user_missing_items(
    user_id: str,
    request: Request,
    skip: int = Query(0, ge=0, description="Number of missing items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of missing items to return"),
    include_deleted: bool = Query(False, description="Include soft-deleted missing items"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Get all missing items for a specific user
    Requires: can_view_missing_items OR can_view_own_missing_items permission
    """
    try:
        missing_items, total = missing_item_service.get_missing_items_by_user(user_id, include_deleted, skip, limit)
        
        return MissingItemListResponse(
            missing_items=missing_items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user missing items: {str(e)}")

@router.get("/statistics/", response_model=dict)
@require_permission("can_view_statistics")
async def get_missing_item_statistics(
    request: Request,
    user_id: Optional[str] = Query(None, description="Get statistics for specific user"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Get missing item statistics
    Requires: can_view_statistics permission
    """
    try:
        stats = missing_item_service.get_missing_item_statistics(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")

@router.get("/pending-count", response_model=dict)
@require_permission("can_view_missing_items")
async def get_pending_missing_items_count(
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Get count of pending missing items (approval == False) accessible to the current user based on branch assignments
    Requires: can_view_missing_items permission
    """
    try:
        count = missing_item_service.get_pending_missing_items_count(current_user.id)
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving pending missing items count: {str(e)}")

@router.get("/{missing_item_id}", response_model=MissingItemDetailResponse)
@require_permission("can_view_missing_items")
async def get_missing_item(
    missing_item_id: str,
    request: Request,
    include_deleted: bool = Query(False, description="Include soft-deleted missing items"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Get a single missing item by ID with related data
    Requires: can_view_missing_items permission
    """
    try:
        missing_item = missing_item_service.get_missing_item_detail_by_id(missing_item_id, include_deleted)
        if not missing_item:
            raise HTTPException(status_code=404, detail="Missing item not found")
        return missing_item
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving missing item: {str(e)}")

# =========================== 
# Update Operations
# ===========================

@router.put("/{missing_item_id}", response_model=MissingItemResponse)
@require_permission("can_edit_missing_items")
async def update_missing_item(
    missing_item_id: str,
    update_data: UpdateMissingItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Update an existing missing item
    Requires: can_edit_missing_items permission
    """
    try:
        missing_item = missing_item_service.update_missing_item(missing_item_id, update_data)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating missing item: {str(e)}")

@router.patch("/{missing_item_id}", response_model=MissingItemResponse)
@require_permission("can_edit_missing_items")
async def patch_missing_item(
    missing_item_id: str,
    update_data: dict,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Partially update an existing missing item with location history tracking
    Requires: can_edit_missing_items permission
    """
    try:
        missing_item = missing_item_service.patch_missing_item(missing_item_id, update_data)
        return missing_item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error patching missing item: {str(e)}")

@router.patch("/{missing_item_id}/toggle-approval", response_model=MissingItemResponse)
@require_permission("can_approve_missing_items")
async def toggle_missing_item_approval(
    missing_item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Toggle the approval status of a missing item
    Requires: can_approve_missing_items permission
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
    Assign one or more found item posts to a missing item, optionally moving status to visit and notifying the reporter.
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

# =========================== 
# Delete Operations
# ===========================

@router.delete("/{missing_item_id}", response_model=DeleteMissingItemResponse)
@require_permission("can_delete_missing_items")
async def delete_missing_item(
    missing_item_id: str,
    request: Request,
    permanent: bool = Query(False, description="Permanently delete the missing item"),
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Delete a missing item (soft delete by default, permanent if specified)
    Requires: can_delete_missing_items permission
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
@require_permission("can_restore_missing_items")
async def restore_missing_item(
    missing_item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Restore a soft-deleted missing item
    Requires: can_restore_missing_items permission
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
@require_permission("can_bulk_delete_missing_items")
async def bulk_delete_missing_items(
    request: BulkDeleteMissingItemRequest,
    req: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Bulk delete multiple missing items
    Requires: can_bulk_delete_missing_items permission
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
@require_permission("can_bulk_edit_missing_items")
async def bulk_update_missing_items(
    request: BulkUpdateMissingItemRequest,
    req: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Bulk update multiple missing items
    Requires: can_bulk_edit_missing_items permission
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
@require_all_permissions(["can_approve_missing_items", "can_bulk_edit_missing_items"])
async def bulk_approval_missing_items(
    request: BulkApprovalMissingItemRequest,
    req: Request,
    db: Session = Depends(get_session),
    missing_item_service: MissingItemService = Depends(get_missing_item_service)
):
    """
    Bulk update approval status for multiple missing items
    Requires: BOTH can_approve_missing_items AND can_bulk_edit_missing_items permissions
    """
    try:
        result = missing_item_service.bulk_approval(request)
        
        return BulkOperationResponse(
            message="Bulk approval operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk approval: {str(e)}")
