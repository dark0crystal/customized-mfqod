'use client'
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslations } from 'next-intl';

export default function UserProfile() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations('navbar');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDashboardClick = () => {
    router.push('/dashboard');
    setIsDropdownOpen(false);
  };

  if (!isAuthenticated || !user) {
    return (
      <Link 
        href="/auth/login"
        className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors"
        style={{ backgroundColor: '#3277AE' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2a5f94';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#3277AE';
        }}
      >
        {t('login')}
      </Link>
    );
  }

  // Get user profile image or default
  const userImage = (user as any).profile_image || (user as any).avatar_url || null;
  const defaultProfileImage = '/default-profile.svg';
  const displayName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.email?.split('@')[0] || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Profile Button - Compact version with just image and arrow */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-1 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { '--tw-ring-color': string }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(50, 119, 174, 0.2)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = '';
        }}
        aria-label="User menu"
      >
        {/* Profile Image */}
        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 transition-colors" style={{ borderColor: '#3277AE', backgroundColor: '#3277AE' }}>
          {userImage ? (
            <img
              src={userImage}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to default if image fails to load
                const target = e.target as HTMLImageElement;
                target.src = defaultProfileImage;
              }}
            />
          ) : (
            <img
              src={defaultProfileImage}
              alt="Default profile"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Google-style Dialog Menu */}
      {isDropdownOpen && (
        <>
          {/* Dialog */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
            {/* Header with Profile Info */}
            <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: '#3277AE', backgroundColor: '#3277AE' }}>
                  {userImage ? (
                    <img
                      src={userImage}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = defaultProfileImage;
                      }}
                    />
                  ) : (
                    <img
                      src={defaultProfileImage}
                      alt="Default profile"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                  {user.role && (
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">
                      {user.role.replace('_', ' ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button
                onClick={handleDashboardClick}
                className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
              >
                <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {t('dashboard')}
              </button>
              
              <div className="border-t border-gray-200 my-1"></div>
              
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
              >
                <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {t('signout')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
