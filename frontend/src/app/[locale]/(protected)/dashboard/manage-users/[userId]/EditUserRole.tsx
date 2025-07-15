"use client";

import { useEffect, useState } from "react";

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
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [currentRole, setCurrentRole] = useState<string | null>(null);
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
        const rolesResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/roles/all`);
        if (!rolesResponse.ok) throw new Error("Failed to fetch roles");
        const rolesData: Role[] = await rolesResponse.json();
        setRoles(rolesData);

        // Fetch current user data to get current role
        const userResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/users/users/${userId}`);
        if (!userResponse.ok) throw new Error("Failed to fetch user data");
        const userData: UserData = await userResponse.json();
        
        setCurrentRole(userData.role_name);
        setSelectedRole(userData.role_name);
      } catch (error: any) {
        setErrorMessage(error.message || "An error occurred while fetching data");
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/users/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role_name: selectedRole }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update user role");
      }

      const result = await response.json();
      setSuccessMessage("User role updated successfully!");
      setCurrentRole(selectedRole);
    } catch (error: any) {
      setErrorMessage(error.message || "An error occurred while updating the role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Edit User Role</h1>
      
      {currentRole && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Current Role: <span className="font-semibold text-gray-800">{currentRole}</span>
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
            {roles.map((role) => (
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
          disabled={isSubmitting || !selectedRole}
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