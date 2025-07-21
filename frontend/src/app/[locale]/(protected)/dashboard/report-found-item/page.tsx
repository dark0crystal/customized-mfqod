import ReportFoundItem from "@/components/forms/ReportFoundItemsForm"
// import {auth} from '../../../../auth'
// import {redirect} from '@/i18n/navigation';
// import { getLocale } from "next-intl/server"; 
export default async function ReportItem() {
//   const session = await auth();

//   if(!session){
//     redirect({href: '/login', locale:`${locale}`});
//   }
  return(
    <div>
      <ReportFoundItem/>
    </div>
  )
}