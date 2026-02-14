import ReportFoundItem from "@/components/forms/ReportFoundItemsForm"
import ProtectedPage from '@/components/protection/ProtectedPage'

export default function ReportItem() {
  return (
    <ProtectedPage requiredPermission="can_manage_items">
      <div>
        <ReportFoundItem/>
      </div>
    </ProtectedPage>
  )
}