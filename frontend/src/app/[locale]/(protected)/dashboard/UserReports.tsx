"use client";

import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from '@/i18n/navigation';
import { formatDateOnly } from '@/utils/dateFormatter';

interface MissingItem {
  id: string;
  title: string;
  description: string;
  status: string;
  approval: boolean;
  created_at: string;
  updated_at: string;
  item_type?: {
    id: string;
    name: string;
  };
}

interface FoundItem {
  id: string;
  title: string;
  description: string;
  approval: boolean;
  created_at: string;
  updated_at: string;
  item_type?: {
    id: string;
    name: string;
  };
}

interface Claim {
  id: string;
  title: string;
  description: string;
  approval: boolean;
  created_at: string;
  updated_at: string;
  is_assigned?: boolean;  // Whether this claim is assigned as the correct claim for the item
  item?: {
    id: string;
    title: string;
  };
}

interface UserReportsData {
  missingItems: MissingItem[];
  foundItems: FoundItem[];
  claims: Claim[];
  stats: {
    totalMissingItems: number;
    totalFoundItems: number;
    totalClaims: number;
    approvedMissingItems: number;
    approvedFoundItems: number;
    approvedClaims: number;
  };
}

const getUserFromCookies = (): { id: string } | null => {
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "user") {
        try {
          return JSON.parse(decodeURIComponent(value));
        } catch {
          console.error("Failed to parse user cookie");
          return null;
        }
      }
    }
  }
  return null;
};

const getTokenFromCookies = (): string | null => {
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "access_token") {
        return decodeURIComponent(value);
      }
    }
  }
  return null;
};

