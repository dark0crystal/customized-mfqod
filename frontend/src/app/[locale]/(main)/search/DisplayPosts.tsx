"use client";
import { useRouter } from "@/i18n/navigation";
import { MdArrowOutward } from "react-icons/md";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { IoMdResize } from "react-icons/io";
import { useState, useEffect } from "react";

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
  is_hidden?: boolean;
  item_type_id?: string;
}

interface ItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
  image_url?: string;
}

interface DisplayPostsProps {
  items: Item[];
  images: Record<string, ItemImage[]>;
  itemTypes?: ItemType[];
}

export default function DisplayPosts({ items, images, itemTypes = [] }: DisplayPostsProps) {
  const t = useTranslations("card");
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
    router.push(`/search/${postId}`);
  };

  const handleImageSize = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Helper to get the correct image URL for an item from local backend uploads
  // Helper to get localized name based on current locale
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Helper to format location with localized organization and branch names
  const getLocationDisplay = (location?: LocationData): string => {
    if (!location) return t("location-not-specified");

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

    // Add branch name first if available (only in selected locale)
    if (branchName) {
      parts.push(branchName);
    }

    // Add organization name if available and different from branch (only in selected locale)
    if (orgName && orgName !== branchName) {
      parts.push(orgName);
    }

    return parts.length > 0 ? parts.join(', ') : t("location-not-specified");
  };

  const getImageUrl = (itemId: string, itemTypeId?: string) => {
    // Backend already filters images based on user permissions and is_hidden status
    // If images are returned, user has permission to see them
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
    
    // If item has no images, check for item type default image
    if (itemTypeId && itemTypes.length > 0) {
      const itemType = itemTypes.find(type => type.id === itemTypeId);
      if (itemType?.image_url) {
        let imageUrl = itemType.image_url;
        
        // Ensure the imageUrl starts with a forward slash
        if (!imageUrl.startsWith('/')) {
          imageUrl = '/' + imageUrl;
        }
        
        // Get base URL and ensure it doesn't end with a slash
        const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
        
        return `${baseUrl}${imageUrl}`;
      }
    }
    
    return null;
  };

  return (
    <div className="w-full p-2 md:p-6 mt-6 flex items-center flex-col">
      <div className="grid grid-cols-1 md:grid-cols-2 [@media(min-width:1150px)]:grid-cols-3 gap-6 justify-items-center">
        {items.length > 0 ? (
          items.map((item, index) => {
            const imageUrl = getImageUrl(item.id, item.item_type_id);
            const isExpanded = expandedItemId === item.id;

            return (
              <div key={item.id}>
                {/* Regular card view */}
                <div
                  className={`bg-white w-[350px] shadow-lg overflow-hidden rounded-2xl hover:shadow-xl transition-shadow duration-300 ${isExpanded ? "hidden" : ""
                    }`}
                >
                  {/* Content */}
                  <div className="p-4 w-full">
                    <h4 className="text-lg font-semibold text-gray-800 truncate w-full" title={item.title}>
                      {item.title}
                    </h4>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2 overflow-hidden text-ellipsis w-full" title={item.description}>
                      {item.description}
                    </p>
                    <p className="text-gray-500 text-xs mt-2 truncate w-full" title={getLocationDisplay(item.location)}>
                      {getLocationDisplay(item.location)}
                    </p>
                  </div>


                  {/* Image Section */}
                  <div className="relative h-[250px] m-3 w-[calc(100%-24px)]">
                    {/* Go to details */}
                    <button
                      title="Go to details"
                      onClick={() => handlePostClick(item.id)}
                      className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                    >
                      <MdArrowOutward />
                    </button>

                    {/* Expand image */}
                    {imageUrl && (
                      <button
                        title="Expand Image"
                        onClick={() => handleImageSize(item.id)}
                        className="absolute top-2 left-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                      >
                        <IoMdResize />
                      </button>
                    )}

                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={`Item image ${index}`}
                        fill
                        style={{ objectFit: "cover" }}
                        className="rounded-2xl cursor-zoom-in"
                        onClick={() => handleImageSize(item.id)}
                        sizes="400px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 flex flex-col items-center justify-center rounded-2xl">
                        <span className="text-gray-500 text-lg">{t("brandName")}</span>
                        <span className="text-gray-400 text-sm mt-1">{t("noImagesAvailable")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded image modal */}
                {isExpanded && (
                  <div
                    className="fixed inset-0 bg-black bg-opacity-90 z-[11000] flex justify-center items-center p-4"
                    style={{ animation: "fadeIn .2s" }}
                    onClick={() => setExpandedItemId(null)}
                  >
                    <div className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex justify-center items-center">
                      {/* Close button */}
                      <button
                        title="Close"
                        onClick={() => setExpandedItemId(null)}
                        className="absolute top-4 right-4 p-3 bg-white z-30 text-black text-xl rounded-full hover:bg-gray-200 transition-colors shadow-md"
                      >
                        ×
                      </button>

                      {/* Go to details */}
                      <button
                        title="Go to details"
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
                        {imageUrl ? (
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
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center">
                            <span className="text-gray-500 text-2xl">{t("brandName")}</span>
                            <span className="text-gray-400 text-base mt-2">{t("noImagesAvailable")}</span>
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
          <p className="text-gray-500">No items found.</p>
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