import { Link } from "@/i18n/navigation";
import Brand from "./Brand";
import Profile from "./Profile";
// import { FaSearch } from "react-icons/fa";
import { getTranslations } from "next-intl/server";
import MobileNavbar from "./MobileNavbar";


export default async function NavBar() {
  // const locale = (await getLocale()).substring(0, 2); // This will give you "ar" or "en"

  const t = await getTranslations("navbar");


  return (
    <>
    <nav  className="lg:flex items-center justify-center h-[12vh] max-h-[12vh] hidden ">
      
      <div className='grid grid-cols-12  p-2 lg:p-2  w-full '>
      


        {/* right section ar links */}
        <div className="flex items-center justify-center p-3 rounded-lg col-span-5 ">
         
            <Link href="/search" >
              <div className="p-2  mx-4">
                  <h1 className="text-[0.9rem] lg:text-[1rem] text-md text-gray-700 font-normal hover:text-blue-600">{t("search")}</h1>
                  
              </div>
            </Link>

            <Link href="/report-found-item" >
              <div className="p-2  mx-4">
                  <h1 className="text-[1rem] text-gray-700 font-normal hover:text-blue-600">{t("report")}</h1>
              </div>
            </Link>
      
        </div>


          {/* Center Section Brand */}
        <div className="flex items-center justify-center col-span-2">
            <Brand />
        </div>


        {/* left section ar */}
        <div className="flex items-center justify-center p-3 rounded-lg col-span-5 ">
          <div>

            <Profile/>
          </div>
         
        </div>
        
        {/* <LanguageChange /> */}
        {/* <MobileMenu navLinks={navLinks} /> */}
      </div>
    </nav>
    <MobileNavbar/>
    </>
  );
}