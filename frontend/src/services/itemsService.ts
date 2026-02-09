/**
 * Items API Service
 * Handles API calls related to items
 */

// Helper function to get token from cookies
const getTokenFromCookies = (): string | null => {
  if (typeof document === "undefined") return null;
  
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "token") {

      return decodeURIComponent(value);
    }
  }
  return null;
};

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = getTokenFromCookies();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

/**
 * Get pending items count for the current user
 */
export async function getPendingItemsCount(): Promise<number> {
  try {
    console.log('🌐 [Pending Items Badge] Making API request to:', `${API_BASE_URL}/api/items/pending-count`);
    const response = await fetch(`${API_BASE_URL}/api/items/pending-count`, {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    });

    console.log('📡 [Pending Items Badge] API response status:', response.status, response.statusText);

    // Handle rate limiting (429 Too Many Requests) gracefully
    if (response.status === 429) {
      console.warn('⚠️ [Pending Items Badge] Rate limit exceeded, returning 0');
      return 0;
    }

    // Handle 403 Forbidden - user doesn't have permission
    if (response.status === 403) {
      console.log('🔒 [Pending Items Badge] User does not have permission to view pending items');
      return 0;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch pending items count: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 [Pending Items Badge] API response data:', data);
    const count = data.count || 0;
    console.log('🔢 [Pending Items Badge] Returning count:', count);
    return count;
  } catch (error) {
    console.error("❌ [Pending Items Badge] Error fetching pending items count:", error);
    return 0;
  }
}

/**
 * Get pending missing items count for the current user
 */
export async function getPendingMissingItemsCount(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/missing-items/pending-count`, {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    });

    // Handle rate limiting (429 Too Many Requests) gracefully
    if (response.status === 429) {
      console.warn('⚠️ [Pending Missing Items Badge] Rate limit exceeded, returning 0');
      return 0;
    }

    // Handle 403 Forbidden - user doesn't have permission
    if (response.status === 403) {
      console.log('🔒 [Pending Missing Items Badge] User does not have permission to view pending missing items');
      return 0;
    }

    if (!response.ok) {
      // Don't throw for rate limit errors, just log and return 0
      const errorMessage = `Failed to fetch pending missing items count: ${response.statusText}`;
      console.warn('⚠️ [Pending Missing Items Badge]', errorMessage);
      return 0;
    }

    const data = await response.json();
    const count = typeof data.count === 'number' && data.count >= 0 ? data.count : 0;
    console.log('🔢 [Pending Missing Items Badge] Returning count:', count);
    return count;
  } catch (error) {
    // Handle network errors and other exceptions gracefully
    if (error instanceof Error && error.message.includes('Too Many Requests')) {
      console.warn('⚠️ [Pending Missing Items Badge] Rate limit error:', error.message);
    } else {
      console.error("❌ [Pending Missing Items Badge] Error fetching pending missing items count:", error);
    }
    return 0;
  }
}

