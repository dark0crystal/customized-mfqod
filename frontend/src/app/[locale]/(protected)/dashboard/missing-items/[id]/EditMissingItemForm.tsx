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

// Zod schema for form validation
const missingItemFormSchema = z.object({
  title: z.string().min(1, "This field is required"),
  content: z.string().min(1, "Please provide additional details"),
  type: z.string().min(1, "This field is required"),
  place: z.string().min(1, "Please select a place"),
  country: z.string().min(1, "Please select a country"),
  orgnization: z.string().min(1, "Please select an organization"),
  item_type_id: z.string().min(1, "Please select an item type"),
  branch_id: z.string().min(1, "Please select a branch"),
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
  organization_id: string;
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
  addresses?: Array<{
    id: string;
    branch_id: string;
    branch?: Branch;
    is_current: boolean;
  }>;
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
  const t = useTranslations("forms");
  const locale = useLocale();
  const router = useRouter();
  
  // API configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    setValue,
    watch
  } = useForm<MissingItemFormFields>({
    defaultValues: {
      country: "Oman",
      type: "",
      place: "",
      orgnization: "",
      item_type_id: "",
      branch_id: ""
    }
  });

  // Watch for organization changes
  const watchedOrganization = watch("orgnization");

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
          
          // Set organization and branch if available
          if (data.addresses && data.addresses.length > 0) {
            console.log('Addresses found:', data.addresses);
            const currentAddress = data.addresses.find((addr: any) => addr.is_current) || data.addresses[0];
            console.log('Current address:', currentAddress);
            if (currentAddress?.branch) {
              console.log('Branch found:', currentAddress.branch);
              setValue('branch_id', currentAddress.branch.id);
              if (currentAddress.branch.organization_id) {
                console.log('Organization ID:', currentAddress.branch.organization_id);
                setValue('orgnization', currentAddress.branch.organization_id);
              }
            }
          }
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

  // Set organization and branch values after organizations are loaded
  useEffect(() => {
    if (missingItem && organizations.length > 0) {
      console.log('Setting organization and branch values after organizations loaded');
      console.log('Missing item:', missingItem);
      console.log('Organizations:', organizations);
      if (missingItem.addresses && missingItem.addresses.length > 0) {
        const currentAddress = missingItem.addresses.find((addr: any) => addr.is_current) || missingItem.addresses[0];
        if (currentAddress?.branch) {
          console.log('Setting branch_id:', currentAddress.branch.id);
          setValue('branch_id', currentAddress.branch.id);
          if (currentAddress.branch.organization_id) {
            console.log('Setting organization:', currentAddress.branch.organization_id);
            setValue('orgnization', currentAddress.branch.organization_id);
          }
        }
      }
    }
  }, [missingItem, organizations, setValue]);

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

  // Fetch branches when organization changes
  useEffect(() => {
    const fetchBranches = async () => {
      if (!watchedOrganization) {
        setBranches([]);
        setValue("branch_id", "");
        return;
      }

      try {
        const branchesResponse = await fetch(`${API_BASE_URL}/api/organizations/${watchedOrganization}/branches`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          setBranches(branchesData);
        } else if (branchesResponse.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
        } else {
          console.error('Failed to fetch branches for organization');
          setBranches([]);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        setBranches([]);
      }
    };

    if (watchedOrganization && !authError) {
      fetchBranches();
    }
  }, [watchedOrganization, API_BASE_URL, authError, setValue]);

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
        status: "lost",
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

      // Update address if branch changed
      if (missingItem?.addresses && missingItem.addresses.length > 0) {
        const currentAddress = missingItem.addresses.find(addr => addr.is_current);
        if (currentAddress && currentAddress.branch_id !== data.branch_id) {
          const addressUpdatePayload = {
            branch_id: data.branch_id,
            is_current: true
          };

          const addressResponse = await fetch(`${API_BASE_URL}/api/addresses/${currentAddress.id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(addressUpdatePayload),
          });

          if (!addressResponse.ok) {
            console.error('Failed to update address');
          }
        }
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
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      {confetti && (
        <ReactConfetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
        />
      )}
      
      {/* Back Button */}
      <div className="mb-6">
        <Link 
          href="/dashboard/missing-items" 
          className="inline-flex items-center transition-colors"
          style={{ color: '#3277AE' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#2a5f94';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#3277AE';
          }}
        >
          ← {c('backToMissingItems')}
        </Link>
      </div>
      
      <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#3277AE' }}>
        {c('editMissingItem')}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("whatDidYouLose")}
          </label>
          <input
            type="text"
            id="title"
            {...register("title")}
            placeholder="e.g., Key, Wallet, etc."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
          />
          {errors.title && (
            <p className="mt-2 text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Content Input */}
        <div>
          <label htmlFor="content" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("Details")}
          </label>
          <textarea
            id="content"
            {...register("content")}
            placeholder="Provide additional details about the missing item"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
          />
          {errors.content && (
            <p className="mt-2 text-sm text-red-500">{errors.content.message}</p>
          )}
        </div>

        {/* Item Type Selection */}
        <div>
          <label htmlFor="item_type_id" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("itemType")}
          </label>
          <select
            id="item_type_id"
            {...register("item_type_id")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
          >
            <option value="">{c("selectItemType")}</option>
            {itemTypes.map((itemType) => (
              <option key={itemType.id} value={itemType.id}>
                {getLocalizedName(itemType.name_ar, itemType.name_en) || 'Unnamed'}
              </option>
            ))}
          </select>
          {errors.item_type_id && (
            <p className="mt-2 text-sm text-red-500">{errors.item_type_id.message}</p>
          )}
        </div>

        {/* Select Organization */}
        <div>
          <label htmlFor="orgnization" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("organization")}
          </label>
          <select
            id="orgnization"
            {...register("orgnization")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            disabled={orgSelectDisabled}
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
          {errors.orgnization && (
            <p className="mt-2 text-sm text-red-500">{errors.orgnization.message}</p>
          )}
        </div>

        {/* Select Branch */}
        <div>
          <label htmlFor="branch_id" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("branch")}
          </label>
          <select
            id="branch_id"
            {...register("branch_id")}
            disabled={!watchedOrganization || branches.length === 0}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
          >
            <option value="">
              {!watchedOrganization 
                ? c("selectOrganizationFirst")
                : branches.length === 0 
                  ? c("noBranchesAvailable")
                  : c("selectBranch")
              }
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || 'Unnamed Branch'}
              </option>
            ))}
          </select>
          {errors.branch_id && (
            <p className="mt-2 text-sm text-red-500">{errors.branch_id.message}</p>
          )}
        </div>

        {/* Select Country */}
        <div>
          <label htmlFor="country" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("country")}
          </label>
          <select
            id="country"
            {...register("country")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
          >
            <option value="Oman">Oman</option>
          </select>
          {errors.country && (
            <p className="mt-2 text-sm text-red-500">{errors.country.message}</p>
          )}
        </div>
        
        {/* Submit Button */}
        <div className="text-center">
          <button 
            type="submit" 
            disabled={isSubmitting || isProcessing || isLoading || !!authError} 
            className="w-full p-3 text-white font-semibold rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: '#3277AE',
              '--tw-ring-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            onMouseEnter={(e) => {
              if (!isSubmitting && !isProcessing && !isLoading && !authError) {
                e.currentTarget.style.backgroundColor = '#2a5f94';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting && !isProcessing && !isLoading && !authError) {
                e.currentTarget.style.backgroundColor = '#3277AE';
              }
            }}
          >
            {isSubmitting || isProcessing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {c('updating')}
              </span>
            ) : (
              c('updateMissingItem')
            )}
          </button>
        </div>
        
      </form>
    </div>
  );
}
