import ReportFoundItem from "@/components/forms/ReportFoundItemsForm"
import { WithPermissions } from "@/lib/server/withPermissions"

export default async function ReportItem() {
  return (
    <WithPermissions permission="can_manage_items">
      <div>
        <ReportFoundItem/>
      </div>
    </WithPermissions>
  )
}