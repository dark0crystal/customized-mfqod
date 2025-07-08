from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_session  # Your database dependency
from schemas.branch_schemas import (
    BranchCreate, BranchUpdate, BranchResponse, BranchWithOrganization,
    AddressCreate, AddressUpdate, AddressResponse, AddressWithDetails
)
from services.branchService import BranchService, AddressService

# Import permission decorators (if needed)
from utils.permission_decorator import require_permission

router = APIRouter()

# =========================== 
# Dependency Injection
# ===========================

def get_branch_service(db: Session = Depends(get_session)) -> BranchService:
    return BranchService(db)

def get_address_service(db: Session = Depends(get_session)) -> AddressService:
    return AddressService(db)

# =========================== 
# Branch Routes
# ===========================

@router.post("/branches/", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
# @require_permission("can_create_branches")  # Uncomment if permissions are needed
def create_branch(
    branch: BranchCreate,
    request: Request,
    db: Session = Depends(get_session),
    branch_service: BranchService = Depends(get_branch_service)
):
    """Create a new branch"""
    try:
        return branch_service.create_branch(branch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating branch: {str(e)}")


@router.get("/branches/", response_model=List[BranchWithOrganization])
# @require_permission("can_view_branches")  # Uncomment if permissions are needed
def get_branches(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organization_id: Optional[str] = Query(None),
    db: Session = Depends(get_session),
    branch_service: BranchService = Depends(get_branch_service)
):
    """Get all branches with optional filtering by organization"""
    try:
        branches = branch_service.get_branches(skip=skip, limit=limit, organization_id=organization_id)
        
        # Convert to response format with organization details
        result = []
        for branch in branches:
            branch_dict = {
                "id": branch.id,
                "branch_name": branch.branch_name,
                "organization_id": branch.organization_id,
                "created_at": branch.created_at,
                "updated_at": branch.updated_at,
                "organization": {
                    "id": branch.organization.id,
                    "name": branch.organization.name,
                    "description": branch.organization.description
                } if branch.organization else None
            }
            result.append(branch_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving branches: {str(e)}")


@router.get("/branches/{branch_id}", response_model=BranchWithOrganization)
# @require_permission("can_view_branches")  # Uncomment if permissions are needed
def get_branch(
    branch_id: str,
    request: Request,
    db: Session = Depends(get_session),
    branch_service: BranchService = Depends(get_branch_service)
):
    """Get a branch by ID"""
    try:
        branch = branch_service.get_branch_by_id(branch_id)
        
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )
        
        return {
            "id": branch.id,
            "branch_name": branch.branch_name,
            "organization_id": branch.organization_id,
            "created_at": branch.created_at,
            "updated_at": branch.updated_at,
            "organization": {
                "id": branch.organization.id,
                "name": branch.organization.name,
                "description": branch.organization.description
            } if branch.organization else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving branch: {str(e)}")


@router.put("/branches/{branch_id}", response_model=BranchResponse)
# @require_permission("can_edit_branches")  # Uncomment if permissions are needed
def update_branch(
    branch_id: str,
    branch_update: BranchUpdate,
    request: Request,
    db: Session = Depends(get_session),
    branch_service: BranchService = Depends(get_branch_service)
):
    """Update a branch"""
    try:
        return branch_service.update_branch(branch_id, branch_update)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating branch: {str(e)}")


@router.delete("/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
# @require_permission("can_delete_branches")  # Uncomment if permissions are needed
def delete_branch(
    branch_id: str,
    request: Request,
    db: Session = Depends(get_session),
    branch_service: BranchService = Depends(get_branch_service)
):
    """Delete a branch"""
    try:
        branch_service.delete_branch(branch_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting branch: {str(e)}")


# =========================== 
# Address Routes
# ===========================

@router.post("/addresses/", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
# @require_permission("can_create_addresses")  # Uncomment if permissions are needed
def create_address(
    address: AddressCreate,
    request: Request,
    db: Session = Depends(get_session),
    address_service: AddressService = Depends(get_address_service)
):
    """Create a new address"""
    try:
        return address_service.create_address(address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating address: {str(e)}")


@router.get("/addresses/", response_model=List[AddressWithDetails])
# @require_permission("can_view_addresses")  # Uncomment if permissions are needed
def get_addresses(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    item_id: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_session),
    address_service: AddressService = Depends(get_address_service)
):
    """Get all addresses with optional filtering"""
    try:
        addresses = address_service.get_addresses(skip=skip, limit=limit, item_id=item_id, branch_id=branch_id)
        
        # Convert to response format with related details
        result = []
        for address in addresses:
            address_dict = {
                "id": address.id,
                "item_id": address.item_id,
                "branch_id": address.branch_id,
                "is_current": address.is_current,
                "created_at": address.created_at,
                "updated_at": address.updated_at,
                "item": {
                    "id": address.item.id,
                    "title": address.item.title,
                    "description": address.item.description
                } if address.item else None,
                "branch": {
                    "id": address.branch.id,
                    "branch_name": address.branch.branch_name,
                    "organization_id": address.branch.organization_id
                } if address.branch else None
            }
            result.append(address_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving addresses: {str(e)}")


@router.get("/addresses/{address_id}", response_model=AddressWithDetails)
# @require_permission("can_view_addresses")  # Uncomment if permissions are needed
def get_address(
    address_id: str,
    request: Request,
    db: Session = Depends(get_session),
    address_service: AddressService = Depends(get_address_service)
):
    """Get an address by ID"""
    try:
        address = address_service.get_address_by_id(address_id)
        
        if not address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        return {
            "id": address.id,
            "item_id": address.item_id,
            "branch_id": address.branch_id,
            "is_current": address.is_current,
            "created_at": address.created_at,
            "updated_at": address.updated_at,
            "item": {
                "id": address.item.id,
                "title": address.item.title,
                "description": address.item.description
            } if address.item else None,
            "branch": {
                "id": address.branch.id,
                "branch_name": address.branch.branch_name,
                "organization_id": address.branch.organization_id
            } if address.branch else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving address: {str(e)}")


@router.put("/addresses/{address_id}", response_model=AddressResponse)
# @require_permission("can_edit_addresses")  # Uncomment if permissions are needed
def update_address(
    address_id: str,
    address_update: AddressUpdate,
    request: Request,
    db: Session = Depends(get_session),
    address_service: AddressService = Depends(get_address_service)
):
    """Update an address"""
    try:
        return address_service.update_address(address_id, address_update)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating address: {str(e)}")


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
# @require_permission("can_delete_addresses")  # Uncomment if permissions are needed
def delete_address(
    address_id: str,
    request: Request,
    db: Session = Depends(get_session),
    address_service: AddressService = Depends(get_address_service)
):
    """Delete an address"""
    try:
        address_service.delete_address(address_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting address: {str(e)}")


# =========================== 
# Additional utility routes
# ===========================

@router.get("/branches/{branch_id}/addresses/", response_model=List[AddressWithDetails])
# @require_permission("can_view_addresses")  # Uncomment if permissions are needed
def get_branch_addresses(
    branch_id: str,
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_session),
    branch_service: BranchService = Depends(get_branch_service),
    address_service: AddressService = Depends(get_address_service)
):
    """Get all addresses for a specific branch"""
    try:
        # First check if branch exists
        branch = branch_service.get_branch_by_id(branch_id)
        
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )
        
        # Get addresses for this branch
        addresses = address_service.get_addresses(skip=skip, limit=limit, branch_id=branch_id)
        
        # Convert to response format
        result = []
        for address in addresses:
            address_dict = {
                "id": address.id,
                "item_id": address.item_id,
                "branch_id": address.branch_id,
                "is_current": address.is_current,
                "created_at": address.created_at,
                "updated_at": address.updated_at,
                "item": {
                    "id": address.item.id,
                    "title": address.item.title,
                    "description": address.item.description
                } if address.item else None,
                "branch": {
                    "id": address.branch.id,
                    "branch_name": address.branch.branch_name,
                    "organization_id": address.branch.organization_id
                } if address.branch else None
            }
            result.append(address_dict)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving branch addresses: {str(e)}")