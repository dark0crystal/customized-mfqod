from sqlalchemy.orm import Session
from models import ItemType
from schemas.item_type_schema import CreateItemTypeRequest, UpdateItemTypeRequest
from datetime import datetime, timezone
import uuid

class ItemTypeService:
    def __init__(self, db: Session):
        self.db = db

    def create_item_type(self, data: CreateItemTypeRequest) -> ItemType:
        new_type = ItemType(
            id=str(uuid.uuid4()),
            name=data.name,
            description=data.description,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        self.db.add(new_type)
        self.db.commit()
        self.db.refresh(new_type)
        return new_type

    def get_item_type_by_id(self, item_type_id: str) -> ItemType:
        item_type = self.db.query(ItemType).filter(ItemType.id == item_type_id).first()
        if not item_type:
            raise ValueError("Item type not found")
        return item_type

    def update_item_type(self, item_type_id: str, data: UpdateItemTypeRequest) -> ItemType:
        item_type = self.get_item_type_by_id(item_type_id)
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item_type, field, value)
        item_type.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(item_type)
        return item_type

    def delete_item_type(self, item_type_id: str) -> bool:
        item_type = self.get_item_type_by_id(item_type_id)
        self.db.delete(item_type)
        self.db.commit()
        return True

    def list_item_types(self):
        return self.db.query(ItemType).order_by(ItemType.created_at.desc()).all()
