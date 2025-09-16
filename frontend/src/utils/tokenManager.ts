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

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_HOST_NAME || '';
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
      const response = await fetch(`${this.baseUrl}/users/refresh`, {
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
      this.checkTokenStatus();
    }, 2 * 60 * 1000);

    // Check immediately
    this.checkTokenStatus();
  }

  stopTokenMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkTokenStatus(): Promise<void> {
    if (!this.isAuthenticated() || this.isRefreshing) return;

    try {
      const tokenInfo = await this.getTokenInfo();
      
      // Show warning if token expires soon
      if (tokenInfo.minutes_remaining <= 5 && tokenInfo.minutes_remaining > 0) {
        this.showSessionWarning(tokenInfo.minutes_remaining);
      }
      
      // Refresh if needed
      if (tokenInfo.needs_refresh && !tokenInfo.is_expired) {
        console.log('Proactively refreshing token...');
        await this.refreshAccessToken();
      }
      
      // Handle expired token
      if (tokenInfo.is_expired) {
        this.handleAuthFailure();
      }
    } catch (error) {
      console.error('Error checking token status:', error);
    }
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

    try {
      const response = await fetch(`${this.baseUrl}/users/token/info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting token info:', error);
    }

    return {
      expires_at: null,
      seconds_remaining: 0,
      minutes_remaining: 0,
      is_expired: true,
      needs_refresh: true,
    };
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
        this.handleAuthFailure();
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
  }

  // =======================================
  // AUTHENTICATION METHODS
  // =======================================

  async login(identifier: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
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
      if (token) {
        await fetch(`${this.baseUrl}/users/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
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
    
    // Only redirect in browser environment
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  private showSessionWarning(minutes: number): void {
    console.log(`Session expires in ${minutes} minutes`);
    
    // You can integrate with your notification system here
    // For example, using react-hot-toast:
    // toast.warning(`Session expires in ${minutes} minutes. Continue using the app to stay logged in.`);
  }

  // Cleanup method
  destroy(): void {
    this.stopTokenMonitoring();
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