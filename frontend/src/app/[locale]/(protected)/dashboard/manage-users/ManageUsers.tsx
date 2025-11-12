"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

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
  admin: "bg-gradient-to-r from-red-50 to-red-100 border-red-200",
  editor: "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200",
  viewer: "bg-gradient-to-r from-green-50 to-green-100 border-green-200",
};


const schema = z.object({
  email: z.string().min(1, "Email is required").max(50, "Email is too long"),
});
type FormFields = z.infer<typeof schema>;

export default function ManageUsers() {
  const t = useTranslations('manageUsers');
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
    setFetchError(error.message || t('errorFetchingUsers'));
  }
};

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    await fetchUsers(data.email);
    reset(); // Reset the form
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">Search and manage user accounts</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('searchByEmail')}
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  id="email"
                  {...register("email")}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder={t('searchByEmail')}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ 
                    backgroundColor: '#3277AE',
                    '--tw-ring-color': '#3277AE'
                  } as React.CSSProperties & { [key: string]: string }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = '#2a5f94';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = '#3277AE';
                    }
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('searching')}
                    </span>
                  ) : (
                    t('search')
                  )}
                </button>
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.email.message}</p>
              )}
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {users.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Found {users.length} user{users.length !== 1 ? 's' : ''}
            </h2>
            {users.map((user) => (
              <Link
                href={{ pathname: `/dashboard/manage-users/${user.id}` }}
                key={user.id}
                className="block"
              >
                <div className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] border-l-4 ${
                  user.role && userCardStyle[user.role] ? userCardStyle[user.role] : "border-gray-200"
                }`}>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {(user.name || user.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {user.name || t('notAvailable')}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                            {user.role || t('notAvailable')}
                          </span>
                        </div>
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : users.length === 0 && !error ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noUsersFound')}</h3>
            <p className="mt-1 text-sm text-gray-500">Try searching with a different email address.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}