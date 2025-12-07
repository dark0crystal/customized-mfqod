"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import BranchMap from '@/components/BranchMap';
import BranchCard from '@/components/BranchCard';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

// Type definitions
interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  description_ar?: string;
  description_en?: string;
  longitude?: number;
  latitude?: number;
  organization_id: string;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name_ar?: string;
    name_en?: string;
    description_ar?: string;
    description_en?: string;
  };
}

interface Organization {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
}

// API service functions (no authentication required for public access)
const branchAPI = {
  async getAllBranches(skip = 0, limit = 100, organizationId: string | null = null): Promise<Branch[]> {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (organizationId) params.append('organization_id', organizationId);
    
    const response = await fetch(`${API_BASE_URL}/api/branches/public/?${params}`);
    if (!response.ok) throw new Error('Failed to fetch branches');
    return response.json();
  }
};

const organizationAPI = {
  async getAllOrganizations(skip = 0, limit = 1000): Promise<Organization[]> {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    const response = await fetch(`${API_BASE_URL}/api/organizations?${params}`);
    if (!response.ok) throw new Error('Failed to fetch organizations');
    return response.json();
  }
};


// Main Branches Info Component
export default function BranchesInfo() {
  const t = useTranslations('branchesInfo');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await branchAPI.getAllBranches(0, 1000, null);
      setBranches(data);
    } catch (error) {
      alert(`${t('errorLoadingBranches')}: ${error instanceof Error ? error.message : t('unknownError')}`);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const data = await organizationAPI.getAllOrganizations();
      setOrganizations(data);
    } catch (error) {
      alert(`${t('errorLoadingOrganizations')}: ${error instanceof Error ? error.message : t('unknownError')}`);
    }
  }, [t]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);


  return (
    <div className="min-h-screen  p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>


        {/* Overview Map */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('overviewMap')}</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{borderColor: '#3277AE'}}></div>
              <p className="mt-4 text-gray-600">{t('loadingBranches')}</p>
            </div>
          ) : (
            <BranchMap
              branches={branches}
              organizations={organizations}
            />
          )}
        </div>

        {/* Branch Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('branchDetails')}</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{borderColor: '#3277AE'}}></div>
              <p className="mt-4 text-gray-600">{t('loadingBranches')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {branches.map((branch) => {
                const organization = organizations.find((org) => org.id === branch.organization_id);
                return (
                  <BranchCard
                    key={branch.id}
                    branch={branch}
                    organization={organization}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
