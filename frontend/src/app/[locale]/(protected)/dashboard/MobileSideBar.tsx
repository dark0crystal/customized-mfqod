"use client"
import { useState } from "react"
export default function MobileSideBar(){

    const [show ,setShow] = useState(false)

   function handleShow(){
    setShow(!show)
   }

  
    return(
        <div>
        <button onClick={handleShow}>
           nav
        </button>
        </div>
    )
}