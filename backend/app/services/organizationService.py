from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status

from models import Organization, Branch  # Assuming these are your models
from schemas.organization_schemas import OrganizationCreate, OrganizationUpdate


class OrganizationService:
    def __init__(self, db: Session):
        self.db = db

    def create_organization(self, org_data: OrganizationCreate) -> Organization:
        """Create a new organization"""
        # Check if organization name already exists
        existing_org = self.db.query(Organization).filter(
            Organization.name == org_data.name
        ).first()
        
        if existing_org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization name already exists"
            )
        
        db_org = Organization(
            name=org_data.name,
            description=org_data.description
        )
        
        self.db.add(db_org)
        self.db.commit()
        self.db.refresh(db_org)
        
        return db_org

    def get_organizations(self, skip: int = 0, limit: int = 100) -> List[Organization]:
        """Get all organizations with pagination"""
        return self.db.query(Organization).offset(skip).limit(limit).all()

    def get_organization_by_id(self, org_id: str) -> Optional[Organization]:
        """Get an organization by ID"""
        return self.db.query(Organization).filter(Organization.id == org_id).first()

    def get_organization_by_name(self, name: str) -> Optional[Organization]:
        """Get an organization by name"""
        return self.db.query(Organization).filter(Organization.name == name).first()

    def update_organization(self, org_id: str, org_update: OrganizationUpdate) -> Organization:
        """Update an organization"""
        db_org = self.get_organization_by_id(org_id)
        
        if not db_org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        update_data = org_update.model_dump(exclude_unset=True)
        
        # If updating name, check for duplicates
        if 'name' in update_data:
            existing_org = self.db.query(Organization).filter(
                and_(
                    Organization.name == update_data['name'],
                    Organization.id != org_id
                )
            ).first()
            
            if existing_org:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Organization name already exists"
                )
        
        for field, value in update_data.items():
            setattr(db_org, field, value)
        
        db_org.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(db_org)
        
        return db_org

    def delete_organization(self, org_id: str) -> bool:
        """Delete an organization"""
        db_org = self.get_organization_by_id(org_id)
        
        if not db_org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        # Check if organization has branches
        branches_count = self.db.query(Branch).filter(
            Branch.organization_id == org_id
        ).count()
        
        if branches_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete organization with existing branches"
            )
        
        self.db.delete(db_org)
        self.db.commit()
        
        return True

    def get_organization_with_branches(self, org_id: str) -> Optional[Organization]:
        """Get organization with its branches"""
        return self.db.query(Organization).filter(
            Organization.id == org_id
        ).first()