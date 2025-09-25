'use client';

import { useRouter } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import Image from 'next/image';
import { tokenManager } from '@/utils/tokenManager';

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
}

interface Organization {
  id: string;
  name: string;
  description?: string;
}

interface Branch {
  id: string;
  branch_name: string;
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
}

interface EditPostProps {
  params: { itemId: string };
}

export default function EditPost({ params }: EditPostProps) {
  const router = useRouter();
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [originalLocation, setOriginalLocation] = useState<string>('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ItemFormFields>();

  const watchedOrganization = watch('organization_id');

  const watchedLocation = watch('location');

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
          setValue('description', data.description || data.content);
          // setValue('type', data.type); // Type editing removed
          setValue('location', data.location?.full_location || '');
          
          // Set organization and branch IDs if available from addresses
          if (data.addresses && data.addresses.length > 0) {
            const currentAddress = data.addresses.find((addr: any) => addr.is_current) || data.addresses[0];
            if (currentAddress?.branch) {
              setValue('branch_id', currentAddress.branch.id);
              if (currentAddress.branch.organization) {
                setValue('organization_id', currentAddress.branch.organization.id);
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
  }, [params.itemId, setValue]);

  // Fetch organizations
  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
        console.log('Organizations fetched:', data.length);
      } else {
        console.error('Failed to fetch organizations:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Fetch branches when organization changes
  useEffect(() => {
    if (watchedOrganization) {
      fetchBranches(watchedOrganization);
    } else {
      setBranches([]);
      setValue('branch_id', '');
    }
  }, [watchedOrganization, setValue]);

  const fetchBranches = async (organizationId: string) => {
    setLoadingBranches(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations/${organizationId}/branches`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
        console.log('Branches fetched:', data.length);
        // Reset branch selection when organization changes
        setValue('branch_id', '');
      } else {
        console.error('Failed to fetch branches:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const onSubmit: SubmitHandler<ItemFormFields> = async (data) => {
    setSubmitting(true);
    
    try {
      // Check if location has changed
      const locationChanged = data.location !== originalLocation;
      
      const updateData = {
        title: data.title,
        description: data.description,
        locationChanged,
        originalLocation: locationChanged ? originalLocation : undefined,
        // Include organization and branch info
        organization_id: data.organization_id,
        branch_id: data.branch_id,
        location: data.location
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
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-red-500">Item not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h2 className="text-2xl font-bold text-center text-indigo-600 mb-6">Edit Item</h2>

      {/* Display current images */}
      {item.uploadedPostPhotos && item.uploadedPostPhotos.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Current Images</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {item.uploadedPostPhotos.map((photo, index) => (
              <div key={index} className="relative h-32">
                <Image
                  src={photo.postUrl}
                  alt={`Item image ${index + 1}`}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            {...register('title', { required: 'Title is required' })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {errors.title && <p className="mt-2 text-sm text-red-500">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-lg font-semibold text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            {...register('description', { required: 'Description is required' })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {errors.description && <p className="mt-2 text-sm text-red-500">{errors.description.message}</p>}
        </div>

        {/* Type field removed as requested */

        {/* Location Fields */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Location Information</h3>
          
          {/* Full Location */}
          <div className="mb-4">
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Full Location
            </label>
            <input
              type="text"
              id="location"
              {...register('location', { required: 'Location is required' })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter full address or location"
            />
            {errors.location && <p className="mt-2 text-sm text-red-500">{errors.location.message}</p>}
            
            {/* Location change indicator */}
            {watchedLocation && watchedLocation !== originalLocation && (
              <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>Location Change Detected:</strong> This will be tracked in the location history.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Previous: {originalLocation}
                </p>
              </div>
            )}
          </div>

          {/* Organization */}
          <div className="mb-4">
            <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700 mb-2">
              Organization
            </label>
            <select
              id="organization_id"
              {...register('organization_id')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">
                {loadingOrgs ? 'Loading organizations...' : 'Select an organization'}
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
            <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 mb-2">
              Branch
            </label>
            <select
              id="branch_id"
              {...register('branch_id')}
              disabled={!watchedOrganization || branches.length === 0}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!watchedOrganization ? 'Select an organization first' : 
                 loadingBranches ? 'Loading branches...' :
                 branches.length === 0 ? 'No branches available' :
                 'Select a branch'}
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard/items')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-6 py-2 rounded-lg text-white font-semibold ${
              submitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 transition-colors'
            }`}
          >
            {submitting ? 'Updating...' : 'Update Item'}
          </button>
        </div>
      </form>
    </div>
  );
}