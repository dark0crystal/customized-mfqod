from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models import Branch
from app.db.database import get_session
from app.schemas.organization_schemas import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse, 
    OrganizationWithBranches
)
from app.services.organizationService import OrganizationService

from app.utils.permission_decorator import require_permission

router = APIRouter()

# =========================== 
# Dependency Injection
# ===========================

def get_organization_service(db: Session = Depends(get_session)) -> OrganizationService:
    return OrganizationService(db)

# =========================== 
# Organization Routes
# ===========================

@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    organization: OrganizationCreate,
    request: Request,
    db: Session = Depends(get_session),
    org_service: OrganizationService = Depends(get_organization_service)
):
    """Create a new organization"""
    try:
        return org_service.create_organization(organization)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating organization: {str(e)}")


@router.get("/", response_model=List[OrganizationResponse])
def get_organizations(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_session),
    org_service: OrganizationService = Depends(get_organization_service)
):
    """Get all organizations with pagination"""
    try:
        return org_service.get_organizations(skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving organizations: {str(e)}")


@router.get("/{organization_id}", response_model=OrganizationWithBranches)
def get_organization(
    organization_id: str,
    request: Request,
    db: Session = Depends(get_session),
    org_service: OrganizationService = Depends(get_organization_service)
):
    """Get an organization by ID with its branches"""
    try:
        organization = org_service.get_organization_with_branches(organization_id)
        
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        # Convert to response format with branches
        result = {
            "id": organization.id,
            "name_ar": organization.name_ar,
            "name_en": organization.name_en,
            "description_ar": organization.description_ar,
            "description_en": organization.description_en,
            "created_at": organization.created_at,
            "updated_at": organization.updated_at,
            "branches": [
                {
                    "id": branch.id,
                    "branch_name_ar": branch.branch_name_ar,
                    "branch_name_en": branch.branch_name_en,
                    "created_at": branch.created_at,
                    "updated_at": branch.updated_at
                } for branch in organization.branches
            ] if organization.branches else []
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving organization: {str(e)}")


@router.put("/{organization_id}", response_model=OrganizationResponse)
def update_organization(
    organization_id: str,
    organization_update: OrganizationUpdate,
    request: Request,
    db: Session = Depends(get_session),
    org_service: OrganizationService = Depends(get_organization_service)
):
    """Update an organization"""
    try:
        return org_service.update_organization(organization_id, organization_update)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating organization: {str(e)}")


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    organization_id: str,
    request: Request,
    db: Session = Depends(get_session),
    org_service: OrganizationService = Depends(get_organization_service)
):
    """Delete an organization"""
    try:
        org_service.delete_organization(organization_id)
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting organization: {str(e)}")


# @router.get("/organizations/search/", response_model=List[OrganizationResponse])
# def search_organizations(
#     name: str = Query(..., min_length=1),
#     request: Request,
#     db: Session = Depends(get_session),
#     org_service: OrganizationService = Depends(get_organization_service)
# ):
#     """Search organizations by name"""
#     try:
#         organization = org_service.get_organization_by_name(name)
#         return [organization] if organization else []
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error searching organizations: {str(e)}")


@router.get("/{organization_id}/branches/", response_model=List[dict])
def get_organization_branches(
    organization_id: str,
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_session),
    org_service: OrganizationService = Depends(get_organization_service)
):
    """Get all branches for a specific organization"""
    try:
        # First check if organization exists
        organization = org_service.get_organization_by_id(organization_id)
        
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        # Get branches for this organization
        branches = db.query(Branch).filter(
            Branch.organization_id == organization_id
        ).offset(skip).limit(limit).all()
        
        # Convert to response format
        result = []
        for branch in branches:
            branch_dict = {
                "id": branch.id,
                "branch_name_ar": branch.branch_name_ar,
                "branch_name_en": branch.branch_name_en,
                "organization_id": branch.organization_id,
                "created_at": branch.created_at,
                "updated_at": branch.updated_at
            }
            result.append(branch_dict)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving organization branches: {str(e)}")


# # =========================== 
# # Statistics Routes
# # ===========================

# @router.get("/organizations/stats/summary")
# def get_organizations_stats(
#     request: Request,
#     db: Session = Depends(get_session)
# ):
#     """Get organization statistics"""
#     try:
#         total_orgs = db.query(Organization).count()
#         total_branches = db.query(Branch).count()
        
#         # Organizations with branches
#         orgs_with_branches = db.query(Organization).filter(
#             Organization.branches.any()
#         ).count()
        
#         # Organizations without branches
#         orgs_without_branches = total_orgs - orgs_with_branches
        
#         return {
#             "total_organizations": total_orgs,
#             "total_branches": total_branches,
#             "organizations_with_branches": orgs_with_branches,
#             "organizations_without_branches": orgs_without_branches,
#             "average_branches_per_org": total_branches / total_orgs if total_orgs > 0 else 0
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")