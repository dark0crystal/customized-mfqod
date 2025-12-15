"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { tokenManager } from "@/utils/tokenManager";
import EditMissingItemForm from "./EditMissingItemForm";
import ItemDropdown from "@/components/ui/ItemDropdown";
import MultiSelectItemDropdown from "@/components/ui/MultiSelectItemDropdown";

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

type FoundItem = { 
  id: string; 
  title: string;
  description?: string;
  status?: string;
  item_type?: {
    id: string;
    name_ar?: string;
    name_en?: string;
  };
  images?: Array<{
    id: string;
    url: string;
  }>;
};
type PendingItem = { 
  id: string; 
  title: string;
  description?: string;
  status?: string;
  item_type?: {
    id: string;
    name_ar?: string;
    name_en?: string;
  };
  images?: Array<{
    id: string;
    url: string;
  }>;
};

type ConnectedItemDetail = {
  id: string;
  title: string;
  description: string;
  item_type?: {
    id: string;
    name_ar?: string;
    name_en?: string;
  };
  images?: Array<{
    id: string;
    url: string;
  }>;
  status?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

const getTokenFromCookies = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default function MissingItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations("dashboard.missingItems.detail");
  const tStatus = useTranslations("dashboard.missingItems.status");
  const tCommon = useTranslations("dashboard.common");
  const tReportMissing = useTranslations("report-missing");
  const locale = useLocale();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [missingItem, setMissingItem] = useState<MissingItemDetail | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignBranchId, setAssignBranchId] = useState("");
  const [assignFoundItemIds, setAssignFoundItemIds] = useState<string[]>([]);
  const [assignNote, setAssignNote] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvePendingItemId, setApprovePendingItemId] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [connectedItems, setConnectedItems] = useState<Record<string, ConnectedItemDetail>>({});
  const [loadingConnectedItems, setLoadingConnectedItems] = useState(false);

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
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const [detailRes, branchRes, foundRes, pendingRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/missing-items/${resolvedParams.id}`, { headers, credentials: "include" }),
          fetch(`${API_BASE_URL}/api/branches`, { headers, credentials: "include" }),
          fetch(`${API_BASE_URL}/api/items?status=pending&limit=100`, { headers, credentials: "include" }),
          fetch(`${API_BASE_URL}/api/items?status=pending&limit=100`, { headers, credentials: "include" }),
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
          // Filter to only include items with status "pending"
          const filteredList = list.filter((itm: FoundItem & { status?: string }) => 
            itm.status === "pending"
          );
          setFoundItems(filteredList.map((itm: FoundItem & { description?: string; status?: string; item_type?: { id: string; name_ar?: string; name_en?: string }; images?: Array<{ id: string; url: string }> }) => ({ 
            id: itm.id, 
            title: itm.title || "Untitled",
            description: itm.description,
            status: itm.status,
            item_type: itm.item_type,
            images: itm.images || []
          })));
        }

        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          const list = Array.isArray(pendingData) ? pendingData : pendingData.items || pendingData.results || [];
          // Filter to only include items with status "pending"
          const filteredList = list.filter((itm: PendingItem & { status?: string }) => 
            itm.status === "pending"
          );
          setPendingItems(filteredList.map((itm: PendingItem & { description?: string; item_type?: { id: string; name_ar?: string; name_en?: string }; images?: Array<{ id: string; url: string }>; status?: string }) => ({ 
            id: itm.id, 
            title: itm.title || "Untitled",
            description: itm.description,
            status: itm.status,
            item_type: itm.item_type,
            images: itm.images || []
          })));
        }
      } catch {
        // ignore
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchData();
  }, [isAuthenticated, resolvedParams.id]);

  const fetchConnectedItemsDetails = async (assignedItems: Array<{ item_id: string }>) => {
    if (assignedItems.length === 0) return;
    
    setLoadingConnectedItems(true);
    try {
      const token = getTokenFromCookies();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };

      // Fetch all item details in parallel
      const itemPromises = assignedItems.map(async (link) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/items/${link.item_id}`, {
            headers,
            credentials: "include",
          });
          if (res.ok) {
            const itemData = await res.json();
            return { itemId: link.item_id, data: itemData };
          }
        } catch (error) {
          console.error(`Failed to fetch item ${link.item_id}:`, error);
        }
        return null;
      });

      const results = await Promise.all(itemPromises);
      const itemsMap: Record<string, ConnectedItemDetail> = {};
      
      results.forEach((result) => {
        if (result && result.data) {
          itemsMap[result.itemId] = {
            id: result.data.id,
            title: result.data.title || "Untitled",
            description: result.data.description || "",
            item_type: result.data.item_type,
            images: result.data.images || [],
            status: result.data.status,
          };
        }
      });

      setConnectedItems(itemsMap);
    } catch (error) {
      console.error("Error fetching connected items:", error);
    } finally {
      setLoadingConnectedItems(false);
    }
  };

  // Fetch connected items when missingItem changes
  useEffect(() => {
    if (missingItem?.assigned_found_items && missingItem.assigned_found_items.length > 0) {
      fetchConnectedItemsDetails(missingItem.assigned_found_items);
    } else {
      setConnectedItems({});
    }
  }, [missingItem?.assigned_found_items]);

  const refreshDetail = async () => {
    try {
      const token = getTokenFromCookies();
      const headers: HeadersInit = token
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
    if (value === "approved") {
      setApproveModalOpen(true);
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
        throw new Error(err.detail || t("failedToUpdateStatus"));
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
      setAssignError(t("validationRequired"));
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
        throw new Error(err.detail || t("failedToAssign"));
      }

      const data = await res.json();
      setMissingItem(data);
      setAssignModalOpen(false);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : t("failedToAssign"));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleApproveSubmit = async () => {
    if (!missingItem) return;
    if (!approvePendingItemId || !approveNote.trim()) {
      setApproveError(t("validationRequiredApproval"));
      return;
    }

    try {
      setApproveLoading(true);
      setApproveError(null);
      const token = getTokenFromCookies();
      const res = await fetch(`${API_BASE_URL}/api/missing-items/${missingItem.id}/assign-pending-item`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pending_item_id: approvePendingItemId,
          note: approveNote,
          notify: true,
          set_status_to_approved: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || t("failedToApprove"));
      }

      const data = await res.json();
      setMissingItem(data);
      setApproveModalOpen(false);
      setApprovePendingItemId("");
      setApproveNote("");
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : t("failedToApprove"));
    } finally {
      setApproveLoading(false);
    }
  };

  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Helper to process and validate image URL
  const getImageUrl = (imageUrl: string | null | undefined): string | null => {
    if (!imageUrl) return null;
    
    // If the url is already absolute, validate and return as is
    if (/^https?:\/\//.test(imageUrl)) {
      try {
        new URL(imageUrl);
        return imageUrl;
      } catch {
        return null;
      }
    }
    
    // Process relative URLs
    let processedUrl = imageUrl.replace('/uploads/images/', '/static/images/');
    if (!processedUrl.startsWith('/')) {
      processedUrl = '/' + processedUrl;
    }
    
    const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
    const fullUrl = `${baseUrl}${processedUrl}`;
    
    // Validate the constructed URL
    try {
      new URL(fullUrl);
      return fullUrl;
    } catch {
      return null;
    }
  };

  if (isLoading || loadingDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t("redirectingToLogin")}</p>
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
                {t("status")}: <span className="font-semibold capitalize">{tStatus(missingItem.status)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">{t("changeStatus")}</label>
              <select
                className="border rounded px-3 py-2"
                value={missingItem.status}
                disabled={statusSaving}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="pending">{tStatus("pending")}</option>
                <option value="approved">{tStatus("approved")}</option>
                <option value="cancelled">{tStatus("cancelled")}</option>
                <option value="visit">{tStatus("visit")}</option>
              </select>
              <button
                className="mt-2 px-3 py-2 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                onClick={() => setAssignModalOpen(true)}
              >
                {t("assignFoundItems")}
              </button>
            </div>
          </div>

          {missingItem.assigned_found_items && missingItem.assigned_found_items.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{t("assignedFoundItems")}</h4>
              {loadingConnectedItems ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {missingItem.assigned_found_items.map((link) => {
                    const itemDetail = connectedItems[link.item_id];
                    const rawImageUrl = itemDetail?.images && itemDetail.images.length > 0 
                      ? itemDetail.images[0].url 
                      : null;
                    const itemImage = getImageUrl(rawImageUrl);
                    const itemTypeName = itemDetail?.item_type 
                      ? getLocalizedName(itemDetail.item_type.name_ar, itemDetail.item_type.name_en)
                      : null;

                    return (
                      <div
                        key={link.id}
                        className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                      >
                        {/* Image - Small square on the left */}
                        <div className="flex-shrink-0 relative w-16 h-16 sm:w-20 sm:h-20">
                          {itemImage ? (
                            <Image
                              src={itemImage}
                              alt={itemDetail?.title || "Item"}
                              fill
                              className="object-cover rounded-md border border-gray-300"
                              sizes="(max-width: 640px) 64px, 80px"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-300 rounded-md flex items-center justify-center border border-gray-300">
                              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Content - Title, description, and type on the right */}
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm sm:text-base font-semibold text-gray-900 mb-1 line-clamp-1">
                            {itemDetail?.title || link.item_title || link.item_id}
                          </h5>
                          {itemDetail?.description && (
                            <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">
                              {itemDetail.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {itemTypeName && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                {itemTypeName}
                              </span>
                            )}
                            {itemDetail?.status && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                itemDetail.status === 'approved' 
                                  ? 'bg-green-100 text-green-800'
                                  : itemDetail.status === 'visit'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {itemDetail.status.charAt(0).toUpperCase() + itemDetail.status.slice(1)}
                              </span>
                            )}
                            {link.branch_name && (
                              <span className="text-xs text-gray-500">
                                {t("branch")}: {link.branch_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <EditMissingItemForm missingItemId={resolvedParams.id} />

      {assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("assignFoundItemsAndSetVisit")}</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                &times;
              </button>
            </div>

            {assignError && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{assignError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("branch")}</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={assignBranchId}
                  onChange={(e) => setAssignBranchId(e.target.value)}
                >
                  <option value="">{t("selectBranch")}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || tReportMissing("unnamedBranch")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <MultiSelectItemDropdown
                  items={foundItems}
                  selectedIds={assignFoundItemIds}
                  onChange={setAssignFoundItemIds}
                  placeholder={t("selectFoundItemsPlaceholder")}
                  label={t("foundItems")}
                  emptyMessage={t("noFoundItemsAvailable")}
                  variant="light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("noteToReporter")}</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder={t("includeVisitInstructions")}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                  disabled={assignLoading}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleAssignSubmit}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={assignLoading}
                >
                  {assignLoading ? t("assigning") : t("assignAndSetVisit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {approveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("assignPendingItemAndApprove")}</h3>
              <button onClick={() => setApproveModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                &times;
              </button>
            </div>

            {approveError && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{approveError}</div>}

            <div className="space-y-4">
              <div>
                <ItemDropdown
                  items={pendingItems.filter(item => item.status === "pending")}
                  value={approvePendingItemId}
                  onChange={setApprovePendingItemId}
                  placeholder={t("selectPendingItemPlaceholder")}
                  label={t("selectPendingItem")}
                  emptyMessage={t("noPendingItemsAvailable")}
                  variant="light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("noteToReporter")}</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder={t("includeApprovalNote")}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setApproveModalOpen(false);
                    setApprovePendingItemId("");
                    setApproveNote("");
                    setApproveError(null);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                  disabled={approveLoading}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleApproveSubmit}
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                  disabled={approveLoading || !approvePendingItemId || !approveNote.trim()}
                >
                  {approveLoading ? t("approving") : t("assignAndApprove")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
