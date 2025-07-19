"use client";

import { z } from "zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState, useEffect } from "react";

const schema = z.object({
  org: z.string().nonempty("Please select an organization"),
  branch: z.string().nonempty("Please select a branch"),
});

type FormFields = z.infer<typeof schema>;

interface Organization {
  id: string;
  name: string;
  description?: string;
}

interface Branch {
  id: string;
  branch_name: string;
  organization_id: string;
  organization?: Organization;
}

export default function EditUserManagement({ userId }: { userId: string }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting }, reset } = useForm<FormFields>();
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userManagedBranches, setUserManagedBranches] = useState<Branch[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/organization/organizations/`);
        if (!response.ok) throw new Error("Failed to fetch organizations");
        const data = await response.json();
        setOrganizations(data);

        // Set the first organization as default if available
        if (data && data.length > 0) {
          setSelectedOrganization(data[0].id);
          setValue("org", data[0].id);
        }
      } catch (error: any) {
        console.error("Error fetching organizations:", error.message);
      }
    }
    fetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setValue]);

  // Fetch user's currently managed branches
  useEffect(() => {
    async function fetchUserManagedBranches() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/branch/users/${userId}/managed-branches/`);
        if (!response.ok) throw new Error("Failed to fetch user managed branches");
        const data = await response.json();
        setUserManagedBranches(data);
      } catch (error: any) {
        console.error("Error fetching user managed branches:", error.message);
      }
    }
    fetchUserManagedBranches();
  }, [userId]);

  // Fetch branches when organization changes
  useEffect(() => {
    async function fetchBranches() {
      if (!selectedOrganization) {
        setBranches([]);
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/branch/branches/?organization_id=${selectedOrganization}`);
        if (!response.ok) throw new Error("Failed to fetch branches");
        const data = await response.json();
        setBranches(data);
      } catch (error: any) {
        console.error("Error fetching branches:", error.message);
        setBranches([]);
      }
    }
    fetchBranches();
  }, [selectedOrganization]);

  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOrg = e.target.value;
    setSelectedOrganization(selectedOrg);
    setValue("org", selectedOrg);
    setValue("branch", ""); // Reset branch selection
  };

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Assign user as branch manager
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/branch/branches/${data.branch}/managers/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to assign user as branch manager");
      }

      setSuccessMessage("User successfully assigned as branch manager!");
      
      // Refresh user managed branches
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/users/${userId}/managed-branches/`);
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setUserManagedBranches(refreshedData);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "An error occurred while assigning branch manager");
    }

    reset();
    // If there is only one org, keep it selected, otherwise clear
    if (organizations.length === 1 && organizations[0]) {
      setSelectedOrganization(organizations[0].id);
      setValue("org", organizations[0].id);
    } else {
      setSelectedOrganization("");
    }
  };

  const handleRemoveBranchManager = async (branchId: string) => {
    if (!confirm("Are you sure you want to remove this user as branch manager?")) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/branch/branches/${branchId}/managers/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to remove user as branch manager");
      }

      setSuccessMessage("User successfully removed as branch manager!");
      
      // Refresh user managed branches
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/branch/users/${userId}/managed-branches/`);
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setUserManagedBranches(refreshedData);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "An error occurred while removing branch manager");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Edit User Management</h1>
      
      {/* Current Managed Branches */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="text-md font-semibold mb-3">Currently Managed Branches</h2>
        {userManagedBranches.length === 0 ? (
          <p className="text-gray-500">No branches currently managed by this user.</p>
        ) : (
          <div className="space-y-2">
            {userManagedBranches.map((branch) => (
              <div key={branch.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div>
                  <span className="font-medium">{branch.branch_name}</span>
                  <span className="text-gray-500 ml-2">
                    ({branch.organization?.name || 'Unknown Organization'})
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveBranchManager(branch.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Branch Management */}
      <div className="bg-white p-4 rounded-lg border">
        <h2 className="text-md font-semibold mb-3">Assign New Branch Management</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Organization */}
          <div>
            <label htmlFor="org" className="block text-sm font-medium">Organization</label>
            <select
              id="org"
              value={selectedOrganization}
              {...register("org")}
              onChange={handleOrganizationChange}
              className="w-full p-2 border rounded"
              disabled={organizations.length === 1}
            >
              <option value="" disabled>Select Organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            {errors.org && <p className="text-red-500 text-sm">{errors.org.message}</p>}
          </div>

          {/* Branch */}
          {branches.length > 0 && (
            <div>
              <label htmlFor="branch" className="block text-sm font-medium">Branch</label>
              <select
                id="branch"
                {...register("branch")}
                className="w-full p-2 border rounded"
              >
                <option value="" disabled>Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                ))}
              </select>
              {errors.branch && <p className="text-red-500 text-sm">{errors.branch.message}</p>}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || branches.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            {isSubmitting ? "Assigning..." : "Assign Branch Manager"}
          </button>
        </form>
      </div>

      {/* Feedback */}
      {successMessage && <p className="text-green-500">{successMessage}</p>}
      {errorMessage && <p className="text-red-500">{errorMessage}</p>}
    </div>
  );
}