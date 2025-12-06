'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDateOnly } from '@/utils/dateFormatter';

interface Organization {
  id: string;
  name_ar?: string;
  name_en?: string;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  organization?: Organization;
}

interface Address {
  id: string;
  is_current: boolean;
  branch?: Branch;
  full_location?: string;
  created_at: string;
  updated_at: string;
}

interface LocationTrackingProps {
  addresses: Address[];
}

export default function LocationTracking({ addresses }: LocationTrackingProps) {
  const locale = useLocale();
  const t = useTranslations('locationTracking');

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Sort addresses by creation date (newest first) and current status
  const sortedAddresses = [...addresses].sort((a, b) => {
    // Current address first
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    
    // Then by creation date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (!addresses || addresses.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <svg className="w-6 h-6 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t('title')}
        </h3>
        <p className="text-gray-500 text-center py-4">{t('noLocationInfo')}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#3277AE' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {t('title')}
      </h3>
      
      <div className="space-y-4">
        {sortedAddresses.map((address, index) => {
          const isCurrent = address.is_current;
          const branch = address.branch;
          const organization = branch?.organization;
          
          return (
            <div
              key={address.id}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                isCurrent
                  ? 'bg-green-50 border-green-200 shadow-md'
                  : 'bg-red-50 border-red-200 opacity-75'
              }`}
            >
              {/* Status Indicator */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div
                    className={`w-4 h-4 rounded-full mr-3 ${
                      isCurrent ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span
                    className={`font-semibold text-sm ${
                      isCurrent ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {isCurrent ? t('currentLocation') : t('previousLocation')}
                  </span>
                </div>
                
                {/* Date */}
                <span className="text-xs text-gray-500">
                  {formatDateOnly(address.created_at)}
                </span>
              </div>

              {/* Location Details */}
              <div className="space-y-3">
                {/* Organization and Branch combined: "organization name, branch name" */}
                {(organization || branch) && (
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrent ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        isCurrent ? 'text-green-600' : 'text-red-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">{t('location')}</p>
                      <p className={`font-medium ${
                        isCurrent ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {(() => {
                          const orgName = organization 
                            ? getLocalizedName(organization.name_ar, organization.name_en)
                            : '';
                          const branchName = branch 
                            ? getLocalizedName(branch.branch_name_ar, branch.branch_name_en)
                            : '';
                          
                          // Format: "organization name, branch name"
                          if (orgName && branchName) {
                            return `${orgName}, ${branchName}`;
                          } else if (orgName) {
                            return orgName;
                          } else if (branchName) {
                            return branchName;
                          }
                          return t('noLocationInfo');
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Full Location (if different from organization/branch) */}
                {address.full_location && (
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrent ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        isCurrent ? 'text-green-600' : 'text-red-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('address')}</p>
                      <p className={`font-medium ${
                        isCurrent ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {address.full_location}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Connection Line (except for the last item) */}
              {index < sortedAddresses.length - 1 && (
                <div className="absolute left-6 top-full w-0.5 h-4 bg-gray-300"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{t('totalLocations')}: {addresses.length}</span>
          <span>{t('current')}: {addresses.filter(addr => addr.is_current).length}</span>
        </div>
      </div>
    </div>
  );
}
