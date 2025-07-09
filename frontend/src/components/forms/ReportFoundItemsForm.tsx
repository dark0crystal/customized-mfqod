"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
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
    for (let cookie of cookies) {
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

export default function ReportFoundItem() {
  // API configuration
  const API_BASE_URL = 'http://localhost:8000'; // Adjust to your FastAPI server

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    setValue 
  } = useForm<ItemFormFields>({
    // resolver: zodResolver(itemFormSchema),
    defaultValues: {
      country: "Oman"
    }
  });

  const [organization, setOrganization] = useState<string>("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [placeOptions, setPlaceOptions] = useState<{ key: string; name: string }[]>([]);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // const t = useTranslations("storage");
  const c = useTranslations("report-found");
  const router = useRouter();

  // Check if user is authenticated
  useEffect(() => {
    const token = getTokenFromCookies();
    if (!token) {
      setAuthError("Authentication required. Please log in first.");
      // Optionally redirect to login page
      // router.push("/login");
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
        } else if (organizationsResponse.status === 401) {
          setAuthError("Authentication failed. Please log in again.");
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
        } else {
          console.error('Failed to fetch item types');
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const onSubmit = async (data: ItemFormFields) => {
    if (authError) {
      alert("Please log in first to submit an item.");
      return;
    }

    try {
      setIsProcessing(true);
      
      // Create FormData to handle both form data and files
      const formData = new FormData();
      
      // Append form fields
      Object.entries(data).forEach(([key, value]) => {
        console.log(value)
        formData.append(key, value);
      });
      
      // Append compressed files
      // compressedFiles.forEach((file, index) => {
      //   formData.append(`images`, file);
      // });
      
      // upload item
      const response = await fetch(`${API_BASE_URL}/items/`, {
        method: "POST",
        headers: getAuthHeadersForFormData(),
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Item uploaded successfully.");
        setConfetti(true);
        reset();
        setCompressedFiles([]);
        setOrganization("");
        setBranches([]);
        
        // Redirect after successful submission and a short delay for confetti
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else if (response.status === 401) {
        setAuthError("Authentication failed. Please log in again.");
      } else {
        console.error("Failed to upload item:", result.error || "Unknown error");
        alert(`Failed to upload item: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("An error occurred while submitting the form. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOrganizationChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOrgId = e.target.value;
    setOrganization(selectedOrgId);
    setValue("orgnization", selectedOrgId);

    // Fetch branches for the selected organization
    if (selectedOrgId) {
      try {
        const branchesResponse = await fetch(`${API_BASE_URL}/organization/organizations/${selectedOrgId}/branches/`, {
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
    } else {
      setBranches([]);
    }
    
    // Reset branch and place selection
    setValue("branch_id", "");
    setValue("place", "");
    setPlaceOptions([]);
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedBranchId = e.target.value;
    setValue("branch_id", selectedBranchId);
    
    // You can add logic here to fetch places for the selected branch
    // For now, using the existing OrgPlaces logic if available
    const selectedBranch = branches.find(branch => branch.id === selectedBranchId);
    if (selectedBranch) {
      // If you have place data associated with branches, set it here
      // setPlaceOptions(selectedBranch.places || []);
    }
  };

  useEffect(() => {
    if (confetti) {
      const timer = setTimeout(() => {
        setConfetti(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Show authentication error if present
  if (authError) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="flex justify-center items-center h-64 flex-col">
          <div className="text-lg text-red-600 mb-4">{authError}</div>
          <button 
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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
        />
      )}
      <h2 className="text-2xl font-bold text-center text-indigo-600 mb-6">
        {c("title")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-lg font-semibold text-gray-700">
            {c("whatDidYouFind")}
          </label>
          <input
            type="text"
            id="title"
            {...register("title")}
            placeholder="e.g., Key, Wallet, etc."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.title && (
            <p className="mt-2 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Content Input */}
        <div>
          <label htmlFor="content" className="block text-lg font-semibold text-gray-700">
            {c("Details")}
          </label>
          <input
            type="text"
            id="content"
            {...register("content")}
            placeholder="Provide additional details about the item"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.content && (
            <p className="mt-2 text-xs text-red-500">{errors.content.message}</p>
          )}
        </div>

        {/* Type Input */}
        {/* <div>
          <label htmlFor="type" className="block text-lg font-semibold text-gray-700">
            {c("type")}
          </label>
          <input
            type="text"
            id="type"
            {...register("type")}
            placeholder="Type of item (e.g., Wallet, Phone)"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.type && (
            <p className="mt-2 text-xs text-red-500">{errors.type.message}</p>
          )}
        </div> */}

        {/* Item Type Selection */}
        <div>
          <label htmlFor="item_type_id" className="block text-lg font-semibold text-gray-700">
            Item Type
          </label>
          <select
            id="item_type_id"
            {...register("item_type_id")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>
              Select an item type
            </option>
            {itemTypes.map((itemType) => (
              <option key={itemType.id} value={itemType.id}>
                {itemType.name}
              </option>
            ))}
          </select>
          {errors.item_type_id && (
            <p className="mt-2 text-xs text-red-500">{errors.item_type_id.message}</p>
          )}
        </div>

        <CompressorFileInput onFilesSelected={setCompressedFiles} />

        {/* Select Organization */}
        <div>
          <label htmlFor="orgnization" className="block text-lg font-semibold text-gray-700">
            {c("organization")}
          </label>
          <select
            id="orgnization"
            value={organization}
            onChange={handleOrganizationChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>
              {c("selectOrganization")}
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          {errors.orgnization && (
            <p className="mt-2 text-xs text-red-500">{errors.orgnization.message}</p>
          )}
        </div>

        {/* Select Branch */}
        {branches.length > 0 && (
          <div>
            <label htmlFor="branch_id" className="block text-lg font-semibold text-gray-700">
              Branch
            </label>
            <select
              id="branch_id"
              {...register("branch_id")}
              onChange={handleBranchChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>
                Select a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
            {errors.branch_id && (
              <p className="mt-2 text-xs text-red-500">{errors.branch_id.message}</p>
            )}
          </div>
        )}

        {/* Select Place */}
        {placeOptions.length > 0 && (
          <div>
            <label htmlFor="place" className="block text-lg font-semibold text-gray-700">
              {c("place")}
            </label>
            <select
              id="place"
              {...register("place")}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>
                {c("selectPlace")}
              </option>
              {placeOptions.map((place, index) => (
                <option key={index} value={place.key}>
                  {place.name}
                </option>
              ))}
            </select>
            {errors.place && (
              <p className="mt-2 text-xs text-red-500">{errors.place.message}</p>
            )}
          </div>
        )}

        {/* Select Country */}
        <div>
          <label htmlFor="country" className="block text-lg font-semibold text-gray-700">
            {c("country")}
          </label>
          <select
            id="country"
            {...register("country")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Oman">Oman</option>
          </select>
          {errors.country && (
            <p className="mt-2 text-xs text-red-500">{errors.country.message}</p>
          )}
        </div>
        
        <div className="text-center">
          <button 
            type="submit" 
            disabled={isSubmitting || isProcessing || isLoading || !!authError} 
            className="w-full p-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {isSubmitting || isProcessing ? "Processing..." : "Submit"}
          </button>
        </div>
        <div className="text-center">
          <h1>{c("note")}</h1>
        </div>
      </form>
    </div>
  );
}