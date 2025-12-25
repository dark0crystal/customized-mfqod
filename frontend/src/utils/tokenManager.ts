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

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';
    this.setupVisibilityHandling();
    this.startTokenMonitoring();
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
    cookieUtils.set("access_token", accessToken, 1); // 1 day for access token
    cookieUtils.set("token", accessToken, 1); // Backward compatibility
    
    if (refreshToken) {
      cookieUtils.set("refresh_token", refreshToken, 7); // 7 days for refresh token
    }
    
    if (user) {
      cookieUtils.set("user", JSON.stringify(user), 7);
    }
    
    console.log('Tokens stored successfully');
  }

  getAccessToken(): string | null {
    return cookieUtils.get("access_token") || cookieUtils.get("token");
  }

  getRefreshToken(): string | null {
    return cookieUtils.get("refresh_token");
  }

  getUser(): User | null {
    const userStr = cookieUtils.get("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  clearTokens(): void {
    cookieUtils.remove("access_token");
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
  // TOKEN REFRESH LOGIC
  // =======================================

  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
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
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data: RefreshResponse = await response.json();
      
      // Update access token
      this.setTokens(data.access_token);
      
      console.log('Token refreshed successfully');
      return data.access_token;
    } catch (error) {
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
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return message.includes('cors') || 
           message.includes('network') || 
           message.includes('fetch') ||
           message.includes('failed to fetch');
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
      throw new Error('No access token available');
    }

    // Add auth header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    try {
      // Make request
      let response = await fetch(url, { ...options, headers });

      // Handle 401 errors with token refresh
      if (response.status === 401 && !this.isRefreshing) {
        try {
          // Refresh token and retry
          token = await this.refreshAccessToken();
          const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
          };
          
          response = await fetch(url, { ...options, headers: newHeaders });
        } catch (refreshError) {
          // Only handle auth failure if it's not a network/CORS error
          if (!(refreshError instanceof Error) || !this.isCorsOrNetworkError(refreshError)) {
            this.handleAuthFailure();
          }
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
    } catch (error) {
      // Re-throw CORS/network errors so they can be handled by retry logic
      if (error instanceof Error && this.isCorsOrNetworkError(error)) {
        throw error;
      }
      // Re-throw other errors
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
    this.showSessionExpiredMessage();
    
    // Only redirect in browser environment
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
      // Small delay to allow message to be seen
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 2000);
    }
  }

  private handleSessionExpired(): void {
    console.log('Session expired, clearing tokens');
    this.clearTokens();
    this.showSessionExpiredMessage();
    
    // Only redirect in browser environment
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
      // Small delay to allow message to be seen
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 2000);
    }
  }

  private showSessionWarning(minutes: number): void {
    const message = `Your session will expire in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. Continue using the app to stay logged in.`;
    console.warn(message);
    
    // Show browser notification if available
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Session Expiring Soon', {
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
    const message = 'Your session has expired due to inactivity. Please log in again.';
    console.error(message);
    
    // Show browser notification if available
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Session Expired', {
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