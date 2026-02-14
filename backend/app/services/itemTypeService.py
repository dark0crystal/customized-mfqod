from sqlalchemy.orm import Session
from app.models import ItemType
from app.schemas.item_type_schema import CreateItemTypeRequest, UpdateItemTypeRequest
from datetime import datetime, timezone
import uuid
import os
import logging
from app.config.storage_config import ITEM_TYPES_IMAGES_DIR

logger = logging.getLogger(__name__)


class ItemTypeService:
    def __init__(self, db: Session):
        self.db = db

    def create_item_type(self, data: CreateItemTypeRequest) -> ItemType:
        new_type = ItemType(
            id=str(uuid.uuid4()),
            name_ar=data.name_ar,
            name_en=data.name_en,
            description_ar=data.description_ar,
            description_en=data.description_en,
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
        
        # Delete associated image file if exists
        if item_type.image_url:
            try:
                image_path = item_type.image_url.replace("/static/item-types-images/", "")
                file_path = os.path.join(ITEM_TYPES_IMAGES_DIR, image_path)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Deleted image file for item type {item_type_id}: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete image file for item type {item_type_id}: {e}")
        
        self.db.delete(item_type)
        self.db.commit()
        return True

    def list_item_types(self):
        return self.db.query(ItemType).order_by(ItemType.created_at.desc()).all()
