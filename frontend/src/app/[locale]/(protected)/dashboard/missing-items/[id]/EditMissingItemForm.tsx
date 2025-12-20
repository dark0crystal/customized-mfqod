"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import ReactConfetti from "react-confetti";
import CompressorFileInput from "@/components/forms/CompressorFileInput";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import imageUploadService, { UploadError, UploadProgress } from "@/services/imageUploadService";
import { Link } from '@/i18n/navigation';
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Image from "next/image";
import ImageCarousel, { CarouselImage } from "@/components/ImageCarousel";
import { usePermissions } from "@/PermissionsContext";

// Zod schema for form validation
const missingItemFormSchema = z.object({
  title: z.string().min(1, "This field is required"),
  content: z.string().min(1, "Please provide additional details"),
  type: z.string().min(1, "This field is required"),
  place: z.string().min(1, "Please select a place"),
  country: z.string().min(1, "Please select a country"),
  orgnization: z.string().min(1, "Please select an organization"),
  item_type_id: z.string().min(1, "Please select an item type"),
});

type MissingItemFormFields = z.infer<typeof missingItemFormSchema>;

// Type definitions
interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  description_ar?: string;
  description_en?: string;
  longitude?: number;
  latitude?: number;
  organization_id?: string;
  organization?: Organization;
  created_at?: string;
  updated_at?: string;
}

interface Organization {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
}

interface MissingItem {
  id: string;
  title: string;
  description: string;
  status: string;
  approval: boolean;
  temporary_deletion: boolean;
  created_at: string;
  updated_at: string;
  item_type_id?: string;
  item_type?: ItemType;
  images?: Array<{
    id: string;
    url: string;
    description?: string;
  }>;
}

// Helper function to get token from cookies
const getTokenFromCookies = (): string | null => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token' || name === 'access_token' || name === 'auth_token') {
        return decodeURIComponent(value);
      }
    }
  }
  return null;
};

// Helper function to create authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = getTokenFromCookies();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

interface EditMissingItemFormProps {
  missingItemId: string;
}

