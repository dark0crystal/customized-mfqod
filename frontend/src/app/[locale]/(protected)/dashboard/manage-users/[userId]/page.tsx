import AddUserManagement from "./AddUserManagement";
import EditUserManagement from "./EditUserManagement";
import EditUserRole from "./EditUserRole";

export default function EditUserProfile({ params }: { params: { userId: string } }){



    return(
        <div className="w-full lg:w-[80%] ">
            <AddUserManagement userId={params.userId}/>
            <EditUserManagement userId={params.userId}/>
            <EditUserRole userId={params.userId}/> 

        </div>
    )
}