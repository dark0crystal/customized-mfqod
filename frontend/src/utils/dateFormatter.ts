/**
 * Consistent date formatting utility to prevent hydration mismatches
 * Always uses a fixed locale and format to ensure server and client render the same
 */

/**
 * Format a date string to a consistent format
 * @param dateString - ISO date string or Date object
 * @param locale - Optional locale (defaults to 'en-US' for consistency)
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  // Handle null or undefined
  if (!dateString) {
    return 'N/A';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Handle invalid dates or if date is still undefined
  if (!date || isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString(locale, options);
}

/**
 * Format a date to a simple date string (no time)
 * @param dateString - ISO date string or Date object
 * @param locale - Optional locale (defaults to 'en-US')
 * @returns Formatted date string
 */
export function formatDateOnly(
  dateString: string | Date | null | undefined,
  locale: string = 'en-US'
): string {
  return formatDate(dateString, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date with locale-aware formatting
 * @param dateString - ISO date string or Date object
 * @param currentLocale - Current locale ('ar' or 'en')
 * @returns Formatted date string
 */
export function formatDateWithLocale(
  dateString: string | Date | null | undefined,
  currentLocale: string = 'en'
): string {
  const locale = currentLocale === 'ar' ? 'ar-SA' : 'en-US';
  return formatDate(dateString, locale);
}

