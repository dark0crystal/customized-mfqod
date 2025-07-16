"use client";
import { useRouter } from "@/i18n/navigation";
import { MdArrowOutward } from "react-icons/md";
import Image from "next/image";
import { useTranslations } from "next-intl";
import defaultImage from "../../../../../public/img1.jpeg";
import { IoMdResize } from "react-icons/io";
import { useState } from "react";

// Use environment variable for image host
const IMAGE_HOST =
  process.env.NEXT_PUBLIC_IMAGE_HOST?.replace(/\/+$/, "") ||
  "http://localhost:8000/backend"; // fallback to working local backend

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

  const handlePostClick = (postId: string) => {
    router.push(`/find/${postId}`);
  };

  const handleImageSize = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Helper to prepend host to image URLs if needed
  const getImageUrl = (url: string) => {
    if (!url) return defaultImage;
    // If url is already absolute (starts with http or https), return as is
    if (/^https?:\/\//.test(url)) return url;
    // Otherwise, prepend the host (ensure no double slashes)
    return `${IMAGE_HOST}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div className="w-full p-2 md:p-6 mt-6 flex items-center flex-col">
      <h3 className="text-xl font-semibold mb-6 text-blue-600">{t("missing-items")}</h3>
      <div className="grid md:grid-cols-1 lg:grid-cols-2 grid-cols-1 gap-12">
        {items.length > 0 ? (
          items.map((item, index) => {
            const itemImages = images?.[item.id] && images[item.id].length > 0 ? images[item.id] : null;
            // If itemImages exists, use the first image's url with host, else use defaultImage
            const imageUrl =
              itemImages && itemImages[0]?.url
                ? getImageUrl(itemImages[0].url)
                : defaultImage;
            const isExpanded = expandedItemId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white min-w-[350px] shadow-lg overflow-hidden ${
                  isExpanded
                    ? "fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center"
                    : "hover:shadow-xl rounded-2xl transition-shadow duration-300"
                }`}
                style={isExpanded ? { animation: "fadeIn .2s" } : {}}
              >
                {/* Content */}
                <div className={`p-4 ${isExpanded ? "hidden" : ""}`}>
                  <h4 className="text-lg font-semibold text-gray-800">{item.title}</h4>
                  <p className="text-gray-500 text-sm">{item.content}</p>
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between py-2 px-4 ${isExpanded ? "hidden" : ""}`}>
                  <p className="text-gray-600 text-sm">
                    {t("location")}: {c(`place.${item.address?.place}`)}, {c(`country.${item.address?.country}`)}
                  </p>
                </div>

                {/* Image Section */}
                <div
                  className={`relative ${
                    isExpanded
                      ? "w-[98vw] h-[88vh] md:w-[500px] md:h-[600px] lg:w-[500px] lg:h-[700px]"
                      : "h-[250px] m-3"
                  }`}
                >
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
                    title={isExpanded ? "Shrink Image" : "Expand Image"}
                    onClick={() => handleImageSize(item.id)}
                    className="absolute top-2 left-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                  >
                    <IoMdResize />
                  </button>

                  <Image
                    src={typeof imageUrl === "string" ? imageUrl : defaultImage}
                    alt={`Item image ${index}`}
                    fill
                    objectFit={isExpanded ? "contain" : "cover"}
                    className={`rounded-2xl transition-transform ${
                      isExpanded ? "cursor-zoom-out w-auto h-auto max-w-full max-h-full" : ""
                    }`}
                    onClick={() => handleImageSize(item.id)}
                    sizes={isExpanded ? "90vw" : "400px"}
                    priority={isExpanded}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-500">No items found.</p>
        )}
      </div>
    </div>
  );
}
