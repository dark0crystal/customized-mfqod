"use client";

import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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
  approval: boolean
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
      if (name === "token") {
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
  const t = useTranslations('dashboard.userReports');

  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

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
        
        // Debug logging to verify data structure
        console.log('Missing items data:', {
          total: missingItemsData.total,
          missing_items_count: missingItemsList.length,
          first_item: missingItemsList[0],
          response_structure: Object.keys(missingItemsData)
        });
        console.log('Found items data:', {
          total: foundItemsData.total,
          items_count: foundItemsList.length,
          first_item: foundItemsList[0],
          response_structure: Object.keys(foundItemsData)
        });
        
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
            approvedClaims: userClaims.filter((claim: Claim) => 
              claim.approval
            ).length,
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
    </div>
  );
}
