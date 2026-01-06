"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import { Mail, MapPin, ArrowRight, Download, HelpCircle } from "lucide-react";
import Claims from "./Claims";
import EditPost from "./EditPost";
import LocationTracking from "@/components/LocationTracking";
import { tokenManager } from '@/utils/tokenManager';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePermissions } from '@/PermissionsContext';
import CustomDropdown from '@/components/ui/CustomDropdown';
import HydrationSafeWrapper from '@/components/HydrationSafeWrapper';
import ImageCarousel, { CarouselImage } from '@/components/ImageCarousel';
import Image from 'next/image';
import { formatDate } from '@/utils/dateFormatter';
import { Trash2 } from 'lucide-react';
import { imageUploadService } from '@/services/imageUploadService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import OnboardingTour, { TourStep } from '@/components/OnboardingTour';
import ProtectedPage from '@/components/protection/ProtectedPage';

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

// Helper to get image URL with validation
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
  
  const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
  const fullUrl = `${baseUrl}${processedUrl}`;
  
  // Validate the constructed URL
  try {
    new URL(fullUrl);
    return fullUrl;
  } catch {
    return '';
  }
};

enum ItemStatus {
  CANCELLED = "cancelled",
  APPROVED = "approved",
  PENDING = "pending",
  DISPOSED = "disposed"
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  internal_description?: string;  // Internal description visible only to authorized users
  status?: string;  // Item status: cancelled, approved, pending, disposed
  approval: boolean;  // DEPRECATED: kept for backward compatibility
  temporary_deletion: boolean;
  is_hidden?: boolean;  // Whether item images are hidden from regular users
  approved_claim_id?: string | null;  // ID of the approved claim
  disposal_note?: string;  // Note describing how the item was disposed
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
  images?: Array<{
    id: string;
    url: string;
  }>;
  item_type?: {
    id: string;
    name_ar?: string;
    name_en?: string;
    description_ar?: string;
    description_en?: string;
  };
}

