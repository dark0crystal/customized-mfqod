"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import defaultImage from "../../../../../../public/img1.jpeg";
import { MdArrowOutward } from "react-icons/md";
import { IoMdResize } from "react-icons/io";

// Define the Item type
type Item = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  [key: string]: any;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const IMAGE_HOST =
  process.env.NEXT_PUBLIC_IMAGE_HOST?.replace(/\/+$/, "") ||
  "http://localhost:8000/backend";

// Helper to get token from cookies
function getTokenFromCookies(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Helper to prepend host to image URLs if needed
const getImageUrl = (url?: string) => {
  if (!url) return defaultImage;
  if (/^https?:\/\//.test(url)) return url;
  return `${IMAGE_HOST}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Fetch all items
  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenFromCookies();
      const res = await fetch(`${API_BASE_URL}/items/`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();

      // Defensive: handle if data is not an array, e.g. { items: [...] }
      let itemsArray: Item[] = [];
      if (Array.isArray(data)) {
        itemsArray = data;
      } else if (Array.isArray(data.items)) {
        itemsArray = data.items;
      } else if (data.results && Array.isArray(data.results)) {
        itemsArray = data.results;
      } else {
        itemsArray = [];
      }

      setItems(itemsArray);
    } catch (err: any) {
      setError(err.message || "Error fetching items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      const token = getTokenFromCookies();
      const res = await fetch(`${API_BASE_URL}/items/${id}/`, {
        method: "DELETE",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete item");
      setItems((prev) =>
        Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []
      );
    } catch (err: any) {
      alert(err.message || "Error deleting item");
    }
  };

  // Start editing
  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditDescription(item.description || "");
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditName("");
    setEditDescription("");
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const token = getTokenFromCookies();
      const res = await fetch(`${API_BASE_URL}/items/${editingItem.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          name: editName,
          description: editDescription,
        }),
      });
      if (!res.ok) throw new Error("Failed to update item");
      const updated = await res.json();
      setItems((prev) =>
        Array.isArray(prev)
          ? prev.map((item) => (item.id === updated.id ? updated : item))
          : []
      );
      handleCancelEdit();
    } catch (err: any) {
      alert(err.message || "Error updating item");
    }
  };

  // Expand/Shrink image
  const handleImageSize = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Defensive: ensure items is always an array before rendering
  const safeItems: Item[] = Array.isArray(items) ? items : [];

  return (
    <div className="w-full p-2 md:p-6 mt-6 flex items-center flex-col">
      <h1 className="text-2xl font-bold mb-6">My Items</h1>
      {loading ? (
        <div className="text-center py-8">Loading items...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 grid-cols-1 gap-12 w-full max-w-5xl">
          {safeItems.length === 0 ? (
            <div className="text-gray-500 text-center col-span-full">No items found.</div>
          ) : (
            safeItems.map((item, index) => {
              const imageUrl = getImageUrl(item.image_url);
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
                    {editingItem && editingItem.id === item.id ? (
                      <div>
                        <input
                          className="border rounded px-2 py-1 w-full mb-2"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                        />
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="text-lg font-semibold text-gray-800">{item.name}</h4>
                        <p className="text-gray-500 text-sm">{item.description || "-"}</p>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className={`flex items-center justify-between py-2 px-4 ${isExpanded ? "hidden" : ""}`}>
                    {editingItem && editingItem.id === item.id ? (
                      <div className="space-x-2">
                        <button
                          className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                          onClick={handleSaveEdit}
                        >
                          Save
                        </button>
                        <button
                          className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="space-x-2">
                        <button
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Image Section */}
                  <div
                    className={`relative ${
                      isExpanded
                        ? "w-[98vw] h-[88vh] md:w-[500px] md:h-[600px] lg:w-[500px] lg:h-[700px]"
                        : "h-[250px] m-3"
                    }`}
                  >
                    {/* Expand image */}
                    <button
                      title={isExpanded ? "Shrink Image" : "Expand Image"}
                      onClick={() => handleImageSize(item.id)}
                      className="absolute top-2 left-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                    >
                      <IoMdResize />
                    </button>

                    {/* Go to details (placeholder, can be linked to details page) */}
                    <button
                      title="Go to details"
                      // onClick={() => router.push(`/dashboard/items/${item.id}`)}
                      className="absolute bottom-2 right-2 p-3 bg-white z-20 text-black text-xl rounded-full hover:bg-blue-200 transition-colors shadow-md"
                      disabled
                    >
                      <MdArrowOutward />
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
          )}
        </div>
      )}
    </div>
  );
}