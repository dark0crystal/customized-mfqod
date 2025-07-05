"use client";

import { z } from "zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import DataProvider from "@/app/storage";

const schema = z.object({
  org: z.string().nonempty("Please select an organization"),
  place: z.string().nonempty("Please select a place"),
});

type FormFields = z.infer<typeof schema>;

export default function EditUserManagement({ userId }: { userId: string }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting }, reset } = useForm<FormFields>();
  const [organization, setOrganization] = useState<string>("");
  const [placeOptions, setPlaceOptions] = useState<{ key: string; name: string }[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {OrgPlaces ,orgNames}  = DataProvider();
  // Fetch existing data for the user
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/get-manage/${userId}`);
        if (!response.ok) throw new Error("Failed to fetch user data");

        const data = await response.json();
        setValue("org", data.organization);
        setOrganization(data.organization);
        setValue("place", data.place);

        const selectedOrgData = OrgPlaces.find(org => org.key === data.organization);
        if (selectedOrgData) {
          setPlaceOptions(selectedOrgData.places);
        }
      } catch (error: any) {
        console.error(error.message);
      }
    }
    fetchData();
  }, [userId, setValue, OrgPlaces]);

  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOrg = e.target.value;
    setOrganization(selectedOrg);

    const selectedOrgData = OrgPlaces.find(org => org.key === selectedOrg);
    if (selectedOrgData) {
      const places = selectedOrgData.places;
      setPlaceOptions(places);
      setValue("place", "");
    } else {
      setPlaceOptions([]);
    }
  };

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/edit-manage", {
        method: "POST",
        body: JSON.stringify({ userId, body: data }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to update user management");
      }

      setSuccessMessage("User management updated successfully!");
    } catch (error: any) {
      setErrorMessage(error.message || "An error occurred while updating user management");
    }

    reset();
  };

  return (
    <div>
      <h1 className="text-lg font-bold">Edit User Management</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Organization */}
        <div>
          <label htmlFor="org" className="block text-sm font-medium">Organization</label>
          <select
            id="org"
            value={organization}
            {...register("org")}
            onChange={handleOrganizationChange}
            className="w-full p-2 border rounded"
          >
            <option value="" disabled>Select Organization</option>
            {orgNames.map((org, index) => {
             
              return (
                <option key={index} value={org.key}>{org.name}</option>
              );
            })}
          </select>
          {errors.org && <p className="text-red-500 text-sm">{errors.org.message}</p>}
        </div>

        {/* Place */}
        {placeOptions.length > 0 && (
          <div>
            <label htmlFor="place" className="block text-sm font-medium">Place</label>
            <select
              id="place"
              {...register("place")}
              className="w-full p-2 border rounded"
            >
              <option value="" disabled>Select Place</option>
              {placeOptions.map((place, index) => (
                <option key={index} value={place.key}>{place.name}</option>
              ))}
            </select>
            {errors.place && <p className="text-red-500 text-sm">{errors.place.message}</p>}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>

        {/* Feedback */}
        {successMessage && <p className="text-green-500">{successMessage}</p>}
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
      </form>
    </div>
  );
}