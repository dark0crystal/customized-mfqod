// "use client";

// import { z } from "zod";
// import { SubmitHandler, useForm } from "react-hook-form";
// import { useState } from "react";
// import DataProvider from "@/app/storage";

// const schema = z.object({
//   org: z.string().nonempty("Please select an organization"),
//   place: z.string().nonempty("Please select a place"),
// });

// type FormFields = z.infer<typeof schema>;

// export default function AddUserManagement({ userId }: { userId: string }) {
//   const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<FormFields>();
//   const [organization, setOrganization] = useState<string>(""); // Organization state
//   const [placeOptions, setPlaceOptions] = useState<{ key: string; name: string }[]>([]);
//   const [successMessage, setSuccessMessage] = useState<string | null>(null);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);

//   const {OrgPlaces ,orgNames} = DataProvider();


//   const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
//     const selectedOrg = e.target.value;
//     setOrganization(selectedOrg);

//     const selectedOrgData = OrgPlaces.find(org => org.key === selectedOrg);
//     if (selectedOrgData) {
//       const places = selectedOrgData;
//       setPlaceOptions(selectedOrgData.places);
//       setValue("place", ""); // Reset the selected place
//     } else {
//       setPlaceOptions([]);
//     }
//   };

//   const onSubmit: SubmitHandler<FormFields> = async (data) => {
//     setSuccessMessage(null);
//     setErrorMessage(null);

//     try {
//       const response = await fetch("/api/add-manage", {
//         method: "POST",
//         body: JSON.stringify({ userId, body: data }),
//         headers: { "Content-Type": "application/json" },
//       });

//       if (!response.ok) {
//         throw new Error("Failed to add user management");
//       }

//       setSuccessMessage("User management added successfully!");
//     } catch (error: any) {
//       setErrorMessage(error.message || "An error occurred while adding user management");
//     }

//     reset(); // Reset form fields
//     setPlaceOptions([]); // Reset place options
//   };

//   return (
//     <div>
//       <h1 className="text-lg font-bold ">Add User Management</h1>
//       <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full">
//         {/* Organization */}
//         <div>
//           <label htmlFor="org" className="block text-sm font-medium">Organization</label>
//           <select
//             id="org"
//             value={organization}
//             {...register("org")}
//             onChange={handleOrganizationChange}
//             className="w-full p-2 border rounded"
//           >
//             <option value="" disabled>Select Organization</option>
//             {orgNames.map((org, index) => {
//               return (
//                 <option key={index} value={org.key}>{org.name}</option>
//               );
//             })}
//           </select>
//           {errors.org && <p className="text-red-500 text-sm">{errors.org.message}</p>}
//         </div>

//         {/* Place */}
//         {placeOptions.length > 0 && (
//           <div>
//             <label htmlFor="place" className="block text-sm font-medium">Place</label>
//             <select
//               id="place"
//               {...register("place")}
//               className="w-full p-2 border rounded"
//             >
//               <option value="" disabled>Select Place</option>
//               {placeOptions.map((place, index) => (
//                 <option key={index} value={place.key}>{place.name}</option>
//               ))}
//             </select>
//             {errors.place && <p className="text-red-500 text-sm">{errors.place.message}</p>}
//           </div>
//         )}

//         {/* Submit */}
//         <button
//           type="submit"
//           disabled={isSubmitting}
//           className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
//         >
//           {isSubmitting ? "Submitting..." : "Submit"}
//         </button>

//         {/* Feedback */}
//         {successMessage && <p className="text-green-500">{successMessage}</p>}
//         {errorMessage && <p className="text-red-500">{errorMessage}</p>}
//       </form>
//     </div>
//   );
// }