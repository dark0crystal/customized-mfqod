"use client"
import { Link } from "@/i18n/routing";
import DataProvider from "@/app/storage";
import { useTranslations } from "next-intl";
export default function NavbarSlider({ userRole, managedOrg , managedPlace }: { userRole: string; managedOrg?: any ,managedPlace?: any }) {
const t= useTranslations("storage")
  const { orgNames } = DataProvider();
  const renderLinks = () => {
    switch (userRole) {
      case "TECHADMIN":
        // Full access to all org names

        return (
          <div className="flex lg:flex-col flex-row overflow-x-auto lg:overflow-y-auto space-x-4 lg:space-x-0 lg:space-y-2">
          {orgNames.map((org, index) => (
            <Link
              key={index}
              href={{
                pathname: "/dashboard/posts",
                query: { orgName: org.key }, // Pass orgName as a query
              }}
            >
              <div className="bg-white border border-blue-200  p-3 rounded-md text-black hover:bg-blue-100 text-sm my-1 cursor-pointer min-w-[120px] lg:min-w-0 whitespace-nowrap">
                {org.name}
              </div>
            </Link>
          ))}
        </div>

        
          )
      case "ADMIN":
        // Full access to all places
        return(
        <div className="flex lg:flex-col flex-row overflow-x-auto lg:overflow-y-auto space-x-4 lg:space-x-0 lg:space-y-2">
         { orgNames.map((org, index) => (
            <Link
              key={index}
              href={{
                pathname: "/dashboard/posts",
                query: { orgName: org.key  }, // Pass orgName as a query
              }}
            >
              <div className="bg-white border border-blue-200  p-3 rounded-md text-black hover:bg-blue-100 text-sm my-2 cursor-pointer  whitespace-nowrap">
                {org.name}
              </div>
            </Link>
          ))}
        </div>
        )
      case "VERIFIED":
        // Access only to managed organizations
        return(
          <div className="flex lg:flex-col flex-row overflow-x-auto lg:overflow-y-auto space-x-4 lg:space-x-0 lg:space-y-2">
          <Link
         
            href={{
              pathname: "/dashboard/posts",
              query: { orgName: managedOrg}, // Pass orgName as a query
            }}
          >
            <div className="bg-white border border-blue-200  p-3 rounded-md text-black hover:bg-blue-100 text-sm my-2 cursor-pointer  whitespace-nowrap">
              {t(`org.${managedOrg}`)}
            </div>
          </Link>
           <Link
         
           href={{
             pathname: "/dashboard/posts",
             query: { orgName: managedOrg ,placeName:managedPlace}, // Pass orgName as a query
           }}
         >
           <div className="bg-white border border-blue-200  p-3 rounded-md text-black hover:bg-blue-100 text-sm  my-2 cursor-pointer  whitespace-nowrap">
             {t(`place.${managedPlace}`)}
           </div>
         </Link>
         </div>
        )

      case "BASIC":
        // Access only to their added places
        return (
          <div className="flex lg:flex-col flex-row overflow-x-auto lg:overflow-y-auto space-x-4 lg:space-x-0 lg:space-y-2">
                <h1>You are a normal user</h1>
          </div>
        )
      default:
        return <p>No access available</p>;
    }
  };

  return <div className="flex flex-col space-y-2">{renderLinks()}</div>;
}