"use client";

import React, { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import DisplayMissingItems from './DisplayMissingItems';

// Define the MissingItem type
type MissingItem = {
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
  location?: {
    organization_name?: string;
    branch_name?: string;
    full_location?: string;
  };
  images?: Array<{
    id: string;
    url: string;
    description?: string;
    created_at: string;
    updated_at: string;
  }>;
  [key: string]: unknown;
};

interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  organization_id: string;
  organization?: {
    id: string;
    name: string;
    name_ar?: string;
    name_en?: string;
  };
}

interface MissingItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

// Helper to get token from cookies
function getTokenFromCookies(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function MissingItemsPage() {
  const locale = useLocale();
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [missingItemImages, setMissingItemImages] = useState<Record<string, MissingItemImage[]>>({});
  const [currentItemTypeId, setCurrentItemTypeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [approvalFilter, setApprovalFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  const API_BASE = `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/item-types/`;

  // Fetch images for a list of missing item IDs
  const fetchImagesForMissingItems = async (missingItemsList: MissingItem[]) => {
    const newImages: Record<string, MissingItemImage[]> = {};
    await Promise.all(
      missingItemsList.map(async (missingItem) => {
        try {
          const token = getTokenFromCookies();
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/images/missing-items/${missingItem.id}/images`,
            {
              headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  }
                : { "Content-Type": "application/json" },
            }
          );
          if (res.ok) {
            const data = await res.json();
            newImages[missingItem.id] = Array.isArray(data) ? data : data.images || [];
          } else {
            newImages[missingItem.id] = [];
          }
        } catch {
          newImages[missingItem.id] = [];
        }
      })
    );
    setMissingItemImages(newImages);
  };

  const fetchMissingItems = async (filters?: {
    itemTypeId?: string;
    searchQuery?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    approval?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenFromCookies();
      
      // Determine which endpoint to use based on search query
      let url = `${API_BASE_URL}/api/missing-items`;
      if (filters?.searchQuery && filters.searchQuery.trim()) {
        url = `${API_BASE_URL}/api/missing-items/search/`;
      }
      
      const params = new URLSearchParams();
      
      // Add search query if provided
      if (filters?.searchQuery && filters.searchQuery.trim()) {
        params.append("q", filters.searchQuery.trim());
      }
      
      // Add other filters
      if (filters?.itemTypeId) params.append("item_type_id", filters.itemTypeId);
      if (filters?.branchId) params.append("branch_id", filters.branchId);
      if (filters?.dateFrom) params.append("date_from", filters.dateFrom);
      if (filters?.dateTo) params.append("date_to", filters.dateTo);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.approval) params.append("approved_only", filters.approval === "approved" ? "true" : "false");
      
      params.append("skip", "0");
      params.append("limit", "100");

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            }
          : { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to fetch missing items");
      const data = await res.json();

      // Defensive: handle if data is not an array, e.g. { missing_items: [...] }
      let missingItemsArray: MissingItem[] = [];
      if (Array.isArray(data)) {
        missingItemsArray = data;
      } else if (Array.isArray(data.missing_items)) {
        missingItemsArray = data.missing_items;
      } else if (data.results && Array.isArray(data.results)) {
        missingItemsArray = data.results;
      } else {
        missingItemsArray = [];
      }

      setMissingItems(missingItemsArray);

      // Fetch images for these missing items
      if (missingItemsArray.length > 0) {
        await fetchImagesForMissingItems(missingItemsArray);
      } else {
        setMissingItemImages({});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching missing items");
      setMissingItems([]);
      setMissingItemImages({});
    } finally {
      setLoading(false);
    }
  };

  const fetchItemTypes = async () => {
    try {
      const token = getTokenFromCookies();
      const response = await fetch(API_BASE, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            }
          : { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setItemTypes(data);
    } catch (err) {
      setError(`Failed to fetch item types: ${(err as Error).message}`);
    }
  };

  const fetchBranches = async () => {
    try {
      const token = getTokenFromCookies();
      const response = await fetch(`${API_BASE_URL}/api/branches/`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            }
          : { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBranches(data);
    } catch (err) {
      setError(`Failed to fetch branches: ${(err as Error).message}`);
    }
  };

  const handleItemTypeClick = (itemTypeId: string) => {
    setCurrentItemTypeId(itemTypeId);
    applyFilters({ itemTypeId });
  };

  const handleShowAll = () => {
    setCurrentItemTypeId("");
    applyFilters({ itemTypeId: "" });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    applyFilters({ searchQuery: query });
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    applyFilters({ branchId });
  };

  const handleDateFromChange = (date: string) => {
    setDateFrom(date);
    applyFilters({ dateFrom: date });
  };

  const handleDateToChange = (date: string) => {
    setDateTo(date);
    applyFilters({ dateTo: date });
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    applyFilters({ status });
  };

  const handleApprovalChange = (approval: string) => {
    setApprovalFilter(approval);
    applyFilters({ approval });
  };

  const applyFilters = (newFilters?: {
    itemTypeId?: string;
    searchQuery?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    approval?: string;
  }) => {
    const filters = {
      itemTypeId: newFilters?.itemTypeId !== undefined ? newFilters.itemTypeId : currentItemTypeId,
      searchQuery: newFilters?.searchQuery !== undefined ? newFilters.searchQuery : searchQuery,
      branchId: newFilters?.branchId !== undefined ? newFilters.branchId : selectedBranchId,
      dateFrom: newFilters?.dateFrom !== undefined ? newFilters.dateFrom : dateFrom,
      dateTo: newFilters?.dateTo !== undefined ? newFilters.dateTo : dateTo,
      status: newFilters?.status !== undefined ? newFilters.status : statusFilter,
      approval: newFilters?.approval !== undefined ? newFilters.approval : approvalFilter,
    };
    
    fetchMissingItems(filters);
  };

  const clearAllFilters = () => {
    setCurrentItemTypeId("");
    setSearchQuery("");
    setSelectedBranchId("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("");
    setApprovalFilter("");
    fetchMissingItems();
  };

  useEffect(() => {
    fetchItemTypes();
    fetchBranches();
    fetchMissingItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full min-h-[88vh]">
      {/* Header with title and filters */}
      <div className="w-full p-4 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#3277AE' }}>Missing Items Reports</h1>
            
            {/* Clear Filters Button */}
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 self-start lg:self-auto"
            >
              Clear All Filters
            </button>
          </div>

          {/* Filters Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-2">
                Search Missing Items
              </label>
              <input
                id="search-input"
                type="text"
                placeholder="Search by title or description..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              />
            </div>

            {/* Item Type Filter */}
            <div>
              <label htmlFor="item-type-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Item Type
              </label>
              <select
                id="item-type-filter"
                value={currentItemTypeId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    handleShowAll();
                  } else {
                    handleItemTypeClick(value);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              >
                <option value="">All Types</option>
                {itemTypes.map((itemType) => (
                  <option key={itemType.id} value={itemType.id}>
                    {getLocalizedName(itemType.name_ar, itemType.name_en) || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div>
              <label htmlFor="branch-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <select
                id="branch-filter"
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || 'Unnamed Branch'}
                    {branch.organization && ` - ${branch.organization.name}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              >
                <option value="">All Status</option>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            {/* Approval Filter */}
            <div>
              <label htmlFor="approval-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Approval Status
              </label>
              <select
                id="approval-filter"
                value={approvalFilter}
                onChange={(e) => handleApprovalChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              >
                <option value="">All</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  placeholder="From Date"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
                <input
                  type="date"
                  placeholder="To Date"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="w-full mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              Error: {error}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="w-full p-4 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="w-full pb-20">
            {loading ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2">Loading missing items...</p>
              </div>
            ) : missingItems.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No missing items found. Try adjusting your filters.</p>
              </div>
            ) : (
              <DisplayMissingItems missingItems={missingItems} images={missingItemImages} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
