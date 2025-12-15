"use client";
import { useState, useRef, useEffect } from "react";
import { MdKeyboardArrowDown, MdSearch, MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";
import { useDirection } from "@/components/DirectionProvider";

interface Item {
  id: string;
  title: string;
}

interface MultiSelectItemDropdownProps {
  items: Item[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'light';
  emptyMessage?: string;
}

export default function MultiSelectItemDropdown({
  items,
  selectedIds,
  onChange,
  placeholder,
  label,
  className = "",
  variant = 'default',
  emptyMessage = "No items available"
}: MultiSelectItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { direction, isRTL } = useDirection();

  const selectedItems = items.filter(item => selectedIds.includes(item.id));

  // Filter items based on search query
  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = (itemId: string) => {
    if (selectedIds.includes(itemId)) {
      onChange(selectedIds.filter(id => id !== itemId));
    } else {
      onChange([...selectedIds, itemId]);
    }
  };

  const handleToggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  const getDisplayText = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    }
    if (selectedItems.length === 1) {
      return selectedItems[0].title;
    }
    return `${selectedItems.length} items selected`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} dir={direction}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={handleToggleDropdown}
        className={`w-full px-4 py-3 rounded-lg focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:border-[#3277AE] ${
          variant === 'light' 
            ? 'bg-gray-50 border border-gray-300 hover:bg-gray-100' 
            : 'bg-white border border-gray-300 hover:bg-gray-50'
        }`}
        style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
      >
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className={`text-start truncate ${selectedItems.length > 0 ? "text-gray-900" : "text-gray-500"}`}>
            {getDisplayText()}
          </span>
          <MdKeyboardArrowDown 
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? "rotate-180" : ""
            } ${isRTL ? 'mr-2' : 'ml-2'}`} 
          />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg ${
          variant === 'light' 
            ? 'bg-gray-50 border-gray-300' 
            : 'bg-white border-gray-300'
        }`}>
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <MdSearch className={`absolute top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 ${
                isRTL ? 'right-3' : 'left-3'
              }`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3277AE] focus:border-[#3277AE] outline-none ${
                  isRTL ? 'text-right' : 'text-left'
                }`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Items list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                {searchQuery ? "No items found" : emptyMessage}
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    className={`w-full px-4 py-3 transition-all duration-150 ${
                      isSelected
                        ? "bg-gray-100 text-gray-900 font-medium hover:bg-gray-200"
                        : "text-gray-900 hover:bg-gray-100 hover:text-gray-900"
                    } ${
                      index === 0 ? "rounded-t-lg" : ""
                    } ${
                      index === filteredItems.length - 1 ? "rounded-b-lg" : ""
                    } ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      {isSelected ? (
                        <MdCheckBox className="w-5 h-5 text-[#3277AE] flex-shrink-0" />
                      ) : (
                        <MdCheckBoxOutlineBlank className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{item.title}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

