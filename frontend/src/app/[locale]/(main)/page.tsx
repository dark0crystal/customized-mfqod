import Footer from "@/components/Footer"
import { getTranslations } from "next-intl/server"
import { SearchButton } from "@/components/buttons/SearchButton"
import FoundButton from "@/components/buttons/FoundButton"
import NewCardsSection from "@/components/NewCardsSection"
import SplashScreen from "@/components/SplashScreen"

export default async function Home() {
  const t = await getTranslations("HomePage")


  return (
    <main className="overflow-hidden flex flex-col justify-center "> 
      <SplashScreen />
      <div className="relative h-fit w-screen  mt-20 p-4 overflow-hidden">
        <div className='flex justify-center my-2 items-center'>
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



        </div>

        <div className='flex flex-col md:flex-row gap-4 items-center justify-center mt-16'>
          <SearchButton/>
          <FoundButton/>
        </div>
      </div>

    <div>
      <NewCardsSection/>
    </div>

      <Footer/>
    </main>
  );
}
