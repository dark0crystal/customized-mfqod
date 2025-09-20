"use client";
import { useRouter } from "@/i18n/navigation";
import { MdArrowOutward } from "react-icons/md";
import Image from "next/image";
import { useTranslations } from "next-intl";
import defaultImage from "../../../../../public/img1.jpeg";
import { IoMdResize } from "react-icons/io";
import { useState, useEffect } from "react";
import img from "../../../../../../backend/uploads/images/8e510a2a-2829-4126-b1f3-4bdc4f3646a0.png"

interface Item {
  id: string;
  title: string;
  content: string;
  address?: {
    place?: string;
    country?: string;
  };
}

interface ItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

interface DisplayPostsProps {
  items: Item[];
  images: Record<string, ItemImage[]>;
}

export default function DisplayPosts({ items, images }: DisplayPostsProps) {
  const t = useTranslations("card");
  const c = useTranslations("storage");
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
    router.push(`/find/${postId}`);
  };

  const handleImageSize = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Helper to get the correct image URL for an item from local backend uploads
  const getImageUrl = (itemId: string) => {
    const itemImages = images?.[itemId] && images[itemId].length > 0 ? images[itemId] : null;
    if (itemImages && itemImages[0]?.url) {
      // If the url is already absolute, use as is
      if (/^https?:\/\//.test(itemImages[0].url)) return itemImages[0].url;
      // Otherwise, just prepend the backend host
      return `http://localhost:8000/backend/${itemImages[0].url}`;
    }
    return defaultImage;
  };

  return (
    <div className="w-full p-2 md:p-6 mt-6 flex items-center flex-col">
      <h3 className="text-xl font-semibold mb-6 text-blue-600">{t("missing-items")}</h3>
      <div className="grid md:grid-cols-1 lg:grid-cols-2 grid-cols-1 gap-12">
        {items.length > 0 ? (
          items.map((item, index) => {
            const imageUrl = getImageUrl(item.id);
            const isExpanded = expandedItemId === item.id;

            return (
              <div key={item.id}>
                {/* Regular card view */}
                <div
                  className={`bg-white min-w-[350px] shadow-lg overflow-hidden rounded-2xl hover:shadow-xl transition-shadow duration-300 ${
                    isExpanded ? "hidden" : ""
                  }`}
                >
                  {/* Content */}
                  <div className="p-4">
                    <h4 className="text-lg font-semibold text-gray-800">{item.title}</h4>
                    <p className="text-gray-500 text-sm">{item.content}</p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between py-2 px-4">
                    <p className="text-gray-600 text-sm">
                      {t("location")}
                    </p>
                  </div>

                  {/* Image Section */}
                  <div className="relative h-[250px] m-3">
                    {/* Go to details */}
                    <button
                      title="Go to details"
                      onClick={() => handlePostClick(item.id)}
                      className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                    >
                      <MdArrowOutward />
                    </button>

                    {/* Expand image */}
                    <button
                      title="Expand Image"
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