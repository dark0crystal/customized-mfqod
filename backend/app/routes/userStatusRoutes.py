from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_session
from app.schemas.user_status_schema import (
    CreateUserStatusRequest,
    UpdateUserStatusRequest,
    UserStatusResponse,
)
from app.services.userStatusService import UserStatusService

router = APIRouter()

# ===================
# add user status
# ===================
@router.post("/", response_model=UserStatusResponse, status_code=status.HTTP_201_CREATED)
def create_user_status(payload: CreateUserStatusRequest, db: Session = Depends(get_session)):
    try:
        return UserStatusService(db).create_user_status(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
# ===================
# list all user statuses
# ===================
@router.get("/", response_model=list[UserStatusResponse])
def list_user_statuses(db: Session = Depends(get_session)):
    return UserStatusService(db).list_user_statuses()
# ===================
# get specific user status
# ===================
@router.get("/{status_id}", response_model=UserStatusResponse)
def get_user_status(status_id: str, db: Session = Depends(get_session)):
    try:
        return UserStatusService(db).get_user_status(status_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
# ===================
# update specific user status
# ===================
@router.put("/{status_id}", response_model=UserStatusResponse)
def update_user_status(status_id: str, data: UpdateUserStatusRequest, db: Session = Depends(get_session)):
    try:
        return UserStatusService(db).update_user_status(status_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
# ===================
# delete specific user status
# ===================
@router.delete("/{status_id}", status_code=204)
def delete_user_status(status_id: str, db: Session = Depends(get_session)):
    try:
        UserStatusService(db).delete_user_status(status_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
