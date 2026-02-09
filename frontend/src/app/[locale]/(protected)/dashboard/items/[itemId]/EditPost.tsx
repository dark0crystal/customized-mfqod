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
import CustomDropdown from '@/components/ui/CustomDropdown';
import { usePermissions } from '@/PermissionsContext';
import Image from 'next/image';

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
  organization_name_ar?: string;
  organization_name_en?: string;
  branch_name?: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  full_location?: string;
}

interface ItemFormFields {
  title: string;
  description: string;
  internal_description?: string;
  location: string;
  item_type_id: string;
  approval: boolean;
  temporary_deletion: boolean;
}

interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  internal_description?: string;  // Internal description visible only to authorized users
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
  item_type?: {
    id: string;
    name_ar?: string;
    name_en?: string;
  };
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
  const { hasPermission } = usePermissions();
  const canManageItems = hasPermission('can_manage_items');

  // Helper function to get localized name
  const getLocalizedName = useCallback((nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  }, [locale]);

  // Helper function to build localized location string
  const getLocalizedLocation = useCallback((location?: LocationData): string => {
    if (!location) return '';
    
    // Build location from organization and branch names based on locale
    const orgName = locale === 'ar' 
      ? (location.organization_name_ar || location.organization_name)
      : (location.organization_name_en || location.organization_name);
    
    const branchName = locale === 'ar'
      ? (location.branch_name_ar || location.branch_name)
      : (location.branch_name_en || location.branch_name);
    
    // Build full location string
    if (branchName && orgName) {
      return `${branchName}, ${orgName}`;
    } else if (branchName) {
      return branchName;
    } else if (orgName) {
      return orgName;
    }
    
    // Fallback to full_location if available
    return location.full_location || '';
  }, [locale]);

  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

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


  // Fetch item types
  useEffect(() => {
    const fetchItemTypes = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/item-types/`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setItemTypes(data);
        }
      } catch (error) {
        console.error('Error fetching item types:', error);
      }
    };

    fetchItemTypes();
  }, []);

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

          // Set form values
          setValue('title', data.title);
          setValue('description', data.description || data.content || '');
          setValue('internal_description', data.internal_description || '');
          // Set location with localized version
          const localizedLocation = getLocalizedLocation(data.location);
          setValue('location', localizedLocation);
          // Set item type if available
          if (data.item_type?.id) {
            setValue('item_type_id', data.item_type.id);
          }
          setValue('approval', data.approval ?? true); // Keep for form compatibility
          setValue('temporary_deletion', data.temporary_deletion ?? false);
        }
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [params.itemId, setValue, getLocalizedLocation]);

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
      const updateData: {
        title: string;
        description: string;
        internal_description?: string;
        location: string;
        item_type_id?: string;
        is_hidden?: boolean;
      } = {
        title: data.title,
        description: data.description,
        location: data.location,
        is_hidden: item?.is_hidden,
      };

      // Add internal_description if user has permission
      if (canManageItems && data.internal_description !== undefined) {
        updateData.internal_description = data.internal_description;
      }

      // Add item_type_id if provided
      if (data.item_type_id) {
        updateData.item_type_id = data.item_type_id;
      }

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

            {/* Internal Description - Only visible to users with can_manage_items permission */}
            {canManageItems && (
              <div>
                <label htmlFor="internal_description" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('internalDescription')}
                </label>
                <textarea
                  id="internal_description"
                  rows={4}
                  {...register('internal_description')}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 border"
                  placeholder={t('placeholderInternalDescription')}
                />
                <p className="mt-1 text-xs text-gray-500">{t('internalDescriptionDisclaimer')}</p>
              </div>
            )}

            {/* Item Type */}
            <div>
              <label htmlFor="item_type_id" className="block text-sm font-medium text-gray-700 mb-1">
                {t('itemTypeLabel') || 'Item Type'}
              </label>
              <input
                type="hidden"
                {...register('item_type_id')}
              />
              <CustomDropdown
                options={itemTypes.map(type => ({
                  value: type.id,
                  label: getLocalizedName(type.name_ar, type.name_en) || 'Unnamed'
                }))}
                value={watch('item_type_id') || ''}
                onChange={(value) => setValue('item_type_id', value, { shouldValidate: true })}
                placeholder={t('selectItemType') || 'Select Item Type'}
                variant="default"
              />
              {errors.item_type_id && (
                <p className="mt-1 text-xs text-red-500">{errors.item_type_id.message}</p>
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
                  <div key={image.id} className="relative border border-gray-200 rounded-lg overflow-hidden group h-32">
                    <Image
                      src={`${API_BASE_URL}${image.url}`}
                      alt={image.description || 'Item image'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                      unoptimized
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