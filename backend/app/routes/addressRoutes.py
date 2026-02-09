from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.db.database import get_session
from app.models import Address, Item, Branch
from pydantic import BaseModel

router = APIRouter()

# Pydantic schemas for request/response
class AddressCreate(BaseModel):
    item_id: str
    branch_id: str
    is_current: bool = True

class AddressResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_current: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_address(
    address: AddressCreate,
    request: Request,
    db: Session = Depends(get_session)
):
    """Create a new address for an item"""
    try:
        # Validate that item exists
        item = db.query(Item).filter(Item.id == address.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Validate that branch exists
        branch = db.query(Branch).filter(Branch.id == address.branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        # Business rule: Only one address can be "current" per item
        # When setting a new address as current, mark all other addresses for this item as not current
        # This ensures item location tracking has a single current location
        if address.is_current:
            db.query(Address).filter(Address.item_id == address.item_id).update(
                {"is_current": False}
            )
        
        # Create new address
        new_address = Address(
            id=str(uuid.uuid4()),
            item_id=address.item_id,
            branch_id=address.branch_id,
            is_current=address.is_current,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(new_address)
        db.commit()
        db.refresh(new_address)
        
        return new_address
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating address: {str(e)}")

@router.get("/", response_model=List[AddressResponse])
async def get_addresses(
    request: Request,
    item_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Get addresses with optional filtering"""
    try:
        query = db.query(Address)
        
        if item_id:
            query = query.filter(Address.item_id == item_id)
        
        if branch_id:
            query = query.filter(Address.branch_id == branch_id)
        
        addresses = query.all()
        return addresses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving addresses: {str(e)}")

@router.get("/{address_id}", response_model=AddressResponse)
async def get_address(
    address_id: str,
    request: Request,
    db: Session = Depends(get_session)
):
    """Get a specific address by ID"""
    try:
        address = db.query(Address).filter(Address.id == address_id).first()
        
        if not address:
            raise HTTPException(status_code=404, detail="Address not found")
        
        return address
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving address: {str(e)}")

@router.put("/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: str,
    address_update: AddressCreate,
    request: Request,
    db: Session = Depends(get_session)
):
    """Update an existing address"""
    try:
        address = db.query(Address).filter(Address.id == address_id).first()
        
        if not address:
            raise HTTPException(status_code=404, detail="Address not found")
        
        # Business rule: Maintain single current address per item
        # When updating an address to current, mark all other addresses for this item as not current
        if address_update.is_current:
            db.query(Address).filter(
                Address.item_id == address_update.item_id,
                Address.id != address_id
            ).update({"is_current": False})
        
        # Validate branch
        branch = db.query(Branch).filter(Branch.id == address_update.branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        # Validate item
        item = db.query(Item).filter(Item.id == address_update.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Update address fields
        address.item_id = address_update.item_id
        address.branch_id = address_update.branch_id
        address.is_current = address_update.is_current
        address.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(address)
        
        return address
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating address: {str(e)}")

@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(
    address_id: str,
    request: Request,
    db: Session = Depends(get_session)
):
    """Delete an address"""
    try:
        address = db.query(Address).filter(Address.id == address_id).first()
        
        if not address:
            raise HTTPException(status_code=404, detail="Address not found")
        
        db.delete(address)
        db.commit()
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting address: {str(e)}")