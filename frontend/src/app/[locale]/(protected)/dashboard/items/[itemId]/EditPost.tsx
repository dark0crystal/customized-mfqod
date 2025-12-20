'use client';

import { useRouter } from '@/i18n/navigation';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { tokenManager } from '@/utils/tokenManager';
import LocationTracking from '@/components/LocationTracking';
import { useTranslations, useLocale } from 'next-intl';
import CompressorFileInput from '@/components/forms/CompressorFileInput';
import imageUploadService, { UploadProgress, UploadError } from '@/services/imageUploadService';
import { X } from 'lucide-react';

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

interface LocationData {
  organization_name?: string;
  branch_name?: string;
  full_location?: string;
}

interface ItemFormFields {
  title: string;
  description: string;
  location: string;
  organization_id: string;
  branch_id: string;
  approval: boolean;
  temporary_deletion: boolean;
}

interface Organization {
  id: string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  description?: string;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  description_ar?: string;
  description_en?: string;
  longitude?: number;
  latitude?: number;
  organization_id: string;
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  content: string;
  type: string;
  location?: LocationData;
  status?: string;
  approval?: boolean; // DEPRECATED: kept for backward compatibility
  approved_claim_id?: string | null; // ID of the approved claim
  temporary_deletion?: boolean;
  is_hidden?: boolean;
  uploadedPostPhotos?: { postUrl: string }[];
  images?: Array<{
    id: string;
    url: string;
    description?: string;
  }>;
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
}


interface EditPostProps {
  params: { itemId: string };
  onSave?: () => void;
  onCancel?: () => void;
}

