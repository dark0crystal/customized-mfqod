"use client";

import React, { useEffect, useState } from "react";
import { useTranslations, useLocale } from 'next-intl';
import DisplayItems from './DisplayItems';

// Define the Item type
enum ItemStatus {
  CANCELLED = "cancelled",
  APPROVED = "approved",
  PENDING = "pending"
}

type Item = {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  item_type_id?: string;
  location?: {
    organization_name_ar?: string;
    organization_name_en?: string;
    branch_name_ar?: string;
    branch_name_en?: string;
    full_location?: string;
  };
  status?: string;  // Item status: cancelled, approved, pending
  approval?: boolean;  // DEPRECATED: kept for backward compatibility
  temporary_deletion?: boolean;
  claims_count?: number;
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

interface ItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

// Helper to get token from cookies
function getTokenFromCookies(): string | null {
  if (typeof document === "undefined") return null;
  
  // Try multiple cookie names for token
  const match = document.cookie.match(/(?:^|;\s*)(?:token|access_token)=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ItemsPage() {
  const t = useTranslations("dashboard.items");
  const locale = useLocale();
  const [items, setItems] = useState<Item[]>([]);
  const [itemImages, setItemImages] = useState<Record<string, ItemImage[]>>({});
  const [currentItemTypeId, setCurrentItemTypeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
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

  // Get today's date in YYYY-MM-DD format for max date validation
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const API_BASE = `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/item-types/`;

  // Fetch images for a list of item IDs
  const fetchImagesForItems = async (itemsList: Item[]) => {
    const newImages: Record<string, ItemImage[]> = {};
    await Promise.all(
      itemsList.map(async (item) => {
        try {
          const token = getTokenFromCookies();
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/images/items/${item.id}/images`,
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
            newImages[item.id] = Array.isArray(data) ? data : data.images || [];
          } else {
            newImages[item.id] = [];
          }
        } catch {
          newImages[item.id] = [];
        }
      })
    );
    setItemImages(newImages);
  };

  const fetchItems = async (filters?: {
    itemTypeId?: string;
    searchQuery?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenFromCookies();
      
      // Determine which endpoint to use based on search query
      let url = `${API_BASE_URL}/api/items`;
      if (filters?.searchQuery && filters.searchQuery.trim()) {
        url = `${API_BASE_URL}/api/items/search/`;
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
      
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();

      // Defensive: handle if data is not an array, e.g. { items: [...] }
      let itemsArray: Item[] = [];
      if (Array.isArray(data)) {
        itemsArray = data;
      } else if (Array.isArray(data.items)) {
        itemsArray = data.items;
      } else if (data.results && Array.isArray(data.results)) {
        itemsArray = data.results;
      } else {
        itemsArray = [];
      }

      setItems(itemsArray);

      // Fetch images for these items
      if (itemsArray.length > 0) {
        await fetchImagesForItems(itemsArray);
      } else {
        setItemImages({});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching items");
      setItems([]);
      setItemImages({});
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
      const response = await fetch(`${API_BASE_URL}/api/branches/public/`, {
        headers: {
          "Content-Type": "application/json",
        },
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
    // Validate that the date is not in the future
    if (date && date > getTodayDate()) {
      setError(t("validation.noFutureDates"));
      return;
    }
    
    // Validate that from date is not after to date
    if (date && dateTo && date > dateTo) {
      setError(t("validation.fromDateAfterToDate"));
      return;
    }
    
    setDateFrom(date);
    setError(null);
    applyFilters({ dateFrom: date });
  };

  const handleDateToChange = (date: string) => {
    // Validate that the date is not in the future
    if (date && date > getTodayDate()) {
      setError(t("validation.noFutureDates"));
      return;
    }
    
    // Validate that to date is not before from date
    if (date && dateFrom && date < dateFrom) {
      setError(t("validation.toDateBeforeFromDate"));
      return;
    }
    
    setDateTo(date);
    setError(null);
    applyFilters({ dateTo: date });
  };

  const applyFilters = (newFilters?: {
    itemTypeId?: string;
    searchQuery?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const filters = {
      itemTypeId: newFilters?.itemTypeId !== undefined ? newFilters.itemTypeId : currentItemTypeId,
      searchQuery: newFilters?.searchQuery !== undefined ? newFilters.searchQuery : searchQuery,
      branchId: newFilters?.branchId !== undefined ? newFilters.branchId : selectedBranchId,
      dateFrom: newFilters?.dateFrom !== undefined ? newFilters.dateFrom : dateFrom,
      dateTo: newFilters?.dateTo !== undefined ? newFilters.dateTo : dateTo,
    };
    
    fetchItems(filters);
  };

  const clearAllFilters = () => {
    setCurrentItemTypeId("");
    setSearchQuery("");
    setSelectedBranchId("");
    setDateFrom("");
    setDateTo("");
    fetchItems();
  };

  useEffect(() => {
    fetchItemTypes();
    fetchBranches();
    fetchItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full min-h-[88vh]">
      {/* Header with title and filters */}
      <div className="w-full p-4 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{t("myItems")}</h1>
            
            {/* Clear Filters Button */}
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 self-start lg:self-auto"
            >
              {t("filters.clearAllFilters")}
            </button>
          </div>

          {/* Filters Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-2">
                {t("filters.searchItems")}
              </label>
              <input
                id="search-input"
                type="text"
                placeholder={t("filters.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              />
            </div>

            {/* Item Type Filter */}
            <div>
              <label htmlFor="item-type-filter" className="block text-sm font-medium text-gray-700 mb-2">
                {t("filters.itemType")}
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              >
                <option value="">{t("filters.allTypes")}</option>
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
                {t("filters.branch")}
              </label>
              <select
                id="branch-filter"
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              >
                <option value="">{t("filters.allBranches")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || 'Unnamed Branch'}
                    {branch.organization && ` - ${branch.organization.name}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filters */}
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("filters.dateRange")}
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  placeholder={t("filters.fromDate")}
                  value={dateFrom}
                  max={getTodayDate()}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                  style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
                />
                <input
                  type="date"
                  placeholder={t("filters.toDate")}
                  value={dateTo}
                  max={getTodayDate()}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                  style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="w-full mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {t("error")}: {error}
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3277AE] mx-auto"></div>
                <p className="mt-2">{t("loading")}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <p style={{ color: '#3277AE' }}>{t("noItemsFound")}</p>
              </div>
            ) : (
              <DisplayItems items={items} images={itemImages} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}