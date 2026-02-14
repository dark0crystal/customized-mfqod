import ManageUsers from "./ManageUsers";
import ProtectedPage from '@/components/protection/ProtectedPage';

export default function ManageUsersPage() {
  return (
    <ProtectedPage requiredPermission="can_manage_users">
      <ManageUsers />
    </ProtectedPage>
  );
}