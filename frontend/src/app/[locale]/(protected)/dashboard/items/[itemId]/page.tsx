"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import { Mail, MapPin, ArrowRight } from "lucide-react";
import Claims from "./Claims";
import EditPost from "./EditPost";
import LocationTracking from "@/components/LocationTracking";
import { tokenManager } from '@/utils/tokenManager';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import CustomDropdown from '@/components/ui/CustomDropdown';
import HydrationSafeWrapper from '@/components/HydrationSafeWrapper';
import ImageCarousel, { CarouselImage } from '@/components/ImageCarousel';
import { formatDate } from '@/utils/dateFormatter';
import { Trash2 } from 'lucide-react';

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

// Helper to get initials
const getInitials = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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

enum ItemStatus {
  CANCELLED = "cancelled",
  APPROVED = "approved",
  PENDING = "pending"
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  status?: string;  // Item status: cancelled, approved, pending
  approval: boolean;  // DEPRECATED: kept for backward compatibility
  temporary_deletion: boolean;
  approved_claim_id?: string | null;  // ID of the approved claim
  created_at: string;
  updated_at: string;
  claims_count?: number;
  images?: Array<{
    id: string;
    url: string;
    description?: string;
  }>;
  location?: {
    organization_name_ar?: string;
    organization_name_en?: string;
    branch_name_ar?: string;
    branch_name_en?: string;
    full_location?: string;
  };
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    name?: string;
    role?: string;
    phone_number?: string;
  };
  addresses?: Array<{
    id: string;
    is_current: boolean;
    branch?: {
      id: string;
      branch_name_ar?: string;
      branch_name_en?: string;
      organization?: {
        id: string;
        name_ar?: string;
        name_en?: string;
      };
    };
    full_location?: string;
    created_at: string;
    updated_at: string;
  }>;
  item_type?: {
    id: string;
    name_ar?: string;
    name_en?: string;
  };
}

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
}

