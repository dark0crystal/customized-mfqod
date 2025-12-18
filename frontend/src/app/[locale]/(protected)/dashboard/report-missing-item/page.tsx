"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/PermissionsContext";
import ReportMissingItemForm from "@/components/forms/ReportMissingItemForm";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function ReportMissingItem() {
  const router = useRouter();
  const t = useTranslations('common');
  const { hasPermission, isLoading, isAuthenticated } = usePermissions();

  useEffect(() => {
    // Wait for permissions to load
    if (!isLoading && isAuthenticated) {
      // Check if user has permission to create missing items
      if (!hasPermission('can_manage_missing_items')) {
        // Redirect to dashboard if user doesn't have permission
        router.push('/dashboard');
      }
    }
  }, [hasPermission, isLoading, isAuthenticated, router]);

  // Show loading while checking permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If not authenticated, the protected layout will handle redirect
  if (!isAuthenticated) {
    return null;
  }

  // Check permission before rendering form
  if (!hasPermission('can_manage_missing_items')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('accessDenied')}</h2>
          <p className="text-gray-600 mb-4">{t('noPermissionToReportMissingItems')}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('goToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ReportMissingItemForm/>
    </div>
  );
}
