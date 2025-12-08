from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status
from datetime import datetime, timezone
from typing import List, Optional
from app.models import BranchTransferRequest, Item, Address, Branch, User, TransferStatus
from app.schemas.transfer_request_schema import TransferRequestCreate, TransferRequestUpdate, TransferRequestResponse

class TransferRequestService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_transfer_request(self, request_data: TransferRequestCreate, requested_by_user_id: str) -> BranchTransferRequest:
        """Create a new transfer request"""
        # Verify item exists
        item = self.db.query(Item).filter(Item.id == request_data.item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        
        # Get current branch of the item
        current_address = self.db.query(Address).filter(
            and_(
                Address.item_id == request_data.item_id,
                Address.is_current == True
            )
        ).first()
        
        if not current_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item does not have a current location"
            )
        
        from_branch_id = current_address.branch_id
        
        # Verify destination branch exists
        to_branch = self.db.query(Branch).filter(Branch.id == request_data.to_branch_id).first()
        if not to_branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Destination branch not found"
            )
        
        # Check if it's the same branch
        if from_branch_id == request_data.to_branch_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transfer item to the same branch"
            )
        
        # Check if there's already a pending request for this item
        existing_request = self.db.query(BranchTransferRequest).filter(
            and_(
                BranchTransferRequest.item_id == request_data.item_id,
                BranchTransferRequest.status == TransferStatus.PENDING
            )
        ).first()
        
        if existing_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="There is already a pending transfer request for this item"
            )
        
        # Create transfer request
        transfer_request = BranchTransferRequest(
            item_id=request_data.item_id,
            from_branch_id=from_branch_id,
            to_branch_id=request_data.to_branch_id,
            requested_by=requested_by_user_id,
            status=TransferStatus.PENDING,
            notes=request_data.notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.db.add(transfer_request)
        self.db.commit()
        self.db.refresh(transfer_request)
        
        return transfer_request
    
    def get_transfer_requests(self, user_id: Optional[str] = None, branch_id: Optional[str] = None, status_filter: Optional[str] = None) -> List[BranchTransferRequest]:
        """Get transfer requests with optional filtering"""
        query = self.db.query(BranchTransferRequest)
        
        if user_id:
            # Get requests where user is the requester or manages the destination branch
            from app.models import UserBranchManager
            managed_branch_ids = [
                row[0] for row in self.db.query(UserBranchManager.branch_id).filter(
                    UserBranchManager.user_id == user_id
                ).all()
            ]
            
            if managed_branch_ids:
                query = query.filter(
                    or_(
                        BranchTransferRequest.requested_by == user_id,
                        BranchTransferRequest.to_branch_id.in_(managed_branch_ids)
                    )
                )
            else:
                query = query.filter(BranchTransferRequest.requested_by == user_id)
        
        if branch_id:
            query = query.filter(
                or_(
                    BranchTransferRequest.from_branch_id == branch_id,
                    BranchTransferRequest.to_branch_id == branch_id
                )
            )
        
        if status_filter:
            try:
                status_enum = TransferStatus(status_filter)
                query = query.filter(BranchTransferRequest.status == status_enum)
            except ValueError:
                pass
        
        return query.order_by(BranchTransferRequest.created_at.desc()).all()
    
    def get_transfer_request_by_id(self, request_id: str) -> Optional[BranchTransferRequest]:
        """Get a transfer request by ID"""
        return self.db.query(BranchTransferRequest).filter(BranchTransferRequest.id == request_id).first()
    
    def approve_transfer_request(self, request_id: str, approved_by_user_id: str) -> BranchTransferRequest:
        """Approve a transfer request and update item location"""
        transfer_request = self.get_transfer_request_by_id(request_id)
        
        if not transfer_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer request not found"
            )
        
        if transfer_request.status != TransferStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transfer request is already {transfer_request.status.value}"
            )
        
        # Update transfer request status
        transfer_request.status = TransferStatus.APPROVED
        transfer_request.approved_by = approved_by_user_id
        transfer_request.approved_at = datetime.now(timezone.utc)
        transfer_request.updated_at = datetime.now(timezone.utc)
        
        # Update item location
        # Mark current address as not current
        self.db.query(Address).filter(
            and_(
                Address.item_id == transfer_request.item_id,
                Address.is_current == True
            )
        ).update({Address.is_current: False})
        
        # Create new address for the new branch
        new_address = Address(
            item_id=transfer_request.item_id,
            branch_id=transfer_request.to_branch_id,
            is_current=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        self.db.add(new_address)
        
        self.db.commit()
        self.db.refresh(transfer_request)
        
        return transfer_request
    
    def reject_transfer_request(self, request_id: str, rejected_by_user_id: str, notes: Optional[str] = None) -> BranchTransferRequest:
        """Reject a transfer request"""
        transfer_request = self.get_transfer_request_by_id(request_id)
        
        if not transfer_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer request not found"
            )
        
        if transfer_request.status != TransferStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transfer request is already {transfer_request.status.value}"
            )
        
        transfer_request.status = TransferStatus.REJECTED
        transfer_request.approved_by = rejected_by_user_id
        transfer_request.approved_at = datetime.now(timezone.utc)
        transfer_request.updated_at = datetime.now(timezone.utc)
        if notes:
            transfer_request.notes = (transfer_request.notes or "") + f"\nRejection note: {notes}"
        
        self.db.commit()
        self.db.refresh(transfer_request)
        
        return transfer_request
    
    def to_response(self, transfer_request: BranchTransferRequest, can_approve: bool = False) -> dict:
        """Convert transfer request to response dict"""
        return {
            "id": transfer_request.id,
            "item_id": transfer_request.item_id,
            "from_branch_id": transfer_request.from_branch_id,
            "to_branch_id": transfer_request.to_branch_id,
            "requested_by": transfer_request.requested_by,
            "status": transfer_request.status.value,
            "notes": transfer_request.notes,
            "created_at": transfer_request.created_at,
            "updated_at": transfer_request.updated_at,
            "approved_at": transfer_request.approved_at,
            "approved_by": transfer_request.approved_by,
            "item": {
                "id": transfer_request.item.id,
                "title": transfer_request.item.title,
                "description": transfer_request.item.description,
            } if transfer_request.item else None,
            "from_branch": {
                "id": transfer_request.from_branch.id,
                "branch_name_ar": transfer_request.from_branch.branch_name_ar,
                "branch_name_en": transfer_request.from_branch.branch_name_en,
            } if transfer_request.from_branch else None,
            "to_branch": {
                "id": transfer_request.to_branch.id,
                "branch_name_ar": transfer_request.to_branch.branch_name_ar,
                "branch_name_en": transfer_request.to_branch.branch_name_en,
            } if transfer_request.to_branch else None,
            "requested_by_user": {
                "id": transfer_request.requested_by_user.id,
                "email": transfer_request.requested_by_user.email,
                "first_name": transfer_request.requested_by_user.first_name,
                "last_name": transfer_request.requested_by_user.last_name,
            } if transfer_request.requested_by_user else None,
            "can_approve": can_approve,
        }

