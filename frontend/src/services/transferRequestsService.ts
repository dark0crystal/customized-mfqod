/**
 * Transfer Requests API Service
 * Handles API calls related to transfer requests
 */

import { tokenManager } from '@/utils/tokenManager';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

/**
 * Get pending transfer requests count for incoming requests
 * Returns the count of pending transfer requests where the current user can approve/reject
 */
export async function getPendingTransferRequestsCount(): Promise<number> {
  try {
    const response = await tokenManager.makeAuthenticatedRequest(
      `${API_BASE_URL}/api/transfer-requests/incoming/?status=pending`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    // Handle 403 Forbidden - user doesn't have permission to view transfer requests
    if (response.status === 403) {
      console.log("User does not have permission to view transfer requests");
      return 0;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch pending transfer requests count: ${response.statusText}`);
    }

    const data = await response.json();
    // The API returns an array of transfer requests, so we count them
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    // Silently handle permission errors - user just doesn't have access
    if (error instanceof Error && error.message.includes('Forbidden')) {
      console.log("User does not have permission to view transfer requests");
      return 0;
    }
    console.error("Error fetching pending transfer requests count:", error);
    return 0;
  }
}

