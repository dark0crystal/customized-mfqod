# from fastapi import APIRouter, Depends, HTTPException, status
# from sqlalchemy.orm import Session
# from db.database import get_session
# from services.itemTypeService import ItemTypeService
# from schemas.item_type_schema import (
#     CreateItemTypeRequest,
#     UpdateItemTypeRequest,
#     ItemTypeResponse
# )

# router = APIRouter()

# # =================
# # Add new item type
# # =================
# @router.post("/", response_model=ItemTypeResponse, status_code=status.HTTP_201_CREATED)
# def create_item_type(
#     payload: CreateItemTypeRequest,
#     db: Session = Depends(get_session)
# ):
#     try:
#         return ItemTypeService(db).create_item_type(payload)
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))

# # =================
# # list all item types
# # =================
# @router.get("/", response_model=list[ItemTypeResponse])
# def list_item_types(db: Session = Depends(get_session)):
#     return ItemTypeService(db).list_item_types()

# # =================
# # Get specific item type
# # =================
# @router.get("/{item_type_id}", response_model=ItemTypeResponse)
# def get_item_type(item_type_id: str, db: Session = Depends(get_session)):
#     try:
#         return ItemTypeService(db).get_item_type_by_id(item_type_id)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))

# # =================
# # Update item type
# # =================
# @router.put("/{item_type_id}", response_model=ItemTypeResponse)
# def update_item_type(item_type_id: str, data: UpdateItemTypeRequest, db: Session = Depends(get_session)):
#     try:
#         return ItemTypeService(db).update_item_type(item_type_id, data)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))

# # =================
# # Delete Item Type
# # =================
# @router.delete("/{item_type_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_item_type(item_type_id: str, db: Session = Depends(get_session)):
#     try:
#         ItemTypeService(db).delete_item_type(item_type_id)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))


from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db.database import get_session
from services.itemTypeService import ItemTypeService
from schemas.item_type_schema import (
    CreateItemTypeRequest,
    UpdateItemTypeRequest,
    ItemTypeResponse
)
from utils.permission_decorator import require_permission, require_any_permission, require_all_permissions

router = APIRouter()

# ================= 
# Add new item type
# ================= 
@router.post("/", response_model=ItemTypeResponse, status_code=status.HTTP_201_CREATED)
@require_permission("can_create_item_types")
def create_item_type(
    payload: CreateItemTypeRequest,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        return ItemTypeService(db).create_item_type(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ================= 
# List all item types
# ================= 
@router.get("/", response_model=list[ItemTypeResponse])
@require_permission("can_view_item_types")
def list_item_types(
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    return ItemTypeService(db).list_item_types()

# ================= 
# Get specific item type
# ================= 
@router.get("/{item_type_id}", response_model=ItemTypeResponse)
@require_permission("can_view_item_types")
def get_item_type(
    item_type_id: str,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        return ItemTypeService(db).get_item_type_by_id(item_type_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ================= 
# Update item type
# ================= 
@router.put("/{item_type_id}", response_model=ItemTypeResponse)
@require_any_permission(["can_edit_item_types", "can_manage_item_types"])
def update_item_type(
    item_type_id: str,
    data: UpdateItemTypeRequest,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        return ItemTypeService(db).update_item_type(item_type_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ================= 
# Delete Item Type
# ================= 
@router.delete("/{item_type_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_all_permissions(["can_delete_item_types", "can_manage_item_types"])
def delete_item_type(
    item_type_id: str,
    request: Request,  # Token extracted automatically from this
    db: Session = Depends(get_session)
):
    try:
        ItemTypeService(db).delete_item_type(item_type_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
