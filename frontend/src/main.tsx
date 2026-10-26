import './config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './styles/fonts.css';
import { router } from './router';
import { loadMessages, applyDocumentLocale } from './i18n/IntlProvider';
import { isAppLocale } from './i18n/routing';

// Start loading the translations of the URL's locale before React renders,
// and set <html lang/dir> right away so the first paint has the right direction.
const urlLocale = window.location.pathname.split('/')[1];
if (isAppLocale(urlLocale)) {
  applyDocumentLocale(urlLocale);
  void loadMessages(urlLocale);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
