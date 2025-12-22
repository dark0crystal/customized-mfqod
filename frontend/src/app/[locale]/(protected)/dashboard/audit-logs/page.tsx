"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Filter, Eye, Clock, User as UserIcon } from "lucide-react";
import { tokenManager } from '@/utils/tokenManager';
import { useTranslations, useLocale } from 'next-intl';
import { formatDateWithLocale } from '@/utils/dateFormatter';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

// Helper function to create authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = tokenManager.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

interface AuditLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  old_value?: string;
  new_value?: string;
  metadata?: string;
  ip_address: string;
  user_agent?: string;
  created_at: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  connection_type?: string;
  description?: string;
  formatted_changes?: string[];
}

export default function AuditLogsPage() {
  const t = useTranslations('dashboard.auditLogs');
  const locale = useLocale();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit] = useState(100);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(async (isLoadMore: boolean = false, currentSkip?: number) => {
    const skipValue = currentSkip !== undefined ? currentSkip : skip;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams({
        skip: skipValue.toString(),
        limit: limit.toString(),
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/audit-logs?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        
        if (isLoadMore) {
          // Append new logs to existing ones
          setLogs(prevLogs => [...prevLogs, ...(data.logs || [])]);
        } else {
          // Replace logs for initial load or search
          setLogs(data.logs || []);
        }
        
        setTotal(data.total || 0);
        setHasMore((skipValue + limit) < (data.total || 0));
      } else {
        console.error('Failed to fetch audit logs:', response.status);
        if (!isLoadMore) {
          setLogs([]);
        }
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      if (!isLoadMore) {
        setLogs([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [skip, limit, searchQuery]);

  useEffect(() => {
    // Only refetch when search query changes, reset skip to 0
    setSkip(0);
    fetchLogs(false, 0);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSkip(0);
    setLogs([]);
    fetchLogs(false, 0);
  };

  const handleRefresh = () => {
    setSkip(0);
    setLogs([]);
    fetchLogs(false, 0);
  };

  const handleLoadMore = () => {
    const newSkip = skip + limit;
    setSkip(newSkip);
    fetchLogs(true, newSkip);
  };

  const getEntityTypeBadgeColor = (entityType: string): string => {
    switch (entityType.toLowerCase()) {
      case 'item':
        return 'bg-blue-100 text-blue-800';
      case 'transfer_request':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionTypeBadgeColor = (actionType: string): string => {
    if (actionType.includes('status_changed')) return 'bg-yellow-100 text-yellow-800';
    if (actionType.includes('deleted')) return 'bg-red-100 text-red-800';
    if (actionType.includes('restored')) return 'bg-green-100 text-green-800';
    if (actionType.includes('approved')) return 'bg-green-100 text-green-800';
    if (actionType.includes('rejected')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getConnectionTypeBadgeColor = (connectionType?: string): string => {
    switch (connectionType?.toLowerCase()) {
      case 'cellular':
        return 'bg-blue-100 text-blue-800';
      case '3g':
        return 'bg-orange-100 text-orange-800';
      case 'wifi':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const formatActionType = (actionType: string): string => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatEntityType = (entityType: string): string => {
    if (entityType === 'item') return 'Items';
    if (entityType === 'transfer_request') return 'Transfer Requests';
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 lg:px-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">{t('description')}</p>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </form>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw size={18} />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>
          <button
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter size={18} />
            <span className="hidden sm:inline">{t('filters')}</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('noLogs')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('timeAndUser')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('activity')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('changes')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('deviceAndLocation')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    {/* Time & User */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDateWithLocale(log.created_at, locale)}
                      </div>
                      {log.user && (
                        <div className="text-sm text-gray-500 mt-1">
                          {log.user.first_name} {log.user.last_name}
                        </div>
                      )}
                      {log.user && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {log.user.email}
                        </div>
                      )}
                    </td>

                    {/* Activity */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getEntityTypeBadgeColor(log.entity_type)}`}>
                          {formatEntityType(log.entity_type)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getActionTypeBadgeColor(log.action_type)}`}>
                          {formatActionType(log.action_type)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900">
                        {log.description || `${formatActionType(log.action_type)} for ${formatEntityType(log.entity_type)}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Entity ID: {log.entity_id.substring(0, 8)}...
                      </div>
                    </td>

                    {/* Changes */}
                    <td className="px-4 py-4">
                      {log.formatted_changes && log.formatted_changes.length > 0 ? (
                        <div className="text-sm">
                          {log.formatted_changes.slice(0, 2).map((change, idx) => (
                            <div key={idx} className="text-gray-900 mb-1">
                              {change}
                            </div>
                          ))}
                          {log.formatted_changes.length > 2 && (
                            <div className="text-xs text-indigo-600 mt-1">
                              +{log.formatted_changes.length - 2} more changes
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No changes</span>
                      )}
                    </td>

                    {/* Device & Location */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {log.browser_name && log.browser_version && (
                          <div>{log.browser_name} {log.browser_version}</div>
                        )}
                        {log.os_name && (
                          <div className="text-gray-600 mt-1 flex items-center gap-2">
                            {log.os_name}
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {log.ip_address}
                        </div>
                        {log.connection_type && (
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${getConnectionTypeBadgeColor(log.connection_type)}`}>
                            {log.connection_type}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Load More Button */}
      {!loading && logs.length > 0 && hasMore && (
        <div className="flex justify-center py-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loadingMore ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Load More</span>
                <span className="text-sm opacity-75">({total - logs.length} remaining)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Results Summary */}
      {!loading && logs.length > 0 && (
        <div className="text-center text-sm text-gray-600">
          Showing {logs.length} of {total} logs
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t('logDetails')}</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <strong>{t('timeAndUser')}:</strong> {formatDateWithLocale(selectedLog.created_at, locale)}
                  {selectedLog.user && (
                    <div className="mt-1">
                      {selectedLog.user.first_name} {selectedLog.user.last_name} ({selectedLog.user.email})
                    </div>
                  )}
                </div>
                <div>
                  <strong>{t('activity')}:</strong> {selectedLog.description}
                </div>
                <div>
                  <strong>{t('changes')}:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {selectedLog.formatted_changes?.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>{t('deviceAndLocation')}:</strong>
                  <div className="mt-1">
                    {selectedLog.browser_name} {selectedLog.browser_version} on {selectedLog.os_name}
                    <br />
                    IP: {selectedLog.ip_address}
                    <br />
                    Connection: {selectedLog.connection_type || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

