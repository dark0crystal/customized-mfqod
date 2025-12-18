import ManageUsers from "./ManageUsers";
import { WithPermissions } from "@/lib/server/withPermissions";

export default async function ManageUsersPage() {
  return (
    <WithPermissions permission="can_manage_users">
      <ManageUsers />
    </WithPermissions>
  );
}