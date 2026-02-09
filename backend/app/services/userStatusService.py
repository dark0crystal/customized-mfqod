from sqlalchemy.orm import Session
from app.models import UserStatus
from app.schemas.user_status_schema import CreateUserStatusRequest, UpdateUserStatusRequest
from datetime import datetime, timezone
import uuid

class UserStatusService:
    def __init__(self, db: Session):
        self.db = db

    def create_user_status(self, payload: CreateUserStatusRequest) -> UserStatus:
        if self.db.query(UserStatus).filter_by(name=payload.name).first():
            raise ValueError("Status with this name already exists.")
        status = UserStatus(
            id=str(uuid.uuid4()),
            name=payload.name,
            description=payload.description,
        )
        self.db.add(status)
        self.db.commit()
        self.db.refresh(status)
        return status

    def get_user_status(self, status_id: str) -> UserStatus:
        status = self.db.query(UserStatus).filter_by(id=status_id).first()
        if not status:
            raise ValueError("User status not found.")
        return status

    def list_user_statuses(self) -> list[UserStatus]:
        return self.db.query(UserStatus).all()

    def update_user_status(self, status_id: str, data: UpdateUserStatusRequest) -> UserStatus:
        status = self.get_user_status(status_id)
        for key, value in data.dict(exclude_unset=True).items():
            setattr(status, key, value)
        status.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(status)
        return status

    def delete_user_status(self, status_id: str) -> bool:
        status = self.get_user_status(status_id)
        self.db.delete(status)
        self.db.commit()
        return True
