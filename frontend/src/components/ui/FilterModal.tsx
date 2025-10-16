"use client";
import { Fragment, useRef, useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import CustomDropdown from "./CustomDropdown";
import { useLocale, useTranslations } from "next-intl";

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

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTypes: ItemType[];
  branches: Branch[];
  currentItemTypeId: string;
  selectedBranchId: string;
  onApplyFilters: (itemTypeId: string, branchId: string) => void;
  onClearFilters: () => void;
  itemsCount: number;
  loading: boolean;
}

export default function FilterModal({
  isOpen,
  onClose,
  itemTypes,
  branches,
  currentItemTypeId,
  selectedBranchId,
  onApplyFilters,
  onClearFilters,
  itemsCount,
  loading
}: FilterModalProps) {
  const locale = useLocale();
  const tSearch = useTranslations("search");
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };
  
  // Local state for temporary filter selections
  const [tempItemTypeId, setTempItemTypeId] = useState(currentItemTypeId);
  const [tempBranchId, setTempBranchId] = useState(selectedBranchId);

  // Update local state when props change (e.g., when modal opens)
  useEffect(() => {
    setTempItemTypeId(currentItemTypeId);
    setTempBranchId(selectedBranchId);
  }, [currentItemTypeId, selectedBranchId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApplyFilters = () => {
    onApplyFilters(tempItemTypeId, tempBranchId);
    onClose();
  };

  const handleClearFilters = () => {
    setTempItemTypeId("");
    setTempBranchId("");
    onClearFilters();
    onClose();
  };

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

  return (
    <Fragment>
      {/* Transparent Backdrop for click outside */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          ref={modalRef}
          className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto transform transition-transform duration-300 shadow-2xl border border-gray-200 pointer-events-auto"
          style={{ 
            animation: isOpen ? "fadeInScale 0.3s ease-out" : "fadeOutScale 0.3s ease-in"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{tSearch("filterOptions")}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <IoClose className="w-6 h-6 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Item Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tSearch("itemType")}
              </label>
              <CustomDropdown
                options={itemTypeOptions}
                value={tempItemTypeId}
                onChange={setTempItemTypeId}
                placeholder={tSearch("selectItemType")}
              />
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tSearch("branch")}
              </label>
              <CustomDropdown
                options={branchOptions}
                value={tempBranchId}
                onChange={setTempBranchId}
                placeholder={tSearch("selectBranch")}
              />
            </div>

            {/* Results Summary */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  {loading ? tSearch("loading") : `${itemsCount} ${tSearch("itemsFound")}`}
                </span>
              </div>
              
              {(tempItemTypeId || tempBranchId) && (
                <button
                  onClick={handleClearFilters}
                  className="w-full px-4 py-3 text-sm text-red-600 rounded-lg font-medium transition-colors duration-200 bg-white border border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  {tSearch("clearAllFilters")}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
            <button
              onClick={handleApplyFilters}
              className="w-full px-4 py-3 text-white rounded-lg transition-colors duration-200 font-medium"
              style={{ 
                backgroundColor: '#3277AE',
                '--tw-ring-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2a5f94';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3277AE';
              }}
            >
              {tSearch("applyFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* Add animation keyframes */}
      <style jsx>{`
        @keyframes fadeInScale {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fadeOutScale {
          from {
            transform: scale(1);
            opacity: 1;
          }
          to {
            transform: scale(0.9);
            opacity: 0;
          }
        }
      `}</style>
    </Fragment>
  );
}