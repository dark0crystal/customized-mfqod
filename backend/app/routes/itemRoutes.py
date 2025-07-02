
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from db.database import get_session

# Import dependencies (adjust import paths as needed)
# from database import get_db
from services.itemService import ItemService
from schemas.item_schema import (
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
async def create_item(
    item_data: CreateItemRequest,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Create a new item
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

@router.get("/{item_id}", response_model=ItemDetailResponse)
async def get_item(
    item_id: str,
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get a single item by ID with related data
    """
    try:
        item = item_service.get_item_by_id(item_id, include_deleted)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving item: {str(e)}")

@router.get("/", response_model=ItemListResponse)
async def get_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    approved_only: bool = Query(False, description="Only return approved items"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get items with filtering and pagination
    """
    try:
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
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
        raise HTTPException(status_code=500, detail=f"Error retrieving items: {str(e)}")

@router.get("/search/", response_model=ItemListResponse)
async def search_items(
    q: str = Query(..., description="Search term"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    approved_only: bool = Query(False, description="Only return approved items"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Search items by title or description
    """
    try:
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id
        )
        
        items, total = item_service.search_items(q, filters)
        
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
async def get_user_items(
    user_id: str,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get all items for a specific user
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
async def get_item_statistics(
    user_id: Optional[str] = Query(None, description="Get statistics for specific user"),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get item statistics
    """
    try:
        stats = item_service.get_item_statistics(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")

# =========================== 
# Update Operations
# ===========================

@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    update_data: UpdateItemRequest,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Update an existing item
    """
    try:
        item = item_service.update_item(item_id, update_data)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")

@router.patch("/{item_id}/toggle-approval", response_model=ItemResponse)
async def toggle_item_approval(
    item_id: str,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Toggle the approval status of an item
    """
    try:
        item = item_service.toggle_approval(item_id)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling approval: {str(e)}")

@router.patch("/{item_id}/update-claims-count", response_model=ItemResponse)
async def update_claims_count(
    item_id: str,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Update the claims count for an item based on actual claims
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
async def delete_item(
    item_id: str,
    permanent: bool = Query(False, description="Permanently delete the item"),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Delete an item (soft delete by default, permanent if specified)
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
async def restore_item(
    item_id: str,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Restore a soft-deleted item
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
async def bulk_delete_items(
    request: BulkDeleteRequest,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Bulk delete multiple items
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
async def bulk_update_items(
    request: BulkUpdateRequest,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Bulk update multiple items
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
async def bulk_approval_items(
    request: BulkApprovalRequest,
    item_service: ItemService = Depends(get_item_service)
):
    """
    Bulk update approval status for multiple items
    """
    try:
        result = item_service.bulk_approval(request)
        
        return BulkOperationResponse(
            message="Bulk approval operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk approval: {str(e)}")

# =========================== 
# Health Check
# ===========================

@router.get("/health/", response_model=dict)
async def health_check():
    """
    Health check endpoint for items service
    """
    return {
        "status": "healthy",
        "service": "items",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

from datetime import datetime, timezone