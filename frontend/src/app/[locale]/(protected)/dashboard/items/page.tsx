"use client";

import React, { useEffect, useState } from "react";
import { useTranslations, useLocale } from 'next-intl';
import { HelpCircle } from 'lucide-react';
import DisplayItems from './DisplayItems';
import OnboardingTour, { TourStep } from '@/components/OnboardingTour';
import ProtectedPage from '@/components/protection/ProtectedPage';

// Define the Item type
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
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);

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
  const [viewMode, setViewMode] = useState<'managed' | 'all'>('managed');
  const [selectedStatus, setSelectedStatus] = useState<string>('pending'); // Default to pending
  const [isTourOpen, setIsTourOpen] = useState(false);

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
    showAll?: boolean;
    status?: string;
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
      
      // Add status filter - only fetch items with the selected status
      if (filters?.status) {
        params.append("status", filters.status);
      }
      
      // Add show_all parameter to bypass branch-based filtering
      // Explicitly set show_all based on the filter - when false, filter by user's managed branches
      // FastAPI will parse "false" string as boolean False
      const showAllValue = filters?.showAll === true ? "true" : "false";
      params.append("show_all", showAllValue);
      console.log('Fetching items with status:', filters?.status, 'show_all:', showAllValue);
      
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
    applyFilters({ itemTypeId, status: selectedStatus });
  };

  const handleShowAll = () => {
    setCurrentItemTypeId("");
    applyFilters({ itemTypeId: "", status: selectedStatus });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    applyFilters({ searchQuery: query, status: selectedStatus });
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    applyFilters({ branchId, status: selectedStatus });
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
    applyFilters({ dateFrom: date, status: selectedStatus });
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
    applyFilters({ dateTo: date, status: selectedStatus });
  };

  const applyFilters = (newFilters?: {
    itemTypeId?: string;
    searchQuery?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
    showAll?: boolean;
    status?: string;
  }) => {
    // Always use viewMode to determine showAll if not explicitly provided
    // This ensures "My Managed Items" always filters by managed branches
    const showAllValue = newFilters?.showAll !== undefined 
      ? newFilters.showAll 
      : (viewMode === 'all');
    
    const filters = {
      itemTypeId: newFilters?.itemTypeId !== undefined ? newFilters.itemTypeId : currentItemTypeId,
      searchQuery: newFilters?.searchQuery !== undefined ? newFilters.searchQuery : searchQuery,
      branchId: newFilters?.branchId !== undefined ? newFilters.branchId : selectedBranchId,
      dateFrom: newFilters?.dateFrom !== undefined ? newFilters.dateFrom : dateFrom,
      dateTo: newFilters?.dateTo !== undefined ? newFilters.dateTo : dateTo,
      status: newFilters?.status !== undefined ? newFilters.status : selectedStatus,
      showAll: showAllValue,
    };
    
    console.log('applyFilters called with:', { status: filters.status, showAllValue, viewMode, filters });
    fetchItems(filters);
  };

  const clearAllFilters = () => {
    setCurrentItemTypeId("");
    setSearchQuery("");
    setSelectedBranchId("");
    setDateFrom("");
    setDateTo("");
    setSelectedStatus('pending'); // Reset to pending
    setViewMode('managed');
    fetchItems({ showAll: false, status: 'pending' });
  };


  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    applyFilters({ status });
  };

  useEffect(() => {
    fetchItemTypes();
    fetchBranches();
    // Initial load: fetch only pending items by default to save resources
    fetchItems({ showAll: false, status: 'pending' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Define tour steps
  const tourSteps: TourStep[] = [
    {
      id: 'welcome',
      title: t('tour.steps.welcome.title'),
      description: t('tour.steps.welcome.description'),
      position: 'center',
    },
    {
      id: 'statusFilters',
      target: '[data-tour="status-filters"]',
      title: t('tour.steps.statusFilters.title'),
      description: t('tour.steps.statusFilters.description'),
      position: 'bottom',
    },
    {
      id: 'searchFilter',
      target: '#search-input',
      title: t('tour.steps.searchFilter.title'),
      description: t('tour.steps.searchFilter.description'),
      position: 'bottom',
    },
    {
      id: 'itemTypeFilter',
      target: '#item-type-filter',
      title: t('tour.steps.itemTypeFilter.title'),
      description: t('tour.steps.itemTypeFilter.description'),
      position: 'bottom',
    },
    {
      id: 'branchFilter',
      target: '#branch-filter',
      title: t('tour.steps.branchFilter.title'),
      description: t('tour.steps.branchFilter.description'),
      position: 'bottom',
    },
    {
      id: 'dateRangeFilters',
      target: '[data-tour="date-range-filters"]',
      title: t('tour.steps.dateRangeFilters.title'),
      description: t('tour.steps.dateRangeFilters.description'),
      position: 'bottom',
    },
    {
      id: 'clearFilters',
      target: '[data-tour="clear-filters"]',
      title: t('tour.steps.clearFilters.title'),
      description: t('tour.steps.clearFilters.description'),
      position: 'bottom',
    },
    {
      id: 'itemsGrid',
      target: '[data-tour="items-grid"]',
      title: t('tour.steps.itemsGrid.title'),
      description: t('tour.steps.itemsGrid.description'),
      position: 'top',
    },
  ];

  return (
    <ProtectedPage requiredPermission="can_manage_items">
      <div className="relative w-full min-h-[88vh]">
      {/* Header with title and filters */}
      <div className="w-full px-2 sm:px-4 py-4 bg-white border-b border-gray-200 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t("myItems")}</h1>
            
            <div className="flex items-center gap-3 self-start lg:self-auto">
              {/* Help Guide Button */}
              <button
                onClick={() => setIsTourOpen(true)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-white bg-[#3277AE] hover:bg-[#2a5f94] rounded-lg transition-colors duration-200 flex items-center gap-2 whitespace-nowrap"
                title={t("tour.helpGuide") || "Help Guide"}
              >
                <HelpCircle className="h-4 w-4" />
                <span>{t("tour.helpGuide") || "Help Guide"}</span>
              </button>
              
              {/* Clear Filters Button */}
              <button
                onClick={clearAllFilters}
                data-tour="clear-filters"
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 whitespace-nowrap"
              >
                {t("filters.clearAllFilters")}
              </button>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="mb-4" data-tour="status-filters">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("filters.itemStatus") || "Item Status"}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusChange('pending')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedStatus === 'pending'
                    ? 'bg-[#3277AE] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t("status.pending") || "Pending"}
              </button>
              <button
                onClick={() => handleStatusChange('approved')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedStatus === 'approved'
                    ? 'bg-[#3277AE] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t("status.approved") || "Approved"}
              </button>
              <button
                onClick={() => handleStatusChange('cancelled')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedStatus === 'cancelled'
                    ? 'bg-[#3277AE] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t("status.cancelled") || "Cancelled"}
              </button>
              <button
                onClick={() => handleStatusChange('disposed')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedStatus === 'disposed'
                    ? 'bg-[#3277AE] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t("status.disposed") || "It was disposed of"}
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {/* Search Input */}
            <div className="lg:col-span-1 min-w-0">
              <label htmlFor="search-input" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t("filters.searchItems")}
              </label>
              <input
                id="search-input"
                type="text"
                placeholder={t("filters.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full min-w-0 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
                style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
              />
            </div>

            {/* Item Type Filter */}
            <div className="min-w-0">
              <label htmlFor="item-type-filter" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
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
                className="w-full min-w-0 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
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
            <div className="min-w-0">
              <label htmlFor="branch-filter" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t("filters.branch")}
              </label>
              <select
                id="branch-filter"
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-full min-w-0 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
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
            <div className="sm:col-span-2 lg:col-span-1 min-w-0" data-tour="date-range-filters">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t("filters.dateRange")}
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-center">

                <input
                  type="date"
                  placeholder={t("filters.fromDate")}
                  value={dateFrom}
                  max={getTodayDate()}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
                  style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
                />
                <span className="text-xs sm:text-sm text-gray-600 font-medium shrink-0">{t("filters.to")}</span>
                <input
                  type="date"
                  placeholder={t("filters.toDate")}
                  value={dateTo}
                  max={getTodayDate()}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:ring-2 focus:border-[#3277AE] transition-colors duration-200"
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
      <div className="w-full px-2 sm:px-4 py-4 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="w-full pb-20" data-tour="items-grid">
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

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={tourSteps}
        translationKey="dashboard.items.tour"
      />
    </div>
    </ProtectedPage>
  );
}