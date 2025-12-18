"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import ReactConfetti from "react-confetti";
import CompressorFileInput from "./CompressorFileInput";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import imageUploadService, { UploadError, UploadProgress } from "@/services/imageUploadService";
import { tokenManager } from "@/utils/tokenManager";

// Zod schema for form validation (used for type inference)
// Note: Validation messages are handled in the component using translations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export default function ReportMissingItem() {
  const locale = useLocale();
  
  // API configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

  // Track if we've set the default orgnization value after fetching
  const hasSetDefaultOrg = useRef(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

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

  const c = useTranslations("report-missing");
  const router = useRouter();

  // useForm with empty orgnization by default, will set after fetch
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    setValue
  } = useForm<MissingItemFormFields>({
    // resolver: zodResolver(missingItemFormSchema),
    defaultValues: {
      country: "Oman",
      type: "",
      place: "",
      orgnization: "",
      item_type_id: ""
    }
  });


  // Helper function to upload images using new service
  const uploadImages = async (missingItemId: string, files: File[]): Promise<string[]> => {
    const uploadedImagePaths: string[] = [];
    const errors: UploadError[] = [];
    
    for (const file of files) {
      try {
        const result = await imageUploadService.uploadImageToItem(
          missingItemId, 
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
      setAuthError(c("authenticationRequired"));
    } else {
      setAuthError(null);
    }
  }, [c]);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch organizations with authentication
        const organizationsResponse = await fetch(`${API_BASE_URL}/api/organizations/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        
        if (organizationsResponse.ok) {
          const organizationsData = await organizationsResponse.json();
          setOrganizations(organizationsData);

          // Set default orgnization to first if available and not already set
          if (
            organizationsData.length > 0 &&
            !hasSetDefaultOrg.current
          ) {
            setValue("orgnization", organizationsData[0].id);
            hasSetDefaultOrg.current = true;
          }

          // If only one organization, disable the select
          setOrgSelectDisabled(organizationsData.length === 1);
        } else if (organizationsResponse.status === 401) {
          setAuthError(c("authenticationFailed"));
          return;
        } else {
          console.error('Failed to fetch organizations');
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
          setAuthError(c("authenticationFailed"));
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
  }, [authError, API_BASE_URL, setValue, c]);

  // If organizations change (e.g. after fetch), set default if not set
  useEffect(() => {
    if (
      organizations.length > 0 &&
      !hasSetDefaultOrg.current
    ) {
      setValue("orgnization", organizations[0].id);
      hasSetDefaultOrg.current = true;
    }
    setOrgSelectDisabled(organizations.length === 1);
  }, [organizations, setValue]);

  const onSubmit = async (data: MissingItemFormFields) => {
    if (authError) {
      alert(c("loginFirstToSubmit"));
      return;
    }

    try {
      setIsProcessing(true);

      const token = getTokenFromCookies();
      if (!token) {
        setAuthError(c("authenticationRequired"));
        return;
      }

      // Get current user ID from token manager
      const currentUser = tokenManager.getUser();
      if (!currentUser || !currentUser.id) {
        setAuthError(c("authenticationRequired") || "User information not found. Please log in again.");
        setIsProcessing(false);
        return;
      }

      // STEP 1: Create the missing item
      const missingItemPayload = {
        title: data.title,
        description: data.content,
        user_id: currentUser.id,
        item_type_id: data.item_type_id,
        status: "pending", // Default status for missing items
        approval: true,
        temporary_deletion: false
      };

      const missingItemResponse = await fetch(`${API_BASE_URL}/api/missing-items`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(missingItemPayload),
      });

      if (!missingItemResponse.ok) {
        let errorMessage = c("missingItemCreationFailed");
        try {
          const errorData = await missingItemResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const missingItemResult = await missingItemResponse.json();
      const missingItemId = missingItemResult.id;

      // STEP 2: Upload images if any
      let uploadedImagePaths: string[] = [];
      if (compressedFiles.length > 0) {
        console.log("Uploading images...");
        uploadedImagePaths = await uploadImages(missingItemId, compressedFiles);
        console.log("Images uploaded:", uploadedImagePaths);
        
        // Clear upload progress after completion
        setUploadProgress(null);
      }

      // STEP 3: Create the address
      const addressPayload = {
        missing_item_id: missingItemId,
        is_current: true
      };

      const addressResponse = await fetch(`${API_BASE_URL}/api/addresses`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(addressPayload),
      });

      if (!addressResponse.ok) {
        let errorMessage = c("addressCreationFailed");
        try {
          const errorData = await addressResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      console.log("Missing item, images, and address uploaded successfully");
      setConfetti(true);
      reset();
      setCompressedFiles([]);
      setUploadProgress(null);
      setUploadErrors([]);
      hasSetDefaultOrg.current = false; // Reset so default org is set again after reset

      // Redirect after success
      setTimeout(() => {
        router.push("/");
      }, 3000);

    } catch (error: unknown) {
      console.error("Error submitting form:", error);
      alert(error instanceof Error ? error.message : c("unexpectedError"));
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
          <div className="text-lg text-gray-600">{c("loading")}</div>
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a5f94';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3277AE';
            }}
          >
            {c("goToLogin")}
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
            {c("whatDidYouLose")}
          </label>
          <input
            type="text"
            id="title"
            {...register("title")}
            placeholder={c("placeholderTitle")}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3277AE';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
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
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3277AE';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          />
          {errors.content && (
            <p className="mt-2 text-sm text-red-500">{errors.content.message}</p>
          )}
        </div>

        {/* Item Type Selection */}
        <div>
          <label htmlFor="item_type_id" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("itemType")}
          </label>
          <select
            id="item_type_id"
            {...register("item_type_id")}
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3277AE';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
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

        {/* File Upload Component */}
        <div>
          <CompressorFileInput 
            onFilesSelected={setCompressedFiles} 
            showValidation={true} 
            maxFiles={5}
            showOptimizationSettings={false}
            compressionQuality={0.7}
            maxWidth={1200}
            maxHeight={1200}
            translationNamespace="report-missing"
          />
          
          {/* Helper text */}
          <p className="mt-2 text-sm text-gray-500">
            {c("uploadImagesHelper")}
          </p>
          
          {/* Upload Progress */}
          {uploadProgress && (
            <div className="mt-2 p-3 border rounded-lg" style={{ backgroundColor: '#f0f7ff', borderColor: '#3277AE' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium" style={{ color: '#3277AE' }}>{c("uploadingImages")}</span>
                <span className="text-sm" style={{ color: '#3277AE' }}>{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300" 
                  style={{ backgroundColor: '#3277AE', width: `${uploadProgress.percentage}%` }}
                ></div>
              </div>
              <div className="text-xs mt-1" style={{ color: '#3277AE' }}>
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
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            disabled={orgSelectDisabled}
            style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
            onFocus={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.borderColor = '#3277AE';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            {!orgSelectDisabled && (
              <option value="">{c("selectUniversity")}</option>
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

        {/* Select Country */}
        <div>
          <label htmlFor="country" className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            {c("country")}
          </label>
          <select
            id="country"
            {...register("country")}
            disabled
            defaultValue="Oman"
            className="w-full p-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-600"
            style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
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
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#2a5f94';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
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
                {c("processing")}
              </span>
            ) : (
              c("submit")
            )}
          </button>
        </div>
        
      </form>
    </div>
  );
}
