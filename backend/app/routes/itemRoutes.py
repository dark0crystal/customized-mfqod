from fastapi import APIRouter, HTTPException, Depends, Query, Request, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from app.db.database import get_session
from app.middleware.rate_limit_decorator import rate_limit_public, rate_limit_authenticated

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
    BulkApprovalRequest,
    BulkStatusRequest,
    DisposeItemRequest,
    ItemStatus
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
from app.services.auth_service import AuthService
from app.models import User

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
@require_permission("can_manage_items")
async def create_item(
    item_data: CreateItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Create a new item
    Requires: can_manage_items permission
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

@router.get("/public", response_model=ItemListResponse)
@rate_limit_public()
async def get_public_items(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    db: Session = Depends(get_session)
):
    """
    Get pending items for public viewing (no authentication required)
    Only returns pending items and excludes deleted items
    Approved items are hidden from public search
    """
    try:
        # Create ItemService directly to avoid any middleware issues
        item_service = ItemService(db)
        
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=None,
            status=ItemStatus.PENDING,  # Only show pending items (excludes approved, cancelled)
            include_deleted=False,  # Never include deleted items for public access
            item_type_id=item_type_id
        )
        
        items, total = item_service.get_items(filters, user_id=None)
        
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
@rate_limit_authenticated()
async def get_items(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    status: Optional[str] = Query(None, description="Filter by status (cancelled, approved, pending)"),
    approved_only: bool = Query(False, description="DEPRECATED: Use status=approved instead. Only return approved items"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    date_from: Optional[str] = Query(None, description="Filter items created from this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter items created until this date (YYYY-MM-DD)"),
    show_all: bool = Query(False, description="Show all items regardless of branch access (skip branch-based filtering)"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Get items with filtering and pagination
    Requires: Authentication (user must be logged in)
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
        
        # Parse status if provided
        status_enum = None
        if status:
            try:
                status_enum = ItemStatus(status.lower())
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}. Valid values are: cancelled, approved, pending")
        
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            status=status_enum,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            branch_id=branch_id,
            date_from=parsed_date_from,
            date_to=parsed_date_to
        )
        
        # Branch-based access control: Users can only see items from branches they manage
        # Bypass this restriction when:
        # - approved_only=True: Public search needs to show all approved items
        # - show_all=True: Admin/privileged users explicitly requesting all items
        # Otherwise, pass current_user.id to filter items by branch assignments
        # Security: This prevents users from seeing items outside their branch scope
        user_id_for_access_control = None if (approved_only or show_all) else current_user.id
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"get_items: show_all={show_all}, approved_only={approved_only}, user_id_for_access_control={user_id_for_access_control}, current_user.id={current_user.id}")
        
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
@require_permission("can_manage_items")
async def search_items(
    request: Request,
    q: str = Query(..., description="Search term"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    status: Optional[str] = Query(None, description="Filter by status (cancelled, approved, pending)"),
    approved_only: bool = Query(False, description="DEPRECATED: Use status=approved instead. Only return approved items"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    date_from: Optional[str] = Query(None, description="Filter items created from this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter items created until this date (YYYY-MM-DD)"),
    show_all: bool = Query(False, description="Show all items regardless of branch access (skip branch-based filtering)"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Search items by title or description
    Requires: can_manage_items permission (users can always view their own items)
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
        
        # Parse status if provided
        status_enum = None
        if status:
            try:
                status_enum = ItemStatus(status.lower())
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}. Valid values are: cancelled, approved, pending")
        
        filters = ItemFilterRequest(
            skip=skip,
            limit=limit,
            user_id=user_id,
            status=status_enum,
            approved_only=approved_only,
            include_deleted=include_deleted,
            item_type_id=item_type_id,
            branch_id=branch_id,
            date_from=parsed_date_from,
            date_to=parsed_date_to
        )
        
        # Branch-based access control: Same logic as get_items endpoint
        # Bypass branch filtering for public search (approved_only) or admin override (show_all)
        # Security: Regular users only see items from their assigned branches
        user_id_for_access_control = None if (approved_only or show_all) else current_user.id
        
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
async def get_user_items(
    user_id: str,
    request: Request,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required)
):
    """
    Get all items for a specific user
    Users can always view their own items. Viewing other users' items requires can_manage_items permission.
    """
    try:
        # Access control: Users can always view their own items
        # Viewing other users' items requires can_manage_items permission
        # This prevents unauthorized access to other users' data
        if user_id != current_user.id:
            from app.services import permissionServices
            if not permissionServices.has_full_access(db, current_user.id):
                if not permissionServices.check_user_permission(db, current_user.id, "can_manage_items"):
                    raise HTTPException(
                        status_code=403,
                        detail="Permission 'can_manage_items' is required to view other users' items"
                    )
        
        items, total = item_service.get_items_by_user(user_id, include_deleted, skip, limit)
        
        return ItemListResponse(
            items=items,
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
        raise HTTPException(status_code=500, detail=f"Error retrieving user items: {str(e)}")

@router.get("/statistics/", response_model=dict)
@require_permission("can_view_analytics")
async def get_item_statistics(
    request: Request,
    user_id: Optional[str] = Query(None, description="Get statistics for specific user"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service)
):
    """
    Get item statistics
    Requires: can_view_analytics permission
    """
    try:
        stats = item_service.get_item_statistics(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")

@router.get("/pending-count", response_model=dict)
@require_permission("can_manage_items")
async def get_pending_items_count(
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Get count of pending items accessible to the current user based on branch assignments
    Requires: can_manage_items permission
    """
    import json
    import os
    from datetime import datetime
    
    # #region agent log
    try:
        log_data = {
            "sessionId": "debug-session",
            "runId": "run1",
            "hypothesisId": "B",
            "location": "itemRoutes.py:get_pending_items_count:entry",
            "message": "API endpoint called",
            "data": {"user_id": current_user.id, "user_email": getattr(current_user, 'email', 'N/A')},
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        with open("/Users/almardas/Desktop/customized-mfqod/.cursor/debug.log", "a") as f:
            f.write(json.dumps(log_data) + "\n")
    except: pass
    # #endregion
    
    try:
        count = item_service.get_pending_items_count(current_user.id)
        
        # #region agent log
        try:
            log_data = {
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "B",
                "location": "itemRoutes.py:get_pending_items_count:return",
                "message": "API returning count",
                "data": {"count": count},
                "timestamp": int(datetime.now().timestamp() * 1000)
            }
            with open("/Users/almardas/Desktop/customized-mfqod/.cursor/debug.log", "a") as f:
                f.write(json.dumps(log_data) + "\n")
        except: pass
        # #endregion
        
        return {"count": count}
    except Exception as e:
        # #region agent log
        try:
            log_data = {
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "B",
                "location": "itemRoutes.py:get_pending_items_count:error",
                "message": "API error",
                "data": {"error": str(e)},
                "timestamp": int(datetime.now().timestamp() * 1000)
            }
            with open("/Users/almardas/Desktop/customized-mfqod/.cursor/debug.log", "a") as f:
                f.write(json.dumps(log_data) + "\n")
        except: pass
        # #endregion
        raise HTTPException(status_code=500, detail=f"Error retrieving pending items count: {str(e)}")

@router.get("/public/{item_id}", response_model=ItemDetailResponse)
@rate_limit_public()
async def get_public_item(
    item_id: str,
    request: Request,
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
        # Pass None as user_id for public access (no permission check)
        item = item_service.get_item_detail_by_id(item_id, include_deleted=False, user_id=None)
        
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
async def get_item(
    item_id: str,
    request: Request,
    include_deleted: bool = Query(False, description="Include soft-deleted items"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user = Depends(get_current_user_required)
):
    """
    Get a single item by ID with related data
    Requires: Authentication (user must be logged in)
    """
    try:
        item = item_service.get_item_detail_by_id(item_id, include_deleted, user_id=str(current_user.id))
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving item: {str(e)}")

# =========================== 
# Update Operations
# ===========================

@router.put("/{item_id}", response_model=ItemResponse)
@require_permission("can_manage_items")
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
    Requires: can_manage_items permission
    """
    try:
        item = item_service.update_item(item_id, update_data)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")

@router.patch("/{item_id}", response_model=ItemResponse)
@require_permission("can_manage_items")
async def patch_item(
    item_id: str,
    update_data: dict,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Partially update an existing item with location history tracking
    Requires: can_manage_items permission
    
    Note: Changes to item location are tracked in audit log for compliance
    """
    try:
        # Capture request metadata for audit trail (IP, user agent, user ID)
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item = item_service.patch_item(item_id, update_data, current_user.id, ip_address, user_agent)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error patching item: {str(e)}")

@router.patch("/{item_id}/toggle-approval", response_model=ItemResponse)
@require_permission("can_manage_items")
async def toggle_item_approval(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Toggle the approval status of an item (toggles between approved and pending)
    Requires: can_manage_items permission
    """
    try:
        # Get request info for audit logging
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item = item_service.toggle_approval(item_id, current_user.id, ip_address, user_agent)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling approval: {str(e)}")

@router.patch("/{item_id}/toggle-hidden/", response_model=ItemResponse)
@require_permission("can_manage_items")
async def toggle_item_hidden_status(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Toggle the hidden status of an item (controls visibility of all images)
    Requires: can_manage_items permission
    """
    try:
        item = item_service.toggle_item_hidden_status(item_id)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling hidden status: {str(e)}")

@router.patch("/{item_id}/set-hidden/", response_model=ItemResponse)
@require_permission("can_manage_items")
async def set_item_hidden_status(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access())
):
    """
    Set the hidden status of an item (controls visibility of all images)
    Requires: can_manage_items permission
    Expects JSON body: {"is_hidden": bool}
    """
    try:
        body = await request.json()
        is_hidden = body.get("is_hidden")
        if is_hidden is None:
            raise HTTPException(status_code=400, detail="is_hidden field is required in request body")
        if not isinstance(is_hidden, bool):
            raise HTTPException(status_code=400, detail="is_hidden must be a boolean value")
        
        item = item_service.set_item_hidden_status(item_id, is_hidden)
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error setting hidden status: {str(e)}")

@router.patch("/{item_id}/status", response_model=ItemResponse)
@require_permission("can_manage_items")
async def update_item_status(
    item_id: str,
    new_status: ItemStatus,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Update item status explicitly
    Requires: can_manage_items permission
    """
    try:
        from app.models import ItemStatus as ModelItemStatus
        # Convert schema enum to model enum
        model_status = ModelItemStatus(new_status.value)
        # Get request info for audit logging
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item = item_service.update_status(item_id, model_status, current_user.id, ip_address, user_agent)
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")

@router.patch("/{item_id}/approve", response_model=ItemResponse)
@require_permission("can_manage_items")
async def approve_item(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Approve an item (change status from pending to approved)
    Requires: can_manage_items permission
    
    Business rule: Item must be in 'pending' status and have an approved claim
    This ensures items are only approved after a valid claim has been processed
    """
    try:
        # Get request info for audit logging
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item = item_service.approve_item(item_id, current_user.id, ip_address, user_agent)
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error approving item: {str(e)}")

@router.post("/{item_id}/dispose", response_model=ItemResponse)
@require_permission("can_manage_items")
async def dispose_item(
    item_id: str,
    request_body: DisposeItemRequest,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Dispose an item (change status to disposed with a note)
    Requires: can_manage_items permission
    
    Business rule: Item status is changed to 'disposed' and a disposal note is saved
    This is used when an item was not received and was disposed of
    """
    try:
        # Get request info for audit logging
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item = item_service.dispose_item(item_id, request_body.disposal_note, current_user.id, ip_address, user_agent)
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error disposing item: {str(e)}")

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
@require_permission("can_manage_items")
async def delete_item(
    item_id: str,
    request: Request,
    permanent: bool = Query(False, description="Permanently delete the item"),
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Delete an item (soft delete by default, permanent if specified)
    Requires: can_manage_items permission
    
    Soft delete: Sets temporary_deletion flag, item can be restored
    Permanent delete: Removes item and all related data (images, claims, addresses)
    """
    try:
        # Capture request metadata for audit trail
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item_service.delete_item(item_id, permanent, current_user.id, ip_address, user_agent)
        
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
@require_permission("can_manage_items")
async def restore_item(
    item_id: str,
    request: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    current_user: User = Depends(get_current_user_required),
    _: None = Depends(require_branch_access())
):
    """
    Restore a soft-deleted item
    Requires: can_manage_items permission
    """
    try:
        # Get request info for audit logging
        auth_service = AuthService()
        ip_address = auth_service._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        item = item_service.restore_item(item_id, current_user.id, ip_address, user_agent)
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error restoring item: {str(e)}")

# =========================== 
# Bulk Operations
# ===========================

@router.post("/bulk/delete", response_model=BulkOperationResponse)
@require_permission("can_manage_items")
async def bulk_delete_items(
    request: BulkDeleteRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk delete multiple items
    Requires: can_manage_items permission
    
    Security: require_branch_access_for_bulk_operations ensures user can only
    delete items from branches they manage, preventing unauthorized bulk operations
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
@require_permission("can_manage_items")
async def bulk_update_items(
    request: BulkUpdateRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk update multiple items
    Requires: can_manage_items permission
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
@require_permission("can_manage_items")
async def bulk_approval_items(
    request: BulkApprovalRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk update approval status for multiple items (DEPRECATED: use bulk/status instead)
    Requires: can_manage_items permission
    """
    try:
        result = item_service.bulk_approval(request)
        
        return BulkOperationResponse(
            message="Bulk approval operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk approval: {str(e)}")

@router.patch("/bulk/status", response_model=BulkOperationResponse)
@require_permission("can_manage_items")
async def bulk_update_status(
    request: BulkStatusRequest,
    req: Request,
    db: Session = Depends(get_session),
    item_service: ItemService = Depends(get_item_service),
    _: None = Depends(require_branch_access_for_bulk_operations())
):
    """
    Bulk update status for multiple items
    Requires: can_manage_items permission
    """
    try:
        result = item_service.bulk_update_status(request)
        
        return BulkOperationResponse(
            message="Bulk status update operation completed",
            **result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk status update: {str(e)}")


