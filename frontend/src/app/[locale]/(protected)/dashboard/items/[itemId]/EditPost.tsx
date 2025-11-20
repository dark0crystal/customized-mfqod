'use client';

import { useRouter } from '@/i18n/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import Image from 'next/image';
import { tokenManager } from '@/utils/tokenManager';
import LocationTracking from '@/components/LocationTracking';
import CustomDropdown from '@/components/ui/CustomDropdown';
import HydrationSafeWrapper from '@/components/HydrationSafeWrapper';
import { useTranslations, useLocale } from 'next-intl';

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
  name: string;
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
  uploadedPostPhotos?: { postUrl: string }[];
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
}

export default function EditPost({ params }: EditPostProps) {
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
  const [approvalStatus, setApprovalStatus] = useState<string>('true');
  const [deletionStatus, setDeletionStatus] = useState<string>('false');

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ItemFormFields>();

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

  const fetchBranches = useCallback(async (organizationId: string) => {
    setLoadingBranches(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations/${organizationId}/branches`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
        setValue('branch_id', ''); // Reset branch when org changes
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
          setItem(data);
          setOriginalLocation(data.location?.full_location || '');

          // Set form values
          setValue('title', data.title);
          setValue('description', data.description || data.content || '');
          setValue('location', data.location?.full_location || '');
          setValue('approval', data.approval ?? true);
          setValue('temporary_deletion', data.temporary_deletion ?? false);
          setApprovalStatus(data.approval ? 'true' : 'false');
          setDeletionStatus(data.temporary_deletion ? 'true' : 'false');

          // Set organization and branch IDs if available from addresses
          if (data.addresses && data.addresses.length > 0) {
            const currentAddress = data.addresses.find((addr: { is_current: boolean }) => addr.is_current) || data.addresses[0];
            if (currentAddress?.branch) {
              setValue('branch_id', currentAddress.branch.id ?? '');
              if (currentAddress.branch.organization) {
                setValue('organization_id', currentAddress.branch.organization.id ?? '');
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
  }, [params.itemId, setValue, fetchOrganizations]);

  useEffect(() => {
    if (watchedOrganization) {
      fetchBranches(watchedOrganization);
    } else {
      setBranches([]);
      setValue('branch_id', '');
    }
  }, [watchedOrganization, fetchBranches, setValue]);

  const onSubmit: SubmitHandler<ItemFormFields> = async (data) => {
    setSubmitting(true);

    try {
      const locationChanged = data.location !== originalLocation;

      const updateData = {
        title: data.title,
        description: data.description,
        locationChanged,
        originalLocation: locationChanged ? originalLocation : undefined,
        organization_id: data.organization_id,
        branch_id: data.branch_id,
        location: data.location,
        approval: approvalStatus === 'true',
        temporary_deletion: deletionStatus === 'true',
      };

      const response = await fetch(`${API_BASE_URL}/api/items/${params.itemId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        router.push('/dashboard/items');
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
    <div className="p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
        {t('title')}
      </h2>

          {/* Images Section */}
          {item.uploadedPostPhotos && item.uploadedPostPhotos.length > 0 && (
            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                {t('currentImages')} ({item.uploadedPostPhotos.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {item.uploadedPostPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <div className="relative h-32 sm:h-28 lg:h-32 rounded-lg overflow-hidden">
                      <Image
                        src={photo.postUrl}
                        alt={`Item image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location History Section */}
          {item.addresses && item.addresses.length > 0 && (
            <div className="mb-6">
              <LocationTracking addresses={item.addresses} />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">
                {t('titleLabel')} *
              </label>
              <input
                type="text"
                id="title"
                {...register('title', { required: t('titleRequired') })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('titlePlaceholder')}
              />
              {errors.title && (
                <p className="mt-2 text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-lg font-semibold text-gray-700 mb-2">
                {t('descriptionLabel')} *
              </label>
              <textarea
                id="description"
                rows={4}
                {...register('description', { required: t('descriptionRequired') })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('descriptionPlaceholder')}
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>

            {/* Approval Status */}
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                {t('approvalStatus')}
              </label>
              <div className="relative">
                <HydrationSafeWrapper fallback={<div className="w-full h-12 bg-gray-100 rounded-lg animate-pulse"></div>}>
                  <CustomDropdown
                    options={[
                      { value: 'true', label: t('approved') },
                      { value: 'false', label: t('pending') }
                    ]}
                    value={approvalStatus}
                    onChange={setApprovalStatus}
                    placeholder={t('selectApprovalStatus')}
                    className="w-full"
                  />
                </HydrationSafeWrapper>
              </div>
            </div>

            {/* Temporary Deletion */}
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                {t('deletionStatus')}
              </label>
              <div className="relative">
                <HydrationSafeWrapper fallback={<div className="w-full h-12 bg-gray-100 rounded-lg animate-pulse"></div>}>
                  <CustomDropdown
                    options={[
                      { value: 'false', label: t('active') },
                      { value: 'true', label: t('markedForDeletion') }
                    ]}
                    value={deletionStatus}
                    onChange={setDeletionStatus}
                    placeholder={t('selectDeletionStatus')}
                    className="w-full"
                  />
                </HydrationSafeWrapper>
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-lg font-semibold text-gray-700 mb-2">
                {t('locationLabel')} *
              </label>
              <input
                type="text"
                id="location"
                {...register('location', { required: t('locationRequired') })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('locationPlaceholder')}
              />
              {errors.location && (
                <p className="mt-2 text-sm text-red-500">{errors.location.message}</p>
              )}
            </div>

            {/* Organization and Branch - Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization */}
              <div>
                <label htmlFor="organization_id" className="block text-lg font-semibold text-gray-700 mb-2">
                  {t('organizationLabel')}
                </label>
                <select
                  id="organization_id"
                  {...register('organization_id')}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">
                    {loadingOrgs ? t('loadingOrganizations') : t('selectOrganization')}
                  </option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div>
                <label htmlFor="branch_id" className="block text-lg font-semibold text-gray-700 mb-2">
                  {t('branchLabel')}
                </label>
                <select
                  id="branch_id"
                  {...register('branch_id')}
                  disabled={!watchedOrganization || branches.length === 0}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

            {/* Submit Button */}
            <div className="text-center">
              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('updating')}
                  </span>
                ) : (
                  t('updateItem')
                )}
              </button>
            </div>
          </form>
    </div>
  );
}