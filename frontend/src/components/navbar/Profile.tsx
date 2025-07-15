// "use client";

// import { useState } from "react";
// // import { useSession } from "next-auth/react";
// // import Image from "next/image";
// // import { SignOut } from "../auth/client/signout-button";
// // import { SignIn } from "../auth/client/signin-button";
// // import defaultProfileImage from "../../../../public/bg11.jpg";
// import { Link } from "@/i18n/navigation";
// import { useTranslations } from "next-intl";

// export default function Profile() {
//   const [show, setShow] = useState(false);
//   // const { data: session, status } = useSession();

//   const t= useTranslations("navbar")

//   function handleProfile() {
//     setShow((prev) => !prev);
//   }

//   return (
//     <div className="flex justify-center items-center h-screen">
//       {status === "unauthenticated" ? (
//         <div className=" w-full  md:w-[120px] bg-gradient-to-r from-blue-100/40 to-blue-100 border border-gray-600 p-4 md:p-2 rounded-full text-gray-700 font-semibold md:font-medium text-xl md:text-base text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
//           {/* <SignIn /> */}
//         </div>
//       ) : (
//         <div className="relative flex items-center gap-2"> 
//           {/* Profile Button */}
//           <button
//             onClick={handleProfile}
//             className="relative w-[43px] h-[43px] rounded-xl overflow-hidden border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             aria-label="Toggle profile menu"
//           >
//             {/* <Image
//               src={session?.user?.image || defaultProfileImage}
//               alt="Profile Image"
//               fill
//               objectFit="cover"
//               className="rounded-xl"
//             /> */}
        
//           </button>

//            {/* Username and Email */}
//            <div className="flex flex-col">
//             {/* <p className="text-sm font-medium">{session?.user?.name || "Guest"}</p>
//             <p className="text-sm text-gray-600">{session?.user?.email || "No email provided"}</p> */}
//           </div>

//           {/* Dropdown Menu */}
//           {show && (
//             <div
//               className="absolute bottom-[60px] lg:top-[60px] left-1/2 transform -translate-x-1/2 w-fit bg-white shadow-lg rounded-lg p-4 z-50 h-fit whitespace-nowrap"
//               onClick={() => setShow(false)}
//             >
//               <div className="flex flex-col items-center text-gray-800 space-y-5 m-3">
//                 {/* User Dashboard */}
//                 <Link href="/dashboard" className="text-sm w-[200px]  text-gray-700  hover:text-blue-500    bg-gradient-to-r from-[#d7eeff] to-[#93bcd2]  py-3 px-6  rounded-xl  font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
//                   {t("dashboard")}
//                 </Link>

               
//                 {/* Sign Out Button */}
//                 <div className=" w-[200px] text-sm bg-gradient-to-r from-[#ff512a] to-[#d42727] py-3 px-6  rounded-xl text-white font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
//                   {/* <SignOut /> */}
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }