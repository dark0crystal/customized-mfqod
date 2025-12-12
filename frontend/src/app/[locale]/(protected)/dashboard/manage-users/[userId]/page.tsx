"use client";

import { useState, use } from "react";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/PermissionsContext";
import UnifiedEditUserForm from "./UnifiedEditUserForm";
import UserProfileCard from "./UserProfileCard";
import UserClaims from "./UserClaims";

export default function EditUserProfile({ params }: { params: Promise<{ userId: string }> }) {
    const resolvedParams = use(params);
    const [showClaims, setShowClaims] = useState(false);
    const t = useTranslations('manageUsers');
    const { hasPermission, isLoading: permissionsLoading } = usePermissions();

    // Note: Individual components (EditUserManagement, EditUserRole) have their own permission checks
    // This page-level check is for better UX - components will show access denied if needed

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* 1. User Profile Card - Always visible (read-only) */}
            <UserProfileCard userId={resolvedParams.userId} />

            {/* 2. Unified User Edit Form */}
            {!permissionsLoading && hasPermission('can_manage_users') && (
                <UnifiedEditUserForm userId={resolvedParams.userId} />
            )}

            {/* 3. Claims Section */}
            <div className="w-full">
                {/* Show Claims Button */}
                <div className="mb-4 flex justify-end">
                    <button
                        onClick={() => setShowClaims(!showClaims)}
                        className="px-4 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#3277AE' }}
                    >
                        {showClaims ? (t('hideClaims') || 'Hide Claims') : (t('showClaims') || 'Show Claims')}
                    </button>
                </div>

                {/* User Claims Section */}
                {showClaims && (
                    <UserClaims userId={resolvedParams.userId} />
                )}
            </div>
        </div>
    )
}