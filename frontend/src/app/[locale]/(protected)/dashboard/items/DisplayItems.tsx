'use client';

import { useRouter } from '@/i18n/navigation';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MdArrowOutward } from 'react-icons/md';
import { IoMdResize } from 'react-icons/io';
import { useTranslations, useLocale } from 'next-intl';
import defaultImage from '../../../../../../public/img1.jpeg';

interface LocationData {
  organization_name_ar?: string;
  organization_name_en?: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  full_location?: string;
}

interface Item {
  id: string;
  title: string;
  description: string;
  location?: LocationData;
  approval?: boolean;
  temporary_deletion?: boolean;
  claims_count?: number;
}

interface ItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

interface DisplayItemsProps {
  items: Item[];
  images: Record<string, ItemImage[]>;
}

export default function DisplayItems({ items, images }: DisplayItemsProps) {
  const t = useTranslations("dashboard.items");
  const locale = useLocale();
  const router = useRouter();

  // Track which image is expanded (by item id), or null if none
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Handle ESC key to close expanded image
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedItemId) {
        setExpandedItemId(null);
      }
    };
    
    if (expandedItemId) {
      document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when image is expanded
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [expandedItemId]);

  const handlePostClick = (postId: string) => {
    router.push(`/dashboard/items/${postId}`);
  };

  const handleImageSize = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Helper to get localized name based on current locale
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Helper to format location with localized organization and branch names
  const getLocationDisplay = (location?: LocationData): string => {
    if (!location) return t("location.notSpecified");
    
    const orgName = getLocalizedName(
      location.organization_name_ar,
      location.organization_name_en
    );
    
    const branchName = getLocalizedName(
      location.branch_name_ar,
      location.branch_name_en
    );
    
    // Build the location string with proper localization - only show locale-specific names
    const parts = [];
    
    // Add organization name if available (only in selected locale)
    if (orgName) {
      parts.push(orgName);
    }
    
    // Add branch name if available and different from organization (only in selected locale)
    if (branchName && branchName !== orgName) {
      parts.push(branchName);
    }
    
    // Add full location if available and not already included
    if (location.full_location && !parts.some(part => location.full_location?.includes(part))) {
      parts.push(location.full_location);
    }
    
    return parts.length > 0 ? parts.join(', ') : t("location.notSpecified");
  };

  const getImageUrl = (itemId: string) => {
    const itemImages = images?.[itemId] && images[itemId].length > 0 ? images[itemId] : null;
    if (itemImages && itemImages[0]?.url) {
      // If the url is already absolute, use as is
      if (/^https?:\/\//.test(itemImages[0].url)) return itemImages[0].url;
      
      // Convert database URL format to static file serving format
      let imageUrl = itemImages[0].url.replace('/uploads/images/', '/static/images/');
      
      // Ensure the imageUrl starts with a forward slash
      if (!imageUrl.startsWith('/')) {
        imageUrl = '/' + imageUrl;
      }
      
      // Get base URL and ensure it doesn't end with a slash
      const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
      
      return `${baseUrl}${imageUrl}`;
    }
    return defaultImage;
  };

  return (
    <div className="w-full flex items-center flex-col">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.length > 0 ? (
          items.map((item, index) => {
            const imageUrl = getImageUrl(item.id);
            const isExpanded = expandedItemId === item.id;

            return (
              <div key={item.id}>
                {/* Regular card view */}
                <div
                  className={`bg-white w-full shadow-lg overflow-hidden rounded-2xl hover:shadow-xl transition-shadow duration-300 ${
                    isExpanded ? "hidden" : ""
                  }`}
                >
                  {/* Content */}
                  <div className="p-4">
                    <h4 className="text-lg font-semibold text-gray-800 truncate" title={item.title}>
                      {item.title}
                    </h4>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2 overflow-hidden text-ellipsis" title={item.description}>
                      {item.description}
                    </p>
                    <p className="text-gray-500 text-xs mt-2 truncate" title={getLocationDisplay(item.location)}>
                      {getLocationDisplay(item.location)}
                    </p>
                    {item.claims_count !== undefined && (
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">{item.claims_count} {t("status.claims")}</span>
                        <span className={`text-xs px-2 py-1 rounded ${item.approval ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.approval ? t("status.approved") : t("status.pending")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Image Section */}
                  <div className="relative h-[250px] m-3">
                    {/* Go to details */}
                    <button
                      title={t("goToDetails")}
                      onClick={() => handlePostClick(item.id)}
                      className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                    >
                      <MdArrowOutward />
                    </button>

                    {/* Expand image */}
                    <button
                      title={t("expandImage")}
                      onClick={() => handleImageSize(item.id)}
                      className="absolute top-2 left-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                    >
                      <IoMdResize />
                    </button>

                    <Image
                      src={imageUrl}
                      alt={`Item image ${index}`}
                      fill
                      style={{ objectFit: "cover" }}
                      className="rounded-2xl cursor-zoom-in"
                      onClick={() => handleImageSize(item.id)}
                      sizes="400px"
                    />
                  </div>
                </div>

                {/* Expanded image modal */}
                {isExpanded && (
                  <div 
                    className="fixed inset-0 bg-black bg-opacity-90 z-50 flex justify-center items-center p-4"
                    style={{ animation: "fadeIn .2s" }}
                    onClick={() => setExpandedItemId(null)}
                  >
                    <div className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex justify-center items-center">
                      {/* Close button */}
                      <button
                        title={t("close")}
                        onClick={() => setExpandedItemId(null)}
                        className="absolute top-4 right-4 p-3 bg-white z-30 text-black text-xl rounded-full hover:bg-gray-200 transition-colors shadow-md"
                      >
                        ×
                      </button>

                      {/* Go to details */}
                      <button
                        title={t("goToDetails")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostClick(item.id);
                        }}
                        className="absolute bottom-4 right-4 p-3 bg-white z-30 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                      >
                        <MdArrowOutward />
                      </button>

                      {/* Expanded image */}
                      <div 
                        className="relative w-full h-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Image
                          src={imageUrl}
                          alt={`Item image ${index} - expanded`}
                          fill
                          style={{ objectFit: "contain" }}
                          className="cursor-zoom-out"
                          onClick={() => setExpandedItemId(null)}
                          sizes="90vw"
                          priority
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-gray-500">{t("noItems")}</p>
        )}
      </div>

      {/* Add some CSS for fade-in animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}