export default function EditPost({ params, onSave }: EditPostProps) {
  const router = useRouter();
  const t = useTranslations('editPost');
  const locale = useLocale();

  // Helper function to get localized name
  const getLocalizedName = useCallback((nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  }, [locale]);

  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [originalLocation, setOriginalLocation] = useState<string>('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ItemFormFields>();
  const formRef = useRef<HTMLFormElement>(null);
  
  // Handle save button click from parent
  useEffect(() => {
    const handleSaveClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (formRef.current) {
        // Find the hidden submit button and click it
        const submitButton = formRef.current.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (submitButton) {
          submitButton.click();
        }
      }
    };
    
    const saveButton = document.getElementById('save-changes-button');
    if (saveButton) {
      saveButton.addEventListener('click', handleSaveClick);
      return () => {
        saveButton.removeEventListener('click', handleSaveClick);
      };
    }
  }, []);

  const watchedOrganization = watch('organization_id');

  const fetchOrganizations = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      } else {
        console.error('Failed to fetch organizations:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const fetchBranches = useCallback(async (organizationId: string, preserveBranchId = false) => {
    setLoadingBranches(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations/${organizationId}/branches`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
        if (!preserveBranchId) {
          setValue('branch_id', ''); // Reset branch when org changes
        }
      } else {
        console.error('Failed to fetch branches:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoadingBranches(false);
    }
  }, [setValue]);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/items/${params.itemId}`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          
          // Fetch images separately
          try {
            const imagesResponse = await fetch(`${API_BASE_URL}/api/images/items/${params.itemId}/images/`, {
              headers: getAuthHeaders(),
            });
            if (imagesResponse.ok) {
              const imagesData = await imagesResponse.json();
              data.images = imagesData;
            }
          } catch (error) {
            console.error('Error fetching images:', error);
          }
          
          setItem(data);
          setOriginalLocation(data.location?.full_location || '');

          // Set form values
          setValue('title', data.title);
          setValue('description', data.description || data.content || '');
          setValue('location', data.location?.full_location || '');
          setValue('approval', data.approval ?? true); // Keep for form compatibility
          setValue('temporary_deletion', data.temporary_deletion ?? false);

          // Set organization and branch IDs if available from addresses
          if (data.addresses && data.addresses.length > 0) {
            const currentAddress = data.addresses.find((addr: { is_current: boolean }) => addr.is_current) || data.addresses[0];
            if (currentAddress?.branch) {
              const branchId = currentAddress.branch.id ?? '';
              const orgId = currentAddress.branch.organization?.id ?? '';

              if (orgId) {
                setValue('organization_id', orgId);
                // Fetch branches for this organization and preserve branch_id
                await fetchBranches(orgId, true);
                // Set branch_id after branches are loaded
                if (branchId) {
                  setValue('branch_id', branchId);
                }
              } else if (branchId) {
                setValue('branch_id', branchId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
    fetchOrganizations();
  }, [params.itemId, setValue, fetchOrganizations, fetchBranches]);

  useEffect(() => {
    if (watchedOrganization) {
      fetchBranches(watchedOrganization);
    } else {
      setBranches([]);
      setValue('branch_id', '');
    }
  }, [watchedOrganization, fetchBranches, setValue]);

  const handleDeleteImage = async (imageId: string) => {
    if (confirm(t('confirmDeleteImage') || 'Are you sure you want to delete this image?')) {
      setDeletingImages(prev => new Set(prev).add(imageId));
      try {
        await imageUploadService.deleteImage(imageId);
        // Remove image from local state
        setItem(prev => prev ? {
          ...prev,
          images: prev.images?.filter(img => img.id !== imageId) || []
        } : null);
        // Refresh item data to ensure consistency
        const itemResponse = await fetch(`${API_BASE_URL}/api/items/${params.itemId}`, {
          headers: getAuthHeaders(),
        });
        if (itemResponse.ok) {
          const updatedItem = await itemResponse.json();
          try {
            const imagesResponse = await fetch(`${API_BASE_URL}/api/images/items/${params.itemId}/images/`, {
              headers: getAuthHeaders(),
            });
            if (imagesResponse.ok) {
              const imagesData = await imagesResponse.json();
              updatedItem.images = imagesData;
            }
          } catch (error) {
            console.error('Error fetching images:', error);
          }
          setItem(updatedItem);
        }
      } catch (error) {
        console.error('Error deleting image:', error);
        alert(t('deleteImageError') || 'Failed to delete image. Please try again.');
      } finally {
        setDeletingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(imageId);
          return newSet;
        });
      }
    }
  };

  const onSubmit: SubmitHandler<ItemFormFields> = async (data) => {
    setSubmitting(true);
    setUploadErrors([]);

    try {
      const locationChanged = data.location !== originalLocation;

      const updateData: {
        title: string;
        description: string;
        locationChanged: boolean;
        originalLocation?: string;
        organization_id: string;
        branch_id: string;
        location: string;
        is_hidden?: boolean;
      } = {
        title: data.title,
        description: data.description,
        locationChanged,
        originalLocation: locationChanged ? originalLocation : undefined,
        organization_id: data.organization_id,
        branch_id: data.branch_id,
        location: data.location,
        is_hidden: item?.is_hidden,
      };

      // Update item details
      const response = await fetch(`${API_BASE_URL}/api/items/${params.itemId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Upload new images if any
        if (newImages.length > 0) {
          setUploadingImages(true);
          setUploadProgress({ loaded: 0, total: 0, percentage: 0 });

          try {
            await imageUploadService.uploadMultipleImages(
              'item',
              params.itemId,
              newImages,
              (progress) => {
                setUploadProgress(progress);
              }
            );

            // Refresh item data to show new images
            const itemResponse = await fetch(`${API_BASE_URL}/api/items/${params.itemId}`, {
              headers: getAuthHeaders(),
            });
            if (itemResponse.ok) {
              const updatedItem = await itemResponse.json();
              // Fetch images separately
              try {
                const imagesResponse = await fetch(`${API_BASE_URL}/api/images/items/${params.itemId}/images/`, {
                  headers: getAuthHeaders(),
                });
                if (imagesResponse.ok) {
                  const imagesData = await imagesResponse.json();
                  updatedItem.images = imagesData;
                }
              } catch (error) {
                console.error('Error fetching images:', error);
              }
              setItem(updatedItem);
            }

            setNewImages([]);
            setUploadProgress(null);
          } catch (uploadError: unknown) {
            console.error('Error uploading images:', uploadError);
            const error = uploadError as UploadError;
            setUploadErrors([{
              error: error.error || 'UPLOAD_ERROR',
              message: error.message || 'Failed to upload images',
              details: error.details
            }]);
          } finally {
            setUploadingImages(false);
          }
        }

        // Only redirect if no images were uploaded or upload was successful
        if (newImages.length === 0 || uploadErrors.length === 0) {
          if (onSave) {
            // Call onSave callback and reload page to show updated data
            onSave();
            // Small delay to ensure state updates
            setTimeout(() => {
              window.location.reload();
            }, 100);
          } else {
            router.push('/dashboard/items');
          }
        }
      } else {
        console.error('Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <div className="text-lg font-medium text-gray-700">{t('loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-lg font-medium text-gray-700">{t('itemNotFound')}</div>
            <button
              onClick={() => router.push('/dashboard/items')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('backToItems')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-10">

        {/* --- Basic Information --- */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">{t('title') || 'Basic Information'}</h2>
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                {t('titleLabel')}
              </label>
              <input
                type="text"
                id="title"
                {...register('title', { required: t('titleRequired') })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border"
                placeholder={t('titlePlaceholder')}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                {t('descriptionLabel')}
              </label>
              <textarea
                id="description"
                rows={4}
                {...register('description', { required: t('descriptionRequired') })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border"
                placeholder={t('descriptionPlaceholder')}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* --- Location & Assignment --- */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">{t('locationLabel') || 'Location & Assignment'}</h2>
          <div className="space-y-6">

            {/* Location (Read-only) */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                {t('locationLabel')}
              </label>
              <input
                type="text"
                id="location"
                {...register('location', { required: t('locationRequired') })}
                disabled
                className="w-full rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-500 sm:text-sm p-2.5 border cursor-not-allowed"
                placeholder={t('locationPlaceholder')}
              />
              {errors.location && (
                <p className="mt-1 text-xs text-red-500">{errors.location.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization */}
              <div>
                <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('organizationLabel')}
                </label>
                <select
                  id="organization_id"
                  {...register('organization_id')}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border bg-white"
                >
                  <option value="">
                    {loadingOrgs ? t('loadingOrganizations') : t('selectOrganization')}
                  </option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {getLocalizedName(org.name_ar, org.name_en) || org.name || 'Unnamed Organization'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div>
                <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('branchLabel')}
                </label>
                <select
                  id="branch_id"
                  {...register('branch_id')}
                  disabled={!watchedOrganization || branches.length === 0}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">
                    {!watchedOrganization ? t('selectOrganizationFirst') :
                      loadingBranches ? t('loadingBranches') :
                        branches.length === 0 ? t('noBranchesAvailable') :
                          t('selectBranch')}
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || 'Unnamed Branch'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* --- Images --- */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">{t('itemImages') || 'Images'}</h2>

          {/* Existing Images */}
          {item.images && item.images.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-700 mb-3">{t('existingImages') || 'Existing Images'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {item.images.map((image) => (
                  <div key={image.id} className="relative border border-gray-200 rounded-lg overflow-hidden group">
                    <img
                      src={`${API_BASE_URL}${image.url}`}
                      alt={image.description || 'Item image'}
                      className="w-full h-32 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      disabled={deletingImages.has(image.id)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-90 hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                      title={t('deleteImage') || 'Delete image'}
                      aria-label={t('deleteImage') || 'Delete image'}
                    >
                      {deletingImages.has(image.id) ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CompressorFileInput
            onFilesSelected={setNewImages}
            showValidation={true}
            maxFiles={10}
            showOptimizationSettings={false}
            compressionQuality={0.7}
            maxWidth={1200}
            maxHeight={1200}
          />

          {/* Upload Progress */}
          {uploadProgress && uploadingImages && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-900">{t('uploadingImages') || 'Uploading images...'}</span>
                <span className="text-sm text-blue-700">{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                ></div>
              </div>
              {uploadProgress.total > 0 && (
                <div className="text-xs text-blue-600 mt-1">
                  {Math.round(uploadProgress.loaded / 1024)} KB / {Math.round(uploadProgress.total / 1024)} KB
                </div>
              )}
            </div>
          )}

          {/* Upload Errors */}
          {uploadErrors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800 font-medium mb-2">{t('someImagesFailed') || 'Some images failed to upload'}</div>
              {uploadErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 mb-1">
                  <span className="font-medium">{error.error}:</span> {error.message}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --- Location History --- */}
        {item.addresses && item.addresses.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">{t('locationHistory') || 'Location History'}</h2>
            <LocationTracking addresses={item.addresses} />
          </section>
        )}

        {/* Hidden submit button for parent to trigger */}
        <button
          type="submit"
          disabled={submitting}
          className="hidden"
          aria-hidden="true"
        >
          {t('updateItem') || 'Save Changes'}
        </button>

      </form>
    </div>
  );
}