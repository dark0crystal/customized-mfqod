from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status

from models import Branch, Organization, Address, Item  # Assuming these are your models
from schemas.branch_schemas import BranchCreate, BranchUpdate, AddressCreate, AddressUpdate


class BranchService:
    def __init__(self, db: Session):
        self.db = db

    def create_branch(self, branch_data: BranchCreate) -> Branch:
        """Create a new branch"""
        # Check if organization exists
        organization = self.db.query(Organization).filter(
            Organization.id == branch_data.organization_id
        ).first()
        
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        # Check if branch name already exists for this organization
        existing_branch = self.db.query(Branch).filter(
            and_(
                Branch.branch_name == branch_data.branch_name,
                Branch.organization_id == branch_data.organization_id
            )
        ).first()
        
        if existing_branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch name already exists for this organization"
            )
        
        db_branch = Branch(
            branch_name=branch_data.branch_name,
            organization_id=branch_data.organization_id
        )
        
        self.db.add(db_branch)
        self.db.commit()
        self.db.refresh(db_branch)
        
        return db_branch

    def get_branches(self, skip: int = 0, limit: int = 100, organization_id: Optional[str] = None) -> List[Branch]:
        """Get all branches with optional filtering by organization"""
        query = self.db.query(Branch)
        
        if organization_id:
            query = query.filter(Branch.organization_id == organization_id)
        
        return query.offset(skip).limit(limit).all()

    def get_branch_by_id(self, branch_id: str) -> Optional[Branch]:
        """Get a branch by ID"""
        return self.db.query(Branch).filter(Branch.id == branch_id).first()

    def update_branch(self, branch_id: str, branch_update: BranchUpdate) -> Branch:
        """Update a branch"""
        db_branch = self.get_branch_by_id(branch_id)
        
        if not db_branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )
        
        update_data = branch_update.model_dump(exclude_unset=True)
        
        # If updating organization_id, check if it exists
        if 'organization_id' in update_data:
            organization = self.db.query(Organization).filter(
                Organization.id == update_data['organization_id']
            ).first()
            
            if not organization:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization not found"
                )
        
        # If updating branch_name, check for duplicates
        if 'branch_name' in update_data:
            org_id = update_data.get('organization_id', db_branch.organization_id)
            existing_branch = self.db.query(Branch).filter(
                and_(
                    Branch.branch_name == update_data['branch_name'],
                    Branch.organization_id == org_id,
                    Branch.id != branch_id
                )
            ).first()
            
            if existing_branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Branch name already exists for this organization"
                )
        
        for field, value in update_data.items():
            setattr(db_branch, field, value)
        
        db_branch.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(db_branch)
        
        return db_branch

    def delete_branch(self, branch_id: str) -> bool:
        """Delete a branch"""
        db_branch = self.get_branch_by_id(branch_id)
        
        if not db_branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )
        
        # Check if branch has addresses
        addresses_count = self.db.query(Address).filter(
            Address.branch_id == branch_id
        ).count()
        
        if addresses_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete branch with existing addresses"
            )
        
        self.db.delete(db_branch)
        self.db.commit()
        
        return True


class AddressService:
    def __init__(self, db: Session):
        self.db = db

    def create_address(self, address_data: AddressCreate) -> Address:
        """Create a new address"""
        # Check if item exists
        item = self.db.query(Item).filter(Item.id == address_data.item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        
        # Check if branch exists
        branch = self.db.query(Branch).filter(Branch.id == address_data.branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )
        
        # If this is set as current, update other addresses for this item
        if address_data.is_current:
            self.db.query(Address).filter(
                Address.item_id == address_data.item_id
            ).update({Address.is_current: False})
        
        db_address = Address(
            item_id=address_data.item_id,
            branch_id=address_data.branch_id,
            is_current=address_data.is_current
        )
        
        self.db.add(db_address)
        self.db.commit()
        self.db.refresh(db_address)
        
        return db_address

    def get_addresses(self, skip: int = 0, limit: int = 100, item_id: Optional[str] = None, branch_id: Optional[str] = None) -> List[Address]:
        """Get all addresses with optional filtering"""
        query = self.db.query(Address)
        
        if item_id:
            query = query.filter(Address.item_id == item_id)
        
        if branch_id:
            query = query.filter(Address.branch_id == branch_id)
        
        return query.offset(skip).limit(limit).all()

    def get_address_by_id(self, address_id: str) -> Optional[Address]:
        """Get an address by ID"""
        return self.db.query(Address).filter(Address.id == address_id).first()

    def update_address(self, address_id: str, address_update: AddressUpdate) -> Address:
        """Update an address"""
        db_address = self.get_address_by_id(address_id)
        
        if not db_address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        update_data = address_update.model_dump(exclude_unset=True)
        
        # Validate item_id if provided
        if 'item_id' in update_data:
            item = self.db.query(Item).filter(Item.id == update_data['item_id']).first()
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found"
                )
        
        # Validate branch_id if provided
        if 'branch_id' in update_data:
            branch = self.db.query(Branch).filter(Branch.id == update_data['branch_id']).first()
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Branch not found"
                )
        
        # If setting as current, update other addresses for this item
        if update_data.get('is_current', False):
            item_id = update_data.get('item_id', db_address.item_id)
            self.db.query(Address).filter(
                and_(
                    Address.item_id == item_id,
                    Address.id != address_id
                )
            ).update({Address.is_current: False})
        
        for field, value in update_data.items():
            setattr(db_address, field, value)
        
        db_address.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(db_address)
        
        return db_address

    def delete_address(self, address_id: str) -> bool:
        """Delete an address"""
        db_address = self.get_address_by_id(address_id)
        
        if not db_address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        self.db.delete(db_address)
        self.db.commit()
        
        return True