// utils/tokenManager.ts
import { cookieUtils } from "@/utils/cookies";

interface TokenInfo {
  expires_at: string | null;
  seconds_remaining: number;
  minutes_remaining: number;
  is_expired: boolean;
  needs_refresh: boolean;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_id: string;
}

interface LoginResponse {
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<string> | null = null;
  private isRefreshing = false;
  private baseUrl: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private isMonitoringPaused = false;
  private retryCount = 0;
  private maxRetries = 3;
  private lastWarningMinutes: number | null = null;
  private requestQueue: Map<string, Promise<Response>> = new Map();
  private translations: Record<string, unknown> | null = null;
  private currentLocale: string = 'en';

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';
    this.detectLocale();
    // Load translations asynchronously (will use defaults until loaded)
    this.loadTranslations().catch(err => {
      console.warn('Failed to load translations:', err);
    });
    this.setupVisibilityHandling();
    this.startTokenMonitoring();
  }

  /**
   * Detect current locale from URL or document
   */
  private detectLocale(): void {
    if (typeof window === 'undefined') {
      this.currentLocale = 'en';
      return;
    }

    // Check URL path for locale (e.g., /ar/... or /en/...)
    const pathname = window.location.pathname;
    const localeMatch = pathname.match(/^\/(ar|en)\//);
    if (localeMatch) {
      this.currentLocale = localeMatch[1];
      return;
    }

    // Check document lang attribute
    if (document.documentElement.lang) {
      const lang = document.documentElement.lang.toLowerCase();
      if (lang.startsWith('ar')) {
        this.currentLocale = 'ar';
      } else {
        this.currentLocale = 'en';
      }
      return;
    }

    // Default to English
    this.currentLocale = 'en';
  }

  /**
   * Load translations for current locale
   */
  private async loadTranslations(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Try to load translations from the messages directory
      // This is a fallback - in production, translations should be loaded via next-intl
      const messages = await import(`../../messages/${this.currentLocale}.json`);
      this.translations = messages.default;
    } catch (error) {
      console.warn('Could not load translations, using default English messages:', error);
      // Fallback to English if locale file doesn't exist
      try {
        const englishMessages = await import(`../../messages/en.json`);
        this.translations = englishMessages.default;
      } catch (e) {
        console.error('Could not load English translations:', e);
      }
    }
  }

  /**
   * Get translated message
   */
  private getTranslation(key: string, params?: Record<string, string | number>): string {
    if (!this.translations) {
      return this.getDefaultMessage(key, params);
    }

    const keys = key.split('.');
    let value: unknown = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && value !== null && !Array.isArray(value) && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return this.getDefaultMessage(key, params);
      }
    }

    if (typeof value !== 'string') {
      return this.getDefaultMessage(key, params);
    }

    // Simple parameter replacement
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  }

  /**
   * Get default English message
   */
  private getDefaultMessage(key: string, params?: Record<string, string | number>): string {
    const messages: Record<string, string> = {
      'auth.session.expiringSoon': `Your session will expire in ${params?.minutes || 0} ${params?.minutes === 1 ? 'minute' : 'minutes'}. Continue using the app to stay logged in.`,
      'auth.session.expired': 'Your session has expired due to inactivity. Please log in again.',
      'auth.session.refreshTokenExpired': 'Refresh token has expired. Please log in again.',
      'auth.session.authenticationFailed': 'Authentication failed. Please log in again.',
    };

    let message = messages[key] || key;
    
    if (params) {
      message = message.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return message;
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  // =======================================
  // TOKEN STORAGE METHODS
  // =======================================

  setTokens(accessToken: string, refreshToken?: string, user?: User): void {
    cookieUtils.set("token", accessToken, 1); // 1 day for access token
    
    if (refreshToken) {
      cookieUtils.set("refresh_token", refreshToken, 7); // 7 days for refresh token
    }
    
    if (user) {
      cookieUtils.set("user", JSON.stringify(user), 7);
    }
    
    console.log('Tokens stored successfully');
  }

  getAccessToken(): string | null {
    return cookieUtils.get("token");
  }

  getRefreshToken(): string | null {
    return cookieUtils.get("refresh_token");
  }

  getUser(): User | null {
    const userStr = cookieUtils.get("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  clearTokens(): void {
    cookieUtils.remove("refresh_token");
    cookieUtils.remove("token");
    cookieUtils.remove("user");
    console.log('Tokens cleared');
  }

  isAuthenticated(): boolean {
    // Only check authentication in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }
    return !!this.getAccessToken();
  }

  // =======================================
  // TOKEN UTILITIES
  // =======================================

  /**
   * Decode JWT token without verification (client-side only)
   */
  private decodeJWT(token: string): { exp?: number; [key: string]: unknown } | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }

  /**
   * Check if a token is expired
   */
  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJWT(token);
    if (!payload || !payload.exp) {
      return true;
    }
    // Add 5 second buffer to account for clock skew
    return payload.exp * 1000 < Date.now() + 5000;
  }

  /**
   * Check if refresh token is expired or will expire soon
   */
  private isRefreshTokenExpired(): boolean {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return true;
    }
    return this.isTokenExpired(refreshToken);
  }

  // =======================================
  // TOKEN REFRESH LOGIC
  // =======================================

  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      const error = new Error('No refresh token available') as Error & { isAuthError: boolean };
      error.isAuthError = true;
      throw error;
    }

    // Check if refresh token is expired before attempting refresh
    if (this.isRefreshTokenExpired()) {
      console.warn('Refresh token is expired, cannot refresh access token');
      const errorMessage = this.getTranslation('auth.session.refreshTokenExpired');
      const error = new Error(errorMessage) as Error & { isAuthError: boolean };
      error.isAuthError = true;
      this.handleAuthFailure();
      throw error;
    }

    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh(refreshToken);

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(refreshToken: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check if it's an auth error (401) vs network error
        if (response.status === 401) {
          const error = new Error('Refresh token is invalid or expired') as Error & { isAuthError: boolean; status: number };
          error.isAuthError = true;
          error.status = 401;
          throw error;
        }
        
        // Other HTTP errors
        const error = new Error(`Token refresh failed with status ${response.status}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      const data: RefreshResponse = await response.json();
      
      if (!data.access_token) {
        const error = new Error('Invalid response from refresh endpoint') as Error & { isAuthError: boolean };
        error.isAuthError = true;
        throw error;
      }
      
      // Update access token
      this.setTokens(data.access_token);
      
      console.log('Token refreshed successfully');
      return data.access_token;
    } catch (error: unknown) {
      // Ensure timeout is cleared
      clearTimeout(timeoutId);
      
      // Handle AbortError (timeout)
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        const timeoutError = new Error('Token refresh request timed out') as Error & { isNetworkError: boolean };
        timeoutError.isNetworkError = true;
        throw timeoutError;
      }
      
      // Handle network errors
      if (this.isCorsOrNetworkError(error)) {
        const networkError = new Error('Network error during token refresh') as Error & { isNetworkError: boolean };
        networkError.isNetworkError = true;
        throw networkError;
      }
      
      // Auth errors (401, expired refresh token, etc.)
      const authError = error as Error & { isAuthError?: boolean; status?: number };
      if (authError.isAuthError || authError.status === 401) {
        console.error('Token refresh failed - authentication error:', error);
        this.handleAuthFailure();
        throw error;
      }
      
      // Other errors
      console.error('Token refresh failed:', error);
      this.handleAuthFailure();
      throw error;
    }
  }

  // =======================================
  // TOKEN MONITORING
  // =======================================

  startTokenMonitoring(): void {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Check token status every 2 minutes
    this.checkInterval = setInterval(() => {
      if (!this.isMonitoringPaused) {
        this.checkTokenStatus();
      }
    }, 2 * 60 * 1000);

    // Check immediately if not paused
    if (!this.isMonitoringPaused) {
      this.checkTokenStatus();
    }
  }

  stopTokenMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private setupVisibilityHandling(): void {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Pause monitoring when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isMonitoringPaused = true;
        console.log('Token monitoring paused (tab inactive)');
      } else {
        this.isMonitoringPaused = false;
        console.log('Token monitoring resumed (tab active)');
        // Check token status immediately when tab becomes visible
        this.checkTokenStatus();
      }
    });
  }

  private async checkTokenStatus(): Promise<void> {
    if (!this.isAuthenticated() || this.isRefreshing || this.isMonitoringPaused) return;

    try {
      const tokenInfo = await this.getTokenInfo();
      
      // Reset retry count on successful check
      this.retryCount = 0;
      
      // Show warning if token expires soon (only show once per minute value)
      if (tokenInfo.minutes_remaining <= 5 && tokenInfo.minutes_remaining > 0) {
        if (this.lastWarningMinutes !== tokenInfo.minutes_remaining) {
          this.showSessionWarning(tokenInfo.minutes_remaining);
          this.lastWarningMinutes = tokenInfo.minutes_remaining;
        }
      } else {
        this.lastWarningMinutes = null;
      }
      
      // Refresh if needed
      if (tokenInfo.needs_refresh && !tokenInfo.is_expired) {
        console.log('Proactively refreshing token...');
        await this.refreshAccessToken();
      }
      
      // Handle expired token - only clear if actually expired, not on network errors
      if (tokenInfo.is_expired && tokenInfo.expires_at) {
        // Only clear if we have a valid expiration time and it's actually expired
        const now = Date.now();
        const expiresAt = new Date(tokenInfo.expires_at).getTime();
        if (expiresAt < now) {
          this.handleSessionExpired();
        }
      }
    } catch (error) {
      // Don't clear tokens on network/CORS errors - retry with exponential backoff
      console.error('Error checking token status:', error);
      
      // Only clear tokens if it's a clear authentication error, not a network issue
      if (error instanceof Error && error.message.includes('401') && !this.isCorsOrNetworkError(error)) {
        this.handleAuthFailure();
      } else if (this.retryCount < this.maxRetries) {
        // Retry with exponential backoff for network errors
        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000); // Max 30 seconds
        console.log(`Retrying token check in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => {
          if (!this.isMonitoringPaused) {
            this.checkTokenStatus();
          }
        }, delay);
      }
    }
  }

  private isCorsOrNetworkError(error: Error | unknown): boolean {
    if (!(error instanceof Error)) {
      // Check if it's a network error by checking for specific properties
      const networkError = error as { isNetworkError?: boolean };
      if (networkError.isNetworkError) {
        return true;
      }
      return false;
    }
    
    // Check explicit network error flag
    const errorWithFlag = error as Error & { isNetworkError?: boolean };
    if (errorWithFlag.isNetworkError) {
      return true;
    }
    
    const message = error.message.toLowerCase();
    const errorName = error.name?.toLowerCase() || '';
    
    return message.includes('cors') || 
           message.includes('network') || 
           message.includes('fetch') ||
           message.includes('failed to fetch') ||
           message.includes('networkerror') ||
           message.includes('network request failed') ||
           message.includes('load failed') ||
           errorName.includes('network') ||
           errorName.includes('typeerror') ||
           errorName === 'aborterror' ||
           errorName === 'timeouterror';
  }

  async getTokenInfo(): Promise<TokenInfo> {
    const token = this.getAccessToken();
    
    if (!token) {
      return {
        expires_at: null,
        seconds_remaining: 0,
        minutes_remaining: 0,
        is_expired: true,
        needs_refresh: true,
      };
    }

    // Prevent circular refresh calls - if already refreshing, return default values
    if (this.isRefreshing) {
      return {
        expires_at: null,
        seconds_remaining: 0,
        minutes_remaining: 0,
        is_expired: false,
        needs_refresh: true,
      };
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/api/users/token/info`,
        {
          method: 'GET',
        }
      );

      if (response.ok) {
        return await response.json();
      }

      // Handle non-ok responses
      // 401 errors are already handled by makeAuthenticatedRequest with refresh
      // If we still get 401 here, it means refresh failed
      if (response.status === 401) {
        console.error('Token info request failed after refresh attempt');
        return {
          expires_at: null,
          seconds_remaining: 0,
          minutes_remaining: 0,
          is_expired: true,
          needs_refresh: true,
        };
      }

      // For other errors (403, 500, etc.), log and return default
      console.error(`Token info request failed with status: ${response.status}`);
      return {
        expires_at: null,
        seconds_remaining: 0,
        minutes_remaining: 0,
        is_expired: false,
        needs_refresh: false,
      };
    } catch (error) {
      // Distinguish between CORS errors, network errors, and authentication errors
      if (error instanceof Error) {
        // CORS errors - don't clear tokens, will retry
        if (this.isCorsOrNetworkError(error)) {
          console.error('CORS/Network error getting token info:', error.message);
          // Re-throw to trigger retry logic in checkTokenStatus
          throw error;
        }
        
        // Authentication errors (no token, refresh failed) - already handled by makeAuthenticatedRequest
        if (error.message.includes('No access token') || error.message.includes('Token refresh failed')) {
          console.error('Authentication error getting token info:', error);
          return {
            expires_at: null,
            seconds_remaining: 0,
            minutes_remaining: 0,
            is_expired: true,
            needs_refresh: true,
          };
        }
      }

      // Unknown errors - log and re-throw to trigger retry logic
      console.error('Error getting token info:', error);
      throw error;
    }
  }

  // =======================================
  // API REQUEST METHODS
  // =======================================

  async makeAuthenticatedRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    let token = this.getAccessToken();
    
    if (!token) {
      const error = new Error('No access token available') as Error & { isAuthError: boolean };
      error.isAuthError = true;
      throw error;
    }

    // Check if access token is expired before making request
    if (this.isTokenExpired(token)) {
      console.log('Access token expired, attempting refresh before request');
      try {
        token = await this.refreshAccessToken();
      } catch (refreshError: unknown) {
        // If refresh fails due to auth error, handle it
        const authError = refreshError as Error & { isAuthError?: boolean };
        if (authError.isAuthError) {
          throw refreshError;
        }
        // For network errors, continue with expired token and let the server handle it
        console.warn('Token refresh failed, proceeding with expired token:', refreshError);
      }
    }

    // Create request key for deduplication
    const requestKey = `${options.method || 'GET'}:${url}`;
    
    // Check if there's already a pending request for this URL
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey)!;
    }

    // Add auth header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    // Create request promise
    const requestPromise = this.executeRequest(url, options, headers, requestKey);
    this.requestQueue.set(requestKey, requestPromise);

    try {
      const response = await requestPromise;
      return response;
    } finally {
      // Clean up request queue after a delay to allow concurrent requests to share the promise
      setTimeout(() => {
        this.requestQueue.delete(requestKey);
      }, 100);
    }
  }

  private async executeRequest(
    url: string,
    options: RequestInit,
    headers: HeadersInit,
    requestKey: string
  ): Promise<Response> {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const requestOptions: RequestInit = {
        ...options,
        headers,
        signal: controller.signal,
      };

      // Make request
      let response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Handle 401 errors with token refresh
      if (response.status === 401 && !this.isRefreshing) {
        try {
          // Refresh token and retry
          const newToken = await this.refreshAccessToken();
          const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`,
          };
          
          // Retry with new token
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
          
          response = await fetch(url, {
            ...options,
            headers: newHeaders,
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
        } catch (refreshError: unknown) {
          // Clear request from queue on auth failure
          this.requestQueue.delete(requestKey);
          
          // Handle auth errors (expired refresh token, invalid token, etc.)
          const authError = refreshError as Error & { isAuthError?: boolean; status?: number; isNetworkError?: boolean };
          if (authError.isAuthError || authError.status === 401) {
            this.handleAuthFailure();
            throw refreshError;
          }
          
          // For network errors during refresh, throw the original 401 response
          // This allows the caller to handle it appropriately
          if (authError.isNetworkError) {
            console.warn('Network error during token refresh, returning 401 response');
            return response; // Return the original 401 response
          }
          
          // Other errors
          throw refreshError;
        }
      }

      // Check for auto-refreshed token in headers
      const newToken = response.headers.get('X-New-Token');
      if (newToken) {
        this.setTokens(newToken);
        console.log('Token auto-refreshed via header');
      }

      return response;
    } catch (error: unknown) {
      // Clear request from queue on error
      this.requestQueue.delete(requestKey);
      
      // Handle timeout errors
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        const timeoutError = new Error('Request timed out') as Error & { isNetworkError: boolean };
        timeoutError.isNetworkError = true;
        throw timeoutError;
      }
      
      // Handle network/CORS errors
      if (this.isCorsOrNetworkError(error)) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
        const networkError = new Error(`Network error: ${errorMessage}`) as Error & { isNetworkError: boolean };
        networkError.isNetworkError = true;
        throw networkError;
      }
      
      // Re-throw other errors (including auth errors)
      throw error;
    }
  }

  // =======================================
  // AUTHENTICATION METHODS
  // =======================================

  async login(identifier: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_or_username: identifier, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data: LoginResponse = await response.json();
      
      // Store tokens
      this.setTokens(data.access_token, data.refresh_token, data.user);
      
      return data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint if available
      const token = this.getAccessToken();
      const refreshToken = this.getRefreshToken();
      if (token && refreshToken) {
        await fetch(`${this.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
      this.stopTokenMonitoring();
    }
  }

  // =======================================
  // UTILITY METHODS
  // =======================================

  private handleAuthFailure(): void {
    console.log('Authentication failed, clearing tokens');
    this.clearTokens();
    this.stopTokenMonitoring();
    this.showSessionExpiredMessage();
    
    // Only redirect in browser environment
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
      // Small delay to allow message to be seen
      setTimeout(() => {
        // Use replace instead of href to prevent back button issues
        window.location.replace('/auth/login');
      }, 2000);
    }
  }

  private handleSessionExpired(): void {
    console.log('Session expired, clearing tokens');
    this.clearTokens();
    this.stopTokenMonitoring();
    this.showSessionExpiredMessage();
    
    // Only redirect in browser environment
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
      // Small delay to allow message to be seen
      setTimeout(() => {
        // Use replace instead of href to prevent back button issues
        window.location.replace('/auth/login');
      }, 2000);
    }
  }

  private showSessionWarning(minutes: number): void {
    const message = this.getTranslation('auth.session.expiringSoon', { minutes });
    console.warn(message);
    
    // Show browser notification if available
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const title = this.currentLocale === 'ar' ? 'انتهاء الجلسة قريباً' : 'Session Expiring Soon';
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'session-warning', // Replace previous notifications with same tag
      });
    }
    
    // Show alert as fallback (less intrusive than blocking alert)
    // You can replace this with a toast notification library if available
    // For example: toast.warning(message);
  }

  private showSessionExpiredMessage(): void {
    const message = this.getTranslation('auth.session.expired');
    console.error(message);
    
    // Show browser notification if available
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const title = this.currentLocale === 'ar' ? 'انتهت الجلسة' : 'Session Expired';
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'session-expired',
      });
    }
    
    // Show alert as fallback
    // You can replace this with a toast notification library if available
    if (typeof window !== 'undefined') {
      alert(message);
    }
  }

  // Cleanup method
  destroy(): void {
    this.stopTokenMonitoring();
    // Remove visibility change listener if needed
    if (typeof document !== 'undefined') {
      // Note: We can't easily remove the listener without storing a reference
      // This is acceptable as the singleton persists for the app lifetime
    }
  }
}

// Create singleton instance
export const tokenManager = TokenManager.getInstance();

// Export types
export type { TokenInfo, User, LoginResponse, RefreshResponse };

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    tokenManager.destroy();
  });
}