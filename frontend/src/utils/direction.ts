/**
 * Direction utilities for RTL/LTR support
 * Based on next-intl documentation for dynamic direction changing
 */

export type Direction = 'ltr' | 'rtl';

export type Locale = 'en' | 'ar';

/**
 * Get text direction based on locale
 * @param locale - The locale string
 * @returns The text direction ('ltr' or 'rtl')
 */
export function getDirection(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Check if locale is RTL
 * @param locale - The locale string
 * @returns True if locale is RTL
 */
export function isRTL(locale: Locale): boolean {
  return getDirection(locale) === 'rtl';
}

/**
 * Get opposite direction
 * @param direction - Current direction
 * @returns Opposite direction
 */
export function getOppositeDirection(direction: Direction): Direction {
  return direction === 'ltr' ? 'rtl' : 'ltr';
}

/**
 * Get CSS classes for direction-aware styling
 * @param direction - The text direction
 * @returns Object with CSS class utilities
 */
export function getDirectionClasses(direction: Direction) {
  return {
    container: direction === 'rtl' ? 'rtl' : 'ltr',
    textAlign: direction === 'rtl' ? 'text-right' : 'text-left',
    marginStart: direction === 'rtl' ? 'ms-auto' : 'me-auto',
    marginEnd: direction === 'rtl' ? 'me-auto' : 'ms-auto',
    paddingStart: direction === 'rtl' ? 'ps-4' : 'pe-4',
    paddingEnd: direction === 'rtl' ? 'pe-4' : 'ps-4',
    flexDirection: direction === 'rtl' ? 'flex-row-reverse' : 'flex-row',
    transform: direction === 'rtl' ? 'scaleX(-1)' : 'scaleX(1)',
  };
}

/**
 * Get locale-specific font family
 * @param locale - The locale string
 * @returns Font family class
 */
export function getFontFamily(locale: Locale): string {
  return locale === 'ar' ? 'font-arabic' : 'font-latin';
}
