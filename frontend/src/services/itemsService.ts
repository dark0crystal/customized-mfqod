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
    const response = await fetch(`${API_BASE_URL}/api/items/pending-count`, {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (response.status === 429) return 0;
    if (response.status === 403) return 0;
    if (!response.ok) {
      throw new Error(`Failed to fetch pending items count: ${response.statusText}`);
    }

    const data = await response.json();
    return data.count || 0;
  } catch {
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
    if (response.status === 429) return 0;
    if (response.status === 403) return 0;
    if (!response.ok) return 0;

    const data = await response.json();
    return typeof data.count === 'number' && data.count >= 0 ? data.count : 0;
  } catch {
    return 0;
  }
}

