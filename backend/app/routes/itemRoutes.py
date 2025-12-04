from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from app.db.database import get_session

# Import dependencies (adjust import paths as needed)
from app.services.itemService import ItemService
from app.schemas.item_schema import (
    CreateItemRequest,
    UpdateItemRequest, 
    ItemFilterRequest,
    ItemResponse,
    ItemDetailResponse,
    ItemListResponse,
    DeleteItemResponse,
    BulkOperationResponse,
    BulkDeleteRequest,
    BulkUpdateRequest,
    BulkApprovalRequest
)

# Import permission decorators
from app.utils.permission_decorator import (
    require_permission,
    require_any_permission,
    require_all_permissions
)

# Import branch-based authorization
from app.middleware.branch_auth_middleware import (
    require_branch_access,
    require_branch_access_for_bulk_operations
)
from app.middleware.auth_middleware import get_current_user_required

router = APIRouter()

# =========================== 
# Dependency Injection
# ===========================

def get_item_service(db: Session = Depends(get_session)) -> ItemService:
    return ItemService(db)

# =========================== 
# Create Operations
# ===========================

@router.post("/", response_model=ItemResponse, status_code=201)
@require_permission("can_create_items")
async def create_item(
    item_data: CreateItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Create a new item
    Requires: can_create_items permission
    """
    try:
        item = item_service.create_item(item_data)
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating item: {str(e)}")

# =========================== 
# Read Operations
# ===========================

@router.get("/public-test")
async def get_public_test():
    """Test endpoint with no authentication required"""
    return {"message": "Public test endpoint works!", "status": "success"}

@router.get("/public", response_model=ItemListResponse)
async def get_public_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    db: Session = Depends(get_session)
):
    """
    Get approved items for public viewing (no authentication required)
    Only returns approved items and excludes deleted items
    """
    try:
        # Create ItemService directly to avoid any middleware issues
        item_service = ItemService(db)
        
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=None,
            approved_only=True,  # Always only approved items for public access
            include_deleted=False,  # Never include deleted items for public access
            item_type_id=item_type_id
        )
        
        items, total = item_service.get_items(filters)
        
        return ItemListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving public items: {str(e)}")

@router.get("/", response_model=ItemListResponse)
@require_permission("can_view_items")
async def get_items(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    approved_only: bool = Query(False, description="Only return approved items"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    date_from: Optional[str] = Query(None, description="Filter items created from this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter items created until this date (YYYY-MM-DD)"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Get items with filtering and pagination
    Requires: can_view_items permission
    """
    try:
        # Parse date strings to datetime objects
        parsed_date_from = None
        parsed_date_to = None
        
        if date_from:
            try:
                parsed_date_from = datetime.strptime(date_from, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
        
        if date_to:
            try:
                parsed_date_to = datetime.strptime(date_to, "%Y-%m-%d")
                # Set to end of day for inclusive filtering
                parsed_date_to = parsed_date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
        
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            branch_id=branch_id,
            date_from=parsed_date_from,
            date_to=parsed_date_to
        )
        
        # When approved_only is True, show all approved items (skip branch-based access control)
        # This allows the public search page to display all approved items
        # Otherwise, apply branch-based access control for regular queries
        user_id_for_access_control = None if approved_only else current_user.id
        
        items, total = item_service.get_items(filters, user_id_for_access_control)
        
        return ItemListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving items: {str(e)}")

@router.get("/search/", response_model=ItemListResponse)
@require_permission("can_view_items")
async def search_items(
    request: Request,
    q: str = Query(..., description="Search term"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    approved_only: bool = Query(False, description="Only return approved items"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    date_from: Optional[str] = Query(None, description="Filter items created from this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter items created until this date (YYYY-MM-DD)"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Search items by title or description
    Requires: can_view_items permission
    """
    try:
        # Parse date strings to datetime objects
        parsed_date_from = None
        parsed_date_to = None
        
        if date_from:
            try:
                parsed_date_from = datetime.strptime(date_from, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
        
        if date_to:
            try:
                parsed_date_to = datetime.strptime(date_to, "%Y-%m-%d")
                # Set to end of day for inclusive filtering
                parsed_date_to = parsed_date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
        
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            branch_id=branch_id,
            date_from=parsed_date_from,
            date_to=parsed_date_to
        )
        
        # When approved_only is True, show all approved items (skip branch-based access control)
        # This allows the public search page to display all approved items
        # Otherwise, apply branch-based access control for regular queries
        user_id_for_access_control = None if approved_only else current_user.id
        
        items, total = item_service.search_items(q, filters, user_id_for_access_control)
        
        return ItemListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching items: {str(e)}")

@router.get("/users/{user_id}/items", response_model=ItemListResponse)
@require_any_permission(["can_view_items", "can_view_own_items"])
async def get_user_items(
    user_id: str,
    request: Request,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get all items for a specific user
    Requires: can_view_items OR can_view_own_items permission
    """
    try:
        items, total = item_service.get_items_by_user(user_id, include_deleted, skip, limit)
        
        return ItemListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user items: {str(e)}")

@router.get("/statistics/", response_model=dict)
@require_permission("can_view_statistics")
async def get_item_statistics(
    request: Request,
    user_id: Optional[str] = Query(None, description="Get statistics for specific user"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get item statistics
    Requires: can_view_statistics permission
    """
    try:
        stats = item_service.get_item_statistics(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")

@router.get("/public/{item_id}", response_model=ItemDetailResponse)
async def get_public_item(
    item_id: str,
    db: Session = Depends(get_session)
):
    """
    Get a single item by ID for public viewing (no authentication required)
    Only returns approved items and excludes deleted items
    """
    try:
        # Create ItemService directly to avoid any middleware issues
        item_service = ItemService(db)
        
        # Get item detail with approved_only=True and include_deleted=False
        item = item_service.get_item_detail_by_id(item_id, include_deleted=False)
        
        if not item:
            raise HTTPException(status_code=404, detail="Item not found or not approved for public viewing")
        
        # Additional check to ensure item is approved
        if not item.approval:
            raise HTTPException(status_code=404, detail="Item not approved for public viewing")
            
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving public item: {str(e)}")

@router.get("/{item_id}", response_model=ItemDetailResponse)
@require_permission("can_view_items")
async def get_item(
    item_id: str,
    request: Request,
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get a single item by ID with related data
    Requires: can_view_items permission
    """
    try:
        item = item_service.get_item_detail_by_id(item_id, include_deleted)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving item: {str(e)}")

# =========================== 
# Update Operations
# ===========================

@router.put("/{item_id}", response_model=ItemResponse)
@require_permission("can_edit_items")
async def update_item(
    item_id: str,
    update_data: UpdateItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Update an existing item
    Requires: can_edit_items permission
    """
    try:
        item = item_service.update_item(item_id, update_data)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")

@router.patch("/{item_id}", response_model=ItemResponse)
@require_permission("can_edit_items")
async def patch_item(
    item_id: str,
    update_data: dict,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Partially update an existing item with location history tracking
    Requires: can_edit_items permission
    """
    try:
        item = item_service.patch_item(item_id, update_data)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error patching item: {str(e)}")

@router.patch("/{item_id}/toggle-approval", response_model=ItemResponse)
@require_permission("can_approve_items")
async def toggle_item_approval(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Toggle the approval status of an item
    Requires: can_approve_items permission
    """
    try:
        item = item_service.toggle_approval(item_id)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling approval: {str(e)}")

@router.patch("/{item_id}/update-claims-count", response_model=ItemResponse)
@require_permission("can_manage_claims")
async def update_claims_count(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Update the claims count for an item based on actual claims
    Requires: can_manage_claims permission
    """
    try:
        item = item_service.update_claims_count(item_id)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating claims count: {str(e)}")

# =========================== 
# Delete Operations
# ===========================

@router.delete("/{item_id}", response_model=DeleteItemResponse)
@require_permission("can_delete_items")
async def delete_item(
    item_id: str,
    request: Request,
    permanent: bool = Query(False, description="Permanently delete the item"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Delete an item (soft delete by default, permanent if specified)
    Requires: can_delete_items permission
    """
    try:
        item_service.delete_item(item_id, permanent)
        
        return DeleteItemResponse(
            message="Item permanently deleted" if permanent else "Item marked for deletion",
            item_id=item_id,
            permanent=permanent
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting item: {str(e)}")

@router.patch("/{item_id}/restore", response_model=ItemResponse)
@require_permission("can_restore_items")
async def restore_item(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Restore a soft-deleted item
    Requires: can_restore_items permission
    """
    try:
        item = item_service.restore_item(item_id)
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error restoring item: {str(e)}")

# =========================== 
# Bulk Operations
# ===========================

@router.post("/bulk/delete", response_model=BulkOperationResponse)
@require_permission("can_bulk_delete_items")
async def bulk_delete_items(
    request: BulkDeleteRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk delete multiple items
    Requires: can_bulk_delete_items permission
    """
    try:
        result = item_service.bulk_delete(request)
        
        return BulkOperationResponse(
            message="Bulk delete operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk delete: {str(e)}")

@router.put("/bulk/update", response_model=BulkOperationResponse)
@require_permission("can_bulk_edit_items")
async def bulk_update_items(
    request: BulkUpdateRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk update multiple items
    Requires: can_bulk_edit_items permission
    """
    try:
        result = item_service.bulk_update(request)
        
        return BulkOperationResponse(
            message="Bulk update operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk update: {str(e)}")

@router.patch("/bulk/approval", response_model=BulkOperationResponse)
@require_all_permissions(["can_approve_items", "can_bulk_edit_items"])
async def bulk_approval_items(
    request: BulkApprovalRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk update approval status for multiple items
    Requires: BOTH can_approve_items AND can_bulk_edit_items permissions
    """
    try:
        result = item_service.bulk_approval(request)
        
        return BulkOperationResponse(
            message="Bulk approval operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk approval: {str(e)}")


