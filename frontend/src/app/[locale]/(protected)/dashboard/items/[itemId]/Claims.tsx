'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { tokenManager } from '@/utils/tokenManager';
import { formatDateOnly } from '@/utils/dateFormatter';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

interface Claim {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  approval: boolean;
  user_id?: string;
  item_id?: string;
  user_name?: string;
  user_email?: string;
  item_title?: string;
  item_description?: string;
  item_status?: string;
  is_assigned?: boolean;
}

// Helper function to create authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = tokenManager.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// Claims Component
export default function Claims({ postId }: { postId: string }) {
  const t = useTranslations('claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [existingClaimInfo, setExistingClaimInfo] = useState<{
    has_existing: boolean;
    claim_id?: string;
    claim_title?: string;
    claimer_name?: string;
  } | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/item/${postId}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch claims');
      
      const data = await response.json();
      setClaims(data);
    } catch (err) {
      console.error('Error fetching claims:', err);
      setError(t('errorLoadingClaims'));
    } finally {
      setIsLoading(false);
    }
  }, [postId, t]);

  // Auto-fetch claims when component mounts
  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  async function checkExistingApprovedClaim(claimId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${claimId}/check-existing-approved`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data.has_existing) {
        setExistingClaimInfo(data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking existing approved claim:', error);
      return false;
    }
  }

  async function handleClaimApproval(claimId: string, approval: boolean) {
    // If rejecting, proceed directly
    if (!approval) {
      await proceedWithApproval(claimId, approval);
      return;
    }

    // If approving, check for existing approved claim
    const hasExisting = await checkExistingApprovedClaim(claimId);
    if (hasExisting) {
      setPendingClaimId(claimId);
      setShowDisclaimer(true);
    } else {
      await proceedWithApproval(claimId, approval);
    }
  }

  async function proceedWithApproval(claimId: string, approval: boolean) {
    try {
      const endpoint = approval 
        ? `${API_BASE_URL}/api/claims/${claimId}/approve`
        : `${API_BASE_URL}/api/claims/${claimId}/reject`;
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });

      if (response.ok) {
        console.log('Claim status updated');
        fetchClaims();
        setShowDisclaimer(false);
        setPendingClaimId(null);
        setExistingClaimInfo(null);
      } else {
        console.error('Failed to update claim status');
      }
    } catch (error) {
      console.error('Error updating claim approval:', error);
    }
  }

  function handleDisclaimerConfirm() {
    if (pendingClaimId) {
      proceedWithApproval(pendingClaimId, true);
    }
  }

  function handleDisclaimerCancel() {
    setShowDisclaimer(false);
    setPendingClaimId(null);
    setExistingClaimInfo(null);
  }

  return (
    <div>
      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('disclaimerTitle') || 'Existing Approved Claim'}
            </h3>
            <p className="text-gray-700 mb-4">
              {t('disclaimerMessage') || 'There is already an approved claim for this post. Approving this claim will unapprove the previous claim. Do you want to continue?'}
            </p>
            {existingClaimInfo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-700">
                  <strong>{t('currentApprovedClaim') || 'Current approved claim:'}</strong> {existingClaimInfo.claim_title || 'N/A'}
                </p>
                {existingClaimInfo.claimer_name && (
                  <p className="text-sm text-gray-600 mt-1">
                    {t('claimer') || 'Claimer:'} {existingClaimInfo.claimer_name}
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDisclaimerCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleDisclaimerConfirm}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {t('confirm') || 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">{t('loadingClaims')}</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
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
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            claim.approval 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {claim.approval ? t('approved') : t('notApproved')}
                          </span>
                          {claim.is_assigned && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {t('assigned') || 'Assigned'}
                            </span>
                          )}
                          {claim.item_status && (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              claim.item_status === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : claim.item_status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {t('itemStatus') || 'Item Status'}: {
                                claim.item_status === 'approved' ? (t('approved') || 'Approved') :
                                claim.item_status === 'cancelled' ? (t('cancelled') || 'Cancelled') :
                                (t('pending') || 'Pending')
                              }
                            </span>
                          )}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">{t('claimDate')}</p>
                        <p className="text-sm text-gray-900">
                          {claim.created_at ? formatDateOnly(claim.created_at) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">{t('claimUserName')}</p>
                        <p className="text-sm text-gray-900">
                          {claim.user_name || 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-gray-500 mb-1">{t('claimEmail')}</p>
                        <p className="text-sm text-gray-900 break-all">
                          {claim.user_email || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleClaimApproval(claim.id, !claim.approval)}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          claim.approval 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {claim.approval ? (t('reject') || 'Reject Claim') : (t('approve') || 'Approve Claim')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-gray-400 text-4xl mb-3">📋</div>
              <p className="text-gray-600 font-medium">{t('noClaimsAvailable')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}