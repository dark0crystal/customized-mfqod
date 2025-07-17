"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import ReactConfetti from "react-confetti";
import CompressorFileInput from "./CompressorFileInput";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// Zod schema for form validation
const itemFormSchema = z.object({
  title: z.string().min(1, "This field is required"),
  content: z.string().min(1, "Please provide additional details"),
  type: z.string().min(1, "This field is required"),
  place: z.string().min(1, "Please select a place"),
  country: z.string().min(1, "Please select a country"),
  orgnization: z.string().min(1, "Please select an organization"),
  item_type_id: z.string().min(1, "Please select an item type"),
  branch_id: z.string().min(1, "Please select a branch"),
});

type ItemFormFields = z.infer<typeof itemFormSchema>;

// Type definitions
interface ItemType {
  id: string;
  name: string;
  description?: string;
}

interface Branch {
  id: string;
  branch_name: string;
  organization_id: string;
  created_at?: string;
  updated_at?: string;
}

interface Organization {
  id: string;
  name: string;
  description?: string;
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

// Helper function for authenticated fetch without JSON content type (for FormData)
const getAuthHeadersForFormData = (): HeadersInit => {
  const token = getTokenFromCookies();
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Helper function to upload images
const uploadImages = async (itemId: string, files: File[], apiBaseUrl: string): Promise<string[]> => {
  const uploadedImagePaths: string[] = [];
  
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${apiBaseUrl}/image/items/${itemId}/upload-image/`, {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        uploadedImagePaths.push(result.image_path || result.file_path);
      } else {
        console.error('Failed to upload image:', file.name);
        // Get error details if available
        try {
          const errorData = await response.json();
          console.error('Upload error details:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
      }
    } catch (error) {
      console.error('Error uploading image:', file.name, error);
    }
  }
  
  return uploadedImagePaths;
};

export default function ReportFoundItem() {
  // API configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Track if we've set the default orgnization value after fetching
  const hasSetDefaultOrg = useRef(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [orgSelectDisabled, setOrgSelectDisabled] = useState(false);

  const t = useTranslations("storage");
  const c = useTranslations("report-found");
  const router = useRouter();

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

  // Check if user is authenticated
  useEffect(() => {
    const token = getTokenFromCookies();
    if (!token) {
      setAuthError("Authentication required. Please log in first.");
    } else {
      setAuthError(null);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch organizations with authentication
        const organizationsResponse = await fetch(`${API_BASE_URL}/organization/organizations/`, {
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
          setAuthError("Authentication failed. Please log in again.");
          return;
        } else {
          console.error('Failed to fetch organizations');
        }

        // Fetch item types with authentication
        const itemTypesResponse = await fetch(`${API_BASE_URL}/item-type/`, {
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

  // Fetch branches when organization changes
  useEffect(() => {
    const fetchBranches = async () => {
      if (!watchedOrganization) {
        setBranches([]);
        setValue("branch_id", "");
        return;
      }

      try {
        const branchesResponse = await fetch(`${API_BASE_URL}/organization/organizations/${watchedOrganization}/branches/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          setBranches(branchesData);
          // Reset branch selection when organization changes
          setValue("branch_id", "");
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

      // STEP 1: Create the item
      const itemPayload = {
        title: data.title,
        description: data.content,
        user_id: "48d1fe78-ddaa-4c1d-bd28-6f5395774bb5", // Consider making this dynamic
        item_type_id: data.item_type_id,
        approval: true,
        temporary_deletion: false
      };

      const itemResponse = await fetch(`${API_BASE_URL}/items/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(itemPayload),
      });

      if (!itemResponse.ok) {
        let errorMessage = "Item creation failed";
        try {
          const errorData = await itemResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
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
        uploadedImagePaths = await uploadImages(itemId, compressedFiles, API_BASE_URL);
        console.log("Images uploaded:", uploadedImagePaths);
      }

      // STEP 3: Create the address
      const addressPayload = {
        item_id: itemId,
        branch_id: data.branch_id,
        is_current: true
      };

      const addressResponse = await fetch(`${API_BASE_URL}/branch/addresses/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(addressPayload),
      });

      if (!addressResponse.ok) {
        let errorMessage = "Address creation failed";
        try {
          const errorData = await addressResponse.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      console.log("Item, images, and address uploaded successfully");
      setConfetti(true);
      reset();
      setCompressedFiles([]);
      setBranches([]);
      hasSetDefaultOrg.current = false; // Reset so default org is set again after reset

      // Redirect after success
      setTimeout(() => {
        router.push("/");
      }, 3000);

    } catch (error: any) {
      console.error("Error submitting form:", error);
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
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Login
          </button>
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
      
      <h2 className="text-2xl font-bold text-center text-indigo-600 mb-6">
        {c("title")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">
            {c("whatDidYouFind")}
          </label>
          <input
            type="text"
            id="title"
            {...register("title")}
            placeholder="e.g., Key, Wallet, etc."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
            placeholder="Provide additional details about the item"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.content && (
            <p className="mt-2 text-sm text-red-500">{errors.content.message}</p>
          )}
        </div>

        {/* Item Type Selection */}
        <div>
          <label htmlFor="item_type_id" className="block text-lg font-semibold text-gray-700 mb-2">
            Item Type
          </label>
          <select
            id="item_type_id"
            {...register("item_type_id")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select an item type</option>
            {itemTypes.map((itemType) => (
              <option key={itemType.id} value={itemType.id}>
                {itemType.name}
              </option>
            ))}
          </select>
          {errors.item_type_id && (
            <p className="mt-2 text-sm text-red-500">{errors.item_type_id.message}</p>
          )}
        </div>

        {/* File Upload Component */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            Upload Images (Optional)
          </label>
          <CompressorFileInput onFilesSelected={setCompressedFiles} />
          {compressedFiles.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {compressedFiles.length} file(s) selected
            </p>
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
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={orgSelectDisabled}
          >
            {!orgSelectDisabled && (
              <option value="">{c("selectOrganization")}</option>
            )}
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          {errors.orgnization && (
            <p className="mt-2 text-sm text-red-500">{errors.orgnization.message}</p>
          )}
        </div>

        {/* Select Branch */}
        <div>
          <label htmlFor="branch_id" className="block text-lg font-semibold text-gray-700 mb-2">
            Branch
          </label>
          <select
            id="branch_id"
            {...register("branch_id")}
            disabled={!watchedOrganization || branches.length === 0}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">
              {!watchedOrganization 
                ? "Select an organization first" 
                : branches.length === 0 
                  ? "No branches available" 
                  : "Select a branch"
              }
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_name}
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
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
            className="w-full p-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting || isProcessing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Submit"
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