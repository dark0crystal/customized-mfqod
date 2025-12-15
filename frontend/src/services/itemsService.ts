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
    if (name === "access_token" || name === "token") {
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'itemsService.ts:getPendingItemsCount:entry',message:'API call started',data:{url:`${API_BASE_URL}/api/items/pending-count`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  try {
    const token = getTokenFromCookies();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'itemsService.ts:getPendingItemsCount:token_check',message:'Token check',data:{has_token:!!token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(`${API_BASE_URL}/api/items/pending-count`, {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'itemsService.ts:getPendingItemsCount:response',message:'API response received',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'itemsService.ts:getPendingItemsCount:error',message:'Response not OK',data:{status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw new Error(`Failed to fetch pending items count: ${response.statusText}`);
    }

    const data = await response.json();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'itemsService.ts:getPendingItemsCount:success',message:'API call successful',data:{count:data.count,raw_data:data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    return data.count || 0;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'itemsService.ts:getPendingItemsCount:catch',message:'Exception caught',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.error("Error fetching pending items count:", error);
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

    if (!response.ok) {
      throw new Error(`Failed to fetch pending missing items count: ${response.statusText}`);
    }

    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error("Error fetching pending missing items count:", error);
    return 0;
  }
}

