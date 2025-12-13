"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { tokenManager } from '@/utils/tokenManager';
import { formatDate, formatDateOnly } from '@/utils/dateFormatter';
import { ArrowLeft, Edit2, Save, X, Upload, Trash2, Mail, MapPin } from 'lucide-react';
import ImageCarousel, { CarouselImage } from '@/components/ImageCarousel';
import imageUploadService from '@/services/imageUploadService';

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
  approval: boolean;
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

export default function ClaimDetails({ params }: { params: Promise<{ claimId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations('dashboard.claims');
  const locale = useLocale();
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [deletingImages, setDeletingImages] = useState<string[]>([]);

  // Helper to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  useEffect(() => {
    fetchClaimDetails();
  }, [resolvedParams.claimId]);

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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

  const canEdit = claim.can_edit && !claim.approval;
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
                {canEdit && (
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {claim.images.map((img) => (
                    <div key={img.id} className="relative group">
                      <div className="relative h-48 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={getImageUrl(img.url)}
                          alt={`Claim image ${img.id}`}
                          fill
                          className="object-cover"
                        />
                        {canEdit && (
                          <button
                            onClick={() => handleImageDelete(img.id)}
                            disabled={deletingImages.includes(img.id)}
                            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                            title={t('deleteImage') || 'Delete Image'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {deletingImages.includes(img.id) && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">{t('noImages') || 'No images uploaded yet'}</p>
                </div>
              )}

              {carouselImages.length > 0 && (
                <div className="mt-6">
                  <ImageCarousel images={carouselImages} />
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
                    claim.approval ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {claim.approval ? t('approved') : t('pending')}
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
                      className="text-sm text-blue-600 hover:text-blue-700"
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
          </div>
        </div>
      </div>
    </div>
  );
}

