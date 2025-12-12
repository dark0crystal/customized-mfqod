"use client";
import { useState, useEffect, useCallback } from "react";
import DisplayPosts from "./DisplayPosts";
import Footer from "@/components/Footer";
import CustomDropdown from "@/components/ui/CustomDropdown";
import FilterModal from "@/components/ui/FilterModal";
import HydrationSafeWrapper from "@/components/HydrationSafeWrapper";
import { MdTune } from "react-icons/md";
import { useTranslations, useLocale } from "next-intl";
import { tokenManager } from "@/utils/tokenManager";

interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  organization?: {
    id: string;
    name: string;
  };
}

interface ItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

export default function Search() {
  const t = useTranslations("card");
  const tSearch = useTranslations("search");
  const locale = useLocale();
  
  const [items, setItems] = useState<Array<{
    id: string;
    title: string;
    description: string;
    [key: string]: unknown;
  }>>([]);
  const [itemImages, setItemImages] = useState<Record<string, ItemImage[]>>({});
  const [currentItemTypeId, setCurrentItemTypeId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const API_BASE = `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/item-types/public`;

  // Helper function to get localized name
  const getLocalizedName = useCallback((nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  }, [locale]);

  const getAuthHeaders = useCallback(() => {
    // Use tokenManager to get the token consistently
    const token = tokenManager.getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Only add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    return headers;
  }, []);


  // Fetch images for a list of item IDs
  const fetchImagesForItems = useCallback(async (itemsList: Array<{
    id: string;
    title: string;
    description: string;
    [key: string]: unknown;
  }>) => {
    // Ensure itemsList is an array
    if (!Array.isArray(itemsList)) {
      console.warn('fetchImagesForItems received non-array data:', itemsList);
      return;
    }

    const newImages: Record<string, ItemImage[]> = {};
    await Promise.all(
      itemsList.map(async (item) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/images/items/${item.id}/images`,
            {
              headers: getAuthHeaders(),
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
  }, [getAuthHeaders]);

  const fetchItemByItemType = useCallback(async (itemTypeId?: string, branchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${process.env.NEXT_PUBLIC_HOST_NAME}/api/items`;
      const params = new URLSearchParams();
      if (itemTypeId) params.append("item_type_id", itemTypeId);
      if (branchId) params.append("branch_id", branchId);
      params.append("skip", "0");
      params.append("limit", "100");
      params.append("status", "pending");

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle both array response and object with items property
      let itemsArray = [];
      if (Array.isArray(data)) {
        itemsArray = data;
      } else if (data && typeof data === 'object' && data.items && Array.isArray(data.items)) {
        itemsArray = data.items;
      } else {
        itemsArray = [];
      }
      
      setItems(itemsArray);
      await fetchImagesForItems(itemsArray);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, fetchImagesForItems]);

  const fetchItemTypes = useCallback(async () => {
    try {
      const response = await fetch(API_BASE, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setItemTypes(data);
    } catch (err) {
      console.error("Error fetching item types:", err);
    }
  }, [getAuthHeaders, API_BASE]);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/api/branches/`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBranches(data);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  }, [getAuthHeaders]);

  // Load data on component mount (authentication required for protected search)
  useEffect(() => {
    fetchItemTypes();
    fetchBranches();
    fetchItemByItemType();
  }, [fetchItemTypes, fetchBranches, fetchItemByItemType]);

  const itemTypeOptions = [
    { value: "", label: tSearch("allItemTypes") },
    ...itemTypes.map(type => ({ 
      value: type.id, 
      label: getLocalizedName(type.name_ar, type.name_en) || 'Unnamed' 
    }))
  ];

  const branchOptions = [
    { value: "", label: tSearch("allBranches") },
    ...branches.map(branch => ({ 
      value: branch.id, 
      label: getLocalizedName(branch.branch_name_ar, branch.branch_name_en) || 'Unnamed Branch' 
    }))
  ];

  const clearAllFilters = () => {
    setCurrentItemTypeId("");
    setSelectedBranchId("");
    fetchItemByItemType();
  };

  const handleItemTypeChange = (itemTypeId: string) => {
    setCurrentItemTypeId(itemTypeId);
    fetchItemByItemType(itemTypeId, selectedBranchId);
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    fetchItemByItemType(currentItemTypeId, branchId);
  };

  return (
    <div className="min-h-screen">
      {/* Mobile Results Summary */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {loading ? tSearch("loading") : `${items.length} ${tSearch("itemsFound")}`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
        <div className="space-y-6">
          {/* Desktop Filters - Top */}
          <div className="hidden lg:block">
            <div className="bg-gray-100 rounded-lg border border-gray-300">
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Item Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("item-type")}
                    </label>
                    <HydrationSafeWrapper fallback={<div className="w-full h-12 bg-gray-100 rounded-lg animate-pulse"></div>}>
                      <CustomDropdown
                        options={itemTypeOptions}
                        value={currentItemTypeId}
                        onChange={handleItemTypeChange}
                        placeholder={tSearch("selectItemType")}
                        variant="light"
                      />
                    </HydrationSafeWrapper>
                  </div>

                  {/* Branch Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("branch")}
                    </label>
                    <HydrationSafeWrapper fallback={<div className="w-full h-12 bg-gray-100 rounded-lg animate-pulse"></div>}>
                      <CustomDropdown
                        options={branchOptions}
                        value={selectedBranchId}
                        onChange={handleBranchChange}
                        placeholder={tSearch("selectBranch")}
                        variant="light"
                      />
                    </HydrationSafeWrapper>
                  </div>

                  {/* Results Summary */}
                  <div className="flex items-end">
                    <div className="w-full">
                      <div className="flex items-center space-x-2 mb-3">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          {loading ? tSearch("loading") : `${items.length} ${tSearch("itemsFound")}`}
                        </span>
                      </div>
                      
                      {(currentItemTypeId || selectedBranchId) && (
                        <button
                          onClick={clearAllFilters}
                          className="w-full px-4 py-2 text-sm text-[#3277AE] hover:text-[#3277AE]/80 hover:bg-[#3277AE]/5 rounded-lg font-medium transition-colors duration-200 border border-[#3277AE]/20"
                        >
                          {tSearch("clearAllFilters")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Posts Content */}
          <div>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Error: {error}</span>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3277AE]"></div>
                  <span className="text-lg font-medium text-gray-700">{tSearch("loading")}</span>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#3277AE' }}>{tSearch("noItemsFound")}</h3>
                <p className="text-gray-500 mb-4">{tSearch("tryAdjustingFilters")}</p>
                <button
                  onClick={clearAllFilters}
                  className="px-6 py-2 bg-[#3277AE] text-white rounded-lg hover:bg-[#3277AE]/80 transition-colors"
                >
                  {tSearch("showAllItems")}
                </button>
              </div>
            ) : (
              <DisplayPosts items={items} images={itemImages} />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      <HydrationSafeWrapper>
        <FilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          itemTypes={itemTypes}
          branches={branches}
          currentItemTypeId={currentItemTypeId}
          selectedBranchId={selectedBranchId}
          onApplyFilters={(itemTypeId, branchId) => {
            setCurrentItemTypeId(itemTypeId);
            setSelectedBranchId(branchId);
            fetchItemByItemType(itemTypeId, branchId);
          }}
          onClearFilters={clearAllFilters}
          itemsCount={items.length}
          loading={loading}
        />
      </HydrationSafeWrapper>

      {/* Mobile Floating Filter Button */}
      <div className="lg:hidden fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <button
          onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
          className="flex items-center space-x-3 px-6 py-4 rounded-lg shadow-md transition-all duration-200 text-white"
          style={{ 
            backgroundColor: isFilterModalOpen ? '#ef4444' : '#3277AE',
            '--tw-ring-color': isFilterModalOpen ? '#ef4444' : '#3277AE'
          } as React.CSSProperties & { [key: string]: string }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isFilterModalOpen ? '#dc2626' : '#2a5f94';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isFilterModalOpen ? '#ef4444' : '#3277AE';
          }}
        >
          <MdTune className="w-6 h-6" />
          <span className="font-medium text-base">
            {isFilterModalOpen ? tSearch("close") : tSearch("filters")}
          </span>
          {(currentItemTypeId || selectedBranchId) && (
            <span 
              className="text-white text-sm px-2 py-1 rounded-full min-w-[24px] h-6 flex items-center justify-center"
              style={{ backgroundColor: '#3277AE' }}
            >
              {(currentItemTypeId ? 1 : 0) + (selectedBranchId ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      <Footer />
    </div>
  );
}