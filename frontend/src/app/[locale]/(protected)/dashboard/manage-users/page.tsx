import ManageUsers from "./ManageUsers";
import { auth } from "../../../../../../auth";
import prisma from "@/lib/db";

export default async function ManageUsersPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <div>You must be logged in to access this page.</div>;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
    },
  });

  if (!user) {
    return <div>User not found.</div>;
  }

  return (
    <>
      {user.role === "TECHADMIN" ? (
        <ManageUsers />
      ) : (
        <div>You can not access this page</div>
      )}
    </>
  );
}