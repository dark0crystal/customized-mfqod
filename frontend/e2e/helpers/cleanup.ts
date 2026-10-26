import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './env';

/** Permanently delete test data created by the suite. Only ever called with ids the suite created. */
export async function deleteItem(request: APIRequestContext, token: string, id: string) {
  return request.delete(`${API_URL}/api/items/${id}?permanent=true`, { headers: { Authorization: `Bearer ${token}` } });
}
export async function deleteMissingItem(request: APIRequestContext, token: string, id: string) {
  return request.delete(`${API_URL}/api/missing-items/${id}?permanent=true`, { headers: { Authorization: `Bearer ${token}` } });
}
