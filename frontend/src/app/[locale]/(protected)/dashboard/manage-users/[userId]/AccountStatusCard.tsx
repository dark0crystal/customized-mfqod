"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { tokenManager } from "@/utils/tokenManager";
import { usePermissions } from "@/PermissionsContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function AccountStatusCard({ userId }: { userId: string }) {
    const t = useTranslations('manageUsers');
    const { hasPermission } = usePermissions();
    const [isLoading, setIsLoading] = useState(true);
    const [isActive, setIsActive] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchUserStatus() {
            try {
                const token = tokenManager.getAccessToken();
                const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) throw new Error("Failed to fetch user data");

                const data = await response.json();
                setIsActive(data.active);
            } catch (error: any) {
                setErrorMessage(error.message);
            } finally {
                setIsLoading(false);
            }
        }

        if (userId) fetchUserStatus();
    }, [userId]);

    const toggleStatus = async () => {
        if (!confirm(isActive ? "Are you sure you want to deactivate this user?" : "Are you sure you want to activate this user?")) {
            return;
        }

        setIsUpdating(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const token = tokenManager.getAccessToken();
            const action = isActive ? "deactivate" : "activate";
            const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/users/${userId}/${action}`, {
                method: "PUT",
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to ${action} user`);
            }

            setIsActive(!isActive);
            setSuccessMessage(`User ${isActive ? "deactivated" : "activated"} successfully`);
        } catch (error: any) {
            setErrorMessage(error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) return <LoadingSpinner />;

    if (!hasPermission('can_manage_users')) return null;

    return (
        <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Account Status</h2>
                <p className="text-sm text-gray-500 mt-1">Manage user account access</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                    <p className="font-medium text-gray-900">Current Status</p>
                    <div className="flex items-center mt-1">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className={`text-sm ${isActive ? 'text-green-700' : 'text-red-700'} font-medium`}>
                            {isActive ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>

                <button
                    onClick={toggleStatus}
                    disabled={isUpdating}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                        } disabled:opacity-50`}
                >
                    {isUpdating ? "Updating..." : (isActive ? "Deactivate" : "Activate")}
                </button>
            </div>

            {successMessage && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded-md">
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                    {errorMessage}
                </div>
            )}
        </div>
    );
}
