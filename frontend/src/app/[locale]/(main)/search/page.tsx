"use client";
import { useState, useEffect } from "react";
import DisplayPosts from "./DisplayPosts";
import Footer from "@/components/Footer";
import { useTranslations } from "next-intl";

interface ItemType {
  id: string;
  name: string;
}

interface ItemImage {
  id: string;
  url: string;
  imageable_type: string;
  imageable_id: string;
}

export default function Search() {
  const [items, setItems] = useState<any[]>([]);
  const [itemImages, setItemImages] = useState<Record<string, ItemImage[]>>({});
  const [currentItemTypeId, setCurrentItemTypeId] = useState<string>("");
  const [currentOrgName, setCurrentOrgName] = useState<string>("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

  const API_BASE = "http://localhost:8000/api/item-types/";
  const t = useTranslations("search");

  const getTokenFromCookies = (): string | null => {
    if (typeof document !== "undefined") {
      return (
        getCookie("token") || getCookie("jwt") || getCookie("access_token")
      );
    }
    return null;
  };

  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || null;
    }
    return null;
  };

  const getAuthHeaders = () => {
    const token = getTokenFromCookies();
    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    };
  };

  const handleShow = () => setShow(!show);

  // Fetch images for a list of item IDs
  const fetchImagesForItems = async (itemsList: any[]) => {
    const newImages: Record<string, ItemImage[]> = {};
    await Promise.all(
      itemsList.map(async (item) => {
        try {
          // You may need to adjust the endpoint according to your backend
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_HOST_NAME}/api/images/items/${item.id}/images/`,
            {
              headers: getAuthHeaders(),
            }
          );
          if (res.ok) {
            const data = await res.json();
            // Accept both array or {images: []} response
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
  };

  const fetchItemByItemType = async (orgName?: string, itemTypeId?: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${process.env.NEXT_PUBLIC_HOST_NAME}/api/items/`;
      const params = new URLSearchParams();
      if (itemTypeId) params.append("item_type_id", itemTypeId);
      params.append("skip", "0");
      params.append("limit", "100");
      params.append("approved_only", "true");

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const itemsArray = data.items || data || [];
      setItems(itemsArray);

      // Fetch images for these items
      if (itemsArray.length > 0) {
        await fetchImagesForItems(itemsArray);
      } else {
        setItemImages({});
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch items");
      setItems([]);
      setItemImages({});
    } finally {
      setLoading(false);
    }
  };

  const handleItemTypeFilter = (itemTypeId: string) => {
    setCurrentItemTypeId(itemTypeId);
    fetchItemByItemType(currentOrgName, itemTypeId);
  };

  const handleFetchItems = () => {
    fetchItemByItemType(currentOrgName, currentItemTypeId);
  };

  const fetchItemTypes = async () => {
    setLoading(true);
    setError(null);
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
      setError(`Failed to fetch item types: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (itemTypeId: string) => {
    setCurrentItemTypeId(itemTypeId);
    fetchItemByItemType(currentOrgName, itemTypeId);
  };

  useEffect(() => {
    fetchItemTypes();
  }, []);

  return (
    <div className="relative lg:grid lg:grid-cols-10 lg:pl-0 lg:h-[88vh]">
      {/* Left Sidebar */}
      <div className="hidden lg:col-span-2 lg:flex flex-col items-center overflow-y-auto p-4">
 
        <div className="h-full w-full flex flex-col items-center z-40 p-4 overflow-y-auto shadow-lg">
          <h3 className="text-md font-semibold mb-4 text-gray-700">Item Types</h3>
          {itemTypes.map((itemType) => (
            <button
              key={itemType.id}
              onClick={() => handleClick(itemType.id)}
              className={`w-full mb-3 rounded-full px-4 py-2 text-sm transition-transform duration-300 ${
                currentItemTypeId === itemType.id
                   ? "bg-blue-200 border border-blue-500 rounded-md scale-105"
                   : "bg-white border border-blue-200 rounded-md"
              }`}
            >
              {itemType.name}
            </button>
          ))}
    
      </div>
      </div>

      {/* Floating button for mobile */}
      <div className="z-40 fixed bottom-8 right-6 lg:hidden">
        <button
          className="text-white border-2 bg-blue-500 py-3 px-4 rounded-md mt-2 text-lg font-semibold"
          onClick={handleShow}
        >
          {t("filter")}
        </button>
      </div>

      {/* Main content */}
      <div className="col-span-12 lg:col-span-6 flex flex-col items-center p-4 overflow-y-auto w-full h-full">
        {error && (
          <div className="w-full mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        <div className="w-full mb-4 p-2 bg-gray-100 rounded text-sm">
          <p>Current Item Type ID: {currentItemTypeId || "None"}</p>
          <p>Current Org Name: {currentOrgName || "None"}</p>
          <p>Items Count: {items.length}</p>
        </div>

        <div className="w-full mt-6 pb-20">
          {loading ? (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2">Loading items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No items found. Try adjusting your filters or click "Fetch Items".</p>
            </div>
          ) : (
            <DisplayPosts items={items} images={itemImages} />
          )}
          <Footer />
        </div>
      </div>

      {/* Right Sidebar: Item Types */}
      
    </div>
  );
}
