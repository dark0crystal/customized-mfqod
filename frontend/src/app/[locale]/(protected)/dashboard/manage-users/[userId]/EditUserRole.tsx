"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import DataProvider from "@/app/storage";
type RoleData = {
  roles: string[];
};

type UserRoleForm = {
  role: string;
};

export default function EditUserRole({ userId }: { userId: string }) {
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {roles} = DataProvider()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserRoleForm>();

  // Fetch available roles and current role
  useEffect(() => {
    async function fetchRolesAndUserRole() {
      try {
        

        // Fetch current user role
        const userRoleResponse = await fetch(`/api/get-role?userId=${userId}`);
        if (!userRoleResponse.ok) throw new Error("Failed to fetch user role");
        const userRoleData = await userRoleResponse.json();
        setCurrentRole(userRoleData.role);
        setValue("role", userRoleData.role); // Set the current role as the default
      } catch (error: any) {
        setErrorMessage(error.message || "An error occurred while fetching data");
      }
    }

    fetchRolesAndUserRole();
  }, [userId, setValue]);

  // Submit handler to update the user role
  const onSubmit = async (data: UserRoleForm) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/manage-role", {
        method: "PUT",
        body: JSON.stringify({ userId, role: data.role }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to update user role");

      setSuccessMessage("User role updated successfully!");
    } catch (error: any) {
      setErrorMessage(error.message || "An error occurred while updating the role");
    }
  };

  return (
    <div>
      <h1 className="text-lg font-bold">Edit User Role</h1>
      {currentRole && (
        <p className="mb-4">Current Role: <strong>{currentRole}</strong></p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Role Selection */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium">Role</label>
          <select
            id="role"
            {...register("role", { required: "Please select a role" })}
            className="w-full p-2 border rounded"
          >
            <option value="" disabled>Select Role</option>
            {roles.map((role, index) => (
              <option key={index} value={role}>{role}</option>
            ))}
          </select>
          {errors.role && <p className="text-red-500 text-sm">{errors.role.message}</p>}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {isSubmitting ? "Submitting..." : "Update Role"}
        </button>

        {/* Feedback Messages */}
        {successMessage && <p className="text-green-500">{successMessage}</p>}
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
      </form>
    </div>
  );
}