export default function PostDetails({ params }: { params: Promise<{ itemId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations('dashboard.items.detail');
  const tEdit = useTranslations('editPost');
  const tNavbar = useTranslations('navbar');
  const tAnalytics = useTranslations('dashboard.analytics');
  const tItems = useTranslations('dashboard.items');
  const locale = useLocale();
  const { hasPermission } = usePermissions();
  const canManageItems = hasPermission('can_manage_items');
  const canManageTransferRequests = hasPermission('can_manage_transfer_requests');
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
  const [imageVisibility, setImageVisibility] = useState<string>('show');
  const [showImageVisibilityModal, setShowImageVisibilityModal] = useState(false);
  const [pendingImageVisibility, setPendingImageVisibility] = useState<string | null>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [disposalNote, setDisposalNote] = useState<string>('');
  const [disposalImages, setDisposalImages] = useState<File[]>([]);
  const [disposalError, setDisposalError] = useState<string | null>(null);
  const [isDisposing, setIsDisposing] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  
  // Create object URLs for image previews
  const disposalImageUrls = useMemo(() => {
    return disposalImages.map(file => URL.createObjectURL(file));
  }, [disposalImages]);
  
  // Cleanup object URLs on unmount or when images change
  useEffect(() => {
    return () => {
      disposalImageUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [disposalImageUrls]);

  // Helper to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to fetch item details: ${response.status}`);
        }
        const data = await response.json();
        if (!data || !data.id) {
          throw new Error("Invalid item data received");
        }
        setItem(data);
        // Set status from data.status or fallback to approved/pending based on approval
        const initialStatus = data.status || (data.approval ? 'approved' : 'pending');
        setStatus(initialStatus);
        // Set previousStatus to match the current status so status change detection works correctly
        setPreviousStatus(initialStatus);
        // Set image visibility from is_hidden
        setImageVisibility(data.is_hidden ? 'hide' : 'show');
      } catch (err) {
        console.error('Error fetching item:', err);
        setError(err instanceof Error ? err.message : "Error fetching item details.");
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams?.itemId) {
      fetchData();
    } else {
      setError("Invalid item ID");
      setLoading(false);
    }
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
    // Get the current status (use item.status if available, otherwise use the status state)
    const currentStatus = item?.status || status;
    
    // If changing to disposed, show disposal modal
    if (newStatus === 'disposed') {
      setPendingStatusChange(newStatus);
      setShowDisposeModal(true);
      return; // Don't update status yet - wait for disposal note
    }
    
    // If changing from disposed to any other status, handle claim connection removal
    if (currentStatus === 'disposed' && newStatus !== 'disposed') {
      // If changing from disposed to approved, show claim selection modal
      if (newStatus === 'approved') {
        // Fetch claims first to check if any exist
        const claimsList = await fetchClaims();
        
        // If no claims exist, prevent the status change
        if (claimsList.length === 0) {
          alert(t('noClaimsToApprove') || 'Cannot approve this post. There are no claims for this post. Please create a claim first before approving.');
          return; // Don't update status - it stays as 'disposed'
        }
        
        // If claims exist, show modal to select a claim
        setPendingStatusChange(newStatus);
        setShowClaimModal(true);
        return; // Don't update status yet - it stays as 'disposed'
      } else {
        // For other status changes from disposed (pending, cancelled), remove claim connection
        // Update status normally - handleStatusUpdate will clear approved_claim_id
        setPreviousStatus(status);
        setStatus(newStatus);
        return;
      }
    }
    
    // If changing from approved to pending, check if there's a connected claim
    if (currentStatus === 'approved' && newStatus === 'pending') {
      // Check if item has an approved claim connected
      if (item?.approved_claim_id) {
        // Show disclaimer modal
        setPendingStatusChange(newStatus);
        setShowPendingDisclaimer(true);
        return; // Don't update status yet - wait for user confirmation
      }
    }
    // If changing from pending to approved, check if claim is needed
    if (
      currentStatus === ("pending" as string) &&
      newStatus === ("approved" as string)
    ) {
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
    
    // If there's a pending status change to disposed, show disposal modal
    if (pendingStatusChange === 'disposed' && !showDisposeModal) {
      setShowDisposeModal(true);
      return;
    }
    
    // Handle status change from disposed to other statuses
    const currentStatus = item.status || status;
    if (currentStatus === 'disposed' && status !== 'disposed') {
      // If changing from disposed to approved, ensure we have a selected claim
      if (status === 'approved') {
        if (!selectedClaimId && !showClaimModal) {
          // Trigger the claim selection flow
          await handleStatusChange(status);
          return;
        }
        if (!selectedClaimId) {
          alert(t('noClaimForApproved') || 'Cannot approve this item. Please select a claim first.');
          return;
        }
      } else {
        // For other status changes from disposed (pending, cancelled), clear approved_claim_id
        setIsUpdating(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              status: status,
              approved_claim_id: null  // Remove claim connection
            }),
          });

          if (response.ok) {
            const updatedData = await response.json();
            setItem(updatedData);
            setStatus(updatedData.status || status);
            setPreviousStatus(updatedData.status || status);
            setPendingStatusChange(null);
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
        return;
      }
    }
    
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

  const handleDisposeSubmit = async () => {
    if (!item) return;
    
    // Validate disposal note
    if (!disposalNote.trim()) {
      setDisposalError(t('disposalNoteRequired') || 'Disposal note is required');
      return;
    }
    
    setIsDisposing(true);
    setDisposalError(null);
    
    try {
      // Upload images first if any
      if (disposalImages.length > 0) {
        for (const file of disposalImages) {
          try {
            await imageUploadService.uploadImageToItem(resolvedParams.itemId, file);
          } catch (err) {
            console.error('Error uploading disposal image:', err);
            // Continue even if image upload fails
          }
        }
      }
      
      // Call disposal endpoint
      const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}/dispose`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          disposal_note: disposalNote
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || t('disposeItemFailed') || 'Failed to dispose item');
      }
      
      const updatedData = await response.json();
      setItem(updatedData);
      setStatus('disposed');
      setPreviousStatus('disposed');
      setPendingStatusChange(null);
      setShowDisposeModal(false);
      setDisposalNote('');
      setDisposalImages([]);
      
      // Show success message
      alert(t('disposeItemSuccess') || 'Item has been disposed successfully');
    } catch (err) {
      setDisposalError(err instanceof Error ? err.message : t('disposeItemFailed') || 'Failed to dispose item');
    } finally {
      setIsDisposing(false);
    }
  };

  const handleClaimSelection = async () => {
    if (!selectedClaimId) {
      alert(t('pleaseSelectClaim') || 'Please select a claim');
      return;
    }
    // Close modal and proceed with status update
    setShowClaimModal(false);
    
    // Update status and proceed with update
    setIsUpdating(true);
    try {
      // Get the current status to determine if we're changing from disposed
      const currentStatus = item?.status || status;
      const targetStatus = pendingStatusChange || 'approved';
      
      // If changing from disposed, we need to clear approved_claim_id first, then set the new one
      const updatePayload: {
        status: string;
        approved_claim_id: string;
      } = {
        status: targetStatus,
        approved_claim_id: selectedClaimId
      };
      
      // If changing from disposed, explicitly clear the old connection
      if (currentStatus === 'disposed') {
        updatePayload.approved_claim_id = selectedClaimId; // Set new claim
      }
      
      const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatePayload),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setItem(updatedData);
        setStatus(targetStatus);
        setPreviousStatus(targetStatus);
        setSelectedClaimId('');
        setPendingStatusChange(null);
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
    // Get the original status from item or previousStatus
    const originalStatus = item?.status || previousStatus;
    setStatus(originalStatus);
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
        setPendingStatusChange(null);
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
    setPendingStatusChange(null);
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

  if (error || (!loading && !item)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-500 text-lg font-semibold mb-2">{error || t('itemNotFound')}</p>
          <p className="text-gray-600 text-sm mb-4">
            {resolvedParams?.itemId ? `Item ID: ${resolvedParams.itemId}` : 'No item ID provided'}
          </p>
          <button
            onClick={() => router.push('/dashboard/items')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('backToItems') || 'Back to Items'}
          </button>
        </div>
      </div>
    );
  }

  // Safety check - if item is still null after loading, show error
  if (!item) {
    return (
      <ProtectedPage requiredPermission="can_manage_items">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <p className="text-red-500 text-lg font-semibold mb-2">{t('itemNotFound')}</p>
            <p className="text-gray-600 text-sm mb-4">
              {resolvedParams?.itemId ? `Item ID: ${resolvedParams.itemId}` : 'No item ID provided'}
            </p>
            <button
              onClick={() => router.push('/dashboard/items')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('backToItems') || 'Back to Items'}
            </button>
          </div>
        </div>
      </ProtectedPage>
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

  // Export item to PDF
  const exportItemToPDF = async () => {
    if (!item) return;

    try {
      // Fetch export data from backend
      const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}/export-data`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch export data');
      }

      const exportData = await response.json();

      // Create a temporary HTML element with the export data
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = locale === 'ar' ? 'Arial, sans-serif' : 'Arial, sans-serif';
      tempDiv.style.direction = locale === 'ar' ? 'rtl' : 'ltr';

      // Build HTML content
      const brandName = tNavbar('brand-duplicate') || 'MFQOD';
      const documentTitle = t('itemInformation') || 'ITEM INFORMATION REPORT';
      const itemId = exportData.id.substring(0, 8).toUpperCase();
      const createdDate = format(new Date(exportData.created_at), 'MMMM dd, yyyy');
      const updatedDate = format(new Date(exportData.updated_at), 'MMMM dd, yyyy');
      
      const htmlContent = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Lalezar&display=swap');
        </style>
        <!-- Brand Logo Section -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 2px solid #3277AE;">
          <!-- Brand Name -->
          <div style="display: inline-flex; align-items: center;">
            <div style="font-size: 32px; font-weight: 400; font-family: 'Lalezar', 'Arial', sans-serif; color: #000000; line-height: 1; white-space: nowrap;">
              ${brandName}
            </div>
          </div>
          
         
        </div>
        
        <!-- Document Title and Info Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
          <div style="text-align: ${locale === 'ar' ? 'right' : 'left'}; flex: 1;">
            <h1 style="font-size: 24px; margin: 0 0 10px 0; color: #3277AE; font-weight: bold;">${documentTitle}</h1>
          </div>
          <div style="text-align: ${locale === 'ar' ? 'left' : 'right'}; flex: 1;">
            <p style="font-size: 12px; margin: 5px 0; color: #333;">${t('itemId') || 'Item ID'}: ${itemId}</p>
            <p style="font-size: 12px; margin: 5px 0; color: #333;">${t('created') || 'Created'}: ${createdDate}</p>
            <p style="font-size: 12px; margin: 5px 0; color: #333;">${t('lastUpdated') || 'Last Updated'}: ${updatedDate}</p>
          </div>
        </div>
        
        <!-- Two Column Address Section -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; gap: 20px;">
          <!-- Reporter Information (Left) -->
          <div style="flex: 1; text-align: ${locale === 'ar' ? 'right' : 'left'};">
            <h3 style="font-size: 14px; margin: 0 0 10px 0; color: #3277AE; font-weight: bold;">${t('createdBy') || 'Reporter Information'}:</h3>
            ${exportData.reporter ? `
              <p style="margin: 5px 0; font-size: 12px; color: #333;">${((exportData.reporter.first_name || '') + ' ' + (exportData.reporter.last_name || '')).trim() || t('unknownUser') || 'Unknown User'}</p>
              <p style="margin: 5px 0; font-size: 12px; color: #333;">${exportData.reporter.email || t('notAvailable') || 'N/A'}</p>
            ` : `
              <p style="margin: 5px 0; font-size: 12px; color: #333;">${t('notAvailable') || 'N/A'}</p>
            `}
          </div>
          
          <!-- Item Location (Right) -->
          <div style="flex: 1; text-align: ${locale === 'ar' ? 'left' : 'right'};">
            <h3 style="font-size: 14px; margin: 0 0 10px 0; color: #3277AE; font-weight: bold;">${t('location') || 'Item Location'}:</h3>
            ${exportData.location ? `
              ${exportData.location.organization_name_ar || exportData.location.organization_name_en ? `
                <p style="margin: 5px 0; font-size: 12px; color: #333;">${getLocalizedName(exportData.location.organization_name_ar, exportData.location.organization_name_en)}</p>
              ` : ''}
              ${exportData.location.branch_name_ar || exportData.location.branch_name_en ? `
                <p style="margin: 5px 0; font-size: 12px; color: #333;">${getLocalizedName(exportData.location.branch_name_ar, exportData.location.branch_name_en)}</p>
              ` : ''}
              ${exportData.location.full_location ? `
                <p style="margin: 5px 0; font-size: 12px; color: #333;">${exportData.location.full_location}</p>
              ` : ''}
            ` : `
              <p style="margin: 5px 0; font-size: 12px; color: #333;">${t('noLocation') || 'No location specified'}</p>
            `}
          </div>
        </div>
        
        <!-- Item Details Table -->
        <div style="margin-bottom: 30px;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background-color: #fafaf9; color: #333;">
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('title') || 'Title'}</th>
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('description') || 'Description'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('approvalStatus') || 'Status'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${tItems('filters.itemType') || 'Item Type'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px;">${exportData.title || t('notAvailable') || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px; white-space: pre-wrap; max-width: 300px;">${exportData.description || t('noDescription') || 'No description'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${exportData.status || t('pending') || 'Pending'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${exportData.item_type ? getLocalizedName(exportData.item_type.name_ar, exportData.item_type.name_en) : (t('notAvailable') || 'N/A')}</td>
              </tr>
              ${exportData.internal_description ? `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px; background-color: #f8f9fa; font-weight: bold;" colspan="4">
                  ${tEdit('internalDescription') || 'Internal Description'}: ${exportData.internal_description}
                </td>
              </tr>
              ` : ''}
              ${exportData.disposal_note ? `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px; background-color: #f8f9fa; font-weight: bold;" colspan="4">
                  ${t('disposalNote') || 'Disposal Note'}: ${exportData.disposal_note}
                </td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
        
        <!-- Approved Claim Table -->
        ${exportData.approved_claim ? `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 16px; margin-bottom: 10px; color: #333; font-weight: bold;">${locale === 'ar' ? 'المطالبة المعتمدة' : 'Approved Claim'}</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background-color: #fafaf9; color: #333;">
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('title') || 'Title'}</th>
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('description') || 'Description'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('claimer') || 'Claimer'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('email') || 'Email'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('approvalStatus') || 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px;">${exportData.approved_claim.title || t('notAvailable') || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px; white-space: pre-wrap; max-width: 250px;">${exportData.approved_claim.description || t('noDescription') || 'No description'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${exportData.approved_claim.user_name || t('notAvailable') || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${exportData.approved_claim.user_email || t('notAvailable') || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${exportData.approved_claim.approval ? (t('approved') || 'Approved') : (t('pending') || 'Pending')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <!-- Connected Missing Items Table -->
        ${exportData.connected_missing_items && exportData.connected_missing_items.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 16px; margin-bottom: 10px; color: #333; font-weight: bold;">${locale === 'ar' ? 'الأغراض المفقودة المتصلة' : 'Connected Missing Items'}</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background-color: #fafaf9; color: #333;">
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">S.NO</th>
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('title') || 'Title'}</th>
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('description') || 'Description'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${t('status') || 'Status'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${tItems('filters.itemType') || 'Item Type'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 12px; font-weight: bold;">${locale === 'ar' ? 'المبلغ' : 'Reporter'}</th>
              </tr>
            </thead>
            <tbody>
              ${exportData.connected_missing_items.map((missingItem: { title?: string; description?: string; status?: string; item_type?: { name_ar?: string; name_en?: string }; user_name?: string }, index: number) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${index + 1}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px;">${missingItem.title || t('notAvailable') || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'}; font-size: 12px; white-space: pre-wrap; max-width: 200px;">${missingItem.description || t('noDescription') || 'No description'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${missingItem.status || t('pending') || 'Pending'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${missingItem.item_type ? getLocalizedName(missingItem.item_type.name_ar, missingItem.item_type.name_en) : (t('notAvailable') || 'N/A')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${missingItem.user_name || t('notAvailable') || 'N/A'}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <!-- Signature Section -->
        <div style="margin-top: 50px; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 20px;">
          <div style="flex: 1; text-align: ${locale === 'ar' ? 'right' : 'left'};">
            <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">${t('createdBy') || 'Reported By'}:</p>
            <div style="border-bottom: 1px solid #333; width: 200px; height: 40px; margin-bottom: 5px;"></div>
            <p style="margin: 0; font-size: 10px; color: #666;">${locale === 'ar' ? 'التوقيع والتاريخ' : 'Signature & Date'}</p>
          </div>
          <div style="flex: 1; text-align: ${locale === 'ar' ? 'left' : 'right'};">
            <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">${locale === 'ar' ? 'تم الاستلام بواسطة' : 'Received By'}:</p>
            <div style="border-bottom: 1px solid #333; width: 200px; height: 40px; margin-bottom: 5px; margin-left: ${locale === 'ar' ? 'auto' : '0'}; margin-right: ${locale === 'ar' ? '0' : 'auto'};"></div>
            <p style="margin: 0; font-size: 10px; color: #666;">${locale === 'ar' ? 'التوقيع والتاريخ' : 'Signature & Date'}</p>
          </div>
        </div>
      `;

      // Ensure Lalezar font is loaded
      if (!document.querySelector('link[href*="Lalezar"]')) {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for font to load
      }
      
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);
      
      // Wait for fonts to be ready
      await document.fonts.ready;

      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false
      });

      // Remove temporary element
      document.body.removeChild(tempDiv);

      // Create PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF
      const filename = `item-${shortItemId}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(t('exportPDFError') || 'Error generating PDF. Please try again.');
    }
  };

  // Define tour steps
  const tourSteps: TourStep[] = [
    {
      id: 'welcome',
      title: t('tour.steps.welcome.title'),
      description: t('tour.steps.welcome.description'),
      position: 'center',
    },
    {
      id: 'itemInformation',
      target: '[data-tour="item-information"]',
      title: t('tour.steps.itemInformation.title'),
      description: t('tour.steps.itemInformation.description'),
      position: 'bottom',
    },
    {
      id: 'itemImages',
      target: '[data-tour="item-images"]',
      title: t('tour.steps.itemImages.title'),
      description: t('tour.steps.itemImages.description'),
      position: 'bottom',
    },
    {
      id: 'itemStatus',
      target: '[data-tour="item-status"]',
      title: t('tour.steps.itemStatus.title'),
      description: t('tour.steps.itemStatus.description'),
      position: 'left',
    },
    {
      id: 'claims',
      target: '[data-tour="claims-section"]',
      title: t('tour.steps.claims.title'),
      description: t('tour.steps.claims.description'),
      position: 'top',
    },
    {
      id: 'location',
      target: '[data-tour="location-section"]',
      title: t('tour.steps.location.title'),
      description: t('tour.steps.location.description'),
      position: 'left',
    },
    {
      id: 'requestTransfer',
      target: '[data-tour="request-transfer"]',
      title: t('tour.steps.requestTransfer.title'),
      description: t('tour.steps.requestTransfer.description'),
      position: 'left',
    },
  ];

  return (
    <ProtectedPage requiredPermission="can_manage_items">
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
            <div className="flex gap-3">
              <button
                onClick={exportItemToPDF}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium transition-colors hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {tAnalytics('exportPDF') || 'Export PDF'}
              </button>
              {showEditForm ? (
                canManageItems && (
                  <>
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
                  </>
                )
              ) : (
                canManageItems && (
                  <button
                    onClick={() => setShowEditForm(!showEditForm)}
                    className="px-4 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#3277AE' }}
                  >
                    {t('editItem')}
                  </button>
                )
              )}
            </div>
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
              <div className="bg-white rounded-lg shadow-sm p-6" data-tour="item-information">
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

                  {/* Internal Description - Only visible to users with can_manage_items permission */}
                  {canManageItems && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">{tEdit('internalDescription')}</label>
                      <p className={`text-base text-gray-900 whitespace-pre-wrap bg-blue-50 p-3 rounded-md border border-blue-200 ${!item.internal_description ? 'text-gray-400 italic' : ''}`}>
                        {item.internal_description || t('noDescription')}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{tEdit('internalDescriptionDisclaimer')}</p>
                    </div>
                  )}

                  {/* Approval Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('approvalStatus')}</label>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${item.status === ItemStatus.APPROVED ? 'bg-green-100 text-green-800' :
                          item.status === ItemStatus.CANCELLED ? 'bg-red-100 text-red-800' :
                            item.status === ItemStatus.DISPOSED ? 'bg-gray-100 text-gray-800' :
                              item.status === ItemStatus.PENDING ? 'bg-orange-100 text-orange-800' :
                                item.approval ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                      {item.status === ItemStatus.APPROVED ? t('approved') :
                            item.status === ItemStatus.CANCELLED ? t('cancelled') :
                              item.status === ItemStatus.DISPOSED ? t('status.disposed') || 'It was disposed of' :
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

                  {/* Disposal Note - Only show if item is disposed */}
                  {item.status === ItemStatus.DISPOSED && item.disposal_note && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">{t('disposalNote')}</label>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-base text-gray-900 whitespace-pre-wrap">{item.disposal_note}</p>
                      </div>
                    </div>
                  )}

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
                </div>
              </div>
            )}

            {/* Item Images Carousel */}
            {item.images && item.images.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6" data-tour="item-images">
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
            <div className="bg-white rounded-lg shadow-sm p-6" data-tour="claims-section">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('claims')}</h2>
              <Claims postId={resolvedParams.itemId} />
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Approval Status Card - Only show if user has can_manage_items permission */}
            {canManageItems && (
              <div className="bg-white rounded-lg shadow-sm p-6" data-tour="item-status">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">{t('itemStatus')}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.status === ItemStatus.APPROVED ? 'bg-green-100 text-green-800' :
                      item.status === ItemStatus.CANCELLED ? 'bg-red-100 text-red-800' :
                        item.status === ItemStatus.DISPOSED ? 'bg-gray-100 text-gray-800' :
                          item.status === ItemStatus.PENDING ? 'bg-orange-100 text-orange-800' :
                            item.approval ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                    {item.status === ItemStatus.APPROVED ? t('approved') :
                          item.status === ItemStatus.CANCELLED ? t('cancelled') :
                            item.status === ItemStatus.DISPOSED ? (t('status.disposed') || 'It was disposed of') :
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
                        { value: 'pending', label: t('status.pending') || 'Pending' },
                        { value: 'disposed', label: t('status.disposed') || 'It was disposed of' }
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
            )}
            
            {/* Status Display Only (for users without manage permission) */}
            {!canManageItems && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{t('itemStatus')}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.status === ItemStatus.APPROVED ? 'bg-green-100 text-green-800' :
                      item.status === ItemStatus.CANCELLED ? 'bg-red-100 text-red-800' :
                        item.status === ItemStatus.DISPOSED ? 'bg-gray-100 text-gray-800' :
                          item.status === ItemStatus.PENDING ? 'bg-orange-100 text-orange-800' :
                            item.approval ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                    {item.status === ItemStatus.APPROVED ? t('approved') :
                          item.status === ItemStatus.CANCELLED ? t('cancelled') :
                            item.status === ItemStatus.DISPOSED ? t('status.disposed') || 'It was disposed of' :
                              item.status === ItemStatus.PENDING ? (t('pending') || 'Pending') :
                                item.approval ? t('approved') : t('pending')}
                  </span>
                </div>
              </div>
            )}

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

            {/* Image Visibility Card - Only show if user has can_manage_items permission */}
            {canManageItems && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{tEdit('imageVisibility')}</h3>
                <div className="mb-2">
                  <HydrationSafeWrapper fallback={<div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse"></div>}>
                    <CustomDropdown
                      options={[
                        { value: 'show', label: tEdit('show') },
                        { value: 'hide', label: tEdit('hide') }
                      ]}
                      value={imageVisibility}
                      onChange={(value) => {
                        if (value !== imageVisibility) {
                          setPendingImageVisibility(value);
                          setShowImageVisibilityModal(true);
                        }
                      }}
                      placeholder={tEdit('imageVisibility')}
                      className="w-full"
                    />
                  </HydrationSafeWrapper>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {tEdit('hideNewImagesDescription')}
                </p>
              </div>
            )}

            {/* Location Card */}
            <div className="bg-white rounded-lg shadow-sm p-6" data-tour="location-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('location')}</h3>
                {canManageTransferRequests && (
                  <button
                    onClick={() => setShowTransferModal(true)}
                    data-tour="request-transfer"
                    className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
                    style={{ backgroundColor: '#3277AE', color: 'white' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    {t('requestTransfer')}
                  </button>
                )}
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

            {/* Delete Item Card - Only show if user has can_manage_items permission */}
            {canManageItems && (
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
            )}

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
                    <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto">
                      {claims.map((claim) => (
                        <label
                          key={claim.id}
                          className={`block border-2 rounded-lg cursor-pointer transition-all ${
                            selectedClaimId === claim.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="claim"
                                value={claim.id}
                                checked={selectedClaimId === claim.id}
                                onChange={(e) => setSelectedClaimId(e.target.value)}
                                className="mt-1 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                              
                              {/* Image Square */}
                              {claim.images && claim.images.length > 0 && (
                                <div className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                  <Image
                                    src={getImageUrl(claim.images[0].url)}
                                    alt={`Claim image`}
                                    fill
                                    className="object-cover"
                                    onError={() => {
                                      // Image will be hidden if it fails to load
                                    }}
                                    unoptimized={getImageUrl(claim.images[0].url).startsWith('http') || getImageUrl(claim.images[0].url).startsWith('data:')}
                                  />
                                </div>
                              )}
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 mb-1">
                                  {claim.title}
                                </div>
                                <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {claim.description}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                  {claim.item_type && (
                                    <span>
                                      {t('type') || 'Type'}: <span className="text-gray-900">{getLocalizedName(claim.item_type.name_ar, claim.item_type.name_en)}</span>
                                    </span>
                                  )}
                                  {claim.user_email && (
                                    <span>
                                      {t('email') || 'Email'}: <span className="text-gray-900">{claim.user_email}</span>
                                    </span>
                                  )}
                                  {claim.user_name && (
                                    <span>
                                      {t('claimer') || 'Claimer'}: <span className="text-gray-900">{claim.user_name}</span>
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.push(`/dashboard/claims/${claim.id}`);
                                  }}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  {t('viewDetails') || 'View Details'}
                                </button>
                              </div>
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
              <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}>
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

            {/* Image Visibility Change Confirmation Modal */}
            {showImageVisibilityModal && pendingImageVisibility && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">{tEdit('confirmImageVisibilityChange')}</h3>
                  </div>

                  <div className="mb-6">
                    <p className="text-gray-700 mb-3">
                      {tEdit('imageVisibilityChangeDescription')}
                    </p>
                    <div className={`border rounded-lg p-3 ${
                      pendingImageVisibility === 'hide' 
                        ? 'bg-orange-50 border-orange-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <p className={`text-sm font-medium mb-1 ${
                        pendingImageVisibility === 'hide' 
                          ? 'text-orange-800' 
                          : 'text-blue-800'
                      }`}>
                        {pendingImageVisibility === 'hide' ? tEdit('hide') : tEdit('show')}
                      </p>
                      <p className={`text-xs ${
                        pendingImageVisibility === 'hide' 
                          ? 'text-orange-700' 
                          : 'text-blue-700'
                      }`}>
                        {pendingImageVisibility === 'hide' 
                          ? tEdit('imageVisibilityHideDescription')
                          : tEdit('imageVisibilityShowDescription')
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowImageVisibilityModal(false);
                        setPendingImageVisibility(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      {tEdit('cancel')}
                    </button>
                    <button
                      onClick={async () => {
                        if (!item || !pendingImageVisibility) return;
                        
                        setIsUpdatingVisibility(true);
                        try {
                          const isHidden = pendingImageVisibility === 'hide';
                          const response = await fetch(`${API_BASE_URL}/api/items/${resolvedParams.itemId}/set-hidden/`, {
                            method: 'PATCH',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ is_hidden: isHidden }),
                          });
                          
                          if (response.ok) {
                            const updatedItem = await response.json();
                            setItem(updatedItem);
                            setImageVisibility(pendingImageVisibility);
                            setShowImageVisibilityModal(false);
                            setPendingImageVisibility(null);
                          } else {
                            const errorData = await response.json().catch(() => ({}));
                            alert(errorData.detail || tEdit('updateError') || 'Failed to update image visibility');
                          }
                        } catch (error) {
                          console.error('Error updating image visibility:', error);
                          alert(tEdit('updateError') || 'Failed to update image visibility');
                        } finally {
                          setIsUpdatingVisibility(false);
                        }
                      }}
                      disabled={isUpdatingVisibility}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isUpdatingVisibility ? (tEdit('updating') || 'Updating...') : tEdit('saveChanges')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Disposal Modal */}
            {showDisposeModal && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">{t('disposeItem')}</h3>
                    <button
                      onClick={() => {
                        // Clean up object URLs before closing
                        disposalImageUrls.forEach(url => URL.revokeObjectURL(url));
                        setShowDisposeModal(false);
                        setPendingStatusChange(null);
                        setDisposalNote('');
                        setDisposalImages([]);
                        setDisposalError(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {disposalError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{disposalError}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('disposalNote')} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={disposalNote}
                        onChange={(e) => {
                          setDisposalNote(e.target.value);
                          setDisposalError(null);
                        }}
                        placeholder={t('disposalNotePlaceholder') || 'Describe how the item was disposed...'}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none"
                        style={{
                          '--tw-ring-color': '#3277AE'
                        } as React.CSSProperties & { [key: string]: string }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#3277AE';
                          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(50, 119, 174, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">{t('howWasDisposed')}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('uploadDisposalImages')} {t('optional')}
                      </label>
                      <div className="relative">
                        <div 
                          className="border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 bg-gray-50 hover:bg-blue-50"
                          style={{ borderColor: '#3277AE' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#2a5f8f';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#3277AE';
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setDisposalImages(files);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            id="disposal-images-input"
                          />
                          <div className="flex flex-col items-center justify-center">
                            <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#3277AE' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-sm font-medium mb-1" style={{ color: '#3277AE' }}>
                              {t('uploadDisposalImages')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t('disposalImagesInfo')}
                            </p>
                          </div>
                        </div>
                      </div>
                      {disposalImages.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {disposalImages.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="relative group aspect-square">
                              <Image
                                src={disposalImageUrls[index]}
                                alt={file.name}
                                fill
                                className="object-cover rounded-lg border-2 border-gray-200"
                                unoptimized
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Revoke the object URL before removing
                                  URL.revokeObjectURL(disposalImageUrls[index]);
                                  const newImages = disposalImages.filter((_, i) => i !== index);
                                  setDisposalImages(newImages);
                                }}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg z-10"
                                aria-label="Remove image"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        // Clean up object URLs before closing
                        disposalImageUrls.forEach(url => URL.revokeObjectURL(url));
                        setShowDisposeModal(false);
                        setPendingStatusChange(null);
                        setDisposalNote('');
                        setDisposalImages([]);
                        setDisposalError(null);
                      }}
                      disabled={isDisposing}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleDisposeSubmit}
                      disabled={isDisposing || !disposalNote.trim()}
                      className="flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ 
                        backgroundColor: isDisposing || !disposalNote.trim() ? undefined : '#3277AE'
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisposing && disposalNote.trim()) {
                          e.currentTarget.style.backgroundColor = '#2a5f8f';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisposing && disposalNote.trim()) {
                          e.currentTarget.style.backgroundColor = '#3277AE';
                        }
                      }}
                    >
                      {isDisposing ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('disposing')}
                        </>
                      ) : (
                        t('disposeItem')
                      )}
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

      {/* Floating Action Button for Tour */}
      <button
        onClick={() => setIsTourOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 p-3 sm:p-4 rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 hover:shadow-xl active:scale-95"
        style={{ 
          backgroundColor: '#3277AE',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2a5f94';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#3277AE';
        }}
        aria-label={t('tour.helpGuide') || 'Start Tour'}
        title={t('tour.helpGuide') || 'Start Tour'}
      >
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </button>

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={tourSteps}
        translationKey="dashboard.items.detail.tour"
      />
    </div>
    </ProtectedPage>
  );
}
