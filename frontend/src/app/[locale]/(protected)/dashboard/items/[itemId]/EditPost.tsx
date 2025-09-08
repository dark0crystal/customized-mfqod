// 'use client';

// import { supabase } from "@/lib/supabase";
// import { SubmitHandler, useForm } from "react-hook-form";
// import { useState, useEffect } from "react";
// import ReactConfetti from "react-confetti";
// import { OrgPlaces } from "@/app/storage";

// type ItemFormFields = {
//   title: string;
//   content: string;
//   type: string;
//   place: string;
//   country: string;
//   orgnization: string;
//   image: FileList;
// };

// type EditPostProps = {
//   postData: {
//     id: string;
//     title: string;
//     content: string;
//     type: string;
//     place: string;
//     country: string;
//     orgnization: string;
//     images: string[]; // Array of image URLs
//   };
// };

// export default function EditPost({ params, postData }: { params: { postId: string }; postData: EditPostProps['postData'] }) {
//   const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<ItemFormFields>({
//     defaultValues: {
//       title: postData.title,
//       content: postData.content,
//       type: postData.type,
//       place: postData.place,
//       country: postData.country,
//       orgnization: postData.orgnization,
//     },
//   });

//   const [organization, setOrganization] = useState<string>(postData.orgnization || "");
//   const [placeOptions, setPlaceOptions] = useState<string[]>([]);
//   const [confetti, setConfetti] = useState(false);

//   // Handle form submission
//   const onSubmit: SubmitHandler<ItemFormFields> = async (data) => {
//     try {
//       const response = await fetch("/api/upload-found-item", {
//         method: "PATCH",
//         body: JSON.stringify({ postId: params.postId, data }),
//         headers: { "Content-Type": "application/json" },
//       });

//       const result = await response.json();
//       if (response.ok) {
//         setConfetti(true);

//         if (data.image?.length > 0) {
//           const uploadPromises = Array.from(data.image).map((file) => {
//             const filePath = `${params.postId}/${file.name}`;
//             return supabase.storage.from("mfqodFiles").upload(filePath, file);
//           });

//           await Promise.all(uploadPromises);
//         }

//         reset();
//       } else {
//         console.error("Failed to update item:", result.error);
//       }
//     } catch (error) {
//       console.error("Error submitting form:", error);
//     }
//   };

//   // Handle organization change
//   const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
//     const selectedOrg = e.target.value;
//     setOrganization(selectedOrg);
//     setValue("orgnization", selectedOrg);

//     const selectedOrgData = OrgPlaces.find((org) => Object.keys(org)[0] === selectedOrg);
//     setPlaceOptions(selectedOrgData ? Object.values(selectedOrgData)[0] : []);
//   };

//   useEffect(() => {
//     if (confetti) {
//       const timer = setTimeout(() => setConfetti(false), 3000);
//       return () => clearTimeout(timer);
//     }
//   }, [confetti]);

//   return (
//     <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
//       {confetti && <ReactConfetti width={window.innerWidth} height={window.innerHeight} />}

//       <h2 className="text-2xl font-bold text-center text-indigo-600 mb-6">Edit Found Item</h2>

//       <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
//         {/* Input fields */}
//         {/* Title */}
//         <div>
//           <label htmlFor="title" className="block text-lg font-semibold text-gray-700">Title</label>
//           <input
//             type="text"
//             id="title"
//             {...register("title", { required: "Title is required" })}
//             className="w-full p-3 border border-gray-300 rounded-lg"
//           />
//           {errors.title && <p className="mt-2 text-sm text-red-500">{errors.title.message}</p>}
//         </div>

//         {/* Content */}
//         <div>
//           <label htmlFor="content" className="block text-lg font-semibold text-gray-700">Details</label>
//           <textarea
//             id="content"
//             {...register("content", { required: "Details are required" })}
//             className="w-full p-3 border border-gray-300 rounded-lg"
//           />
//           {errors.content && <p className="mt-2 text-sm text-red-500">{errors.content.message}</p>}
//         </div>

//         {/* Organization */}
//         <div>
//           <label htmlFor="orgnization" className="block text-lg font-semibold text-gray-700">Organization</label>
//           <select
//             id="orgnization"
//             value={organization}
//             onChange={handleOrganizationChange}
//             className="w-full p-3 border border-gray-300 rounded-lg"
//           >
//             <option value="" disabled>Select Organization</option>
//             {OrgPlaces.map((org, index) => (
//               <option key={index} value={Object.keys(org)[0]}>
//                 {Object.keys(org)[0]}
//               </option>
//             ))}
//           </select>
//         </div>

//         {/* Country */}
//         <div>
//           <label htmlFor="country" className="block text-lg font-semibold text-gray-700">Country</label>
//           <select
//             id="country"
//             {...register("country", { required: "Country is required" })}
//             className="w-full p-3 border border-gray-300 rounded-lg"
//           >
//             <option value="Oman">Oman</option>
//           </select>
//         </div>

//         {/* Submit */}
//         <button
//           type="submit"
//           disabled={isSubmitting}
//           className={`w-full p-3 text-white font-semibold rounded-lg ${
//             isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
//           }`}
//         >
//           {isSubmitting ? "Submitting..." : "Submit"}
//         </button>
//       </form>
//     </div>
//   );
// }