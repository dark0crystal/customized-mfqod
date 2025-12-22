"use client";

import { z } from "zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePermissions } from "@/PermissionsContext";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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
  branch_name_ar?: string;
  branch_name_en?: string;
  organization_id: string;
  organization?: Organization;
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=')[1] || document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
  return {
    'Authorization': `Bearer ${token || ''}`,
    'Content-Type': 'application/json'
  };
};

export default function EditUserManagement({ userId }: { userId: string }) {
  const t = useTranslations('userDetails');
  const tCommon = useTranslations('common');
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting }, reset } = useForm<FormFields>();
  const locale = useLocale();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  // Helper function to get localized name
  const getLocalizedName = useCallback((nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  }, [locale]);

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
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/organizations/`, {
          headers: getAuthHeaders()
        });
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

  }, [setValue]);

  // Fetch user's currently managed branches
  useEffect(() => {
    async function fetchUserManagedBranches() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/branches/users/${userId}/managed-branches/`, {
          headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error("Failed to fetch user managed branches");
        const data = await response.json();
        setUserManagedBranches(data);
      } catch (error: any) {
        console.error("Error fetching user managed branches:", error.message);
      }
    }
    fetchUserManagedBranches();
  }, [userId]);

  // Check permissions
  if (permissionsLoading) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{tCommon('accessDenied')}</h3>
          <p className="text-gray-600">{tCommon('noPermissionToManageUsers')}</p>
        </div>
      </div>
    );
  }

  // Fetch branches when organization changes
  useEffect(() => {
    async function fetchBranches() {
      if (!selectedOrganization) {
        setBranches([]);
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/branches/public/?organization_id=${selectedOrganization}`, {
          headers: {
            "Content-Type": "application/json",
          }
        });
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/branches/${data.branch}/managers/${userId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorDetail = errorData.detail || "";
        
        // Check if it's a permission error (403) or if the error message mentions permission
        if (response.status === 403 || errorDetail.toLowerCase().includes("permission")) {
          setErrorMessage(t('branchAssignmentPermissionDenied'));
          return;
        } else {
          throw new Error(errorDetail || t('failedToAssignBranch'));
        }
      }

      setSuccessMessage(t('userSuccessfullyAssigned'));

      // Refresh user managed branches
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}/managed-branches/`, {
        headers: getAuthHeaders()
      });
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setUserManagedBranches(refreshedData);
      }
    } catch (error: any) {
      setErrorMessage(error.message || t('errorAssigning'));
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
    if (!confirm(t('confirmRemove'))) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/branches/${branchId}/managers/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to remove user as branch manager");
      }

      setSuccessMessage(t('userSuccessfullyRemoved'));

      // Refresh user managed branches
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/branches/users/${userId}/managed-branches/`, {
        headers: getAuthHeaders()
      });
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setUserManagedBranches(refreshedData);
      }
    } catch (error: any) {
      setErrorMessage(error.message || t('errorRemoving'));
    }
  };

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">{t('title')}</h2>
        <p className="text-sm text-gray-500 mt-1">Manage branch assignments for this user</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800 font-medium">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 font-medium">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Current Managed Branches */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('currentlyManagedBranches')}</h2>
          {userManagedBranches.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noBranchesManaged')}</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {userManagedBranches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || t('unnamedBranch')}</span>
                      <span className="text-gray-500 ml-2">
                        ({branch.organization?.name || t('unknownOrganization')})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBranchManager(branch.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors duration-200"
                  >
                    {t('remove')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Branch Management */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('assignNewBranchManagement')}</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Organization */}
            <div>
              <label htmlFor="org" className="block text-sm font-medium text-gray-700 mb-2">{t('organization')}</label>
              <select
                id="org"
                value={selectedOrganization}
                {...register("org")}
                onChange={handleOrganizationChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                disabled={organizations.length === 1}
              >
                <option value="" disabled>{t('selectOrganization')}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              {errors.org && <p className="mt-2 text-sm text-red-600 font-medium">{errors.org.message}</p>}
            </div>

            {/* Branch */}
            {branches.length > 0 && (
              <div>
                <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-2">{t('branch')}</label>
                <select
                  id="branch"
                  {...register("branch")}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="" disabled>{t('selectBranch')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || t('unnamedBranch')}</option>
                  ))}
                </select>
                {errors.branch && <p className="mt-2 text-sm text-red-600 font-medium">{errors.branch.message}</p>}
              </div>
            )}

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || branches.length === 0}
                className="w-full px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{
                  backgroundColor: '#3277AE',
                  '--tw-ring-color': '#3277AE'
                } as React.CSSProperties & { [key: string]: string }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && branches.length > 0) {
                    e.currentTarget.style.backgroundColor = '#2a5f94';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting && branches.length > 0) {
                    e.currentTarget.style.backgroundColor = '#3277AE';
                  }
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('assigning')}
                  </span>
                ) : (
                  t('assignBranchManager')
                )}
              </button>
            </div>
          </form>
        </div>

        {/* User Deletion Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-red-500">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Danger Zone</h2>
          <p className="text-gray-600 mb-6">
            These actions are destructive. Please read the descriptions carefully before proceeding.
          </p>

          <div className="space-y-4">
            {/* Soft Delete */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Deactivate User (Soft Delete)</h3>
                <p className="text-sm text-gray-500">
                  The user will be marked as deleted and cannot log in. Their data (posts, claims) remains linked to them.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to deactivate this user? They will not be able to log in.")) {
                    try {
                      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                      });
                      if (!response.ok) throw new Error("Failed to deactivate user");
                      setSuccessMessage("User deactivated successfully");
                      // Redirect or update UI state
                    } catch (error: any) {
                      setErrorMessage(error.message);
                    }
                  }
                }}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                Deactivate
              </button>
            </div>

            {/* Hard Delete */}
            <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
              <div>
                <h3 className="text-lg font-medium text-red-800">Permanently Delete User</h3>
                <p className="text-sm text-red-600">
                  The user account will be permanently removed. Their posts and claims will be kept but anonymized (unlinked). This action cannot be undone.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (confirm("⚠️ WARNING: This will permanently delete the user account. Their data will be anonymized. This action CANNOT be undone. Are you absolutely sure?")) {
                    try {
                      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}/permanent`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                      });
                      if (!response.ok) throw new Error("Failed to permanently delete user");
                      setSuccessMessage("User permanently deleted");
                      // Redirect to users list after short delay
                      setTimeout(() => {
                        window.location.href = "/dashboard/manage-users";
                      }, 2000);
                    } catch (error: any) {
                      setErrorMessage(error.message);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}