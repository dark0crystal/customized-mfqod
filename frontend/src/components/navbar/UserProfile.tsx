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

  // Get user initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(user.name || user.email || 'U');

  return (
    <div className="relative border rounded-4xl p-1" style={{ borderColor: '#3277AE' }} ref={dropdownRef}>
      {/* User Profile Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-2 py-2 rounded-4xl hover:bg-gray-100 transition-colors w-full min-w-64"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium border-2" style={{ backgroundColor: '#3277AE', borderColor: '#3277AE' }}>
          {initials}
        </div>
        
        {/* User Info */}
        <div className="flex flex-col items-start flex-1">
          <span className="text-sm font-medium text-gray-700 truncate w-full">
            {user.name || user.email}
          </span>
          {user.role && (
            <span className="text-xs text-gray-500 truncate w-full">
              {user.role}
            </span>
          )}
        </div>
        
        {/* Dropdown Arrow */}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            <button
              onClick={handleDashboardClick}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
              {t('dashboard')}
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('signout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
