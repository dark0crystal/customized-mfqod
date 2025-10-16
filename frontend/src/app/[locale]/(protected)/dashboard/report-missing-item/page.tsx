import ReportMissingItemForm from "@/components/forms/ReportMissingItemForm"
// import {auth} from '../../../../auth'
// import {redirect} from '@/i18n/navigation';
// import { getLocale } from "next-intl/server"; 
export default async function ReportMissingItem() {
//   const session = await auth();

//   if(!session){
//     redirect({href: '/login', locale:`${locale}`});
//   }
  return(
    <div>
      <ReportMissingItemForm/>
    </div>
  )
}
