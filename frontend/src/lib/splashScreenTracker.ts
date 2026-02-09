/**
 * Tracks whether the user has navigated within the app (client-side navigation).
 * Resets on full page load (module re-initializes).
 * Used to hide splash screen when navigating from dashboard/other pages to home.
 */
let hasNavigatedWithinApp = false;

export function setHasNavigatedWithinApp(): void {
  hasNavigatedWithinApp = true;
}

export function getHasNavigatedWithinApp(): boolean {
  return hasNavigatedWithinApp;
}
