"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { tokenManager } from '@/utils/tokenManager';
import { formatDate, formatDateOnly } from '@/utils/dateFormatter';
import { ArrowLeft, Edit2, Save, X, Upload, Trash2, Mail, MapPin, Send } from 'lucide-react';
import ImageCarousel, { CarouselImage } from '@/components/ImageCarousel';
import imageUploadService from '@/services/imageUploadService';
import { usePermissions } from '@/PermissionsContext';

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

interface ClaimData {
  id: string;
  title: string;
  description: string;
  approval: boolean
  user_id?: string;
  item_id?: string;
  created_at: string;
  updated_at: string;
  is_assigned?: boolean;
  user_name?: string;
  user_email?: string;
  item_title?: string;
  item_description?: string;
  item_status?: string;
  item_branches?: Array<{
    id: string;
    name_ar?: string;
    name_en?: string;
  }>;
  images?: Array<{
    id: string;
    url: string;
  }>;
  can_edit?: boolean;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  organization?: {
    id: string;
    name_ar?: string;
    name_en?: string;
  };
}

export default function ClaimDetails({ params }: { params: Promise<{ claimId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations('dashboard.claims');
  const locale = useLocale();
  const { hasPermission } = usePermissions();
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [deletingImages, setDeletingImages] = useState<string[]>([]);
  
  // Email notification state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [emailNote, setEmailNote] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // Check if user has permission to send emails
  const canSendEmail = hasPermission('can_process_claims');

  // Helper to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  useEffect(() => {
    fetchClaimDetails();
    if (canSendEmail) {
      fetchBranches();
    }
  }, [resolvedParams.claimId, canSendEmail]);

  const fetchClaimDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${resolvedParams.claimId}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('claimNotFound') || 'Claim not found');
        } else if (response.status === 403) {
          throw new Error(t('accessDenied') || 'Access denied');
        }
        throw new Error(t('errorFetchingClaim') || 'Failed to fetch claim details');
      }

      const data = await response.json();
      setClaim(data);
      setEditedTitle(data.title);
      setEditedDescription(data.description);
    } catch (err) {
      console.error('Error fetching claim:', err);
      setError(err instanceof Error ? err.message : 'Error fetching claim details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!claim) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${resolvedParams.claimId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: editedTitle,
          description: editedDescription
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || t('errorUpdatingClaim') || 'Failed to update claim');
      }

      const updatedClaim = await response.json();
      setClaim({ ...claim, ...updatedClaim });
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating claim:', err);
      alert(err instanceof Error ? err.message : t('errorUpdatingClaim') || 'Failed to update claim');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (claim) {
      setEditedTitle(claim.title);
      setEditedDescription(claim.description);
    }
    setIsEditing(false);
  };

  const handleImageUpload = async (file: File) => {
    if (!claim) return;

    const imageId = `uploading-${Date.now()}`;
    setUploadingImages(prev => [...prev, imageId]);

    try {
      await imageUploadService.uploadImage(file, 'claim', resolvedParams.claimId);

      // Refresh claim data to get updated images
      await fetchClaimDetails();
    } catch (err) {
      console.error('Error uploading image:', err);
      alert(t('errorUploadingImage') || 'Failed to upload image');
    } finally {
      setUploadingImages(prev => prev.filter(id => id !== imageId));
    }
  };

  const handleImageDelete = async (imageId: string) => {
    if (!claim) return;
    if (!confirm(t('confirmDeleteImage') || 'Are you sure you want to delete this image?')) return;

    setDeletingImages(prev => [...prev, imageId]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${resolvedParams.claimId}/images/${imageId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Refresh claim data
      await fetchClaimDetails();
    } catch (err) {
      console.error('Error deleting image:', err);
      alert(t('errorDeletingImage') || 'Failed to delete image');
    } finally {
      setDeletingImages(prev => prev.filter(id => id !== imageId));
    }
  };

  const fetchBranches = async () => {
    setLoadingBranches(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/branches/public/?skip=0&limit=1000`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();
      setBranches(data);
    } catch (err) {
      console.error('Error fetching branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSendEmail = async () => {
    if (!claim) return;

    setSendingEmail(true);
    setEmailError(null);
    setEmailSent(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${resolvedParams.claimId}/send-visit-notification`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          branch_id: selectedBranchId || null,
          note: emailNote || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || t('emailSendError') || 'Failed to send email');
      }

      const result = await response.json();
      setEmailSent(true);
      setEmailNote('');
      setSelectedBranchId('');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setEmailSent(false);
      }, 5000);
    } catch (err) {
      console.error('Error sending email:', err);
      setEmailError(err instanceof Error ? err.message : t('emailSendError') || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#3277AE' }}></div>
          <p className="text-gray-500">{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/claims')}
            className="px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: '#3277AE' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {t('backToClaims') || 'Back to Claims'}
          </button>
        </div>
      </div>
    );
  }

  if (!claim) {
    return null;
  }

  const isApproved = claim.approval;
  const canEdit = claim.can_edit && !isApproved;
  const carouselImages: CarouselImage[] = (claim.images || []).map(img => ({
    id: img.id,
    url: getImageUrl(img.url),
    alt: `Claim image ${img.id}`
  }));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/dashboard/claims" className="hover:text-gray-900">
              {t('title') || 'Claims'}
            </Link>
            <span>/</span>
            <span className="text-gray-900">{t('claimDetails') || 'Claim Details'}</span>
          </nav>
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard/claims')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('backToClaims') || 'Back to Claims'}</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Claim Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2 mb-2"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{claim.title}</h1>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      claim.approval
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {claim.approval
                        ? t('approved') 
                        : t('pending')}
                    </span>
                    {claim.is_assigned && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {t('assigned') || 'Assigned'}
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                    title={t('edit') || 'Edit'}
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Description */}
              <div className="mb-4">
                {isEditing ? (
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="w-full min-h-[150px] border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
                    placeholder={t('description') || 'Description'}
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{claim.description}</p>
                )}
              </div>

              {/* Edit Actions */}
              {isEditing && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-white rounded-lg disabled:bg-gray-300 flex items-center gap-2"
                    style={{ backgroundColor: '#3277AE', ...(isSaving ? {} : {}) }}
                    onMouseEnter={(e) => { if (!isSaving) e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { if (!isSaving) e.currentTarget.style.opacity = '1'; }}
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {t('cancel') || 'Cancel'}
                  </button>
                </div>
              )}
            </div>

            {/* Images Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('supportingImages') || 'Supporting Images'}
                </h2>
                {canEdit && isEditing && (
                  <label className="px-4 py-2 text-white rounded-lg cursor-pointer flex items-center gap-2" style={{ backgroundColor: '#3277AE' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('uploadImage') || 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                          e.target.value = ''; // Reset input
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {uploadingImages.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    {t('uploading') || 'Uploading...'} {uploadingImages.length} {t('image') || 'image(s)'}
                  </p>
                </div>
              )}

              {claim.images && claim.images.length > 0 ? (
                <div className="mt-6">
                  <ImageCarousel images={carouselImages} />
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">{t('noImages') || 'No images uploaded yet'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Claim Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('claimInformation') || 'Claim Information'}</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t('created') || 'Created'}</p>
                  <p className="text-sm font-medium text-gray-900">{formatDateOnly(claim.created_at)}</p>
                </div>
                {claim.updated_at !== claim.created_at && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{t('updated') || 'Updated'}</p>
                    <p className="text-sm font-medium text-gray-900">{formatDateOnly(claim.updated_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t('status') || 'Status'}</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      claim.approval
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {claim.approval
                        ? t('approved') 
                        : t('pending')}
                    </span>
                </div>
                {claim.item_status && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{t('itemStatus') || 'Item Status'}</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      claim.item_status === 'approved' 
                        ? 'bg-green-100 text-green-800' 
                        : claim.item_status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {claim.item_status === 'approved' ? (t('approved') || 'Approved') :
                       claim.item_status === 'cancelled' ? (t('cancelled') || 'Cancelled') :
                       (t('pending') || 'Pending')}
                    </span>
                  </div>
                )}
                
                {/* Images Grid - Only shown in edit mode */}
                {isEditing && canEdit && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-3">{t('supportingImages') || 'Supporting Images'}</p>
                    {claim.images && claim.images.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {claim.images.map((img) => (
                          <div key={img.id} className="relative group">
                            <div className="relative h-20 rounded-lg overflow-hidden bg-gray-100">
                              <Image
                                src={getImageUrl(img.url)}
                                alt={`Claim image ${img.id}`}
                                fill
                                className="object-cover"
                              />
                              <button
                                onClick={() => handleImageDelete(img.id)}
                                disabled={deletingImages.includes(img.id)}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                                title={t('deleteImage') || 'Delete Image'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              {deletingImages.includes(img.id) && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p className="text-xs text-gray-500">{t('noImages') || 'No images uploaded yet'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Claimer Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('claimer') || 'Claimer'}</h3>
              <div className="space-y-2">
                {claim.user_name && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{claim.user_name}</p>
                  </div>
                )}
                {claim.user_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{claim.user_email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Item Information */}
            {claim.item_title && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('item') || 'Item'}</h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">{claim.item_title}</p>
                  {claim.item_description && (
                    <p className="text-sm text-gray-600 line-clamp-3">{claim.item_description}</p>
                  )}
                  {claim.item_id && (
                    <Link
                      href={`/dashboard/items/${claim.item_id}`}
                      className="text-sm hover:opacity-80 transition-opacity"
                      style={{ color: '#3277AE' }}
                    >
                      {t('viewItem') || 'View Item'} →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Branch Information */}
            {claim.item_branches && claim.item_branches.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('branch') || 'Branch'}</h3>
                <div className="space-y-2">
                  {claim.item_branches.map((branch) => (
                    <div key={branch.id} className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-900">
                        {getLocalizedName(branch.name_ar, branch.name_en)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send Visit Notification Section */}
            {canSendEmail && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('sendVisitNotification') || 'Send Visit Notification'}
                </h3>
                
                <div className="space-y-4">
                  {/* Branch Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('selectBranch') || 'Select Branch/Office'}
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      disabled={loadingBranches || sendingEmail}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      style={{ 
                        '--tw-ring-color': '#3277AE',
                      } as React.CSSProperties & { '--tw-ring-color': string }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3277AE';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(50, 119, 174, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = '';
                      }}
                    >
                      <option value="">{t('generalOffice') || 'General Office'}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {getLocalizedName(branch.branch_name_ar, branch.branch_name_en)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Note Textarea */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('addNote') || 'Add Note (Optional)'}
                    </label>
                    <textarea
                      value={emailNote}
                      onChange={(e) => setEmailNote(e.target.value)}
                      disabled={sendingEmail}
                      rows={4}
                      maxLength={1000}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                      style={{ 
                        '--tw-ring-color': '#3277AE',
                      } as React.CSSProperties & { '--tw-ring-color': string }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3277AE';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(50, 119, 174, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = '';
                      }}
                      placeholder={t('addNotePlaceholder') || 'Enter additional notes for the user...'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {emailNote.length}/1000 {t('characters') || 'characters'}
                    </p>
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !claim.user_email}
                    className="w-full px-4 py-2 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#3277AE' }}
                    onMouseEnter={(e) => { 
                      if (!sendingEmail && claim.user_email) {
                        e.currentTarget.style.opacity = '0.9';
                      }
                    }}
                    onMouseLeave={(e) => { 
                      if (!sendingEmail && claim.user_email) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                  >
                    {sendingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{t('sendingEmail') || 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{t('sendEmail') || 'Send Email'}</span>
                      </>
                    )}
                  </button>

                  {!claim.user_email && (
                    <p className="text-xs text-red-600">
                      {t('noUserEmail') || 'User email not available'}
                    </p>
                  )}

                  {/* Success Message */}
                  {emailSent && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        {t('emailSentSuccess') || 'Email sent successfully'}
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {emailError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{emailError}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

