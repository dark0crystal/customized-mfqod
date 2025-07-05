import { auth } from "../../../../../auth"
import Image from "next/image"
import img2 from "../../../../../public/bg11.jpg"
export default async function UserInfo(){

    const session = await auth()
    if(!session) return null

    return(
       <>
       
        <div className="flex flex-col justify-center items-center w-full h-fit p-8 mt-12 rounded-3xl bg-slate-400/40">
            <div>
           
          
            {
                session.user?.image == null ?(
                    <div className="relative rounded-full w-[60px] h-[60px] overflow-hidden">
                        <Image src={img2} alt="use profile img" className="absolute" fill objectFit="cover"/>
                    </div>
                ):(
           
                    <div className="relative rounded-full w-[60px] h-[60px] overflow-hidden">                  
                         <Image src={session.user?.image} alt="use profile img" className="absolute" fill objectFit="cover"/>
                    </div> 
                )}               
            </div>
            <div>
                <p className="text-sm md:text-xl ">{session.user?.name}</p>
            </div>
            <div>
                <p className="text-sm text-black/70 md:text-lg ">{session.user?.email}</p>
            </div>
            
            </div>
        
        </>
        

    )
}