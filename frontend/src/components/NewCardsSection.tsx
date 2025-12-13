"use client";
import { useEffect, useState, useRef } from "react";
import { useTranslations } from 'next-intl';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

export default function NewCardsSection() {
  const t = useTranslations('stats');
  const [branchesCount, setBranchesCount] = useState<number | null>(null);
  const [itemsCount, setItemsCount] = useState<number | null>(null);
  const [returnedCount, setReturnedCount] = useState<number | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingReturned, setLoadingReturned] = useState(true);
  const [errorBranches, setErrorBranches] = useState<string | null>(null);
  const [errorItems, setErrorItems] = useState<string | null>(null);
  const [errorReturned, setErrorReturned] = useState<string | null>(null);

  // ref for animation interval to avoid memory leaks
  const returnedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchBranches() {
      try {
        setLoadingBranches(true);
        setErrorBranches(null);
        const res = await fetch(`${API_BASE_URL}/api/branches/public/`, {
          cache: "no-store",
          headers: {
            'Content-Type': 'application/json',
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch branches: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setBranchesCount(data.length);
        } else {
          setBranchesCount(0);
        }
      } catch (err) {
        setErrorBranches(err instanceof Error ? err.message : 'Unknown error');
        setBranchesCount(null);
      } finally {
        setLoadingBranches(false);
      }
    }

    async function fetchItems() {
      try {
        setLoadingItems(true);
        setErrorItems(null);
        // Use the public statistics endpoint
        const res = await fetch(`${API_BASE_URL}/api/analytics/public/stats`, {
          cache: "no-store",
          headers: {
            'Content-Type': 'application/json',
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch statistics: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (data && typeof data === 'object' && 'total_items' in data) {
          setItemsCount(data.total_items);
        } else {
          setItemsCount(0);
        }
      } catch (err) {
        setErrorItems(err instanceof Error ? err.message : 'Unknown error');
        setItemsCount(null);
      } finally {
        setLoadingItems(false);
      }
    }

    // Fetch returned items count from public statistics endpoint
    async function fetchReturned() {
      try {
        setLoadingReturned(true);
        setErrorReturned(null);

        const res = await fetch(`${API_BASE_URL}/api/analytics/public/stats`, {
          cache: "no-store",
          headers: {
            'Content-Type': 'application/json',
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch statistics: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        let returned = 0;

        // Extract returned items count from the statistics
        if (data && typeof data === "object" && 'returned_items' in data) {
          returned = data.returned_items || 0;
        }

        // Animate counting from 0 to the returned count
        setReturnedCount(0);
        let currentCount = 0;
        const duration = 1200;
        const steps = Math.max(24, Math.min(96, returned * 2));
        const increment = returned > 0 ? returned / steps : 1;

        if (returnedIntervalRef.current) clearInterval(returnedIntervalRef.current);

        returnedIntervalRef.current = setInterval(() => {
          currentCount += increment;
          if (currentCount >= returned) {
            setReturnedCount(returned);
            if (returnedIntervalRef.current) clearInterval(returnedIntervalRef.current);
            setLoadingReturned(false);
          } else {
            setReturnedCount(Math.floor(currentCount));
          }
        }, duration / steps);

        if (returned === 0) {
          setReturnedCount(0);
          setLoadingReturned(false);
        }
      } catch (err) {
        setErrorReturned(err instanceof Error ? err.message : 'Unknown error');
        setReturnedCount(null);
        setLoadingReturned(false);
      }
    }

    fetchBranches();
    fetchItems();
    fetchReturned();

    // Cleanup interval if component unmounts
    return () => {
      if (returnedIntervalRef.current) clearInterval(returnedIntervalRef.current);
    };
  }, []);

  return (
    <div className="w-full py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Bottom Stats Section */}
        <div className="mt-16 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 sm:p-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold" style={{ color: '#3277AE' }}>
                {loadingItems ? (
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                ) : errorItems ? (
                  "--"
                ) : (
                  itemsCount !== null ? itemsCount : "--"
                )}
              </div>
              <div className="text-gray-600 font-medium">
                {t('itemsCount')}
              </div>
              {errorItems && (
                <div className="text-xs text-red-500 mt-1">
                  {t('loadingError')}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold" style={{ color: '#3277AE' }}>
                {loadingBranches ? (
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                ) : errorBranches ? (
                  "--"
                ) : (
                  branchesCount !== null ? branchesCount : "--"
                )}
              </div>
              <div className="text-gray-600 font-medium">
                {t('branchesCount')}
              </div>
              {errorBranches && (
                <div className="text-xs text-red-500 mt-1">
                  {t('loadingError')}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold" style={{ color: '#3277AE' }}>
                {loadingReturned ? (
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                ) : errorReturned ? (
                  "--"
                ) : (
                  returnedCount !== null ? returnedCount : "--"
                )}
              </div>
              <div className="text-gray-600 font-medium">
                {t('returnedCount')}
              </div>
              {errorReturned && (
                <div className="text-xs text-red-500 mt-1">
                  {t('loadingError')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
