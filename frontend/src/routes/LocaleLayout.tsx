/**
 * /:locale — validates the locale segment and provides translations (use-intl) to every page.
 * (Replaces the hasLocale() checks + NextIntlClientProvider in the old main/dashboard layouts.)
 */
import { Suspense } from 'react';
import { Outlet, useParams } from 'react-router';
import AppIntlProvider from '@/i18n/IntlProvider';
import { isAppLocale } from '@/i18n/routing';
import NotFound from './NotFound';

export default function LocaleLayout() {
  const { locale } = useParams();

  // Ensure that the incoming `locale` is valid
  if (!isAppLocale(locale)) {
    return <NotFound />;
  }

  return (
    <Suspense fallback={null}>
      <AppIntlProvider locale={locale}>
        <Outlet />
      </AppIntlProvider>
    </Suspense>
  );
}
