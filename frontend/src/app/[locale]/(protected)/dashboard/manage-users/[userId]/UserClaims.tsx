'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateOnly } from '@/utils/dateFormatter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

interface Claim {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  approval: boolean
  user_id?: string;
  item_id?: string;
  user_name?: string;
  user_email?: string;
  item_title?: string;
  item_description?: string;
  is_assigned?: boolean;
}

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=')[1] || document.cookie
    .split('; ')
    .find(row => row.startsWith('token='))
    ?.split('=')[1];
  return {
    'Authorization': `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  };
};

interface UserClaimsProps {
  userId: string;
}

// User Claims Component
export default function UserClaims({ userId }: UserClaimsProps) {
  const t = useTranslations('claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all claims (admin endpoint)
      const response = await fetch(`${API_BASE_URL}/api/claims/all?limit=1000`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Admin permission required.');
        }
        throw new Error('Failed to fetch claims');
      }
      
      const data = await response.json();
      
      // Filter claims by user_id
      const userClaims = Array.isArray(data) 
        ? data.filter((claim: Claim) => claim.user_id === userId)
        : [];
      
      setClaims(userClaims);
    } catch (err) {
      console.error('Error fetching claims:', err);
      setError(err instanceof Error ? err.message : t('errorLoadingClaims'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

  // Auto-fetch claims when component mounts
  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('userClaims') || 'User Claims'}</h2>
      
      {claims.length > 0 ? (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div 
              key={claim.id} 
              className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              <div className="p-6">
                {/* Header Section */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {claim.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        claim.approval
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {claim.approval
                          ? t('approved') 
                          : t('notApproved')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {claim.description}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-4"></div>

                {/* Claim Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t('claimDate')}</p>
                    <p className="text-sm text-gray-900">
                      {claim.created_at ? formatDateOnly(claim.created_at) : 'N/A'}
                    </p>
                  </div>
                  {claim.item_title && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t('forItem') || 'For Item'}</p>
                      <p className="text-sm text-gray-900">
                        {claim.item_title}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 text-4xl mb-3">📋</div>
          <p className="text-gray-600 font-medium">{t('noClaimsAvailable') || "Can't find any claims"}</p>
        </div>
      )}
    </div>
  );
}
