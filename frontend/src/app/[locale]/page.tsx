
import img1 from "../../../public/img1.jpeg"
import img2 from "../../../public/img2.jpeg"
import img3 from "../../../public/img3.jpeg"
import img4 from "../../../public/img4.jpeg"
import img5 from "../../../public/img5.jpeg"
import Image from 'next/image';
import TimeBasedWords from '../components/framer/TimeBaseWords';
import CardsSection from '../components/CardSection';
import TrustedBy from '../components/trusted-by/TrustedBy';
import Footer from "../components/Footer"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/routing"
import { SearchButton } from "../components/Buttons/SearchButton"
import FoundButton from "../components/Buttons/FoundButton"

export default async function Home() {
  
 const t = await getTranslations("HomePage")


  return (
    <main className="overflow-hidden flex flex-col justify-center "> 
      <div className="relative h-fit w-screen  mt-20 p-4 overflow-hidden">
        <div className='flex justify-center my-2 items-center'>
        <TimeBasedWords/>
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


    <div>
      <TrustedBy/>
    </div>
  
     
      {/* <div ref={container}>
        <Slide src={img5} direction={'left'} left={"-40%"} progress={scrollYProgress}/>
        <Slide src={img2} direction={'right'} left={"-25%"} progress={scrollYProgress}/>
        <Slide src={img3} direction={'left'}  left={"-75%"} progress={scrollYProgress}/>
      </div> */}
     

      <Footer/>
    </main>
  );
}

// const Slide = (props:any) => {
//   const direction = props.direction == 'left' ? -1 : 1;
//   const translateX = useTransform(props.progress, [0, 1], [150 * direction, -150 * direction])
//   return (
//     <motion.div style={{x: translateX, left: props.left}} className="relative flex whitespace-nowrap">
//       <Phrase src={props.src}/>
//       <Phrase src={props.src}/>
//       <Phrase src={props.src}/>
//     </motion.div>
//   )
// }

// const Phrase = ({src}:any) => {

//   return (
//     <div className={'px-5 flex gap-5 items-center'}>
//       <p className='text-[6vw] text-black/44 font-bold'>مغيب شي ؟ مفقود بيساعدك</p>
//       <span className="relative h-[7.5vw] aspect-[4/2] rounded-full overflow-hidden">
//         <Image style={{objectFit: "cover"}} src={src} alt="image" fill/>
//       </span>
//     </div>
//   )
// }


// async function FoundButton() {
//   const t = await getTranslations("HomePage")
//   return (
//     <Link href="/report-found-item" className=" w-full md:w-[200px] bg-gradient-to-r from-white to-white border border-black p-4 rounded-xl text-black font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
//       <h1>{t("report")}</h1>
//     </Link>
//   );
// }

// async function SearchButton() {
//   const t = await getTranslations("HomePage")
//   return (
//     <Link href="/search" className="w-full md:w-[200px]  bg-gradient-to-r from-[#2196f3] to-[#2f7ce1] p-4 rounded-xl text-white font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
//       {t("search")}
//     </Link>
//   );
// }