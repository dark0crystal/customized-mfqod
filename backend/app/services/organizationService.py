from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.models import Organization, Branch  # Assuming these are your models
from app.schemas.organization_schemas import OrganizationCreate, OrganizationUpdate


class OrganizationService:
    def __init__(self, db: Session):
        self.db = db

    def create_organization(self, org_data: OrganizationCreate) -> Organization:
        """Create a new organization"""
        # Check if organization name already exists (check both AR and EN)
        existing_org = None
        if org_data.name_ar:
            existing_org = self.db.query(Organization).filter(
                Organization.name_ar == org_data.name_ar
            ).first()
        
        if not existing_org and org_data.name_en:
            existing_org = self.db.query(Organization).filter(
                Organization.name_en == org_data.name_en
            ).first()
        
        if existing_org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization name already exists"
            )
        
        db_org = Organization(
            name_ar=org_data.name_ar,
            name_en=org_data.name_en,
            description_ar=org_data.description_ar,
            description_en=org_data.description_en
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

    def get_organization_by_name(self, name_ar: str = None, name_en: str = None) -> Optional[Organization]:
        """Get an organization by name (Arabic or English)"""
        if name_ar:
            return self.db.query(Organization).filter(Organization.name_ar == name_ar).first()
        elif name_en:
            return self.db.query(Organization).filter(Organization.name_en == name_en).first()
        return None

    def update_organization(self, org_id: str, org_update: OrganizationUpdate) -> Organization:
        """Update an organization"""
        db_org = self.get_organization_by_id(org_id)
        
        if not db_org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        update_data = org_update.model_dump(exclude_unset=True)
        
        # If updating names, check for duplicates
        existing_org = None
        if 'name_ar' in update_data and update_data['name_ar']:
            existing_org = self.db.query(Organization).filter(
                and_(
                    Organization.name_ar == update_data['name_ar'],
                    Organization.id != org_id
                )
            ).first()
        
        if not existing_org and 'name_en' in update_data and update_data['name_en']:
            existing_org = self.db.query(Organization).filter(
                and_(
                    Organization.name_en == update_data['name_en'],
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