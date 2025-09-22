# services/imageService.py
from sqlalchemy.orm import Session
from models import Image  # Adjust import based on your model
from typing import Optional

class ImageService:
    def __init__(self, db: Session):
        self.db = db
    
    def upload_image(self, url: str, imageable_type: str, imageable_id: str) -> Image:
        """Create a new image record in the database"""
        image = Image(
            url=url,
            imageable_type=imageable_type,
            imageable_id=imageable_id
        )
        self.db.add(image)
        self.db.commit()
        self.db.refresh(image)
        return image
    
    def get_image_by_id(self, image_id: str) -> Optional[Image]:
        """Get an image by its ID"""
        return self.db.query(Image).filter(Image.id == image_id).first()
    
    def get_images_by_entity(self, imageable_type: str, imageable_id: str) -> list[Image]:
        """Get all images for a specific entity"""
        return self.db.query(Image).filter(
            Image.imageable_type == imageable_type,
            Image.imageable_id == imageable_id
        ).all()
    
    def delete_image(self, image_id: str) -> bool:
        """Delete an image from the database"""
        image = self.get_image_by_id(image_id)
        if image:
            self.db.delete(image)
            self.db.commit()
            return True
        return False
    
    def delete_images_by_entity(self, imageable_type: str, imageable_id: str) -> int:
        """Delete all images for a specific entity"""
        deleted_count = self.db.query(Image).filter(
            Image.imageable_type == imageable_type,
            Image.imageable_id == imageable_id
        ).delete()
        self.db.commit()
        return deleted_count

    def get_images_by_item_id(self, item_id: str) -> list[Image]:
        """Get all images for a specific item"""
        return self.db.query(Image).filter(Image.imageable_id == item_id).all()
        