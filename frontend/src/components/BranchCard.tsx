"use client";

import React from 'react';
import { Building, MapPin, Clock, Phone } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDateWithLocale } from '@/utils/dateFormatter';

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  description_ar?: string;
  description_en?: string;
  longitude?: number;
  latitude?: number;
  phone1?: string;
  phone2?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface Organization {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
}

interface BranchCardProps {
  branch: Branch;
  organization?: Organization;
}

export default function BranchCard({ branch, organization }: BranchCardProps) {
  const locale = useLocale();
  const t = useTranslations('branchesInfo');

  // Helper function to get localized branch name
  const getLocalizedBranchName = (branch: Branch): string => {
    if (locale === 'ar' && branch.branch_name_ar) {
      return branch.branch_name_ar;
    }
    if (locale === 'en' && branch.branch_name_en) {
      return branch.branch_name_en;
    }
    return branch.branch_name_ar || branch.branch_name_en || t('unnamedBranch');
  };

  // Helper function to get localized branch description
  const getLocalizedBranchDescription = (branch: Branch): string => {
    if (locale === 'ar' && branch.description_ar) {
      return branch.description_ar;
    }
    if (locale === 'en' && branch.description_en) {
      return branch.description_en;
    }
    return branch.description_ar || branch.description_en || '';
  };

  // Helper function to get localized organization name
  const getLocalizedOrganizationName = (organization?: Organization): string => {
    if (!organization) return t('unknownOrganization');
    if (locale === 'ar' && organization.name_ar) {
      return organization.name_ar;
    }
    if (locale === 'en' && organization.name_en) {
      return organization.name_en;
    }
    return organization.name_ar || organization.name_en || t('unknownOrganization');
  };

  const branchName = getLocalizedBranchName(branch);
  const branchDescription = getLocalizedBranchDescription(branch);
  const organizationName = getLocalizedOrganizationName(organization);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
      {/* Content Area - grows to fill available space */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: '#3277AE20'}}>
              <Building className="w-5 h-5" style={{color: '#3277AE'}} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{branchName}</h3>
              <p className="text-sm text-gray-600">{organizationName}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {branchDescription && (
          <div className="mb-4">
            <p className="text-gray-700 text-sm leading-relaxed">{branchDescription}</p>
          </div>
        )}

        {/* Location Info */}
        <div className="space-y-3">
          {/* Phone Numbers */}
          {(branch.phone1 || branch.phone2) && (
            <div className="space-y-2">
              {branch.phone1 && (
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${branch.phone1}`} className="hover:text-[#3277AE] transition-colors">
                    {branch.phone1}
                  </a>
                </div>
              )}
              {branch.phone2 && (
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${branch.phone2}`} className="hover:text-[#3277AE] transition-colors">
                    {branch.phone2}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Coordinates */}
          {branch.latitude && branch.longitude && (
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>
                {branch.latitude.toFixed(6)}, {branch.longitude.toFixed(6)}
              </span>
            </div>
          )}

          {/* Created Date */}
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>
              {t('createdOn')}: {formatDateWithLocale(branch.created_at, locale)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button - Fixed at bottom */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={() => {
            if (branch.latitude && branch.longitude) {
              const url = `https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`;
              window.open(url, '_blank');
            }
          }}
          disabled={!branch.latitude || !branch.longitude}
          className="w-full text-white py-2 px-4 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
          style={{backgroundColor: '#3277AE'}}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a5f8f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3277AE'}
        >
          <MapPin className="w-4 h-4" />
          <span>{t('viewOnMap')}</span>
        </button>
      </div>
    </div>
  );
}