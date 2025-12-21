'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ExternalLink } from 'lucide-react';
import { tokenManager } from '@/utils/tokenManager';
import { formatDateOnly } from '@/utils/dateFormatter';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

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
  images?: Array<{ id: string; url: string }>;
}

// Claims Component
export default function Claims({ postId }: { postId: string }) {
  const t = useTranslations('claims');
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

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

  // Helper function to get image URL
  const getImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return '';
    
    // If the url is already absolute, validate and return as is
    if (/^https?:\/\//.test(imageUrl)) {
      try {
        new URL(imageUrl);
        return imageUrl;
      } catch {
        return '';
      }
    }
    
    // Process relative URLs
    let processedUrl = imageUrl.replace('/uploads/images/', '/static/images/');
    if (!processedUrl.startsWith('/')) {
      processedUrl = '/' + processedUrl;
    }
    
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const fullUrl = `${baseUrl}${processedUrl}`;
    
    // Validate the constructed URL
    try {
      new URL(fullUrl);
      return fullUrl;
    } catch {
      return '';
    }
  };

  return (
    <div>
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
              {claims.map((claim) => {
                // Check if item is approved to disable claims
                const isItemApproved = claim.item_status === 'approved';
                
                return (
                  <div 
                    key={claim.id} 
                    className={`rounded-xl overflow-hidden transition-shadow duration-200 ${
                      isItemApproved
                        ? 'bg-gray-100 border border-gray-300 shadow-sm'
                        : 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="p-6">
                      {/* Header Section */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`text-lg font-semibold ${
                              isItemApproved ? 'text-gray-500' : 'text-gray-900'
                            }`}>
                              {claim.title}
                            </h3>
                            <button
                              onClick={() => router.push(`/dashboard/claims/${claim.id}`)}
                              className={`p-1.5 rounded-lg transition-colors duration-200 ${
                                isItemApproved
                                  ? 'text-[#3277AE] cursor-pointer hover:bg-blue-50'
                                  : 'text-gray-500 hover:text-[#3277AE] hover:bg-blue-50'
                              }`}
                              title={t('viewClaimDetails') || 'View Claim Details'}
                              aria-label={t('viewClaimDetails') || 'View Claim Details'}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              isItemApproved
                                ? claim.approval
                                  ? 'bg-gray-200 text-gray-500'
                                  : 'bg-gray-200 text-gray-500'
                                : claim.approval
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {claim.approval ? t('approved') : t('notApproved')}
                            </span>
                            {claim.is_assigned && (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                isItemApproved
                                  ? 'bg-gray-200 text-gray-500'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {t('assigned') || 'Assigned'}
                              </span>
                            )}
                            {claim.item_status && (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                isItemApproved
                                  ? 'bg-gray-200 text-gray-500'
                                  : claim.item_status === 'approved'
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
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          isItemApproved ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          {claim.description}
                        </p>
                      </div>

                    {/* Images Section */}
                    <div className="mb-4">
                      {claim.images && claim.images.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {claim.images.map((image) => {
                            const imageUrl = getImageUrl(image.url);
                            const imageKey = `${claim.id}-${image.id}`;
                            const hasFailed = failedImages.has(imageKey);
                            
                            return (
                              <div
                                key={image.id}
                                className={`relative aspect-square rounded-lg overflow-hidden ${
                                  isItemApproved
                                    ? 'bg-gray-200 border border-gray-300'
                                    : 'bg-gray-100 border border-gray-200'
                                }`}
                              >
                                {imageUrl && !hasFailed ? (
                                  <img
                                    src={imageUrl}
                                    alt={`Claim image ${image.id}`}
                                    className={`w-full h-full object-cover ${
                                      isItemApproved ? 'opacity-60' : ''
                                    }`}
                                    onError={() => {
                                      setFailedImages(prev => new Set(prev).add(imageKey));
                                    }}
                                  />
                                ) : (
                                  <div className={`flex items-center justify-center w-full h-full text-xs text-center p-2 ${
                                    isItemApproved ? 'text-gray-400' : 'text-gray-400'
                                  }`}>
                                    {t('imageNotFound') || 'Image not found'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={`rounded-lg p-6 text-center ${
                          isItemApproved
                            ? 'bg-gray-200 border border-gray-300'
                            : 'bg-gray-50 border border-gray-200'
                        }`}>
                          <div className={`text-2xl mb-2 ${
                            isItemApproved ? 'text-gray-400' : 'text-gray-400'
                          }`}>🖼️</div>
                          <p className={`text-sm ${
                            isItemApproved ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {t('noImagesAvailable') || 'No images available'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div className={`border-t my-4 ${
                      isItemApproved ? 'border-gray-300' : 'border-gray-200'
                    }`}></div>

                    {/* Claim Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className={`text-xs font-medium mb-1 ${
                          isItemApproved ? 'text-gray-400' : 'text-gray-500'
                        }`}>{t('claimDate')}</p>
                        <p className={`text-sm ${
                          isItemApproved ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {claim.created_at ? formatDateOnly(claim.created_at) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs font-medium mb-1 ${
                          isItemApproved ? 'text-gray-400' : 'text-gray-500'
                        }`}>{t('claimUserName')}</p>
                        <p className={`text-sm ${
                          isItemApproved ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {claim.user_name || 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className={`text-xs font-medium mb-1 ${
                          isItemApproved ? 'text-gray-400' : 'text-gray-500'
                        }`}>{t('claimEmail')}</p>
                        <p className={`text-sm break-all ${
                          isItemApproved ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {claim.user_email || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
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