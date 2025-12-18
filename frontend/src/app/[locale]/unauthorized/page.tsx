import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/server/permissions';

export default async function UnauthorizedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getAuthenticatedUser();
  
  // If user is not authenticated, redirect to login
  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations('common');

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

