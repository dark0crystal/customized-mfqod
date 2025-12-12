"use client";

import { useEffect, useState } from "react";
import { tokenManager } from '@/utils/tokenManager';
import { usePermissions } from "@/PermissionsContext";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Helper function to create authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = tokenManager.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

type Role = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

type UserData = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  status_name: string;
  created_at: string;
  updated_at: string;
};

export default function EditUserRole({ userId }: { userId: string }) {
  const { hasPermission, userRole, isLoading: permissionsLoading } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available roles and current user role
  useEffect(() => {
    async function fetchRolesAndUserRole() {
      try {
        setIsLoading(true);
        
        // Fetch available roles from your FastAPI backend
        const rolesResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/roles/all`, {
          headers: getAuthHeaders()
        });
        if (!rolesResponse.ok) throw new Error("Failed to fetch roles");
        const rolesData: Role[] = await rolesResponse.json();
        setRoles(rolesData);

        // Fetch current user data to get current role
        const userResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}`, {
          headers: getAuthHeaders()
        });
        if (!userResponse.ok) throw new Error("Failed to fetch user data");
        const userData: UserData = await userResponse.json();
        
        setCurrentRole(userData.role_name);
        setSelectedRole(userData.role_name);
        
        // Get current logged-in user info to check if editing self
        const currentUser = tokenManager.getUser();
        if (currentUser && currentUser.id) {
          setCurrentUserId(currentUser.id);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "An error occurred while fetching data";
        setErrorMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchRolesAndUserRole();
    }
  }, [userId]);

  // Submit handler to update the user role
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRole) {
      setErrorMessage("Please select a role");
      return;
    }

    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Use the FastAPI endpoint for updating user role
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role_name: selectedRole }),
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update user role");
      }

      setSuccessMessage("User role updated successfully!");
      setCurrentRole(selectedRole);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while updating the role";
      setErrorMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Check permissions
  if (permissionsLoading || isLoading) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5">
        <LoadingSpinner size="md" className="h-64" />
      </div>
    );
  }

  if (!hasPermission('can_manage_users')) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5">
        <div className="text-center py-12">
          <div className="text-red-500 text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to manage user roles.</p>
        </div>
      </div>
    );
  }

  // Filter roles based on current user's role
  // Only super_admin can assign super_admin or admin roles
  const availableRoles = roles.filter(role => {
    const roleNameLower = role.name.toLowerCase();
    if (roleNameLower === 'super_admin' || roleNameLower === 'admin') {
      return userRole === 'super_admin';
    }
    return true;
  });

  // Check if user is trying to edit themselves
  const isEditingSelf = currentUserId === userId;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Edit User Role</h1>
      
      {currentRole && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Current Role: <span className="font-semibold text-gray-800">{currentRole}</span>
          </p>
        </div>
      )}

      {isEditingSelf && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ You are editing your own role. You cannot elevate yourself to admin or super_admin.
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        {/* Role Selection */}
        <div>
          <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 mb-2">
            Select New Role
          </label>
          <select
            id="role_name"
            value={selectedRole}
            onChange={handleRoleChange}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="" disabled>Select Role</option>
            {availableRoles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          {!selectedRole && errorMessage?.includes("select a role") && (
            <p className="text-red-500 text-sm mt-1">Please select a role</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedRole || (isEditingSelf && (selectedRole.toLowerCase() === 'admin' || selectedRole.toLowerCase() === 'super_admin'))}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Updating...
            </span>
          ) : (
            "Update Role"
          )}
        </button>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        )}
        {errorMessage && !errorMessage.includes("select a role") && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}