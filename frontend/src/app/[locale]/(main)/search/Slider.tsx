"use client";
import React, { useEffect, useState } from "react";

interface ItemType {
  id: string;
  name: string;
}

interface SliderBarProps {
  onFilterChange: (itemTypeId: string) => void;
  initialItemTypeId?: string;
}

const SliderBar = ({ onFilterChange, initialItemTypeId }: SliderBarProps) => {
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [currentItemTypeId, setCurrentItemTypeId] = useState<string>(initialItemTypeId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/item-types/`;

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
    onFilterChange(itemTypeId);
  };

  useEffect(() => {
    fetchItemTypes();
  }, []);

  return (
    <div className="fixed h-screen w-[12vw] bg-slate-300 flex flex-col items-center z-40 p-4 overflow-y-auto shadow-lg">
      {loading && <p className="text-gray-600 mb-4">Loading...</p>}
      {error && <p className="text-red-600 mb-4">Error: {error}</p>}
      {itemTypes.map((itemType) => (
        <button
          key={itemType.id}
          onClick={() => handleClick(itemType.id)}
          className={`w-full mb-3 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-transform duration-300 ${
            currentItemTypeId === itemType.id
              ? "bg-violet-500 text-white scale-105"
              : "bg-violet-300 hover:bg-violet-400"
          }`}
        >
          {itemType.name}
        </button>
      ))}
    </div>
  );
};

export default SliderBar;
