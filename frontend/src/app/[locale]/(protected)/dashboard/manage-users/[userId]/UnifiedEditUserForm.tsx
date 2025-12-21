"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations, useLocale } from "next-intl";
import { tokenManager } from "@/utils/tokenManager";
import { usePermissions } from "@/PermissionsContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// --- Types & Schemas ---

const profileSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone_number: z.string().optional(),
    role: z.string().min(1, "Role is required"),
    isActive: z.boolean(),
});

type ProfileFormFields = z.infer<typeof profileSchema>;

type Role = {
    id: string;
    name: string;
};

type Organization = {
    id: string;
    name: string;
};

type Branch = {
    id: string;
    branch_name_ar?: string;
    branch_name_en?: string;
    organization_id: string;
    organization?: Organization;
};

// --- Helper Functions ---

const getAuthHeaders = (): HeadersInit => {
    const token = tokenManager.getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

export default function UnifiedEditUserForm({ userId }: { userId: string }) {
    const t = useTranslations('manageUsers'); // Using manageUsers namespace for general labels
    const locale = useLocale();
    const { hasPermission, userRole: currentUserRole } = usePermissions();

    // --- State ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [roles, setRoles] = useState<Role[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]); // Available branches for selection
    const [userManagedBranches, setUserManagedBranches] = useState<Branch[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string>("");
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initial Data Tracking (to detect changes)
    const [initialRole, setInitialRole] = useState<string>("");
    const [initialStatus, setInitialStatus] = useState<boolean>(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<ProfileFormFields>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            isActive: false
        }
    });

    // --- Data Fetching ---

    const getLocalizedName = useCallback((nameAr?: string, nameEn?: string): string => {
        if (locale === 'ar' && nameAr) return nameAr;
        if (locale === 'en' && nameEn) return nameEn;
        return nameAr || nameEn || '';
    }, [locale]);

    useEffect(() => {
        async function fetchAllData() {
            try {
                setIsLoading(true);
                const headers = getAuthHeaders();

                // 1. Fetch User Details
                const userRes = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}`, { headers });
                if (!userRes.ok) throw new Error("Failed to fetch user");
                const userData = await userRes.json();

                setValue("first_name", userData.first_name);
                setValue("last_name", userData.last_name);
                setValue("email", userData.email);
                setValue("phone_number", userData.phone_number || "");
                setValue("role", userData.role);
                setValue("isActive", userData.active);

                setInitialRole(userData.role);
                setInitialStatus(userData.active);

                // 2. Fetch Roles
                const rolesRes = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/roles/all`, { headers });
                if (rolesRes.ok) {
                    const rolesData = await rolesRes.json();
                    // Filter roles: Only users with can_manage_roles permission can assign all roles
                    // Backend will enforce additional restrictions for roles with full access
                    const filteredRoles = hasPermission('can_manage_roles') 
                        ? rolesData 
                        : rolesData.filter((r: Role) => {
                            // Users without can_manage_roles can only see non-admin roles
                            const rName = r.name.toLowerCase();
                            return rName !== 'super_admin' && rName !== 'admin';
                        });
                    setRoles(filteredRoles);
                }

                // 3. Fetch Organizations
                const orgsRes = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/organizations/`, { headers });
                if (orgsRes.ok) {
                    const orgsData = await orgsRes.json();
                    setOrganizations(orgsData);
                    if (orgsData.length > 0) setSelectedOrgId(orgsData[0].id);
                }

                // 4. Fetch User Managed Branches
                const managedRes = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/users/${userId}/managed-branches/`, { headers });
                if (managedRes.ok) {
                    setUserManagedBranches(await managedRes.json());
                }

            } catch (err: any) {
                setErrorMessage(err.message);
            } finally {
                setIsLoading(false);
            }
        }

        if (userId && hasPermission('can_manage_users')) {
            fetchAllData();
        }
    }, [userId, setValue, hasPermission]);

    // Fetch branches when Org changes
    useEffect(() => {
        async function fetchBranches() {
            if (!selectedOrgId) {
                setBranches([]);
                return;
            }
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/public/?organization_id=${selectedOrgId}`, {
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) setBranches(await res.json());
            } catch (err) {
                console.error(err);
            }
        }
        fetchBranches();
    }, [selectedOrgId]);


    // --- Handlers ---

    const onSubmit: SubmitHandler<ProfileFormFields> = async (data) => {
        console.log('Form submitted with data:', data);
        setSuccessMessage(null);
        setErrorMessage(null);
        setIsSaving(true);

        try {
            const headers = getAuthHeaders();
            const updates = [];

            // 1. Update Profile Info
            // Convert empty phone_number to null to avoid validation errors
            const phoneNumber = data.phone_number?.trim();
            updates.push(
                fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}`, {
                    method: "PUT",
                    headers,
                    body: JSON.stringify({
                        first_name: data.first_name,
                        last_name: data.last_name,
                        email: data.email,
                        phone_number: phoneNumber && phoneNumber.length > 0 ? phoneNumber : null
                    })
                })
            );

            // 2. Update Role (if changed)
            if (data.role !== initialRole) {
                updates.push(
                    fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}/role`, {
                        method: "PUT",
                        headers,
                        body: JSON.stringify({ role_name: data.role })
                    })
                );
            }

            // 3. Update Status (if changed)
            if (data.isActive !== initialStatus) {
                const action = data.isActive ? 'activate' : 'deactivate';
                updates.push(
                    fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}/${action}`, {
                        method: "PUT",
                        headers
                    })
                );
            }

            // Execute all updates
            const results = await Promise.all(updates);

            // Check for errors
            for (const res of results) {
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || "Failed to save some changes");
                }
            }

            setSuccessMessage(t('userProfileUpdated'));
            setInitialRole(data.role);
            setInitialStatus(data.isActive);

        } catch (err: any) {
            setErrorMessage(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignBranch = async () => {
        if (!selectedBranchId) return;
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/${selectedBranchId}/managers/${userId}`, {
                method: "POST",
                headers: getAuthHeaders()
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorDetail = errorData.detail || "";
                
                // Check if it's a permission error (403) or if the error message mentions permission
                if (res.status === 403 || errorDetail.toLowerCase().includes("permission")) {
                    setErrorMessage(t('branchAssignmentPermissionDenied'));
                } else {
                    setErrorMessage(errorDetail || t('failedToAssignBranch'));
                }
                return;
            }

            // Refresh managed branches
            const managedRes = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/users/${userId}/managed-branches/`, { headers: getAuthHeaders() });
            if (managedRes.ok) setUserManagedBranches(await managedRes.json());

            setSelectedBranchId("");
            setSuccessMessage(t('branchAssignedSuccessfully'));
        } catch (err: any) {
            // Network errors or other exceptions
            setErrorMessage(err.message || t('failedToAssignBranch'));
        }
    };

    const handleRemoveBranch = async (branchId: string) => {
        if (!confirm(t('removeBranchAssignment'))) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/${branchId}/managers/${userId}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to remove branch assignment");

            // Refresh managed branches
            const managedRes = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/users/${userId}/managed-branches/`, { headers: getAuthHeaders() });
            if (managedRes.ok) setUserManagedBranches(await managedRes.json());

            setSuccessMessage(t('branchAssignmentRemoved'));
        } catch (err: any) {
            setErrorMessage(err.message);
        }
    };

    const handleDeleteUser = async (permanent: boolean) => {
        const msg = permanent
            ? t('permanentDeleteWarning')
            : t('deactivateUserConfirm');

        if (!confirm(msg)) return;

        try {
            const url = permanent
                ? `${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}/permanent`
                : `${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}`;

            const res = await fetch(url, {
                method: "DELETE",
                headers: getAuthHeaders()
            });

            if (!res.ok) throw new Error("Failed to delete user");

            window.location.href = "/dashboard/manage-users";
        } catch (err: any) {
            setErrorMessage(err.message);
        }
    };


    if (isLoading) return <LoadingSpinner />;
    if (!hasPermission('can_manage_users')) return <div className="p-8 text-center text-red-500">{t('accessDenied')}</div>;

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

            {/* Messages */}
            {successMessage && <div className="bg-green-50 text-green-700 p-4 border-b border-green-100">{successMessage}</div>}
            {errorMessage && <div className="bg-red-50 text-red-700 p-4 border-b border-red-100">{errorMessage}</div>}

            <form onSubmit={handleSubmit(
                onSubmit,
                (errors) => {
                    console.error('Form validation errors:', errors);
                    const errorMessages = Object.values(errors).map(err => err?.message).filter(Boolean);
                    setErrorMessage(errorMessages.length > 0 
                        ? errorMessages.join(', ') 
                        : (t('formValidationError') || 'Please fix the form errors'));
                }
            )} className="p-6 md:p-8 space-y-10" noValidate>

                {/* --- Basic Information --- */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">{t('basicInformation')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* First Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstName')}</label>
                            <input {...register("first_name")} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border" />
                            {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
                        </div>

                        {/* Last Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastName')}</label>
                            <input {...register("last_name")} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border" />
                            {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
                        </div>

                        {/* Email */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailAddress')}</label>
                            <div className="flex gap-2">
                                <input {...register("email")} className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border" />
                                {/* Update Email button is implicit in the main save, but visually we can show it if needed. 
                                For now, it's just part of the form. */}
                            </div>
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                            <p className="text-xs text-gray-500 mt-1">{t('emailUpdateNote')}</p>
                        </div>

                        {/* User Role */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('userRoleLabel')}</label>
                            <select {...register("role")} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border bg-white">
                                {roles.map(r => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                            </select>
                            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
                        </div>

                        {/* Mobile Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('mobileNumber')}</label>
                            <input {...register("phone_number")} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border" />
                        </div>

                    </div>
                </section>

                {/* --- Business Information (Branch Management) --- */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">{t('businessInformation')}</h2>

                    {/* List of Managed Branches */}
                    <div className="mb-6 space-y-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('assignedBranches')}</label>
                        {userManagedBranches.length === 0 && <p className="text-sm text-gray-500 italic">{t('noBranchesAssigned')}</p>}
                        {userManagedBranches.map(branch => (
                            <div key={branch.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200">
                                <div>
                                    <span className="font-medium text-gray-900">{getLocalizedName(branch.branch_name_ar, branch.branch_name_en)}</span>
                                </div>
                                <button type="button" onClick={() => handleRemoveBranch(branch.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">{t('remove')}</button>
                            </div>
                        ))}
                    </div>

                    {/* Add New Assignment */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{t('organization')}</label>
                            <select
                                value={selectedOrgId}
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
                            >
                                {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{t('branch')}</label>
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
                                disabled={!selectedOrgId}
                            >
                                <option value="">{t('selectBranch')}</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{getLocalizedName(b.branch_name_ar, b.branch_name_en)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={handleAssignBranch}
                                disabled={!selectedBranchId}
                                className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                            >
                                {t('assignBranch')}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Hidden input for isActive to ensure it's included in form submission */}
                <input type="hidden" {...register("isActive")} />

                {/* --- Action Buttons --- */}
                <div className="pt-6 border-t border-gray-100 flex justify-end space-x-4">
                    <button
                        type="submit"
                        disabled={isSaving || isLoading}
                        onClick={(e) => {
                            console.log('Submit button clicked');
                            console.log('Form errors:', errors);
                            console.log('Form state:', { isSaving, isLoading });
                        }}
                        className="px-6 py-2.5 bg-[#3277AE] text-white rounded-lg font-medium hover:bg-[#2a6594] focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-70"
                    >
                        {isSaving ? t('savingChanges') : t('saveChanges')}
                    </button>
                </div>

                {/* --- Danger Zone --- */}
                <section className="pt-10 mt-10 border-t border-gray-200">
                    <h2 className="text-lg font-semibold text-red-600 mb-4">{t('dangerZone')}</h2>
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-red-900">{t('deactivateUser')}</h3>
                                <p className="text-xs text-red-700 mt-1">{t('deactivateUserDescription')}</p>
                            </div>
                            <button type="button" onClick={() => handleDeleteUser(false)} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm rounded hover:bg-red-50">{t('deactivate')}</button>
                        </div>
                        <div className="border-t border-red-200 pt-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-red-900">{t('deleteUserPermanently')}</h3>
                                <p className="text-xs text-red-700 mt-1">{t('deleteUserPermanentlyDescription')}</p>
                            </div>
                            <button type="button" onClick={() => handleDeleteUser(true)} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">{t('deletePermanently')}</button>
                        </div>
                    </div>
                </section>

            </form>
        </div>
    );
}
