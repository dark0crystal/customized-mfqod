"use client";

import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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
  job_title?: string;
  phone?: string;
  user_type?: string;
  active?: boolean;
  last_login?: string;
  ad_sync_date?: string;
  profile_image?: string;
  avatar_url?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [imageError, setImageError] = useState(false);
  const t = useTranslations('dashboard.userInfo');

  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const fetchUser = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get token from cookies
        const getTokenFromCookies = (): string | null => {
          if (typeof document === "undefined") return null;
          
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token') {

              return decodeURIComponent(value);
            }
          }
          return null;
        };

        const token = getTokenFromCookies();
        if (!token) {
          throw new Error("No authentication token found");
        }

        // Use /api/auth/me endpoint to get current user data
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to fetch user data: ${res.status}`);
        }

        const text = await res.text();
        let payload: { user?: unknown } | null = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            throw new Error("Invalid user data received from server");
          }
        }
        // Backend returns { user: {...} }; support both shapes
        const data = (payload?.user ?? payload) as User | null;

        // Ensure we have the required fields
        if (!data || !data.id || !data.email) {
          throw new Error("Invalid user data received from server");
        }

        // Build full name from components if name is missing
        if (!data.name && (data.first_name || data.last_name)) {
          const nameParts = [data.first_name, data.middle_name, data.last_name].filter(Boolean);
          data.name = nameParts.join(' ').trim();
        }

        // Ensure active field is boolean (default to true if undefined/null)
        if (data.active === undefined || data.active === null) {
          data.active = true;
        }

        setUser(data);
        setImageError(false); // Reset image error when user data is loaded
      } catch (error) {
        console.error("Error fetching user:", error);
        setError(error instanceof Error ? error.message : "Failed to load user information");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [isClient, API_BASE_URL]);

  if (loading) {
    return <LoadingSpinner size="md" className="h-64" />;
  }

  if (error || !user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error || t('unableToLoad')}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {t('retry') || 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(user.name || user.email);

  // Get user profile image or default
  const userImage = user.profile_image || user.avatar_url || null;
  const defaultProfileImage = '/default-profile.svg';
  
  // Get phone number - prefer phone_number, fallback to phone (legacy)
  const phone = user.phone_number || user.phone || t('notProvided');
  
  // Get job title - prefer job_title, fallback to status or role
  const jobTitle = user.job_title || user.status || user.role || t('noJobTitle');
  
  // Build display name
  const displayName = user.name || 
    (user.first_name && user.last_name 
      ? `${user.first_name} ${user.middle_name || ''} ${user.last_name}`.trim()
      : user.email?.split('@')[0] || 'N/A');
  
  // Helper to get full image URL
  const getImageUrl = (imagePath: string | null): string => {
    if (!imagePath) return defaultProfileImage;
    if (/^https?:\/\//.test(imagePath)) return imagePath;
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseUrl}${cleanPath}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-2 sm:mt-4 p-3 sm:p-5 bg-white border border-gray-200 rounded-2xl sm:rounded-3xl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 mb-6">
        {/* Avatar and Basic Info */}
        <div className="flex flex-col items-center text-center lg:text-left lg:items-start">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-4 border-2" style={{ borderColor: '#3277AE' }}>
            {userImage && !imageError ? (
              <Image
                src={getImageUrl(userImage)}
                alt={displayName}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 96px, 128px"
                unoptimized={getImageUrl(userImage)?.startsWith('http')}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-5xl font-bold text-white" style={{ backgroundColor: '#3277AE' }}>
                {initials}
              </div>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{displayName}</h2>
          <span className="text-gray-600 font-medium text-base sm:text-lg mb-4">
            {jobTitle}
          </span>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
            (user.active === true || user.active === undefined) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${(user.active === true || user.active === undefined) ? 'bg-green-400' : 'bg-red-400'}`}></div>
            {(user.active === true || user.active === undefined) ? t('active') : t('inactive')}
          </div>
        </div>

        {/* Contact Information */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('contactInfo')}</h3>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('email')}</p>
                <p className="text-base text-gray-900 font-medium">{user.email}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">{t('phone')}</p>
                <p className="text-base text-gray-900 font-medium">{phone}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('accountInfo')}</h3>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('role')}</p>
                <p className="text-base text-gray-900 font-medium">{user.role || "N/A"}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">{t('userType')}</p>
                <p className="text-base text-gray-900 font-medium capitalize">{user.user_type || "N/A"}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">{t('status')}</p>
                <p className="text-base text-gray-900 font-medium">{user.status || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
