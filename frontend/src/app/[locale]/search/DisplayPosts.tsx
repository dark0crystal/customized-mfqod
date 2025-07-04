"use client";
import { useRouter } from "@/i18n/navigation";
import { MdArrowOutward } from "react-icons/md";
import Image from "next/image";
import { useTranslations } from "next-intl";
import defaultImage from "../../../../public/bg11.jpg";
import { IoMdResize } from "react-icons/io";
import { useState } from "react";

export default function DisplayPosts({ items }: any) {
  const t = useTranslations("card");
  const c = useTranslations("storage");
  const router = useRouter();

  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Handle post click to navigate to details
  const handlePostClick = (postId: string) => {
    router.push(`/find/${postId}`);
  };

  // Toggle Image Size
  const handleImageSize = (imageUrl: string) => {
    setExpandedImage(expandedImage === imageUrl ? null : imageUrl);
  };

  return (
    <div className="w-full p-2 md:p-6 mt-6 flex items-center flex-col">
      <h3 className="text-xl font-semibold mb-6 text-blue-600">{t("missing-items")}</h3>
      <div className="grid md:grid-cols-1 lg:grid-cols-2 grid-cols-1 gap-12">
        {items.length > 0 ? (
          items.map((item: any, index: number) => {
            const isExpanded = expandedImage === item.imageUrls[0];

            return (
              <div
                key={index}
                className={`bg-white min-w-[350px]  shadow-lg overflow-hidden ${
                  isExpanded ? "fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center" : "hover:shadow-xl rounded-2xl transition-shadow duration-300"
                }`}
              >
                {/* Content Section */}
                <div className={`p-4  ${isExpanded && "hidden"}`}>
                  <h4 className="text-lg font-semibold text-gray-800">{item.title}</h4>
                  <p className="text-gray-500 text-sm">{item.content}</p>
                </div>

                {/* Footer Section */}
                <div className={`flex items-center justify-between py-2 px-4 ${isExpanded && "hidden"}`}>
                  <p className="text-gray-600 text-sm">
                    {t("location")}: {c(`place.${item.address?.place}`)}, {c(`country.${item.address?.country}`)}
                  </p>
                </div>

                {/* Image Section */}
                <div className={`relative ${isExpanded ? "w-[98vw] h-[88vh] md:w-[500px] md:h-[600px] lg:w-[500px] lg:h-[700px]" : "h-[250px] m-3"}`}>
                  {item.imageUrls.length > 0 ? (
                    <div>
                      {/* Button to navigate to details */}
                      <button
                        title="Go to details"
                        onClick={() => handlePostClick(item.id)}
                        className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                      >
                        <MdArrowOutward />
                      </button>

                      {/* Button to expand image */}
                      <button
                        title="Expand Image"
                        onClick={() => handleImageSize(item.imageUrls[0])}
                        className="absolute top-2 left-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                      >
                        <IoMdResize />
                      </button>

                      <Image
                        src={item.imageUrls[0]} // Display the first image
                        alt={`Image ${index}`}
                        fill
                        objectFit={`${isExpanded ? "fill":"cover"}`}
                        className={`rounded-2xl transition-transform ${
                          isExpanded ? "cursor-zoom-out w-auto h-auto max-w-full max-h-full" : ""
                        }`}
                        onClick={() => handleImageSize(item.imageUrls[0])}
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        title="Go to details"
                        onClick={() => handlePostClick(item.id)}
                        className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-indigo-200 transition-colors shadow-md"
                      >
                        <MdArrowOutward />
                      </button>
                      <Image
                        src={defaultImage}
                        alt="Default Image"
                        layout="fill"
                        objectFit="cover"
                        className="rounded-2xl"
                      />
                    </>
                  )}
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