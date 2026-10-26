import { useTranslations } from 'use-intl';
import { Navigate } from 'react-router';
import { Link, useParams } from '@/lib/next-compat';
import { tokenManager } from '@/utils/tokenManager';
import { cookieUtils } from '@/utils/cookies';

/**
 * Client-side equivalent of the deleted server helper
 * `getAuthenticatedUser()` (lib/server/permissions): the `token` (else `jwt`)
 * cookie must hold a JWT whose payload has an `exp` in the future.
 * The JWT is not verified here; the backend enforces auth on every API call.
 */
function getAuthenticatedUser(): {
  userId?: string;
  roleId?: string;
  email?: string;
  role?: string;
} | null {
  const token = tokenManager.getAccessToken() || cookieUtils.get('jwt');

  if (!token) {
    return null;
  }

  let payload: {
    exp?: number;
    user_id?: string;
    sub?: string;
    role_id?: string;
    email?: string;
    role?: string;
  } | null = null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );
  } catch {
    payload = null;
  }

  if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
    return null;
  }

  return {
    userId: payload.user_id || payload.sub,
    roleId: payload.role_id,
    email: payload.email,
    role: payload.role,
  };
}

export default function UnauthorizedPage() {
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('common');
  const user = getAuthenticatedUser();

  // If user is not authenticated, redirect to login
  if (!user) {
    return <Navigate to={`/${locale}/auth/login`} replace />;
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {t('accessDenied')}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {t('accessDeniedDescription')}
        </p>
        
        <div className="space-y-3">
          <Link
            href={`/${locale}/dashboard`}
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('goToDashboard')}
          </Link>
          
          <Link
            href={`/${locale}/auth/login`}
            className="block w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