export default function UserReports() {
  const [data, setData] = useState<UserReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'missing' | 'found' | 'claims'>('missing');
  const t = useTranslations('dashboard.userReports');
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

  // Navigation functions
  const handleEditMissingItem = (itemId: string) => {
    router.push('/dashboard/missing-items');
  };

  const handleEditFoundItem = (itemId: string) => {
    router.push('/dashboard/items');
  };

  const handleEditClaim = (claimId: string) => {
    router.push('/dashboard/claims');
  };

  useEffect(() => {
    const fetchUserReports = async () => {
      const userFromCookie = getUserFromCookies();
      const token = getTokenFromCookies();

      if (!userFromCookie || !userFromCookie.id) {
        setError("User not found");
        setLoading(false);
        return;
      }

      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        // Fetch all user reports in parallel
        const [missingItemsRes, foundItemsRes, claimsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/missing-items/users/${userFromCookie.id}/missing-items?limit=100`, {
            headers,
            credentials: "include",
          }),
          fetch(`${API_BASE_URL}/api/items/users/${userFromCookie.id}/items?limit=100`, {
            headers,
            credentials: "include",
          }),
          fetch(`${API_BASE_URL}/api/claims/?limit=100`, {
            headers,
            credentials: "include",
          }),
        ]);

        if (!missingItemsRes.ok || !foundItemsRes.ok || !claimsRes.ok) {
          throw new Error("Failed to fetch user reports");
        }

        const [missingItemsData, foundItemsData, claimsData] = await Promise.all([
          missingItemsRes.json(),
          foundItemsRes.json(),
          claimsRes.json(),
        ]);

        // Filter claims to only show user's own claims
        const userClaims = Array.isArray(claimsData) 
          ? claimsData.filter((claim: Claim) => claim.id) // This will be filtered properly when we have user_id in claims
          : [];

        const missingItemsList = missingItemsData.missing_items || [];
        const foundItemsList = foundItemsData.items || [];
        
        const reportsData: UserReportsData = {
          missingItems: missingItemsList,
          foundItems: foundItemsList,
          claims: userClaims,
          stats: {
            totalMissingItems: missingItemsData.total || 0,
            totalFoundItems: foundItemsData.total || 0,
            totalClaims: userClaims.length,
            approvedMissingItems: missingItemsList.filter((item: MissingItem) => item.approval).length,
            approvedFoundItems: foundItemsList.filter((item: FoundItem) => item.approval).length,
            approvedClaims: userClaims.filter((claim: Claim) => claim.approval).length,
          },
        };

        setData(reportsData);
      } catch (err) {
        console.error("Error fetching user reports:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch reports");
      } finally {
        setLoading(false);
      }
    };

    fetchUserReports();
  }, [API_BASE_URL]);

  if (loading) {
    return <LoadingSpinner size="md" className="h-64" />;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">{t('errorLoadingReports')}</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">{t('noReportsFound')}</p>
      </div>
    );
  }

  // Using utility function for consistent date formatting
  const formatDate = formatDateOnly;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'visit':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalColor = (approved: boolean) => {
    return approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-2 sm:mt-4 p-3 sm:p-5 bg-white shadow-xl rounded-2xl sm:rounded-3xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('myReports')}</h2>
        <p className="text-sm sm:text-base text-gray-600">{t('reportsDescription')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 sm:p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-xs sm:text-sm font-medium">{t('missingItems')}</p>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{data.stats.totalMissingItems}</p>
              <p className="text-red-700 text-xs">{t('approved')}: {data.stats.approvedMissingItems}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-200 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 sm:p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-xs sm:text-sm font-medium">{t('foundItems')}</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900">{data.stats.totalFoundItems}</p>
              <p className="text-green-700 text-xs">{t('approved')}: {data.stats.approvedFoundItems}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-200 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-xs sm:text-sm font-medium">{t('claims')}</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{data.stats.totalClaims}</p>
              <p className="text-blue-700 text-xs">{t('approved')}: {data.stats.approvedClaims}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-200 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 sm:mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 lg:space-x-8">
            <button
              onClick={() => setActiveTab('missing')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'missing'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="hidden sm:inline">{t('missingItems')}</span>
              <span className="sm:hidden">{t('missingItems')}</span>
              <span className="ml-1">({data.missingItems.filter((item: MissingItem) => item.status === 'pending').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('found')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'found'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="hidden sm:inline">{t('foundItems')}</span>
              <span className="sm:hidden">{t('foundItems')}</span>
              <span className="ml-1">({data.stats.totalFoundItems})</span>
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'claims'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="hidden sm:inline">{t('claims')}</span>
              <span className="sm:hidden">{t('claims')}</span>
              <span className="ml-1">({data.stats.totalClaims})</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'missing' && (
          <div>
            {data.missingItems.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noMissingItems')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('noMissingItemsDescription')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {data.missingItems.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 truncate">{item.title}</h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2">{item.description}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span>{t('created')}: {formatDate(item.created_at)}</span>
                          <span>{t('updated')}: {formatDate(item.updated_at)}</span>
                          {item.item_type && (
                            <span>{t('type')}: {item.item_type.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getApprovalColor(item.approval)}`}>
                          {item.approval ? t('approved') : t('pending')}
                        </span>
                        <button
                          onClick={() => handleEditMissingItem(item.id)}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                          title={t('edit')}
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('edit')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'found' && (
          <div>
            {data.foundItems.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noFoundItems')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('noFoundItemsDescription')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {data.foundItems.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 truncate">{item.title}</h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2">{item.description}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span>{t('created')}: {formatDate(item.created_at)}</span>
                          <span>{t('updated')}: {formatDate(item.updated_at)}</span>
                          {item.item_type && (
                            <span>{t('type')}: {item.item_type.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {t('found')}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getApprovalColor(item.approval)}`}>
                          {item.approval ? t('approved') : t('pending')}
                        </span>
                        <button
                          onClick={() => handleEditFoundItem(item.id)}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                          title={t('edit')}
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('edit')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'claims' && (
          <div>
            {data.claims.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noClaims')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('noClaimsDescription')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {data.claims.map((claim) => (
                  <div key={claim.id} className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 truncate">{claim.title}</h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2">{claim.description}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span>{t('created')}: {formatDate(claim.created_at)}</span>
                          <span>{t('updated')}: {formatDate(claim.updated_at)}</span>
                          {claim.item && (
                            <span>{t('forItem')}: {claim.item.title}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {t('claim')}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getApprovalColor(claim.approval)}`}>
                          {claim.approval ? t('approved') : t('pending')}
                        </span>
                        {claim.is_assigned && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {t('assigned') || 'Assigned'}
                          </span>
                        )}
                        <button
                          onClick={() => handleEditClaim(claim.id)}
                          disabled={claim.approval && claim.is_assigned}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            claim.approval && claim.is_assigned
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          }`}
                          title={claim.approval && claim.is_assigned ? (t('cannotEditAssigned') || 'Cannot edit approved and assigned claim') : t('edit')}
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('edit')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
