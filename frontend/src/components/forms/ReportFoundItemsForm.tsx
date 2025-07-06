"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import ReactConfetti from "react-confetti";
// import DataProvider from "@/app/storage";
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
});

type ItemFormFields = z.infer<typeof itemFormSchema>;

export default function ReportFoundItem() {
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    setValue 
  } = useForm<ItemFormFields>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      country: "Oman"
    }
  });

  const [organization, setOrganization] = useState<string>("");
  const [placeOptions, setPlaceOptions] = useState<{ key: string; name: string }[]>([]);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const t = useTranslations("storage");
  const c = useTranslations("report-found");
  const { OrgPlaces } = DataProvider();
  const router = useRouter();
  const orgPlacesRef = useRef(OrgPlaces);

  const onSubmit = async (data: ItemFormFields) => {
    try {
      setIsProcessing(true);
      
      // Create FormData to handle both form data and files
      const formData = new FormData();
      
      // Append form fields
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Append compressed files
      compressedFiles.forEach((file, index) => {
        formData.append(`images`, file);
      });

      const response = await fetch("/api/upload-found-item", {
        method: "POST",
        body: formData, // Send as FormData instead of JSON
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Item uploaded successfully.");
        setConfetti(true);
        reset();
        setCompressedFiles([]);
        
        // Redirect after successful submission and a short delay for confetti
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        console.error("Failed to upload item:", result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOrg = e.target.value;
    setOrganization(selectedOrg);

    const selectedOrgData = orgPlacesRef.current.find(
      (org) => org.key === selectedOrg
    );
    
    if (selectedOrgData) {
      const places = selectedOrgData.places;
      setPlaceOptions(places);
      setValue("place", "");
    } else {
      setPlaceOptions([]);
    }
  };

  // Initialize place options when organization changes
  useEffect(() => {
    if (organization) {
      const selectedOrgData = orgPlacesRef.current.find(
        (org) => org.key === organization
      );
      if (selectedOrgData) {
        setPlaceOptions(selectedOrgData.places);
      }
    }
  }, [organization]);

  // Store OrgPlaces in ref to avoid dependency issues
  useEffect(() => {
    orgPlacesRef.current = OrgPlaces;
  }, [OrgPlaces]);

  useEffect(() => {
    if (confetti) {
      const timer = setTimeout(() => {
        setConfetti(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

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
        <div>
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
            {...register("orgnization")}
            onChange={handleOrganizationChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>
              {c("selectOrganization")}
            </option>
            {OrgPlaces.map((org, index) => {
              const orgName = Object.keys(org)[0];
              return (
                <option key={index} value={org.key}>
                  {t(`org.${org.key}`)}
                </option>
              );
            })}
          </select>
          {errors.orgnization && (
            <p className="mt-2 text-xs text-red-500">{errors.orgnization.message}</p>
          )}
        </div>

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
            disabled={isSubmitting || isProcessing} 
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