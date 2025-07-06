import { Link } from "@/i18n/navigation";
import NavbarSlider from "./NavbarSlider";
export default async function NavBar() {
  // const session = await auth();
  // if (!session) return null;
  // const userId = session.user?.id
  // if (!userId) return null;

  const result =await getUserRoleAndManagedPlaces(userId)


  return (
    <div >
      <div>
       
       <h1> Role: {result?.role}</h1>
     </div>
     
      {/* For the CTO */}
      {result.role == "TECHADMIN" &&
          <div>
            <h1>Hello my Founder & CTO </h1>
            <NavbarSlider userRole ={result.role} /> 
          </div>
      }
      {/* for admin  */}
      {result.role == "ADMIN" &&
          <div>
            <h1>Welcome Admin, Thank For Your Great Job </h1>
            <NavbarSlider userRole ={result.role}  /> 
          </div>
      }
      {/* for verified */}
      {result.role == "VERIFIED" && 
          
          <div>
            <div>
              <h1>Welcome manager </h1>
            </div>
            <NavbarSlider userRole ={result.role} managedOrg={result.managedOrg} managedPlace={result.managedPlace} /> 
          </div>
      }
       {/* for Basic */}
      {result.role == "BASIC" &&
          <div>
            <h1>Welcome You Are Basic User</h1>
            <NavbarSlider userRole ={result.role}/> 
          </div>
      }

      

      {/* <div  >
        <Link 
        href={{
          pathname: "/dashboard/posts",
          query: { id: `${userId}` }, // Pass user id in query
        }}>
          <h1 className="bg-sky-400 rounded-3xl py-3 px-4 text-center">Show Posts</h1>
        </Link>
      </div> */}

      <div>

      </div>


    </div>
  );
}



export async function getUserRoleAndManagedPlaces(userId: string) {
  try {
    const userWithManage = await prisma.user.findFirst({
      where: { id: userId },
      select: {
        role: true,
        manage: {
          take: 1, // Limit to only one record
          select: {
            place: true,
            orgnization: true,
          },
        },
      },
    });

    if (!userWithManage) {
      throw new Error("User not found");
    }

    // Extract the first (and only) item from `manage`
    const [firstManage] = userWithManage.manage;

    return {
      role: userWithManage.role,
      managedPlace: firstManage?.place ?? null,
      managedOrg: firstManage?.orgnization ?? null,
    };
  } catch (error) {
    console.error("Error fetching user role and managed places:", error);
    throw error;
  }
}