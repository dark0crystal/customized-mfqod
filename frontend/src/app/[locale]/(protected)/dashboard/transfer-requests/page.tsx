"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, MapPin, Package, User, ArrowRight } from "lucide-react";
import { tokenManager } from '@/utils/tokenManager';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

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

import { formatDate } from '@/utils/dateFormatter';

// Helper to get image URL
const getImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return '';
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  let processedUrl = imageUrl.replace('/uploads/images/', '/static/images/');
  if (!processedUrl.startsWith('/')) {
    processedUrl = '/' + processedUrl;
  }
  const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${processedUrl}`;
};

interface TransferRequest {
  id: string;
  item_id: string;
  from_branch_id: string;
  to_branch_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  can_approve?: boolean;
  item?: {
    id: string;
    title: string;
    description: string;
  };
  from_branch?: {
    id: string;
    branch_name_ar?: string;
    branch_name_en?: string;
  };
  to_branch?: {
    id: string;
    branch_name_ar?: string;
    branch_name_en?: string;
  };
  requested_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export default function TransferRequestsPage() {
  const t = useTranslations('dashboard.transferRequests');
  const locale = useLocale();
  const router = useRouter();
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Helper to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  const fetchTransferRequests = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus 
        ? `${API_BASE_URL}/api/transfer-requests/incoming/?status=${filterStatus}`
        : `${API_BASE_URL}/api/transfer-requests/incoming/`;
      
      console.log('Fetching transfer requests from:', url);
      
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Transfer requests data:', data);
        setTransferRequests(data);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Failed to fetch transfer requests:', response.status, errorData);
        setTransferRequests([]);
      }
    } catch (err) {
      console.error('Error fetching transfer requests:', err);
      setTransferRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchTransferRequests();
  }, [fetchTransferRequests]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/transfer-requests/${requestId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        await fetchTransferRequests();
        alert(t('transferApproved') || 'Transfer request approved successfully');
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('approvalFailed') || 'Failed to approve transfer request');
      }
    } catch (err) {
      console.error('Error approving transfer:', err);
      alert(t('approvalFailed') || 'Failed to approve transfer request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm(t('confirmReject') || 'Are you sure you want to reject this transfer request?')) {
      return;
    }

    setProcessingId(requestId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/transfer-requests/${requestId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      });

      if (response.ok) {
        await fetchTransferRequests();
        alert(t('transferRejected') || 'Transfer request rejected');
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('rejectionFailed') || 'Failed to reject transfer request');
      }
    } catch (err) {
      console.error('Error rejecting transfer:', err);
      alert(t('rejectionFailed') || 'Failed to reject transfer request');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('pending')}
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'approved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('approved')}
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'rejected'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('rejected')}
            </button>
            <button
              onClick={() => setFilterStatus('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('all')}
            </button>
          </div>
        </div>

        {/* Transfer Requests List */}
        {transferRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t('noRequests')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {transferRequests.map((request) => {
              const canApprove = request.can_approve ?? false;
              const isPending = request.status === 'pending';
              const showActions = isPending && canApprove;
              
              return (
              <div 
                key={request.id} 
                className={`bg-white rounded-lg shadow-sm p-6 transition-all ${
                  !canApprove ? 'opacity-60 bg-gray-50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(request.status)}`}>
                      {t(request.status)}
                    </span>
                    <span className="text-sm text-gray-500">{formatDate(request.created_at)}</span>
                  </div>
                  {showActions ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {t('approve')}
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        {t('reject')}
                      </button>
                    </div>
                  ) : isPending && !canApprove ? (
                    <div className="text-sm text-gray-500 italic">
                      {t('noPermissionToApprove') || 'You don\'t manage this branch'}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Item Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      {t('itemInformation')}
                    </h3>
                    {request.item && (
                      <div className="space-y-2">
                        <p className="font-medium text-gray-900">{request.item.title}</p>
                        <p className="text-sm text-gray-600 line-clamp-2">{request.item.description}</p>
                        <button
                          onClick={() => router.push(`/dashboard/items/${request.item_id}`)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
                        >
                          {t('viewItemDetails')} →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Transfer Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-5 h-5" />
                      {t('transferDetails')}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">{t('fromBranch')}</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.from_branch 
                              ? getLocalizedName(request.from_branch.branch_name_ar, request.from_branch.branch_name_en)
                              : request.from_branch_id}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">{t('toBranch')}</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.to_branch 
                              ? getLocalizedName(request.to_branch.branch_name_ar, request.to_branch.branch_name_en)
                              : request.to_branch_id}
                          </p>
                        </div>
                      </div>

                      {request.requested_by_user && (
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 text-gray-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">{t('requestedBy')}</p>
                            <p className="text-sm font-medium text-gray-900">
                              {request.requested_by_user.first_name && request.requested_by_user.last_name
                                ? `${request.requested_by_user.first_name} ${request.requested_by_user.last_name}`
                                : request.requested_by_user.email}
                            </p>
                          </div>
                        </div>
                      )}

                      {request.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">{t('notes')}</p>
                          <p className="text-sm text-gray-700">{request.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

