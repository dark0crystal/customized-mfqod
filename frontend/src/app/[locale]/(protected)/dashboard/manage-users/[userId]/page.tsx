import EditUserManagement from "./EditUserManagement";
import EditUserRole from "./EditUserRole";


export default function EditUserProfile({ params }: { params: { userId: string } }){



    return(
        <div className="w-full lg:w-[80%] ">
            <EditUserManagement userId={params.userId}/>
            {/* <EditUserRole userId={params.userId}/> */}
        </div>  
    )
}