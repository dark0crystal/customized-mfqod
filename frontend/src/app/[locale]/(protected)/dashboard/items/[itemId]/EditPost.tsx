'use client';

import { useRouter } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import Image from 'next/image';

interface LocationData {
  organization_name?: string;
  branch_name?: string;
  full_location?: string;
}

interface ItemFormFields {
  title: string;
  description: string;
  type: string;
  location: string;
  organization_name: string;
  branch_name: string;
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

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ItemFormFields>();

  const watchedLocation = watch('location');

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await fetch(`/api/items/${params.itemId}`);
        if (response.ok) {
          const data = await response.json();
          setItem(data);
          setOriginalLocation(data.location?.full_location || '');
          
          // Set form values
          setValue('title', data.title);
          setValue('description', data.description || data.content);
          setValue('type', data.type);
          setValue('location', data.location?.full_location || '');
          setValue('organization_name', data.location?.organization_name || '');
          setValue('branch_name', data.location?.branch_name || '');
        }
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [params.itemId, setValue]);

  const onSubmit: SubmitHandler<ItemFormFields> = async (data) => {
    setSubmitting(true);
    
    try {
      // Check if location has changed
      const locationChanged = data.location !== originalLocation;
      
      const updateData = {
        ...data,
        locationChanged,
        originalLocation: locationChanged ? originalLocation : undefined
      };

      const response = await fetch(`/api/items/${params.itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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

        {/* Type */}
        <div>
          <label htmlFor="type" className="block text-lg font-semibold text-gray-700 mb-2">
            Type
          </label>
          <select
            id="type"
            {...register('type', { required: 'Type is required' })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Select Type</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
          {errors.type && <p className="mt-2 text-sm text-red-500">{errors.type.message}</p>}
        </div>

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

          {/* Organization Name */}
          <div className="mb-4">
            <label htmlFor="organization_name" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              id="organization_name"
              {...register('organization_name')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Organization or institution name"
            />
          </div>

          {/* Branch Name */}
          <div>
            <label htmlFor="branch_name" className="block text-sm font-medium text-gray-700 mb-2">
              Branch Name
            </label>
            <input
              type="text"
              id="branch_name"
              {...register('branch_name')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Specific branch or department"
            />
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