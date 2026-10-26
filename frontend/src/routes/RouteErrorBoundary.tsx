/**
 * Route error boundary (errorElement). Handles the next-compat control-flow errors:
 *  - notFound()  → renders the 404 page
 *  - redirect()  → navigates to the target
 * Anything else renders the same message the Next.js production client showed.
 */
import { Navigate, isRouteErrorResponse, useRouteError } from 'react-router';
import { isNotFoundError, isRedirectError } from '@/lib/next-compat';
import NotFound from './NotFound';

export default function RouteErrorBoundary() {
  const error = useRouteError();

  if (isNotFoundError(error) || (isRouteErrorResponse(error) && error.status === 404)) {
    return <NotFound />;
  }

  if (isRedirectError(error)) {
    return <Navigate to={error.url} replace={error.type !== 'push'} />;
  }

  console.error(error);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return (
    <div
      style={{
        fontFamily:
          'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
        height: '100vh',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 400, lineHeight: '28px' }}>
          Application error: a client-side exception has occurred while loading {host} (see the browser
          console for more information).
        </h2>
      </div>
    </div>
  );
}
