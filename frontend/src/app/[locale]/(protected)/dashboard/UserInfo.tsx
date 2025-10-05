"use client";

import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';

interface User {
  id: string;
  email: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  name?: string;
  phone_number?: string;
  role?: string;
  role_id?: string;
  status?: string;
  status_id?: string;
  created_at?: string;
  updated_at?: string;
  job_title?: string; // for backward compatibility if present
  phone?: string; // for backward compatibility if present
} 

const getUserFromCookies = (): User | null => {
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "user") {
        try {
          return JSON.parse(decodeURIComponent(value));
        } catch {
          console.error("Failed to parse user cookie");
          return null;
        }
      }
    }
  }
  return null;
};

function stringToColor(str: string) {
  // Simple hash to color
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color;
}

function getInitials(name?: string) {
  if (!name) return "";
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserInfo() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('dashboard.userInfo');

  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

  useEffect(() => {
    const userFromCookie = getUserFromCookies();

    if (!userFromCookie || !userFromCookie.id) {
      console.error("User info or ID not found in cookies");
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/${userFromCookie.id}`);
        if (!res.ok) throw new Error("Failed to fetch user data");

        const data = await res.json();

        // Combine first and last name if name is missing
        if (!data.name && data.first_name && data.last_name) {
          data.name = `${data.first_name} ${data.last_name}`;
        }

        setUser(data);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  if (!user)
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">{t('unableToLoad')}</p>
      </div>
    );

  const avatarColor = stringToColor(user.name || user.email);
  const initials = getInitials(user.name || user.email);

  // Prefer phone_number, fallback to phone (legacy)
  const phone = user.phone_number || user.phone || t('notProvided');
  // Prefer job_title, fallback to status or role
  const jobTitle = user.job_title || user.status || user.role || t('noJobTitle');

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-gradient-to-br from-indigo-50 to-white shadow-xl rounded-3xl">
      <div className="flex flex-col items-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-lg mb-4"
          style={{
            background: `linear-gradient(135deg, ${avatarColor} 60%, #6366f1 100%)`,
            color: "#fff",
            border: "4px solid #fff",
          }}
        >
          {initials}
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">{user.name || "N/A"}</h2>
        <span className="text-indigo-600 font-medium text-sm mb-2">
          {jobTitle}
        </span>
        <div className="flex flex-col w-full mt-4 space-y-3">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                <path d="M12 14c-4.418 0-8 1.79-8 4v2h16v-2c0-2.21-3.582-4-8-4z" />
              </svg>
            </span>
            <span className="text-gray-700 font-medium">{user.role || "N/A"}</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M3 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM3 15a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2zM15 15a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </span>
            <span className="text-gray-700">{user.email}</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8" />
                <path d="M21 8v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8" />
              </svg>
            </span>
            <span className="text-gray-700">{phone}</span>
          </div>
          {/* More user info */}
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M8 7V3m8 4V3M3 11h18M5 19h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z" />
              </svg>
            </span>
            <span className="text-gray-700">
              <span className="font-medium">{t('created')}:</span>{" "}
              {user.created_at ? new Date(user.created_at).toLocaleString() : "N/A"}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </span>
            <span className="text-gray-700">
              <span className="font-medium">{t('updated')}:</span>{" "}
              {user.updated_at ? new Date(user.updated_at).toLocaleString() : "N/A"}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 text-pink-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
            <span className="text-gray-700">
              <span className="font-medium">{t('status')}:</span>{" "}
              {user.status || "N/A"}
            </span>
          </div>
         
          {(user.first_name || user.middle_name || user.last_name) && (
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                  <path d="M6.343 17.657A8 8 0 0112 16a8 8 0 015.657 1.657" />
                </svg>
              </span>
              <span className="text-gray-700">
                <span className="font-medium">{t('fullName')}:</span>{" "}
                {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
