from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from functools import wraps
import logging

from app.db.database import get_session
from app.models import User, Item, Address, Branch, UserBranchManager
from app.middleware.auth_middleware import get_current_user_required
from app.services import permissionServices

logger = logging.getLogger(__name__)

class BranchAuthMiddleware:
    """Middleware for branch-based authorization"""
    
    def __init__(self):
        pass
    
    def get_user_managed_branches(self, user_id: str, db: Session) -> List[str]:
        """Get list of branch IDs that the user manages"""
        managed_branches = db.query(UserBranchManager.branch_id).filter(
            UserBranchManager.user_id == user_id
        ).all()
        
        return [branch_id[0] for branch_id in managed_branches]
    
    def get_item_branches(self, item_id: str, db: Session) -> List[str]:
        """Get list of branch IDs where the item is located"""
        item_branches = db.query(Address.branch_id).filter(
            Address.item_id == item_id,
            Address.is_current == True
        ).all()
        
        return [branch_id[0] for branch_id in item_branches]
    
    def can_user_manage_item(self, user_id: str, item_id: str, db: Session) -> bool:
        """Check if user can manage an item based on branch management"""
        # Get user's managed branches
        user_branches = self.get_user_managed_branches(user_id, db)
        
        # Get item's branches
        item_branches = self.get_item_branches(item_id, db)
        
        # Check if user manages any branch where the item is located
        return bool(set(user_branches) & set(item_branches))
    
    def require_branch_access(self, item_id_param: str = "item_id"):
        """
        Dependency factory that requires branch-based access to items
        Usage: @app.put("/items/{item_id}", dependencies=[Depends(branch_auth.require_branch_access())])
        """
        async def branch_access_checker(
            request: Request,
            current_user: User = Depends(get_current_user_required),
            db: Session = Depends(get_session)
        ) -> User:
            # Extract item_id from path parameters
            path_params = request.path_params
            item_id = path_params.get(item_id_param)
            
            if not item_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Item ID is required"
                )
            
            # Check if item exists
            item = db.query(Item).filter(Item.id == item_id).first()
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found"
                )
            
            # Full access bypass: If user has all permissions, grant access
            if permissionServices.has_full_access(db, current_user.id):
                logger.info(f"User with full access {current_user.email} granted access to item {item_id}")
                return current_user
            
            # Owner can always access their own items
            if current_user.id == item.user_id:
                logger.info(f"Owner {current_user.email} granted access to their item {item_id}")
                return current_user
            
            # Check branch-based access
            if self.can_user_manage_item(current_user.id, item_id, db):
                logger.info(f"Branch manager {current_user.email} granted access to item {item_id}")
                return current_user
            
            # Access denied
            logger.warning(f"User {current_user.email} denied access to item {item_id} - not owner or branch manager")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only manage items in branches you manage or items you own"
            )
        
        return branch_access_checker
    
    def require_branch_access_for_multiple_items(self, item_ids_param: str = "item_ids"):
        """
        Dependency factory for bulk operations that require branch-based access
        Usage: @app.post("/items/bulk/delete", dependencies=[Depends(branch_auth.require_branch_access_for_multiple_items())])
        """
        async def branch_access_checker(
            request: Request,
            current_user: User = Depends(get_current_user_required),
            db: Session = Depends(get_session)
        ) -> User:
            # Extract item_ids from request body
            try:
                body = await request.json()
                item_ids = body.get(item_ids_param, [])
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid request body"
                )
            
            if not item_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Item IDs are required"
                )
            
            # Full access bypass: If user has all permissions, grant access
            if permissionServices.has_full_access(db, current_user.id):
                logger.info(f"User with full access {current_user.email} granted access to bulk operation")
                return current_user
            
            # Check access for each item
            denied_items = []
            for item_id in item_ids:
                # Check if item exists
                item = db.query(Item).filter(Item.id == item_id).first()
                if not item:
                    denied_items.append(f"Item {item_id} not found")
                    continue
                
                # Owner can always access their own items
                if current_user.id == item.user_id:
                    continue
                
                # Check branch-based access
                if not self.can_user_manage_item(current_user.id, item_id, db):
                    denied_items.append(f"Item {item_id} - not owner or branch manager")
            
            if denied_items:
                logger.warning(f"User {current_user.email} denied access to bulk operation: {denied_items}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied for items: {', '.join(denied_items)}"
                )
            
            logger.info(f"User {current_user.email} granted access to bulk operation")
            return current_user
        
        return branch_access_checker
    
    def get_user_accessible_items(self, user_id: str, db: Session) -> List[str]:
        """Get list of item IDs that the user can access (own or manage through branches)"""
        # Get user's managed branches
        user_branches = self.get_user_managed_branches(user_id, db)
        
        # Get items owned by user
        owned_items = db.query(Item.id).filter(Item.user_id == user_id).all()
        owned_item_ids = [item_id[0] for item_id in owned_items]
        
        # Get items in user's managed branches
        managed_items = []
        if user_branches:
            managed_items_query = db.query(Address.item_id).filter(
                Address.branch_id.in_(user_branches),
                Address.is_current == True
            ).distinct()
            managed_items = [item_id[0] for item_id in managed_items_query.all() if item_id[0] is not None]
        
        # Combine and deduplicate, filtering out None values
        all_accessible_items = [item_id for item_id in list(set(owned_item_ids + managed_items)) if item_id is not None]
        return all_accessible_items
    
    def is_branch_manager(self, user_id: str, db: Session) -> bool:
        """Check if user manages any branches"""
        count = db.query(UserBranchManager).filter(
            UserBranchManager.user_id == user_id
        ).count()
        return count > 0

# Global middleware instance
branch_auth_middleware = BranchAuthMiddleware()

# Convenience dependency functions
def require_branch_access(item_id_param: str = "item_id"):
    """Require branch-based access to an item"""
    return branch_auth_middleware.require_branch_access(item_id_param)

def require_branch_access_for_bulk_operations(item_ids_param: str = "item_ids"):
    """Require branch-based access for bulk operations"""
    return branch_auth_middleware.require_branch_access_for_multiple_items(item_ids_param)

# Helper functions for use in services
def get_user_managed_branches(user_id: str, db: Session) -> List[str]:
    """Get list of branch IDs that the user manages"""
    return branch_auth_middleware.get_user_managed_branches(user_id, db)

def get_item_branches(item_id: str, db: Session) -> List[str]:
    """Get list of branch IDs where the item is located"""
    return branch_auth_middleware.get_item_branches(item_id, db)

def can_user_manage_item(user_id: str, item_id: str, db: Session) -> bool:
    """Check if user can manage an item based on branch management"""
    return branch_auth_middleware.can_user_manage_item(user_id, item_id, db)

def get_user_accessible_items(user_id: str, db: Session) -> List[str]:
    """Get list of item IDs that the user can access"""
    return branch_auth_middleware.get_user_accessible_items(user_id, db)

def is_branch_manager(user_id: str, db: Session) -> bool:
    """Check if user manages any branches"""
    return branch_auth_middleware.is_branch_manager(user_id, db)
