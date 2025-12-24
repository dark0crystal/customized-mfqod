"use client";

import { useForm } from "react-hook-form";
import { useState, useEffect, useRef } from "react";
import ReactConfetti from "react-confetti";
import CompressorFileInput from "./CompressorFileInput";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import imageUploadService, { UploadError, UploadProgress } from "@/services/imageUploadService";
import { tokenManager } from "@/utils/tokenManager";
import CustomDropdown from "@/components/ui/CustomDropdown";
import HydrationSafeWrapper from "@/components/HydrationSafeWrapper";
import { usePermissions } from "@/PermissionsContext";

// Type definitions for form fields
type ItemFormFields = {
  title: string;
  content: string;
  internal_description?: string;
  type: string;
  place: string;
  country: string;
  orgnization: string;
  item_type_id: string;
  branch_id: string;
};

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

// Removed unused function

export default function ReportFoundItem() {
  const locale = useLocale();
  
  // API configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

  // Track if we've set the default orgnization value after fetching
  const hasSetDefaultOrg = useRef(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [orgSelectDisabled, setOrgSelectDisabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [imageVisibility, setImageVisibility] = useState<string>('show');

  const c = useTranslations("report-found");
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManageItems = hasPermission('can_manage_items');

  // useForm with empty orgnization by default, will set after fetch
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    setValue,
    watch
  } = useForm<ItemFormFields>({
    // resolver: zodResolver(itemFormSchema),
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

  // Helper function to upload images using new service
  const uploadImages = async (itemId: string, files: File[]): Promise<string[]> => {
    const uploadedImagePaths: string[] = [];
    const errors: UploadError[] = [];
    
    for (const file of files) {
      try {
        const result = await imageUploadService.uploadImageToItem(
          itemId, 
          file,
          (progress) => {
            setUploadProgress(progress);
          }
        );
        
        if (result.success) {
          uploadedImagePaths.push(result.data.url);
        }
      } catch (error) {
        console.error('Error uploading image:', file.name, error);
        errors.push(error as UploadError);
      }
    }
    
    if (errors.length > 0) {
      setUploadErrors(errors);
    }
    
    return uploadedImagePaths;
  };

  // Check if user is authenticated
  useEffect(() => {
    const token = getTokenFromCookies();
    if (!token) {
      setAuthError("Authentication required. Please log in first.");
    } else {
      setAuthError(null);
    }
  }, []);

  // Fetch data on component mount - get user's managed branches and derive organizations
  // Note: Only fetches branches that the current user manages, not all branches
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch user's managed branches only (not all branches)
        const branchesResponse = await fetch(`${API_BASE_URL}/api/branches/my-managed-branches/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          // branchesData contains only branches managed by the current user
          // Filter by organization if one is already selected
          let filteredBranches = branchesData;
          if (watchedOrganization) {
            filteredBranches = branchesData.filter(
              (branch: Branch) => branch.organization_id === watchedOrganization
            );
          }
          setBranches(filteredBranches);
          
          // Extract unique organizations from managed branches
          const orgMap = new Map();
          branchesData.forEach((branch: Branch) => {
            if (branch.organization_id && branch.organization) {
              if (!orgMap.has(branch.organization_id)) {
                orgMap.set(branch.organization_id, {
                  id: branch.organization_id,
                  name_ar: branch.organization.name_ar,
                  name_en: branch.organization.name_en,
                  description_ar: branch.organization.description_ar,
                  description_en: branch.organization.description_en,
                });
              }
            }
          });
          
          const uniqueOrganizations = Array.from(orgMap.values());
          setOrganizations(uniqueOrganizations);

          // Set default organization to first if available and not already set
          if (
            uniqueOrganizations.length > 0 &&
            !hasSetDefaultOrg.current
          ) {
            setValue("orgnization", uniqueOrganizations[0].id);
            hasSetDefaultOrg.current = true;
          }

          // If only one organization, disable the select
          setOrgSelectDisabled(uniqueOrganizations.length === 1);
          
          // If only one branch available, select it
          if (filteredBranches.length === 1) {
            setValue("branch_id", filteredBranches[0].id);
          }
        } else if (branchesResponse.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
          return;
        } else {
          console.error('Failed to fetch managed branches');
          setBranches([]);
        }

        // Fetch item types with authentication
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
        } else {
          console.error('Failed to fetch item types');
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch data if user is authenticated
    if (!authError) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [authError, API_BASE_URL, setValue]);


  // Fetch user's managed branches when organization changes
  // Note: This ensures branches are always filtered to only show managed branches for the selected organization
  useEffect(() => {
    const fetchManagedBranches = async () => {
      try {
        // Fetch only branches managed by the current user (not all branches)
        const branchesResponse = await fetch(`${API_BASE_URL}/api/branches/my-managed-branches/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          // branchesData contains only branches managed by the current user
          // Filter branches by selected organization if one is selected
          let filteredBranches = branchesData;
          if (watchedOrganization) {
            filteredBranches = branchesData.filter(
              (branch: Branch) => branch.organization_id === watchedOrganization
            );
          }
          // Set branches state - this will only contain managed branches (filtered by org if selected)
          setBranches(filteredBranches);
          
          // If only one branch available and matches organization, select it
          if (filteredBranches.length === 1 && watchedOrganization) {
            setValue("branch_id", filteredBranches[0].id);
          } else if (!watchedOrganization && filteredBranches.length > 0 && !hasSetDefaultOrg.current) {
            // Set first organization if not set
            setValue("orgnization", filteredBranches[0].organization_id);
            hasSetDefaultOrg.current = true;
          } else {
            setValue("branch_id", "");
          }
        } else if (branchesResponse.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
        } else {
          console.error('Failed to fetch managed branches');
          setBranches([]);
        }
      } catch (error) {
        console.error('Error fetching managed branches:', error);
        setBranches([]);
      }
    };

    if (!authError) {
      fetchManagedBranches();
    }
  }, [watchedOrganization, API_BASE_URL, authError, setValue]);

  const onSubmit = async (data: ItemFormFields) => {
    if (authError) {
      alert("Please log in first to submit an item.");
      return;
    }

    try {
      setIsProcessing(true);

      const token = getTokenFromCookies();
      if (!token) {
        setAuthError("Authentication required. Please log in again.");
        return;
      }

      // Get current user ID from token manager
      const currentUser = tokenManager.getUser();
      if (!currentUser || !currentUser.id) {
        setAuthError("User information not found. Please log in again.");
        setIsProcessing(false);
        return;
      }

      // STEP 1: Create the item
      const itemPayload: any = {
        title: data.title,
        description: data.content,
        user_id: currentUser.id,
        item_type_id: data.item_type_id,
        approval: true,
        temporary_deletion: false,
        is_hidden: imageVisibility === 'hide'
      };

      // Add internal_description only if user has permission and field is provided
      if (canManageItems && data.internal_description) {
        itemPayload.internal_description = data.internal_description;
      }

      const itemResponse = await fetch(`${API_BASE_URL}/api/items`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(itemPayload),
      });

      if (!itemResponse.ok) {
        let errorMessage = "Item creation failed";
        try {
          const errorData = await itemResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const itemResult = await itemResponse.json();
      const itemId = itemResult.id;

      // STEP 2: Upload images if any
      let uploadedImagePaths: string[] = [];
      if (compressedFiles.length > 0) {
        console.log("Uploading images...");
        uploadedImagePaths = await uploadImages(itemId, compressedFiles);
        console.log("Images uploaded:", uploadedImagePaths);
        
        // Clear upload progress after completion
        setUploadProgress(null);
      }

      // STEP 3: Create the address
      const addressPayload = {
        item_id: itemId,
        branch_id: data.branch_id,
        is_current: true
      };

      const addressResponse = await fetch(`${API_BASE_URL}/api/addresses`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(addressPayload),
      });

      if (!addressResponse.ok) {
        let errorMessage = "Address creation failed";
        try {
          const errorData = await addressResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      console.log("Item, images, and address uploaded successfully");
      setConfetti(true);
      reset();
      setCompressedFiles([]);
      setBranches([]);
      setUploadProgress(null);
      setUploadErrors([]);
      hasSetDefaultOrg.current = false; // Reset so default org is set again after reset

      // Redirect after success
      setTimeout(() => {
        router.push("/");
      }, 3000);

    } catch (error: unknown) {
      console.error("Error submitting form:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      alert(errorMessage);
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
            onClick={() => router.push("/login")}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#3277AE' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3277AE'; }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-5 bg-white shadow-md rounded-lg mt-10">
      {confetti && (
        <ReactConfetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
        />
      )}
      
      <h2 className="text-lg md:text-2xl font-bold text-center mb-5" style={{ color: '#3277AE' }}>
        {c("title")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("whatDidYouFind")}
          </label>
          <input
            type="text"
            id="title"
            {...register("title")}
            placeholder={c("placeholderTitle")}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
            style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
          />
          {errors.title && (
            <p className="mt-2 text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Content Input */}
        <div>
          <label htmlFor="content" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("Details")}
          </label>
          <textarea
            id="content"
            {...register("content")}
            placeholder={c("placeholderDetails")}
            rows={4}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
            style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
          />
          <p className="mt-1 text-xs text-gray-500">
            {c("descriptionDisclaimer")}
          </p>
          {errors.content && (
            <p className="mt-2 text-sm text-red-500">{errors.content.message}</p>
          )}
        </div>

        {/* Internal Description Input - Only visible to users with can_manage_items permission */}
        {canManageItems && (
          <div>
            <label htmlFor="internal_description" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
              {c("internalDescription") || "Internal Description"}
            </label>
            <textarea
              id="internal_description"
              {...register("internal_description")}
              placeholder={c("placeholderInternalDescription") || "Enter detailed internal information (visible only to administrators)"}
              rows={4}
              className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
              style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
            />
            <p className="mt-1 text-xs text-gray-500">
              {c("internalDescriptionDisclaimer") || "This field is only visible to users with item management permissions"}
            </p>
            {errors.internal_description && (
              <p className="mt-2 text-sm text-red-500">{errors.internal_description.message}</p>
            )}
          </div>
        )}

        {/* Item Type Selection */}
        <div>
          <label htmlFor="item_type_id" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("itemType")}
          </label>
          <select
            id="item_type_id"
            {...register("item_type_id")}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
            style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
          >
            <option value="">{c("selectItemType")}</option>
            {itemTypes.map((itemType) => (
              <option key={itemType.id} value={itemType.id}>
                {getLocalizedName(itemType.name_ar, itemType.name_en) || c("unnamed")}
              </option>
            ))}
          </select>
          {errors.item_type_id && (
            <p className="mt-2 text-sm text-red-500">{errors.item_type_id.message}</p>
          )}
        </div>

        {/* Image Visibility */}
        <div>
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("imageVisibility")}
          </label>
          <HydrationSafeWrapper fallback={<div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse"></div>}>
            <CustomDropdown
              options={[
                { value: 'show', label: c("show") },
                { value: 'hide', label: c("hide") }
              ]}
              value={imageVisibility}
              onChange={setImageVisibility}
              placeholder={c("imageVisibility")}
              className="w-full"
            />
          </HydrationSafeWrapper>
          <p className="text-xs text-gray-500 mt-1">
            {c("hideImagesDescription")}
          </p>
        </div>

        {/* File Upload Component */}
        <div>
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("uploadImagesOptional")}
          </label>
          <CompressorFileInput 
            onFilesSelected={setCompressedFiles} 
            showValidation={true} 
            maxFiles={5}
            showOptimizationSettings={false}
            compressionQuality={0.7}
            maxWidth={1200}
            maxHeight={1200}
          />
          
          {/* Upload Progress */}
          {uploadProgress && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-900">{c("uploadingImages")}</span>
                <span className="text-sm text-blue-700">{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress.percentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {Math.round(uploadProgress.loaded / 1024)} KB / {Math.round(uploadProgress.total / 1024)} KB
              </div>
            </div>
          )}

          {/* Upload Errors */}
          {uploadErrors.length > 0 && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800 font-medium mb-2">{c("someImagesFailed")}</div>
              {uploadErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 mb-1">
                  <span className="font-medium">{error.error}:</span> {error.message}
                </div>
              ))}
            </div>
          )}

          {compressedFiles.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {compressedFiles.length} {c("filesSelected")}
            </p>
          )}
        </div>

        {/* Select Organization */}
        <div>
          <label htmlFor="orgnization" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("organization")}
          </label>
          <select
            id="orgnization"
            {...register("orgnization")}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
            style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
            disabled={orgSelectDisabled}
          >
            {!orgSelectDisabled && (
              <option value="">{c("selectOrganization")}</option>
            )}
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {getLocalizedName(org.name_ar, org.name_en) || c("unnamedOrganization")}
              </option>
            ))}
          </select>
          {errors.orgnization && (
            <p className="mt-2 text-sm text-red-500">{errors.orgnization.message}</p>
          )}
        </div>

        {/* Select Branch */}
        <div>
          <label htmlFor="branch_id" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("branch")}
          </label>
          <select
            id="branch_id"
            {...register("branch_id")}
            disabled={!watchedOrganization || branches.length === 0}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
          >
            <option value="">
              {!watchedOrganization 
                ? c("selectOrganizationFirst")
                : branches.length === 0 
                  ? c("noBranchesAvailable")
                  : c("selectBranch")
              }
            </option>
            {/* branches state already contains only managed branches filtered by organization */}
            {branches.map((branch: Branch) => (
              <option key={branch.id} value={branch.id}>
                {getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || c("unnamedBranch")}
              </option>
            ))}
          </select>
          {errors.branch_id && (
            <p className="mt-2 text-sm text-red-500">{errors.branch_id.message}</p>
          )}
        </div>

        {/* Select Country */}
        <div>
          <label htmlFor="country" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("country")}
          </label>
          <select
            id="country"
            {...register("country")}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-300"
            style={{ "--tw-ring-color": "#3277AE" } as React.CSSProperties}
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
            style={{ backgroundColor: '#3277AE', "--tw-ring-color": "#3277AE" } as React.CSSProperties}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#3277AE'; }}
          >
            {isSubmitting || isProcessing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {c("processing")}
              </span>
            ) : (
              c("submit")
            )}
          </button>
        </div>
        
        {/* Note */}
        <div className="text-center">
          <p className="text-sm text-gray-600">{c("note")}</p>
        </div>
      </form>
    </div>
  );
}