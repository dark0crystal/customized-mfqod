"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { tokenManager } from "@/utils/tokenManager";
import EditMissingItemForm from "./EditMissingItemForm";

type MissingItemDetail = {
  id: string;
  title: string;
  description: string;
  status: string;
  approval: boolean;
  temporary_deletion: boolean;
  item_type_id?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  assigned_found_items?: Array<{
    id: string;
    item_id: string;
    item_title?: string;
    branch_id?: string;
    branch_name?: string;
    note?: string;
    notified_at?: string;
  }>;
};

type Branch = {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
};

type FoundItem = { id: string; title: string };

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

const getTokenFromCookies = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default function MissingItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [missingItem, setMissingItem] = useState<MissingItemDetail | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignBranchId, setAssignBranchId] = useState("");
  const [assignFoundItemIds, setAssignFoundItemIds] = useState<string[]>([]);
  const [assignNote, setAssignNote] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    const authenticated = tokenManager.isAuthenticated();
    setIsAuthenticated(authenticated);
    setIsLoading(false);
    if (!authenticated) {
      router.push("/auth/login");
    }
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;
      setLoadingDetail(true);
      try {
        const token = getTokenFromCookies();
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const [detailRes, branchRes, foundRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/missing-items/${resolvedParams.id}`, { headers, credentials: "include" }),
          fetch(`${API_BASE_URL}/api/branches`, { headers, credentials: "include" }),
          fetch(`${API_BASE_URL}/api/items?status=approved&limit=100`, { headers, credentials: "include" }),
        ]);

        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setMissingItem(detailData);
        }

        if (branchRes.ok) {
          const branchData = await branchRes.json();
          setBranches(Array.isArray(branchData) ? branchData : branchData.results || []);
        }

        if (foundRes.ok) {
          const foundData = await foundRes.json();
          const list = Array.isArray(foundData) ? foundData : foundData.items || foundData.results || [];
          setFoundItems(list.map((itm: any) => ({ id: itm.id, title: itm.title || "Untitled" })));
        }
      } catch {
        // ignore
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchData();
  }, [isAuthenticated, resolvedParams.id]);

  const refreshDetail = async () => {
    try {
      const token = getTokenFromCookies();
      const headers = token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };
      const res = await fetch(`${API_BASE_URL}/api/missing-items/${resolvedParams.id}`, {
        headers,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMissingItem(data);
      }
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (value: string) => {
    if (!missingItem) return;
    if (value === "visit") {
      setAssignModalOpen(true);
      return;
    }
    try {
      setStatusSaving(true);
      const token = getTokenFromCookies();
      const res = await fetch(
        `${API_BASE_URL}/api/missing-items/${missingItem.id}/update-status?status=${value}`,
        {
          method: "PATCH",
          headers: token
            ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
            : { "Content-Type": "application/json" },
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update status");
      }
      await refreshDetail();
    } catch (err) {
      console.error(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAssignSubmit = async () => {
    if (!missingItem) return;
    if (!assignBranchId || assignFoundItemIds.length === 0 || !assignNote.trim()) {
      setAssignError("Branch, at least one found item, and a note are required.");
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError(null);
      const token = getTokenFromCookies();
      const res = await fetch(`${API_BASE_URL}/api/missing-items/${missingItem.id}/assign-found-items`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branch_id: assignBranchId,
          found_item_ids: assignFoundItemIds,
          note: assignNote,
          notify: true,
          set_status_to_visit: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to assign found items");
      }

      const data = await res.json();
      setMissingItem(data);
      setAssignModalOpen(false);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign found items");
    } finally {
      setAssignLoading(false);
    }
  };

  if (isLoading || loadingDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {missingItem && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{missingItem.title}</h2>
              <p className="text-gray-700 mt-1">{missingItem.description}</p>
              <div className="mt-2 text-sm text-gray-600">
                Status: <span className="font-semibold capitalize">{missingItem.status}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Change status</label>
              <select
                className="border rounded px-3 py-2"
                value={missingItem.status}
                disabled={statusSaving}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
                <option value="visit">Visit</option>
              </select>
              <button
                className="mt-2 px-3 py-2 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                onClick={() => setAssignModalOpen(true)}
              >
                Assign found items
              </button>
            </div>
          </div>

          {missingItem.assigned_found_items && missingItem.assigned_found_items.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-gray-800">Assigned found items</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {missingItem.assigned_found_items.map((link) => (
                  <li key={link.id} className="flex items-center justify-between">
                    <span>{link.item_title || link.item_id}</span>
                    <span className="text-gray-500 text-xs">
                      {link.branch_name ? `Branch: ${link.branch_name}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <EditMissingItemForm missingItemId={resolvedParams.id} />

      {assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Assign found items & set visit</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                &times;
              </button>
            </div>

            {assignError && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{assignError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={assignBranchId}
                  onChange={(e) => setAssignBranchId(e.target.value)}
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_name_en || branch.branch_name_ar || "Unnamed Branch"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Found items</label>
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                  {foundItems.length === 0 && <p className="text-sm text-gray-500">No found items available.</p>}
                  {foundItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={assignFoundItemIds.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignFoundItemIds((prev) => [...prev, item.id]);
                          } else {
                            setAssignFoundItemIds((prev) => prev.filter((id) => id !== item.id));
                          }
                        }}
                      />
                      <span>{item.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note to reporter</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Include visit instructions"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                  disabled={assignLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSubmit}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={assignLoading}
                >
                  {assignLoading ? "Assigning..." : "Assign & set visit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
