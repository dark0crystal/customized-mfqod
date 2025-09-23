"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "@/i18n/navigation";

type User = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

type UserSearchResponse = {
  users: User[];
  total_count: number;
  total_pages: number;
  page: number;
  limit: number;
};
const userCardStyle: Record<string, string> = {
  admin: "bg-gradient-to-l from-red-200 to-white",
  editor: "bg-gradient-to-l from-yellow-200 to-white",
  viewer: "bg-gradient-to-l from-green-200 to-white",
};


const schema = z.object({
  email: z.string().min(1, "Email is required").max(50, "Email is too long"),
});
type FormFields = z.infer<typeof schema>;

export default function ManageUsers() {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(schema),
  });
  const API_BASE = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';
  const [users, setUsers] = useState<any[]>([]); // State to store fetched users
  const [error, setFetchError] = useState<string | null>(null);

  const fetchUsers = async (email: string) => {
  try {
    const response = await fetch(`${API_BASE}/api/users/search?email=${encodeURIComponent(email)}&page=1&limit=10`);
    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }

    const data: UserSearchResponse = await response.json();
    setUsers(data.users);
    setFetchError(null);
  } catch (error: any) {
    setUsers([]);
    setFetchError(error.message || "Error fetching users.");
  }
};

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    await fetchUsers(data.email);
    reset(); // Reset the form
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Users</h1>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="mb-4">
        <input
          type="text"
          {...register("email")}
          className="border p-2 rounded w-full mb-2"
          placeholder="Search by email"
        />
        {errors.email && <div className="text-red-400">{errors.email.message}</div>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-4 py-2 rounded ${
            isSubmitting ? "bg-gray-400" : "bg-blue-600 text-white"
          }`}
        >
          {isSubmitting ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Error Message */}
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Results */}
      {users.map((user) => (
      <Link
        href={{ pathname: `/dashboard/manage-users/${user.id}` }}
        key={user.id}
        className={`flex items-center justify-between border p-4 my-2 rounded-2xl shadow-md transition hover:scale-[1.01] `}
        >
      <div>
        <p className="font-semibold">{user.email}</p>
        <p className="text-sm text-gray-600">{user.name || "N/A"}</p>
      </div>
      <div className={`text-sm font-medium text-gray-700 h-full ${
          user.role && userCardStyle[user.role] ? userCardStyle[user.role] : "bg-white"
        }`}>
        {user.role || "N/A"}
      </div>
    </Link>

      ))}

    </div>
  );
}