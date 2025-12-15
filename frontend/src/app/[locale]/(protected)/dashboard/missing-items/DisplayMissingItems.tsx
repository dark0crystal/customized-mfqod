'use client';

import { useRouter } from '@/i18n/navigation';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MdArrowOutward } from 'react-icons/md';
import { IoMdResize } from 'react-icons/io';
import { useTranslations, useLocale } from 'next-intl';
import { formatDateWithLocale } from '@/utils/dateFormatter';

interface LocationData {
  organization_name?: string;
  branch_name?: string;
  full_location?: string;
}

interface MissingItem {
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
  location?: LocationData;
}

interface MissingItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

interface DisplayMissingItemsProps {
  missingItems: MissingItem[];
  images: Record<string, MissingItemImage[]>;
}

export default function DisplayMissingItems({ missingItems, images }: DisplayMissingItemsProps) {
  const t = useTranslations("card");
  const tMissing = useTranslations("dashboard.missingItems");
  const tStatus = useTranslations("dashboard.missingItems.status");
  const locale = useLocale();
  const router = useRouter();

  // Track which image is expanded (by missing item id), or null if none
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
    router.push(`/dashboard/missing-items/${postId}`);
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
    if (!location) return t("location-not-specified");
    
    // For missing items, the API returns full_location that contains both languages
    // We need to parse it to show only the selected locale
    if (location.full_location) {
      // Split by common separators and try to identify language parts
      const parts = location.full_location.split(/[,،]/).map(part => part.trim()).filter(Boolean);
      
      if (locale === 'ar') {
        // For Arabic locale, prefer Arabic text
        const arabicParts = parts.filter(part => {
          // Check if the part contains Arabic characters
          return /[\u0600-\u06FF]/.test(part);
        });
        return arabicParts.length > 0 ? arabicParts.join(', ') : parts[parts.length - 1] || location.full_location;
      } else {
        // For English locale, prefer English text
        const englishParts = parts.filter(part => {
          // Check if the part contains mostly English characters
          return !/[\u0600-\u06FF]/.test(part) && /[a-zA-Z]/.test(part);
        });
        return englishParts.length > 0 ? englishParts.join(', ') : parts[0] || location.full_location;
      }
    }
    
    // Fallback to organization and branch names if available
    const orgName = location.organization_name;
    const branchName = location.branch_name;
    
    const parts = [];
    if (orgName) parts.push(orgName);
    if (branchName && branchName !== orgName) parts.push(branchName);
    
    return parts.length > 0 ? parts.join(', ') : t("location-not-specified");
  };

  // Helper to get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'visit':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper to format date - using utility function for consistency
  const formatDate = (dateString: string) => {
    return formatDateWithLocale(dateString, locale);
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
    return null;
  };

  return (
    <div className="w-full flex items-center flex-col">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {missingItems.length > 0 ? (
          missingItems.map((missingItem, index) => {
            const imageUrl = getImageUrl(missingItem.id);
            const isExpanded = expandedItemId === missingItem.id;

            return (
              <div key={missingItem.id}>
                {/* Regular card view */}
                <div
                  className={`bg-white w-full shadow-lg overflow-hidden rounded-2xl hover:shadow-xl transition-shadow duration-300 ${
                    isExpanded ? "hidden" : ""
                  }`}
                >
                  {/* Content */}
                  <div className="p-4">
                    <h4 className="text-lg font-semibold text-gray-800 truncate" title={missingItem.title}>
                      {missingItem.title}
                    </h4>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2 overflow-hidden text-ellipsis" title={missingItem.description}>
                      {missingItem.description}
                    </p>
                    <p className="text-gray-500 text-xs mt-2 truncate" title={getLocationDisplay(missingItem.location)}>
                      {getLocationDisplay(missingItem.location)}
                    </p>
                    
                    {/* Status and Approval badges */}
                    <div className="flex justify-between items-center mt-3">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(missingItem.status)}`}>
                        {tStatus(missingItem.status.toLowerCase() as any) || missingItem.status.charAt(0).toUpperCase() + missingItem.status.slice(1)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${missingItem.approval ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {missingItem.approval ? tStatus("approved") : tStatus("pending")}
                      </span>
                    </div>

                    {/* Date information */}
                    <div className="mt-2 text-xs text-gray-500">
                      <p>{tMissing("reported")} {formatDate(missingItem.created_at)}</p>
                      {missingItem.updated_at !== missingItem.created_at && (
                        <p>{tMissing("updated")} {formatDate(missingItem.updated_at)}</p>
                      )}
                    </div>

                  </div>

                  {/* Image Section */}
                  <div className="relative h-[250px] m-3">
                    {/* Go to details */}
                    <button
                      title={tMissing("goToDetails")}
                      onClick={() => handlePostClick(missingItem.id)}
                      className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full transition-colors shadow-md"
                      style={{ 
                        '--tw-hover-bg': '#3277AE',
                        '--tw-hover-text': 'white'
                      } as React.CSSProperties & { [key: string]: string }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#3277AE';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.color = 'black';
                      }}
                    >
                      <MdArrowOutward />
                    </button>

                    {/* Expand image */}
                    {imageUrl && (
                      <button
                        title={tMissing("expandImage")}
                        onClick={() => handleImageSize(missingItem.id)}
                        className="absolute top-2 left-2 p-3 bg-white z-20 text-black text-xl rounded-full transition-colors shadow-md"
                        style={{ 
                          '--tw-hover-bg': '#3277AE',
                          '--tw-hover-text': 'white'
                        } as React.CSSProperties & { [key: string]: string }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#3277AE';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.color = 'black';
                        }}
                      >
                        <IoMdResize />
                      </button>
                    )}

                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={`Missing item image ${index}`}
                        fill
                        style={{ objectFit: "cover" }}
                        className="rounded-2xl cursor-zoom-in"
                        onClick={() => handleImageSize(missingItem.id)}
                        sizes="400px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 flex flex-col items-center justify-center rounded-2xl">
                        <span className="text-gray-500 text-lg">مفقود</span>
                        <span className="text-gray-400 text-sm mt-1">الصور غير متاحة</span>
                      </div>
                    )}
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
                        title={tMissing("close")}
                        onClick={() => setExpandedItemId(null)}
                        className="absolute top-4 right-4 p-3 bg-white z-30 text-black text-xl rounded-full hover:bg-gray-200 transition-colors shadow-md"
                      >
                        ×
                      </button>

                      {/* Go to details */}
                      <button
                        title={tMissing("goToDetails")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostClick(missingItem.id);
                        }}
                        className="absolute bottom-4 right-4 p-3 bg-white z-30 text-black text-xl rounded-full transition-colors shadow-md"
                        style={{ 
                          '--tw-hover-bg': '#3277AE',
                          '--tw-hover-text': 'white'
                        } as React.CSSProperties & { [key: string]: string }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#3277AE';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.color = 'black';
                        }}
                      >
                        <MdArrowOutward />
                      </button>

                      {/* Expanded image */}
                      <div 
                        className="relative w-full h-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={`Missing item image ${index} - expanded`}
                            fill
                            style={{ objectFit: "contain" }}
                            className="cursor-zoom-out"
                            onClick={() => setExpandedItemId(null)}
                            sizes="90vw"
                            priority
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center">
                            <span className="text-gray-500 text-2xl">مفقود</span>
                            <span className="text-gray-400 text-base mt-2">الصور غير متاحة</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-gray-500">{tMissing("noMissingItems")}</p>
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
