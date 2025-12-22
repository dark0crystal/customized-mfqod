"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  role: string;
  status_name: string;
  created_at: string;
  updated_at: string;
};

export default function EditUserRole({ userId }: { userId: string }) {
  const t = useTranslations('editUserRole');
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
        const rolesResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/roles/all`, {
          headers: getAuthHeaders()
        });
        if (!rolesResponse.ok) throw new Error("Failed to fetch roles");
        const rolesData: Role[] = await rolesResponse.json();
        setRoles(rolesData);

        // Fetch current user data to get current role
        const userResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}`, {
          headers: getAuthHeaders()
        });
        if (!userResponse.ok) throw new Error("Failed to fetch user data");
        const userData: UserData = await userResponse.json();

        setCurrentRole(userData.role);
        setSelectedRole(userData.role);

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}/role`, {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('accessDeniedTitle')}</h3>
          <p className="text-gray-600">{t('accessDeniedMessage')}</p>
        </div>
      </div>
    );
  }

  // Filter roles based on current user's permissions
  // Only users with can_manage_roles permission can assign all roles
  // Backend will enforce additional restrictions for roles with full access
  const availableRoles = hasPermission('can_manage_roles')
    ? roles
    : roles.filter(role => {
        // Users without can_manage_roles can only see non-admin roles
        const roleNameLower = role.name.toLowerCase();
        return roleNameLower !== 'super_admin' && roleNameLower !== 'admin';
      });

  // Check if user is trying to edit themselves
  const isEditingSelf = currentUserId === userId;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">{t('title')}</h2>
      </div>

      {currentRole && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            {t('currentRole')}: <span className="font-semibold text-gray-800">{currentRole}</span>
          </p>
        </div>
      )}

      {isEditingSelf && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            {t('editingSelfWarning')}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Role Selection */}
        <div>
          <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 mb-2">
            {t('selectNewRole')}
          </label>
          <select
            id="role_name"
            value={selectedRole}
            onChange={handleRoleChange}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="" disabled>{t('selectRole')}</option>
            {availableRoles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          {!selectedRole && errorMessage?.includes("select a role") && (
            <p className="text-red-500 text-sm mt-1">{t('pleaseSelectRole')}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedRole}
          className="w-full px-4 py-3 text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: isSubmitting || !selectedRole ? undefined : '#3277AE' }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {t('updating')}
            </span>
          ) : (
            t('updateRole')
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