
// import img1 from "../../../public/img1.jpeg"
// import img2 from "../../../public/img2.jpeg"
// import img3 from "../../../public/img3.jpeg"
// import img4 from "../../../public/img4.jpeg"
// import img5 from "../../../public/img5.jpeg"
// import Image from 'next/image';
// import TimeBasedWords from '../components/framer/TimeBaseWords';
// import CardsSection from '../components/CardSection';
// import TrustedBy from '../components/trusted-by/TrustedBy';
import Footer from "@/components/Footer"
import { getTranslations } from "next-intl/server"
// import { Link } from "@/i18n/navigation"
import { SearchButton } from "@/components/buttons/SearchButton"
import FoundButton from "@/components/buttons/FoundButton"
import CardsSection from "@/components/CardsSection"

export default async function Home() {
  
 const t = await getTranslations("HomePage")


  return (
    <main className="overflow-hidden flex flex-col justify-center "> 
      <div className="relative h-fit w-screen  mt-20 p-4 overflow-hidden">
        <div className='flex justify-center my-2 items-center'>
        {/* <TimeBasedWords/> */}
        </div>
        {/* Central Text */}
        <p className="text-center text-4xl font-extrabold text-black leading-relaxed">
          {t("title")}
        </p>

        <div className="flex flex-col items-center justify-center mt-2 rounded-lg  px-[2rem] md:px-[5rem] lg:px-[7rem] text-center">

        <div className="relative inline-block">
            <p className="relative text-center text-lg font-semibold text-black z-20">
            {t("description")}
            </p>
            <svg
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10"
              xmlns="http://www.w3.org/2000/svg"
              width="150"
              height="50"
              viewBox="0 0 150 50"
              fill="none"
            >
             <path
                d="M10 25c10 10 60 15 120 0"
                stroke="#add8e6" /* Light blue color */
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>


        
        <p className="text-center text-md font-medium text-gray-600 mt-6 underline decoration-blue-500 decoration-wavy">
          {t("versionMessage")}
        </p>

          <p className="text-center text-lg font-semibold text-black">
           
          </p>
          
        </div>

        {/* Bottom Center Card */}
        <div className='flex flex-col md:flex-row gap-4 items-center justify-center mt-16'>
          <SearchButton/>
          <FoundButton/>
        </div>

        {/* Bottom Right Card */}
        
      </div>

    <div>
      <CardsSection/>
    </div>

      <Footer/>
    </main>
  );
}





