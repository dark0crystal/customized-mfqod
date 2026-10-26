// app/admin/layout.tsx
import "./globals.css"
import { Outlet } from "react-router";
import { useLocale } from "use-intl";
import { PermissionsProvider } from "@/PermissionsContext";
import DashboardShell from "./DashboardShell";

export default function AdminLayout() {
  const locale = useLocale();
  const initialDirection = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <>
      <title>Admin Dashboard</title>
      <PermissionsProvider>
        <DashboardShell initialDirection={initialDirection}>
          <Outlet />
        </DashboardShell>
      </PermissionsProvider>
    </>
  );
}
