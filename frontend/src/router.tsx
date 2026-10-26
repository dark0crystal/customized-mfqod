/**
 * Route table — mirrors every URL of the former Next.js app (src/app/[locale]/...).
 *
 * Layout chain:
 *   RootLayout (RequireAuth = old middleware, ScrollRestoration, SplashScreenTracker)
 *   └─ /:locale  LocaleLayout (locale validation + use-intl provider + <html lang/dir>)
 *      └─ (error boundary: notFound() / redirect())
 *         ├─ MainLayout            (navbar, radial background, main globals.css)
 *         │    /:locale, /auth/*, /branches-info, /guides, /how-mfqod-works,
 *         │    /legal/privacy-terms, /search, /search/:id
 *         ├─ ProtectedLayout       (client auth check + PermissionsProvider)
 *         │  └─ DashboardLayout    (dashboard globals.css, PermissionsProvider, DashboardShell)
 *         │       /:locale/dashboard/**
 *         ├─ /:locale/unauthorized (no layout, like before)
 *         └─ *                     → NotFound
 *
 * Every page/layout below the locale is a lazy route module (default export = component).
 */
import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import RootLayout from './routes/RootLayout';
import LocaleLayout from './routes/LocaleLayout';
import NotFound from './routes/NotFound';
import RouteErrorBoundary from './routes/RouteErrorBoundary';

// Route modules must default-export a component that takes NO props (read params with
// useParams() from '@/lib/next-compat'). Typed loosely so not-yet-ported pages still compile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyModule = () => Promise<{ default: ComponentType<any> }>;

/** Lazy route module whose default export is the route component. */
function lazy(load: LazyModule): RouteObject['lazy'] {
  return async () => ({ Component: (await load()).default as ComponentType });
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RouteErrorBoundary />,
    HydrateFallback: () => null,
    children: [
      // "/" is redirected to "/<locale>" by RequireAuth (cookie → browser language → 'ar')
      { index: true, element: null },
      {
        path: ':locale',
        Component: LocaleLayout,
        children: [
          {
            errorElement: <RouteErrorBoundary />,
            children: [
              // ---------------------------------------------------------------- (main)
              {
                lazy: lazy(() => import('./routes/main/layout')),
                children: [
                  { index: true, lazy: lazy(() => import('./routes/main/page')) },
                  { path: 'auth/login', lazy: lazy(() => import('./routes/main/auth/login/page')) },
                  { path: 'auth/register', lazy: lazy(() => import('./routes/main/auth/register/page')) },
                  {
                    path: 'auth/forgot-password',
                    lazy: lazy(() => import('./routes/main/auth/forgot-password/page')),
                  },
                  {
                    path: 'auth/reset-password',
                    lazy: lazy(() => import('./routes/main/auth/reset-password/page')),
                  },
                  { path: 'branches-info', lazy: lazy(() => import('./routes/main/branches-info/page')) },
                  { path: 'guides', lazy: lazy(() => import('./routes/main/guides/page')) },
                  { path: 'how-mfqod-works', lazy: lazy(() => import('./routes/main/how-mfqod-works/page')) },
                  {
                    path: 'legal/privacy-terms',
                    lazy: lazy(() => import('./routes/main/legal/privacy-terms/page')),
                  },
                  { path: 'search', lazy: lazy(() => import('./routes/main/search/page')) },
                  { path: 'search/:id', lazy: lazy(() => import('./routes/main/search/[id]/page')) },
                ],
              },
              // ----------------------------------------------------------- (protected)
              {
                lazy: lazy(() => import('./routes/ProtectedLayout')),
                children: [
                  {
                    path: 'dashboard',
                    lazy: lazy(() => import('./routes/dashboard/layout')),
                    children: [
                      { index: true, lazy: lazy(() => import('./routes/dashboard/page')) },
                      { path: 'analytics', lazy: lazy(() => import('./routes/dashboard/analytics/page')) },
                      { path: 'audit-logs', lazy: lazy(() => import('./routes/dashboard/audit-logs/page')) },
                      { path: 'branch', lazy: lazy(() => import('./routes/dashboard/branch/page')) },
                      { path: 'claims', lazy: lazy(() => import('./routes/dashboard/claims/page')) },
                      {
                        path: 'claims/:claimId',
                        lazy: lazy(() => import('./routes/dashboard/claims/[claimId]/page')),
                      },
                      { path: 'help', lazy: lazy(() => import('./routes/dashboard/help/page')) },
                      { path: 'item-types', lazy: lazy(() => import('./routes/dashboard/item-types/page')) },
                      { path: 'items', lazy: lazy(() => import('./routes/dashboard/items/page')) },
                      {
                        path: 'items/:itemId',
                        lazy: lazy(() => import('./routes/dashboard/items/[itemId]/page')),
                      },
                      {
                        path: 'manage-users',
                        lazy: lazy(() => import('./routes/dashboard/manage-users/page')),
                      },
                      {
                        path: 'manage-users/:userId',
                        lazy: lazy(() => import('./routes/dashboard/manage-users/[userId]/page')),
                      },
                      {
                        path: 'missing-items',
                        lazy: lazy(() => import('./routes/dashboard/missing-items/page')),
                      },
                      {
                        path: 'missing-items/:id',
                        lazy: lazy(() => import('./routes/dashboard/missing-items/[id]/page')),
                      },
                      { path: 'permissions', lazy: lazy(() => import('./routes/dashboard/permissions/page')) },
                      {
                        path: 'report-found-item',
                        lazy: lazy(() => import('./routes/dashboard/report-found-item/page')),
                      },
                      {
                        path: 'report-missing-item',
                        lazy: lazy(() => import('./routes/dashboard/report-missing-item/page')),
                      },
                      {
                        path: 'transfer-requests',
                        lazy: lazy(() => import('./routes/dashboard/transfer-requests/page')),
                      },
                    ],
                  },
                ],
              },
              // --------------------------------------------------------- unauthorized
              { path: 'unauthorized', lazy: lazy(() => import('./routes/unauthorized/page')) },
              // ------------------------------------------------------------ 404
              { path: '*', Component: NotFound },
            ],
          },
        ],
      },
      // Paths that the old middleware skipped (e.g. containing a dot) and that match nothing.
      { path: '*', Component: NotFound },
    ],
  },
];

export const router = createBrowserRouter(routes);
