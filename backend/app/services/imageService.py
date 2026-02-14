# services/imageService.py
from sqlalchemy.orm import Session
from app.models import Image, User, Item, Claim, MissingItem
from typing import Optional
from app.services import permissionServices
from app.middleware.branch_auth_middleware import can_user_manage_item

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
        """Get all images for a specific item, filtering based on item's is_hidden and user permissions"""
        # Fetch the item to check its is_hidden status
        item = self.db.query(Item).filter(Item.id == item_id).first()
        if not item:
            return []
        
        # If include_hidden is explicitly set, use it
        if include_hidden is not None:
            if include_hidden:
                # Return all images
                return self.db.query(Image).filter(
                    Image.imageable_id == item_id,
                    Image.imageable_type == "item"
                ).all()
            else:
                # Return only images if item is not hidden
                if not item.is_hidden:
                    return self.db.query(Image).filter(
                        Image.imageable_id == item_id,
                        Image.imageable_type == "item"
                    ).all()
                else:
                    return []
        
        # If item is not hidden, return all images
        if not item.is_hidden:
            return self.db.query(Image).filter(
                Image.imageable_id == item_id,
                Image.imageable_type == "item"
            ).all()
        
        # Item is hidden - check if user can view hidden images
        if user:
            can_view_hidden = self.can_user_view_hidden_images(user, item_id)
            if can_view_hidden:
                # User has permission, return all images
                return self.db.query(Image).filter(
                    Image.imageable_id == item_id,
                    Image.imageable_type == "item"
                ).all()
        
        # Item is hidden and user doesn't have permission - return empty list
        return []
    
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

    def can_user_attach_image(self, user_id: str, imageable_type: str, imageable_id: str) -> bool:
        """
        Check if user is allowed to attach an image to the given entity.
        Used to prevent IDOR on upload-multiple-images and upload_image_to_item.
        """
        if imageable_type == "item":
            item = self.db.query(Item).filter(Item.id == imageable_id).first()
            if not item:
                return False
            if permissionServices.has_full_access(self.db, user_id):
                return True
            if item.user_id == user_id:
                return True
            return can_user_manage_item(user_id, imageable_id, self.db)

        if imageable_type == "claim":
            from app.services.claimService import ClaimService
            claim_service = ClaimService(self.db)
            return claim_service.can_user_edit_claim(user_id, imageable_id)

        if imageable_type == "missingitem":
            missing = self.db.query(MissingItem).filter(MissingItem.id == imageable_id).first()
            if not missing:
                return False
            if permissionServices.has_full_access(self.db, user_id):
                return True
            if permissionServices.check_user_permission(self.db, user_id, "can_manage_missing_items"):
                return True
            return missing.user_id == user_id

        return False

    def can_user_delete_image(self, user_id: str, image: Image) -> bool:
        """
        Check if user is allowed to delete this image (based on its entity).
        Used to prevent IDOR on delete_image.
        """
        return self.can_user_attach_image(user_id, image.imageable_type, image.imageable_id)
        