export default function PostDetails({ params }: { params: Promise<{ itemId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations('dashboard.items.detail');
  const locale = useLocale();
  const [item, setItem] = useState<ItemData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');
  const [previousStatus, setPreviousStatus] = useState<string>('pending');
  const [showEditForm, setShowEditForm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferBranches, setTransferBranches] = useState<Array<{ id: string, branch_name_ar?: string, branch_name_en?: string, disabled?: boolean, isManaged?: boolean }>>([]);
  const [selectedTransferBranch, setSelectedTransferBranch] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [showPendingDisclaimer, setShowPendingDisclaimer] = useState(false);
  const [pendingStatusChangeToPending, setPendingStatusChangeToPending] = useState<string | null>(null);

  // Helper to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          throw new Error("Failed to fetch item details");
        }
        const data = await response.json();
        setItem(data);
        // Set status from data.status or fallback to approved/pending based on approval
        setStatus(data.status || (data.approval ? 'approved' : 'pending'));
      } catch (err) {
        console.error(err);
        setError("Error fetching item details.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.itemId]);

  // Fetch branches for transfer when modal opens
  useEffect(() => {
    const fetchTransferBranches = async () => {
      if (!showTransferModal || !item) return;

      try {
        // Fetch all branches
        const allBranchesResponse = await fetch(`${API_BASE_URL}/api/branches/`, {
          headers: getAuthHeaders()
        });

        // Fetch user's managed branches
        const managedBranchesResponse = await fetch(`${API_BASE_URL}/api/branches/my-managed-branches/`, {
          headers: getAuthHeaders()
        });

        if (allBranchesResponse.ok && managedBranchesResponse.ok) {
          const allBranches = await allBranchesResponse.json();
          const managedBranches = await managedBranchesResponse.json();

          // Get current branch ID from item location
          const currentBranchId = item.addresses?.find(addr => addr.is_current)?.branch?.id;

          // Create a set of managed branch IDs for quick lookup (for display purposes only)
          const managedBranchIds = new Set(managedBranches.map((branch: { id: string }) => branch.id));

          // Process all branches: filter out only the current branch (users can transfer to branches they manage)
          const availableBranches = allBranches
            .filter((branch: { id: string }) => branch.id !== currentBranchId)
            .map((branch: { id: string, branch_name_ar?: string, branch_name_en?: string }) => ({
              ...branch,
              isManaged: managedBranchIds.has(branch.id)
            }));

          setTransferBranches(availableBranches);
        } else if (allBranchesResponse.ok) {
          // Fallback: if managed branches fetch fails, just show all branches
          const allBranches = await allBranchesResponse.json();
          const currentBranchId = item.addresses?.find(addr => addr.is_current)?.branch?.id;
          const availableBranches = allBranches.filter(
            (branch: { id: string }) => branch.id !== currentBranchId
          );
          setTransferBranches(availableBranches);
        }
      } catch (err) {
        console.error('Error fetching branches for transfer:', err);
      }
    };

    fetchTransferBranches();
  }, [showTransferModal, item]);

  const fetchClaims = async (): Promise<Claim[]> => {
    setLoadingClaims(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/item/${resolvedParams.itemId}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setClaims(data);
        return data;
      } else {
        console.error('Failed to fetch claims');
        return [];
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
      return [];
    } finally {
      setLoadingClaims(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    // If changing from approved to pending, check if there's a connected claim
    if (previousStatus === 'approved' && newStatus === 'pending') {
      // Check if item has an approved claim connected
      if (item?.approved_claim_id) {
        // Show disclaimer modal
        setPendingStatusChangeToPending(newStatus);
        setShowPendingDisclaimer(true);
        return; // Don't update status yet - wait for user confirmation
      }
    }
    
    // If changing from pending to approved, check if claim is needed
    if (previousStatus === 'pending' && newStatus === 'approved') {
      // Check if item already has an approved claim
      if (!item?.approved_claim_id) {
        // Fetch claims first to check if any exist
        const claimsList = await fetchClaims();
        
        // If no claims exist, prevent the status change
        if (claimsList.length === 0) {
          alert(t('noClaimsToApprove') || 'Cannot approve this post. There are no claims for this post. Please create a claim first before approving.');
          return; // Don't update status - it stays as 'pending'
        }
        
        // If claims exist, show modal to select a claim
        setPendingStatusChange(newStatus);
        setShowClaimModal(true);
        return; // Don't update status yet - it stays as 'pending'
      }
    }
    // For other status changes, proceed normally
    setPreviousStatus(status);
    setStatus(newStatus);
  };

  const handleStatusUpdate = async () => {
    if (!item) return;
    
    // If trying to change from pending to approved without a claim, handle it
    if (previousStatus === 'pending' && status === 'approved' && !item.approved_claim_id) {
      // This should have been handled by handleStatusChange, but as a safety check
      if (!selectedClaimId && !showClaimModal) {
        await handleStatusChange(status);
        return;
      }
      // If no selected claim and no modal, prevent the change
      if (!selectedClaimId && !showClaimModal) {
        alert(t('noClaimForApproved') || 'Cannot approve this item. Please select a claim first.');
        return;
      }
    }
    
    // If trying to change to approved, ensure approved_claim_id exists
    if (status === 'approved' && !item.approved_claim_id && !selectedClaimId) {
      alert(t('noClaimForApproved') || 'Cannot approve this item. Please select a claim first.');
      return;
    }
    
    setIsUpdating(true);
    try {
      // If we have a selected claim and changing to approved, use PATCH endpoint with approved_claim_id
      if (status === 'approved' && selectedClaimId) {
        const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: 'approved',
            approved_claim_id: selectedClaimId
          }),
        });

        if (response.ok) {
          const updatedData = await response.json();
          setItem(updatedData);
          setStatus(updatedData.status || status);
          setPreviousStatus(updatedData.status || status);
          setShowClaimModal(false);
          setSelectedClaimId('');
          setPendingStatusChange(null);
        }
      } else {
        // Use the status endpoint to update status
        const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}/status?new_status=${status}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const updatedData = await response.json();
          setItem(updatedData);
          setStatus(updatedData.status || status);
          setPreviousStatus(updatedData.status || status);
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClaimSelection = async () => {
    if (!selectedClaimId) {
      alert(t('pleaseSelectClaim') || 'Please select a claim');
      return;
    }
    // Close modal and proceed with status update
    setShowClaimModal(false);
    setPendingStatusChange(null);
    
    // Update status and proceed with update
    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'approved',
          approved_claim_id: selectedClaimId
        }),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setItem(updatedData);
        setStatus('approved');
        setPreviousStatus('approved');
        setSelectedClaimId('');
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('updateStatusError') || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert(t('updateStatusError') || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelClaimSelection = () => {
    // Revert status to previous (status was never actually changed)
    setStatus(previousStatus);
    setShowClaimModal(false);
    setPendingStatusChange(null);
    setSelectedClaimId('');
  };

  const handlePendingDisclaimerConfirm = async () => {
    // Proceed with status change to pending and clear approved_claim_id
    setShowPendingDisclaimer(false);
    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'pending',
          approved_claim_id: null
        }),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setItem(updatedData);
        setStatus('pending');
        setPreviousStatus('pending');
        setPendingStatusChangeToPending(null);
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('updateStatusError') || 'Failed to update status');
        // Revert status on error
        setStatus(previousStatus);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert(t('updateStatusError') || 'Failed to update status');
      // Revert status on error
      setStatus(previousStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePendingDisclaimerCancel = () => {
    // Revert status to previous (status was never actually changed)
    setStatus(previousStatus);
    setShowPendingDisclaimer(false);
    setPendingStatusChangeToPending(null);
  };


  const handleTransferRequest = async () => {
    if (!item || !selectedTransferBranch) return;

    // Validate that the selected branch is not the current branch
    const currentBranchId = item.addresses?.find(addr => addr.is_current)?.branch?.id;
    if (selectedTransferBranch === currentBranchId) {
      alert(t('cannotTransferToCurrentBranch') || 'Cannot transfer item to the same branch it is currently in');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/transfer-requests/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          item_id: item.id,
          to_branch_id: selectedTransferBranch,
          notes: transferNotes || undefined,
        }),
      });

      if (response.ok) {
        setShowTransferModal(false);
        setSelectedTransferBranch('');
        setTransferNotes('');
        alert(t('transferRequestSubmitted') || 'Transfer request submitted successfully');
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('transferRequestFailed') || 'Failed to submit transfer request');
      }
    } catch (err) {
      console.error('Error submitting transfer request:', err);
      alert(t('transferRequestFailed') || 'Failed to submit transfer request');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!item) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}?permanent=true`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // Navigate back to items list after successful deletion
        router.push('/dashboard/items');
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('deleteItemFailed') || 'Failed to delete item');
        setIsDeleting(false);
        setShowDeleteModal(false);
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      alert(t('deleteItemFailed') || 'Failed to delete item');
      setIsDeleting(false);
      setShowDeleteModal(false);
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

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500 text-lg">{error || t('itemNotFound')}</p>
      </div>
    );
  }

  const userName = item.user?.name ||
    (item.user?.first_name && item.user?.last_name
      ? `${item.user.first_name} ${item.user.last_name}`
      : item.user?.first_name || item.user?.email || t('unknownUser'));

  const userInitial = getInitials(userName);
  const userEmail = item.user?.email || '';
  const userRole = item.user?.role || 'N/A';

  // Shortened item ID for display (first 8 characters)
  const shortItemId = item.id.substring(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('itemNumber', { id: shortItemId })}
            </h1>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t('created')} {formatDate(item.created_at)}</span>
            {showEditForm ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium transition-colors hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  id="save-changes-button"
                  type="button"
                  className="px-4 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#3277AE' }}
                >
                  {t('save') || 'Save Changes'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowEditForm(!showEditForm)}
                className="px-4 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: '#3277AE' }}
              >
                {t('editItem')}
              </button>
            )}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Edit Form Section - Wider and on top */}
            {showEditForm ? (
              <EditPost 
                params={{ itemId: resolvedParams.itemId }}
                onSave={() => {
                  // This will be called after successful save
                  setShowEditForm(false);
                }}
                onCancel={() => setShowEditForm(false)}
              />
            ) : (
              /* Read-only Item Information Section */
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('itemInformation')}</h2>
                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('title')}</label>
                    <p className="text-base text-gray-900">{item.title || t('notAvailable')}</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('description')}</label>
                    <p className="text-base text-gray-900 whitespace-pre-wrap">{item.description || t('noDescription')}</p>
                  </div>

                  {/* Approval Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('approvalStatus')}</label>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${item.status === ItemStatus.APPROVED ? 'bg-green-100 text-green-800' :
                          item.status === ItemStatus.CANCELLED ? 'bg-red-100 text-red-800' :
                            item.status === ItemStatus.PENDING ? 'bg-orange-100 text-orange-800' :
                              item.approval ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                      {item.status === ItemStatus.APPROVED ? t('approved') :
                            item.status === ItemStatus.CANCELLED ? t('cancelled') :
                              item.status === ItemStatus.PENDING ? (t('pending') || 'Pending') :
                                item.approval ? t('approved') : (t('pending') || 'Pending')}
                    </span>
                  </div>

                  {/* Temporary Deletion Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('deletionStatus')}</label>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${item.temporary_deletion
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                      }`}>
                      {item.temporary_deletion ? t('markedForDeletion') : t('active')}
                    </span>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('location')}</label>
                    <p className="text-base text-gray-900">{item.location?.full_location || t('noLocation')}</p>
                  </div>

                  {/* Organization and Branch */}
                  {(item.location?.organization_name_en || item.location?.organization_name_ar ||
                    item.location?.branch_name_en || item.location?.branch_name_ar) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Organization */}
                        {(item.location?.organization_name_en || item.location?.organization_name_ar) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">{t('organization')}</label>
                            <p className="text-base text-gray-900">
                              {getLocalizedName(item.location.organization_name_ar, item.location.organization_name_en)}
                            </p>
                          </div>
                        )}

                        {/* Branch */}
                        {(item.location?.branch_name_en || item.location?.branch_name_ar) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">{t('branch')}</label>
                            <p className="text-base text-gray-900">
                              {getLocalizedName(item.location.branch_name_ar, item.location.branch_name_en)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Location History */}
                  {item.addresses && item.addresses.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-3">{t('locationHistory')}</label>
                      <LocationTracking addresses={item.addresses} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Item Images Carousel */}
            {item.images && item.images.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{t('itemImages')}</h2>
                  <span className="text-sm text-gray-600">
                    {item.images.length} {item.images.length === 1 ? t('image') : t('images')}
                  </span>
                </div>
                <div className="w-full" style={{ minHeight: '400px' }}>
                  <ImageCarousel
                    images={item.images.map((img): CarouselImage => ({
                      id: img.id,
                      url: getImageUrl(img.url),
                      alt: img.description || `Item image`,
                      description: img.description,
                    }))}
                    isModal={false}
                    showCounter={true}
                    showDots={true}
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}



            {/* Item Summary Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('itemSummary')}</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('itemId')}</span>
                  <span className="font-medium text-gray-900">{item.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('claims')}</span>
                  <span className="font-medium text-gray-900">{item.claims_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('created')}</span>
                  <span className="font-medium text-gray-900">{formatDate(item.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('lastUpdated')}</span>
                  <span className="font-medium text-gray-900">{formatDate(item.updated_at)}</span>
                </div>
              </div>
            </div>

            {/* Claims Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('claims')}</h2>
              <Claims postId={resolvedParams.itemId} />
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Approval Status Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{t('itemStatus')}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.status === ItemStatus.APPROVED ? 'bg-green-100 text-green-800' :
                    item.status === ItemStatus.CANCELLED ? 'bg-red-100 text-red-800' :
                      item.status === ItemStatus.PENDING ? 'bg-orange-100 text-orange-800' :
                        item.approval ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                  {item.status === ItemStatus.APPROVED ? t('approved') :
                        item.status === ItemStatus.CANCELLED ? t('cancelled') :
                          item.status === ItemStatus.PENDING ? (t('pending') || 'Pending') :
                            item.approval ? t('approved') : t('pending')}
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('selectNewStatus')}
                </label>
                <HydrationSafeWrapper fallback={<div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse"></div>}>
                  <CustomDropdown
                    options={[
                      { value: 'cancelled', label: t('status.cancelled') || t('cancelled') },
                      { value: 'approved', label: t('status.approved') || t('approved') },
                      { value: 'pending', label: t('status.pending') || 'Pending' }
                    ]}
                    value={pendingStatusChange && !selectedClaimId ? previousStatus : status}
                    onChange={handleStatusChange}
                    placeholder={t('selectStatus')}
                    className="w-full"
                  />
                </HydrationSafeWrapper>
              </div>

              <button
                onClick={handleStatusUpdate}
                disabled={isUpdating || status === (item.status || (item.approval ? 'approved' : 'pending'))}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isUpdating ? t('updating') : t('update')}
              </button>
            </div>

            {/* Created By Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('createdBy')}</h3>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{userName}</p>
                  {userEmail && (
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{userEmail}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-3">
                    {t('createdOn')} {formatDate(item.created_at)}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    {t('role')}: <span className="text-gray-500">{userRole}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('location')}</h3>
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#3277AE', color: 'white' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  <ArrowRight className="w-4 h-4" />
                  {t('requestTransfer')}
                </button>
              </div>
              {item.location?.full_location || (item.addresses && item.addresses.length > 0) ? (
                <div className="space-y-3">
                  {item.location?.organization_name_en || item.location?.organization_name_ar ? (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {getLocalizedName(item.location.organization_name_ar, item.location.organization_name_en)}
                        </p>
                        {(item.location.branch_name_en || item.location.branch_name_ar) && (
                          <p className="text-sm text-gray-600 mt-1">
                            {getLocalizedName(item.location.branch_name_ar, item.location.branch_name_en)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {item.location?.full_location && (
                    <p className="text-sm text-gray-600 pl-6">{item.location.full_location}</p>
                  )}

                  {item.addresses && item.addresses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <LocationTracking addresses={item.addresses} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('noLocationInfo')}</p>
              )}
            </div>

            {/* Delete Item Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-red-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-900">{t('deleteItem')}</h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('deleteItemWarning')}
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('deletePermanently')}
              </button>
            </div>

            {/* Transfer Request Modal */}
            {showTransferModal && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">{t('requestTransfer')}</h3>
                    <button
                      onClick={() => {
                        setShowTransferModal(false);
                        setSelectedTransferBranch('');
                        setTransferNotes('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('selectDestinationBranch')}
                      </label>
                      <HydrationSafeWrapper fallback={<div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse"></div>}>
                        <CustomDropdown
                          options={transferBranches.map(branch => {
                            const branchName = getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || branch.id;
                            return {
                              value: branch.id,
                              label: branch.isManaged ? `${branchName} (${locale === 'ar' ? 'تديره' : 'You manage this'})` : branchName,
                              disabled: false
                            };
                          })}
                          value={selectedTransferBranch}
                          onChange={setSelectedTransferBranch}
                          placeholder={t('selectBranch')}
                          className="w-full"
                        />
                      </HydrationSafeWrapper>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('notes')} ({t('optional')})
                      </label>
                      <textarea
                        value={transferNotes}
                        onChange={(e) => setTransferNotes(e.target.value)}
                        rows={3}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('transferNotesPlaceholder')}
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          setShowTransferModal(false);
                          setSelectedTransferBranch('');
                          setTransferNotes('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={handleTransferRequest}
                        disabled={!selectedTransferBranch || isSubmittingTransfer}
                        className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#3277AE' }}
                      >
                        {isSubmittingTransfer ? t('submitting') : t('submitRequest')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Claim Selection Modal */}
            {showClaimModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('selectClaim') || 'Select a Claim'}
                  </h3>
                  <p className="text-gray-700 mb-4 text-sm">
                    {t('selectClaimMessage') || 'To approve this post, please select a claim from the list below. Only one claim can be selected.'}
                  </p>

                  {loadingClaims ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">{t('loadingClaims') || 'Loading claims...'}</span>
                    </div>
                  ) : claims.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <p className="text-gray-600 font-medium mb-2">{t('noClaimsAvailable') || 'No claims available'}</p>
                      <p className="text-gray-500 text-sm">{t('noClaimsMessage') || 'There are no claims for this post. Please create a claim first before approving.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                      {claims.map((claim) => (
                        <label
                          key={claim.id}
                          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedClaimId === claim.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start">
                            <input
                              type="radio"
                              name="claim"
                              value={claim.id}
                              checked={selectedClaimId === claim.id}
                              onChange={(e) => setSelectedClaimId(e.target.value)}
                              className="mt-1 mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 mb-1">{claim.title}</div>
                              <div className="text-sm text-gray-600 mb-2 line-clamp-2">{claim.description}</div>
                              {claim.user_name && (
                                <div className="text-xs text-gray-500">
                                  {t('claimer') || 'Claimer:'} {claim.user_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleCancelClaimSelection}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      {t('cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={handleClaimSelection}
                      disabled={!selectedClaimId || claims.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {t('confirm') || 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Disclaimer Modal */}
            {showPendingDisclaimer && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('pendingToApprovedDisclaimerTitle') || 'Discard Connected Claim?'}
                  </h3>
                  <p className="text-gray-700 mb-4">
                    {t('pendingToApprovedDisclaimer') || 'Changing this item from approved to pending will discard the connected claim. Do you want to continue?'}
                  </p>
                  {item?.approved_claim_id && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-700">
                        <strong>{t('connectedClaimWillBeDiscarded') || 'The connected claim will be discarded when changing status to pending.'}</strong>
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handlePendingDisclaimerCancel}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      {t('cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={handlePendingDisclaimerConfirm}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? (t('updating') || 'Updating...') : (t('confirm') || 'Continue')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{t('confirmDelete')}</h3>
                      <p className="text-sm text-gray-500 mt-1">{t('deleteItemTitle')}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-gray-700 mb-3">
                      {t('deleteItemConfirmation')}
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800 font-medium mb-1">{t('thisActionCannotBeUndone')}</p>
                      <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                        <li>{t('deleteItemImages')}</li>
                        <li>{t('deleteItemClaims')}</li>
                        <li>{t('deleteItemAddresses')}</li>
                        <li>{t('deleteItemTransferRequests')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                      }}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleDeleteItem}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:bg-red-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('deleting')}
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          {t('deletePermanently')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
