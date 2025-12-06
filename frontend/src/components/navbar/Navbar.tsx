"use client";
import { Link } from "@/i18n/navigation";
import Brand from "./Brand";
import { useTranslations } from "next-intl";
import MobileNavbar from "./MobileNavbar";
import { tokenManager } from "@/utils/tokenManager";
import { useRouter } from "next/navigation";
import LanguageChange from "./LangChange";
import UserProfile from "./UserProfile";

export default function NavBar() {
  const t = useTranslations("navbar");
  const router = useRouter();

  const handleReportClick = () => {
    if (!tokenManager.isAuthenticated()) {
      router.push('/auth/login');
    } else {
      router.push('/dashboard/report-missing-item');
    }
  };

  return (
    <>
    <nav  className="lg:flex items-center justify-center h-[12vh] max-h-[12vh] hidden ">
      
      <div className='grid grid-cols-12  p-2 lg:p-2  w-full '>
      

        {/* right section ar links */}
        <div className="flex items-center justify-center p-3 rounded-lg col-span-4 ">
         
            <Link href="/search">
              <div className="p-2  mx-4">
                  <h1 className="text-[0.9rem] lg:text-[1rem] text-md text-gray-700 font-normal hover:text-blue-600">{t("search")}</h1>
                  
              </div>
            </Link>

            <button onClick={handleReportClick}>
              <div className="p-2  mx-4">
                  <h1 className="text-[1rem] text-gray-700 font-normal hover:text-blue-600">{t("report")}</h1>
              </div>
            </button>

            <Link href="/branches-info">
              <div className="p-2  mx-4">
                  <h1 className="text-[0.9rem] lg:text-[1rem] text-md text-gray-700 font-normal hover:text-blue-600">{t("branchesInfo")}</h1>
                  
              </div>
            </Link>

            
      
        </div>


          {/* Center Section Brand */}
        <div className="flex items-center justify-center col-span-4">
            <Brand />
        </div>


        {/* left section with language change and user profile */}
        <div className="flex items-center justify-center p-3 rounded-lg col-span-4 space-x-4">
          <LanguageChange />
          <UserProfile />
        </div>
        
      </div>
    </nav>
    <MobileNavbar/>
    </>
  );
}