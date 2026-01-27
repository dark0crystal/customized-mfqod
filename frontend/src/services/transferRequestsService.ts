/**
 * Transfer Requests API Service
 */

import { tokenManager } from '@/utils/tokenManager';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

/**
 * Get pending transfer requests count
 */
export async function getPendingTransferRequestsCount(): Promise<number> {
  try {
    const response = await tokenManager.makeAuthenticatedRequest(
      `${API_BASE_URL}/api/transfer-requests/pending-count`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    // Handle non-ok responses without reading body
    if (response.status === 403 || response.status === 429) {
      return 0;
    }

    if (!response.ok) {
      return 0;
    }

    // Read response body - only read once
    try {
      const data = await response.json();
      return data?.count || 0;
    } catch {
      // If JSON parsing fails, return 0
      return 0;
    }
  } catch (error) {
    console.error('Error fetching pending transfer requests count:', error);
    return 0;
  }
}
