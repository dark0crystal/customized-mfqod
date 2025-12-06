from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.database import get_session
from app.services.transferRequestService import TransferRequestService
from app.schemas.transfer_request_schema import (
    TransferRequestCreate,
    TransferRequestUpdate,
    TransferRequestResponse
)
from app.middleware.auth_middleware import get_current_user_required
from app.models import User

router = APIRouter()

def get_transfer_request_service(db: Session = Depends(get_session)) -> TransferRequestService:
    return TransferRequestService(db)

@router.post("/", response_model=TransferRequestResponse, status_code=201)
async def create_transfer_request(
    request_data: TransferRequestCreate,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    transfer_service: TransferRequestService = Depends(get_transfer_request_service)
):
    """Create a new branch transfer request"""
    try:
        transfer_request = transfer_service.create_transfer_request(
            request_data, 
            current_user.id
        )
        return transfer_service.to_response(transfer_request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating transfer request: {str(e)}")

@router.get("/", response_model=List[TransferRequestResponse])
async def get_transfer_requests(
    request: Request,
    current_user: User = Depends(get_current_user_required),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    status: Optional[str] = Query(None, description="Filter by status (pending, approved, rejected)"),
    db: Session = Depends(get_session),
    transfer_service: TransferRequestService = Depends(get_transfer_request_service)
):
    """Get transfer requests for the current user"""
    try:
        transfer_requests = transfer_service.get_transfer_requests(
            user_id=current_user.id,
            branch_id=branch_id,
            status_filter=status
        )
        return [transfer_service.to_response(req) for req in transfer_requests]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving transfer requests: {str(e)}")

@router.get("/incoming/", response_model=List[TransferRequestResponse])
async def get_incoming_transfer_requests(
    request: Request,
    current_user: User = Depends(get_current_user_required),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_session),
    transfer_service: TransferRequestService = Depends(get_transfer_request_service)
):
    """Get transfer requests for branches managed by the current user (incoming requests)"""
    try:
        from app.models import UserBranchManager
        managed_branch_ids = [
            row[0] for row in db.query(UserBranchManager.branch_id).filter(
                UserBranchManager.user_id == current_user.id
            ).all()
        ]
        
        if not managed_branch_ids:
            return []
        
        all_requests = transfer_service.get_transfer_requests(
            branch_id=None,
            status_filter=status
        )
        
        # Filter to only requests to branches managed by user
        incoming_requests = [
            req for req in all_requests 
            if req.to_branch_id in managed_branch_ids
        ]
        
        return [transfer_service.to_response(req) for req in incoming_requests]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving incoming transfer requests: {str(e)}")

@router.get("/{request_id}", response_model=TransferRequestResponse)
async def get_transfer_request(
    request_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    transfer_service: TransferRequestService = Depends(get_transfer_request_service)
):
    """Get a specific transfer request by ID"""
    try:
        transfer_request = transfer_service.get_transfer_request_by_id(request_id)
        if not transfer_request:
            raise HTTPException(status_code=404, detail="Transfer request not found")
        return transfer_service.to_response(transfer_request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving transfer request: {str(e)}")

@router.post("/{request_id}/approve", response_model=TransferRequestResponse)
async def approve_transfer_request(
    request_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    transfer_service: TransferRequestService = Depends(get_transfer_request_service)
):
    """Approve a transfer request"""
    try:
        transfer_request = transfer_service.approve_transfer_request(
            request_id,
            current_user.id
        )
        return transfer_service.to_response(transfer_request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error approving transfer request: {str(e)}")

@router.post("/{request_id}/reject", response_model=TransferRequestResponse)
async def reject_transfer_request(
    request_id: str,
    rejection_data: Optional[TransferRequestUpdate] = None,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session),
    transfer_service: TransferRequestService = Depends(get_transfer_request_service)
):
    """Reject a transfer request"""
    try:
        notes = rejection_data.notes if rejection_data else None
        transfer_request = transfer_service.reject_transfer_request(
            request_id,
            current_user.id,
            notes
        )
        return transfer_service.to_response(transfer_request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rejecting transfer request: {str(e)}")

