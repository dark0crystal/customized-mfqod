# services/imageService.py
from sqlalchemy.orm import Session
from app.models import Image, User, Item  # Adjust import based on your model
from typing import Optional
from app.services import permissionServices
from app.middleware.branch_auth_middleware import can_user_manage_item

class ImageService:
    def __init__(self, db: Session):
        self.db = db
    
    def upload_image(self, url: str, imageable_type: str, imageable_id: str, is_hidden: bool = False) -> Image:
        """Create a new image record in the database"""
        image = Image(
            url=url,
            imageable_type=imageable_type,
            imageable_id=imageable_id,
            is_hidden=is_hidden
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
    
    def can_user_view_hidden_images(self, user: Optional[User], item_id: Optional[str] = None) -> bool:
        """Check if user can view hidden images"""
        if not user:
            return False
        
        # User with full access can see all images
        if permissionServices.has_full_access(self.db, user.id):
            return True
        
        # Check if user has can_manage_items permission
        if permissionServices.check_user_permission(self.db, user.id, "can_manage_items"):
            return True
        
        # Check if user is branch manager for the item's branch
        if item_id:
            if can_user_manage_item(user.id, item_id, self.db):
                return True
        
        return False
    
    def get_images_by_item_id(self, item_id: str, user: Optional[User] = None, include_hidden: Optional[bool] = None) -> list[Image]:
        """Get all images for a specific item, filtering hidden images based on user permissions"""
        # If include_hidden is explicitly set, use it
        if include_hidden is not None:
            if include_hidden:
                # Return all images including hidden
                return self.db.query(Image).filter(
                    Image.imageable_id == item_id,
                    Image.imageable_type == "item"
                ).all()
            else:
                # Return only non-hidden images
                return self.db.query(Image).filter(
                    Image.imageable_id == item_id,
                    Image.imageable_type == "item",
                    Image.is_hidden == False
                ).all()
        
        # If user is provided, check permissions
        if user:
            can_view_hidden = self.can_user_view_hidden_images(user, item_id)
            if can_view_hidden:
                # Return all images including hidden
                return self.db.query(Image).filter(
                    Image.imageable_id == item_id,
                    Image.imageable_type == "item"
                ).all()
        
        # Default: return only non-hidden images
        return self.db.query(Image).filter(
            Image.imageable_id == item_id,
            Image.imageable_type == "item",
            Image.is_hidden == False
        ).all()
    
    def toggle_image_hidden_status(self, image_id: str) -> Optional[Image]:
        """Toggle the hidden status of an image"""
        image = self.get_image_by_id(image_id)
        if image:
            image.is_hidden = not image.is_hidden
            self.db.commit()
            self.db.refresh(image)
            return image
        return None
    
    def update_image_hidden_status(self, image_id: str, is_hidden: bool) -> Optional[Image]:
        """Update the hidden status of an image"""
        image = self.get_image_by_id(image_id)
        if image:
            image.is_hidden = is_hidden
            self.db.commit()
            self.db.refresh(image)
            return image
        return None
    
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
        