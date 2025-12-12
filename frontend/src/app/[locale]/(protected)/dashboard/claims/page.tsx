"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import ImageCarousel, { CarouselImage } from '@/components/ImageCarousel';
import { formatDateOnly } from '@/utils/dateFormatter';

// Types
interface Claim {
  id: string;
  title: string;
  description: string;
  approval: boolean;
  user_id?: string;
  item_id?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  item_title?: string;
  item_description?: string;
  images?: string[];
  is_assigned?: boolean;  // Whether this claim is assigned as the correct claim for the item
}

interface ClaimFilters {
  approved_only?: boolean;
  search?: string;
}

// Helper function to get token from cookies
const getTokenFromCookies = (): string | null => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token' || name === 'access_token' || name === 'auth_token') {
        return decodeURIComponent(value);
      }
    }
  }
  return null;
};

// Helper function to create authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = getTokenFromCookies();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

export default function ClaimsPage() {
  const t = useTranslations('dashboard.claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [filters, setFilters] = useState<ClaimFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [existingClaimInfo, setExistingClaimInfo] = useState<{
    has_existing: boolean;
    claim_id?: string;
    claim_title?: string;
    claimer_name?: string;
  } | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

  // Fetch all claims
  const fetchClaims = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/all`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch claims');
      }
      
      const data = await response.json();
      setClaims(data);
      setFilteredClaims(data);
    } catch (err) {
      console.error('Error fetching claims:', err);
      setError(t('errorLoading'));
    } finally {
      setIsLoading(false);
    }
  };

  // Check for existing approved claim
  const checkExistingApprovedClaim = async (claimId: string): Promise<boolean> => {
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
  };

  // Proceed with approval/rejection
  const proceedWithApproval = async (claimId: string, approval: boolean) => {
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
        // Update the claim in the local state
        setClaims(prevClaims => 
          prevClaims.map(claim => 
            claim.id === claimId ? { ...claim, approval } : claim
          )
        );
        setFilteredClaims(prevClaims => 
          prevClaims.map(claim => 
            claim.id === claimId ? { ...claim, approval } : claim
          )
        );
        if (selectedClaim?.id === claimId) {
          setSelectedClaim(prev => prev ? { ...prev, approval } : null);
        }
        setShowDisclaimer(false);
        setPendingClaimId(null);
        setExistingClaimInfo(null);
      } else {
        throw new Error('Failed to update claim status');
      }
    } catch (error) {
      console.error('Error updating claim approval:', error);
      alert(t('updateStatusError'));
    }
  };

  // Handle claim approval/rejection
  const handleClaimApproval = async (claimId: string, approval: boolean) => {
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
  };

  function handleDisclaimerConfirm() {
    if (pendingClaimId) {
      proceedWithApproval(pendingClaimId, true);
    }
  }

  function handleDisclaimerCancel() {
    setShowDisclaimer(false);
    setPendingClaimId(null);
    setExistingClaimInfo(null);
  };

  // Filter claims based on search and filters
  useEffect(() => {
    let filtered = claims;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(claim => 
        claim.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.item_title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply approval filter
    if (filters.approved_only !== undefined) {
      filtered = filtered.filter(claim => claim.approval === filters.approved_only);
    }

    setFilteredClaims(filtered);
  }, [claims, searchTerm, filters]);

  // Load claims on component mount
  useEffect(() => {
    fetchClaims();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#3277AE' }}></div>
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">{error}</div>
          <button 
            onClick={fetchClaims}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#3277AE' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3277AE'; }}
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
                style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
              />
            </div>
            
            {/* Approval Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, approved_only: undefined })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filters.approved_only === undefined 
                    ? 'text-white' 
                    : 'text-gray-600 border border-gray-300'
                }`}
                style={{ 
                  backgroundColor: filters.approved_only === undefined ? '#3277AE' : 'white'
                }}
              >
                {t('all')}
              </button>
              <button
                onClick={() => setFilters({ ...filters, approved_only: true })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filters.approved_only === true 
                    ? 'text-white' 
                    : 'text-gray-600 border border-gray-300'
                }`}
                style={{ 
                  backgroundColor: filters.approved_only === true ? '#3277AE' : 'white'
                }}
              >
                {t('approved')}
              </button>
              <button
                onClick={() => setFilters({ ...filters, approved_only: false })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filters.approved_only === false 
                    ? 'text-white' 
                    : 'text-gray-600 border border-gray-300'
                }`}
                style={{ 
                  backgroundColor: filters.approved_only === false ? '#3277AE' : 'white'
                }}
              >
                {t('pending')}
              </button>
            </div>
          </div>
        </div>

        {/* Claims List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredClaims.map((claim) => (
            <div key={claim.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6">
                {/* Claim Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{claim.title}</h3>
                    <p className="text-sm text-gray-500">
                      {t('claimedBy')}: {claim.user_name || t('unknownUser')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      claim.approval ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {claim.approval ? t('approved') : t('pending')}
                    </span>
                    {claim.is_assigned && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {t('assigned') || 'Assigned'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Claim Description */}
                <p className="text-gray-700 mb-4 line-clamp-3">{claim.description}</p>

                {/* Item Information */}
                {claim.item_title && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-1">{t('item')}: {claim.item_title}</p>
                    {claim.item_description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{claim.item_description}</p>
                    )}
                  </div>
                )}

                {/* Claim Images */}
                {claim.images && claim.images.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">{t('supportingImages')}:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {claim.images.slice(0, 4).map((image, index) => (
                        <div key={index} className="relative h-20 rounded-lg overflow-hidden">
                          <Image
                            src={image}
                            alt={`${t('supportingImage')} ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claim Details */}
                <div className="text-sm text-gray-500 mb-4">
                  <p>{t('created')}: {formatDateOnly(claim.created_at)}</p>
                  {claim.updated_at !== claim.created_at && (
                    <p>{t('updated')}: {formatDateOnly(claim.updated_at)}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/claims/${claim.id}`}
                    className="flex-1 px-4 py-2 text-center text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('viewDetails')}
                  </Link>
                  {!claim.approval && (
                    <button
                      onClick={() => handleClaimApproval(claim.id, true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      {t('approve')}
                    </button>
                  )}
                  {claim.approval && (
                    <button
                      onClick={() => handleClaimApproval(claim.id, false)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      {t('reject')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredClaims.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noClaimsFound')}</h3>
            <p className="text-gray-500">
              {searchTerm || filters.approved_only !== undefined 
                ? t('tryAdjustingFilters')
                : t('noClaimsSubmitted')
              }
            </p>
          </div>
        )}

        {/* Claim Details Modal */}
        {selectedClaim && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedClaim.title}</h2>
                    <p className="text-gray-600">
                      {t('claimedBy')}: {selectedClaim.user_name || t('unknownUser')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedClaim(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                {/* Claim Description */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('claimDescription')}</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedClaim.description}</p>
                </div>

                {/* Item Information */}
                {selectedClaim.item_title && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('itemInformation')}</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900 mb-2">{selectedClaim.item_title}</p>
                      {selectedClaim.item_description && (
                        <p className="text-gray-700">{selectedClaim.item_description}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Supporting Images */}
                {selectedClaim.images && selectedClaim.images.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('supportingImages')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedClaim.images.map((image, index) => (
                        <div key={index} className="relative h-32 rounded-lg overflow-hidden">
                          <Image
                            src={image}
                            alt={`${t('supportingImage')} ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claim Status */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('status')}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedClaim.approval ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedClaim.approval ? t('approved') : t('pendingReview')}
                    </span>
                    {selectedClaim.is_assigned && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        {t('assigned') || 'Assigned'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mb-6 text-sm text-gray-500">
                  <p>{t('created')}: {formatDateOnly(selectedClaim.created_at)}</p>
                  {selectedClaim.updated_at !== selectedClaim.created_at && (
                    <p>{t('lastUpdated')}: {formatDateOnly(selectedClaim.updated_at)}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedClaim(null)}
                    className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('close')}
                  </button>
                  {!selectedClaim.approval && (
                    <button
                      onClick={() => {
                        handleClaimApproval(selectedClaim.id, true);
                        setSelectedClaim(null);
                      }}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      {t('approveClaim')}
                    </button>
                  )}
                  {selectedClaim.approval && (
                    <button
                      onClick={() => {
                        handleClaimApproval(selectedClaim.id, false);
                        setSelectedClaim(null);
                      }}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      {t('rejectClaim')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}