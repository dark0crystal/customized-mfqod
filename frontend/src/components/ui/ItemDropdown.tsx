"use client";
import { useState, useRef, useEffect } from "react";
import { MdKeyboardArrowDown, MdSearch } from "react-icons/md";
import { useDirection } from "@/components/DirectionProvider";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useLocale } from "next-intl";

interface Item {
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
}

interface ItemDropdownProps {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'light';
  emptyMessage?: string;
}

export default function ItemDropdown({
  items,
  value,
  onChange,
  placeholder,
  label,
  className = "",
  variant = 'default',
  emptyMessage = "No items available"
}: ItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { direction, isRTL } = useDirection();
  const locale = useLocale();

  const selectedItem = items.find(item => item.id === value);

  // Helper to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Helper to process and validate image URL
  const getImageUrl = (imageUrl: string | null | undefined): string | null => {
    if (!imageUrl) return null;
    
    if (/^https?:\/\//.test(imageUrl)) {
      try {
        new URL(imageUrl);
        return imageUrl;
      } catch {
        return null;
      }
    }
    
    let processedUrl = imageUrl.replace('/uploads/images/', '/static/images/');
    if (!processedUrl.startsWith('/')) {
      processedUrl = '/' + processedUrl;
    }
    
    const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
    const fullUrl = `${baseUrl}${processedUrl}`;
    
    try {
      new URL(fullUrl);
      return fullUrl;
    } catch {
      return null;
    }
  };

  // Filter items based on search query
  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
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

  // Calculate dropdown position based on available space
  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const estimatedDropdownHeight = 400; // Approximate height
      
      if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
        // Position dropdown above if not enough space below
        dropdownRef.current.style.bottom = '100%';
        dropdownRef.current.style.top = 'auto';
        dropdownRef.current.style.marginBottom = '0.25rem';
        dropdownRef.current.style.marginTop = '0';
      } else {
        // Position dropdown below (default)
        dropdownRef.current.style.top = '100%';
        dropdownRef.current.style.bottom = 'auto';
        dropdownRef.current.style.marginTop = '0.25rem';
        dropdownRef.current.style.marginBottom = '0';
      }
    }
  }, [isOpen]);

  const handleSelect = (itemId: string) => {
    onChange(itemId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} dir={direction}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`w-full px-4 py-3 rounded-lg focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:border-[#3277AE] ${
          variant === 'light' 
            ? 'bg-gray-50 border border-gray-300 hover:bg-gray-100' 
            : 'bg-white border border-gray-300 hover:bg-gray-50'
        }`}
        style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
      >
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={`text-start truncate ${selectedItem ? "text-gray-900" : "text-gray-500"}`}>
              {selectedItem ? selectedItem.title : placeholder}
            </span>
            {selectedItem?.status && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                selectedItem.status === 'approved' 
                  ? 'bg-green-100 text-green-800'
                  : selectedItem.status === 'pending'
                  ? 'bg-orange-100 text-orange-800'
                  : selectedItem.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
              </span>
            )}
          </div>
          <MdKeyboardArrowDown 
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? "rotate-180" : ""
            } ${isRTL ? 'mr-2' : 'ml-2'}`} 
          />
        </div>
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`absolute z-50 w-full border rounded-lg shadow-lg ${
            variant === 'light' 
              ? 'bg-gray-50 border-gray-300' 
              : 'bg-white border-gray-300'
          }`}
          style={{
            maxHeight: 'min(300px, calc(100vh - 300px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 flex-shrink-0">
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
          <div className="overflow-y-auto flex-1" style={{ 
            maxHeight: 'min(250px, calc(100vh - 350px))',
            overscrollBehavior: 'contain'
          }}>
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                {searchQuery ? "No items found" : emptyMessage}
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === value;
                const itemImage = item.images && item.images.length > 0 
                  ? getImageUrl(item.images[0].url) 
                  : null;
                const itemTypeName = item.item_type 
                  ? getLocalizedName(item.item_type.name_ar, item.item_type.name_en)
                  : null;

                return (
                  <div
                    key={item.id}
                    className={`border-b border-gray-200 last:border-b-0 ${
                      isSelected ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                    } transition-colors cursor-pointer`}
                    onClick={() => handleSelect(item.id)}
                  >
                    <div className={`flex items-start gap-3 p-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Image */}
                      <div className="flex-shrink-0 relative w-12 h-12">
                        {itemImage ? (
                          <Image
                            src={itemImage}
                            alt={item.title}
                            fill
                            className="object-cover rounded-md border border-gray-300"
                            sizes="48px"
                            unoptimized={itemImage?.startsWith('http')}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 rounded-md flex items-center justify-center border border-gray-300">
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-1">
                              {item.title}
                            </h4>
                            {item.description && (
                              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                {item.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {itemTypeName && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {itemTypeName}
                                </span>
                              )}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                item.status === 'approved' 
                                  ? 'bg-green-100 text-green-800'
                                  : item.status === 'pending'
                                  ? 'bg-orange-100 text-orange-800'
                                  : item.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown'}
                              </span>
                            </div>
                          </div>
                          {/* View Details Link */}
                          <Link
                            href={`/dashboard/items/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ml-2"
                          >
                            {locale === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


