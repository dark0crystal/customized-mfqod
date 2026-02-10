import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

// Helper function to deep merge objects
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}
 
export default getRequestConfig(async ({requestLocale}) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
 
  // Load messages for current locale (standard: messages/ at project root per next-intl docs)
  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    console.warn(`Messages for locale "${locale}" not found, using en`);
    messages = (await import(`../../messages/en.json`)).default;
  }

  // If locale is not English, merge English messages as fallback
  let finalMessages = messages;
  if (locale !== 'en') {
    try {
      const englishMessages = (await import(`../../messages/en.json`)).default;
      // Deep merge: English as base, current locale messages override (take precedence)
      // This way missing keys in current locale will fall back to English
      finalMessages = deepMerge(englishMessages, messages);
    } catch (error) {
      // If English messages can't be loaded, just use current locale messages
      console.warn('Could not load English messages for fallback:', error);
    }
  }
 
  return {
    locale,
    messages: finalMessages,
    direction: locale === 'ar' ? 'rtl' : 'ltr',
    // Prevent missing keys from throwing and breaking the app (e.g. dashboard)
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join('.');
      return path || '…';
    },
  };
});