export default function EditMissingItemForm({ missingItemId }: EditMissingItemFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const { hasPermission } = usePermissions();

  // API configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [missingItem, setMissingItem] = useState<MissingItem | null>(null);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [orgSelectDisabled, setOrgSelectDisabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);

  const c = useTranslations("report-missing");
  
  // Check if user can edit this missing item
  const hasManageMissingItemsPermission = hasPermission("can_manage_missing_items");
  const canEdit = missingItem 
    ? (missingItem.status !== "approved" || hasManageMissingItemsPermission)
    : true;

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Helper function to get image URL
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setValue,
    watch
  } = useForm<MissingItemFormFields>({
    defaultValues: {
      country: "Oman",
      type: "",
      place: "",
      orgnization: "",
      item_type_id: ""
    }
  });

  const watchedOrg = watch("orgnization");


  // Fetch missing item data
  useEffect(() => {
    const fetchMissingItem = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/missing-items/${missingItemId}`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Missing item data:', data);
          setMissingItem(data);

          // Set form values
          setValue('title', data.title);
          setValue('content', data.description);
          setValue('item_type_id', data.item_type_id || '');

          // Organization selection is no longer based on addresses
        } else if (response.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
        } else {
          console.error('Failed to fetch missing item');
        }
      } catch (error) {
        console.error('Error fetching missing item:', error);
      }
    };

    fetchMissingItem();
  }, [missingItemId, API_BASE_URL, setValue]);

  // Organization selection is no longer based on addresses
  // Users can manually select organization if needed

  // Fetch organizations and item types
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch organizations
        const organizationsResponse = await fetch(`${API_BASE_URL}/api/organizations/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (organizationsResponse.ok) {
          const organizationsData = await organizationsResponse.json();
          console.log('Organizations loaded:', organizationsData);
          setOrganizations(organizationsData);
          setOrgSelectDisabled(organizationsData.length === 1);
        } else if (organizationsResponse.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          return;
        }

        // Fetch item types
        const itemTypesResponse = await fetch(`${API_BASE_URL}/api/item-types/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (itemTypesResponse.ok) {
          const itemTypesData = await itemTypesResponse.json();
          setItemTypes(itemTypesData);
        } else if (itemTypesResponse.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          return;
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authError) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [authError, API_BASE_URL]);

  const onSubmit = async (data: MissingItemFormFields) => {
    if (authError) {
      alert("Please log in first to update the missing item.");
      return;
    }

    try {
      setIsProcessing(true);

      const token = getTokenFromCookies();
      if (!token) {
        setAuthError("Authentication required. Please log in again.");
        return;
      }

      // Update the missing item
      const updatePayload = {
        title: data.title,
        description: data.content,
        item_type_id: data.item_type_id,
        status: missingItem?.status || "pending",
        approval: true,
        temporary_deletion: false
      };

      const updateResponse = await fetch(`${API_BASE_URL}/api/missing-items/${missingItemId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        let errorMessage = "Missing item update failed";
        try {
          const errorData = await updateResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      console.log("Missing item updated successfully");
      setConfetti(true);

      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard/missing-items");
      }, 3000);

    } catch (error: any) {
      console.error("Error updating form:", error);
      alert(error.message || "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle confetti timeout
  useEffect(() => {
    if (confetti) {
      const timer = setTimeout(() => {
        setConfetti(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

  // Loading state
  if (isLoading) return <LoadingSpinner />;

  // Authentication error state
  if (authError) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="flex justify-center items-center h-64 flex-col">
          <div className="text-lg text-red-600 mb-4">{authError}</div>
          <button
            onClick={() => router.push("/auth/login")}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{
              backgroundColor: '#3277AE'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a5f94';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3277AE';
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!missingItem) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="flex justify-center items-center h-64 flex-col">
          <div className="text-lg text-red-600 mb-4">{c('missingItemNotFound')}</div>
          <Link
            href="/dashboard/missing-items"
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{
              backgroundColor: '#3277AE'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a5f94';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3277AE';
            }}
          >
            {c('backToMissingItems')}
          </Link>
        </div>
      </div>
    );
  }

  // If item is approved and user doesn't have permission, show message
  if (!canEdit) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="flex justify-center items-center h-64 flex-col">
          <div className="text-lg text-red-600 mb-4">
            {c('cannotEditApproved') || "Cannot edit approved missing items without permission"}
          </div>
          <Link
            href="/dashboard/missing-items"
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{
              backgroundColor: '#3277AE'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a5f94';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3277AE';
            }}
          >
            {c('backToMissingItems')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {confetti && (
        <ReactConfetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-10">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{c('editMissingItem')}</h2>
          <Link href="/dashboard/missing-items" className="text-sm text-gray-500 hover:text-gray-900">
            ← {c('backToMissingItems')}
          </Link>
        </div>

        {/* Section 1: Item Details */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">
            Item Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                {c("whatDidYouLose")}
              </label>
              <input
                type="text"
                id="title"
                {...register("title")}
                placeholder="e.g., Key, Wallet, etc."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3277AE] focus:ring-[#3277AE] sm:text-sm p-2.5 border"
              />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
            </div>

            {/* Content */}
            <div className="md:col-span-2">
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                {c("Details")}
              </label>
              <textarea
                id="content"
                {...register("content")}
                placeholder="Provide additional details about the missing item"
                rows={4}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3277AE] focus:ring-[#3277AE] sm:text-sm p-2.5 border"
              />
              {errors.content && <p className="mt-1 text-sm text-red-500">{errors.content.message}</p>}
            </div>

            {/* Item Type */}
            <div>
              <label htmlFor="item_type_id" className="block text-sm font-medium text-gray-700 mb-1">
                {c("itemType")}
              </label>
              <select
                id="item_type_id"
                {...register("item_type_id")}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3277AE] focus:ring-[#3277AE] sm:text-sm p-2.5 border bg-white"
              >
                <option value="">{c("selectItemType")}</option>
                {itemTypes.map((itemType) => (
                  <option key={itemType.id} value={itemType.id}>
                    {getLocalizedName(itemType.name_ar, itemType.name_en) || 'Unnamed'}
                  </option>
                ))}
              </select>
              {errors.item_type_id && <p className="mt-1 text-sm text-red-500">{errors.item_type_id.message}</p>}
            </div>
          </div>
        </section>

        {/* Section 2: Location Information */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">
            Location Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                {c("country")}
              </label>
              <select
                id="country"
                {...register("country")}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3277AE] focus:ring-[#3277AE] sm:text-sm p-2.5 border bg-white"
              >
                <option value="Oman">Oman</option>
              </select>
              {errors.country && <p className="mt-1 text-sm text-red-500">{errors.country.message}</p>}
            </div>

            {/* Organization */}
            <div>
              <label htmlFor="orgnization" className="block text-sm font-medium text-gray-700 mb-1">
                {c("organization")}
              </label>
              <select
                id="orgnization"
                {...register("orgnization")}
                value={watchedOrg || ""}
                disabled={orgSelectDisabled}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3277AE] focus:ring-[#3277AE] sm:text-sm p-2.5 border bg-white disabled:bg-gray-100"
              >
                {!orgSelectDisabled && (
                  <option value="">{c("selectOrganization")}</option>
                )}
                {organizations.length === 0 ? (
                  <option value="" disabled>Loading organizations...</option>
                ) : (
                  organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {getLocalizedName(org.name_ar, org.name_en) || 'Unnamed Organization'}
                    </option>
                  ))
                )}
              </select>
              {errors.orgnization && <p className="mt-1 text-sm text-red-500">{errors.orgnization.message}</p>}
              {watchedOrg && !organizations.find(org => org.id === watchedOrg) && (
                <p className="mt-1 text-sm text-yellow-600">Selected organization not found in list</p>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Images */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100">
            {c("uploadImages")}
          </h3>
          {missingItem?.images && missingItem.images.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-700">
                  {missingItem.images.length} {missingItem.images.length === 1 ? c("image") || "image" : c("images") || "images"}
                </h4>
              </div>
              <div className="w-full" style={{ minHeight: '400px' }}>
                <ImageCarousel
                  images={missingItem.images.map((img): CarouselImage => ({
                    id: img.id,
                    url: getImageUrl(img.url),
                    alt: img.description || `Missing item image`,
                    description: img.description,
                  }))}
                  isModal={false}
                  showCounter={true}
                  showDots={true}
                  className="rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">
                {c("noImages") || "No images found"}
              </p>
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-100 flex justify-end space-x-4">
          <Link
            href="/dashboard/missing-items"
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            {c('cancel') || "Cancel"}
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isProcessing || isLoading || !!authError || !isDirty}
            className="px-6 py-2.5 bg-[#3277AE] text-white rounded-lg font-medium hover:bg-[#2a6594] focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-70 flex items-center"
          >
            {isSubmitting || isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {c('updating')}
              </>
            ) : (
              c('updateMissingItem')
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
