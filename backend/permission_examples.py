# examples/permission_examples.py
"""
Examples of how to use the RBAC Permission System

This file contains practical examples of:
1. Creating permissions
2. Assigning permissions to roles
3. Checking user permissions
4. Protecting routes with permissions
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


# Example router demonstrating permission usage
example_router = APIRouter()

# =================================
# 1. INITIAL SETUP - Create Common Permissions
# =================================

def setup_common_permissions(session: Session):
    """
    Create common permissions that most applications need.
    Run this once during application setup.
    """
    common_permissions = [
        # User Management
        {"name": "can_view_users", "description": "Can view user profiles and lists"},
        {"name": "can_create_users", "description": "Can create new user accounts"},
        {"name": "can_edit_users", "description": "Can edit user profiles and settings"},
        {"name": "can_delete_users", "description": "Can delete user accounts"},
        {"name": "can_manage_users", "description": "Full user management access"},
        
        # Content Management
        {"name": "can_view_content", "description": "Can view published content"},
        {"name": "can_create_content", "description": "Can create new content"},
        {"name": "can_edit_content", "description": "Can edit existing content"},
        {"name": "can_delete_content", "description": "Can delete content"},
        {"name": "can_publish_content", "description": "Can publish/unpublish content"},
        
        # Item Management (for your lost & found system)
        {"name": "can_view_items", "description": "Can view lost/found items"},
        {"name": "can_create_items", "description": "Can report lost/found items"},
        {"name": "can_edit_items", "description": "Can edit item details"},
        {"name": "can_delete_items", "description": "Can delete items"},
        {"name": "can_approve_items", "description": "Can approve/reject item reports"},
        
        # Claims Management
        {"name": "can_view_claims", "description": "Can view item claims"},
        {"name": "can_create_claims", "description": "Can create item claims"},
        {"name": "can_process_claims", "description": "Can approve/reject claims"},
        
        # System Administration
        {"name": "can_view_system_logs", "description": "Can view system logs"},
        {"name": "can_manage_roles", "description": "Can create/edit/delete roles"},
        {"name": "can_manage_permissions", "description": "Can manage permission assignments"},
        {"name": "can_view_analytics", "description": "Can view system analytics"},
        
        # Organization Management
        {"name": "can_view_organizations", "description": "Can view organizations"},
        {"name": "can_manage_organizations", "description": "Can manage organization details"},
    ]
    
   