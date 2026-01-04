"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Building, Search, Filter, X, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDateOnly } from '@/utils/dateFormatter';
import ProtectedPage from '@/components/protection/ProtectedPage';

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
  phone1?: string;
  phone2?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    name_ar?: string;
    name_en?: string;
    description?: string;
  };
}

interface Organization {
  id: string;
  name: string;
  name_ar?: string;
  name_en?: string;
  description?: string;
}

interface BranchFormData {
  branch_name_ar: string;
  branch_name_en: string;
  description_ar: string;
  description_en: string;
  longitude: number | '' | undefined;
  latitude: number | '' | undefined;
  phone1?: string | null;
  phone2?: string | null;
  organization_id: string;
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=')[1] || document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
  return {
    'Authorization': `Bearer ${token || ''}`,
    'Content-Type': 'application/json'
  };
};

// API service functions
const branchAPI = {
  async getAllBranches(skip = 0, limit = 100, organizationId: string | null = null): Promise<Branch[]> {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (organizationId) params.append('organization_id', organizationId);

    const response = await fetch(`${API_BASE_URL}/api/branches/public/?${params}`, {
      headers: {
        "Content-Type": "application/json",
      }
    });
    if (!response.ok) throw new Error('Failed to fetch branches');
    return response.json();
  },

  async getBranchById(branchId: string): Promise<Branch> {
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch branch');
    return response.json();
  },

  async createBranch(branchData: BranchFormData): Promise<Branch> {
    const response = await fetch(`${API_BASE_URL}/api/branches/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(branchData)
    });
    if (!response.ok) throw new Error('Failed to create branch');
    return response.json();
  },

  async updateBranch(branchId: string, branchData: BranchFormData): Promise<Branch> {
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(branchData)
    });
    if (!response.ok) throw new Error('Failed to update branch');
    return response.json();
  },

  async deleteBranch(branchId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete branch');
  },

  async getBranchAddresses(branchId: string, skip = 0, limit = 100): Promise<unknown[]> {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}/addresses?${params}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch addresses');
    return response.json();
  },

  async createAddress(addressData: unknown): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/addresses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(addressData)
    });
    if (!response.ok) throw new Error('Failed to create address');
    return response.json();
  },

  async deleteAddress(addressId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/addresses/${addressId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete address');
  }
};

// Organization API functions
const organizationAPI = {
  async getAllOrganizations(skip = 0, limit = 1000): Promise<Organization[]> {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    const response = await fetch(`${API_BASE_URL}/api/organizations?${params}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch organizations');
    return response.json();
  }
};

// Branch Form Modal Component
const BranchFormModal = ({ isOpen, onClose, branch, onSave, locale }: {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch | null;
  onSave: () => void;
  locale: string;
}) => {
  const t = useTranslations('branches');
  const [formData, setFormData] = useState<BranchFormData>({
    branch_name_ar: '',
    branch_name_en: '',
    description_ar: '',
    description_en: '',
    longitude: '',
    latitude: '',
    phone1: '',
    phone2: '',
    organization_id: ''
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    setOrganizationsLoading(true);
    try {
      const data = await organizationAPI.getAllOrganizations();
      setOrganizations(data);
    } catch (error) {
      alert(`${t('errorLoadingOrganizations')}: ${error instanceof Error ? error.message : t('unknownError')}`);
    } finally {
      setOrganizationsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen, fetchOrganizations]);

  useEffect(() => {
    if (branch) {
      setFormData({
        branch_name_ar: branch.branch_name_ar || '',
        branch_name_en: branch.branch_name_en || '',
        description_ar: branch.description_ar || '',
        description_en: branch.description_en || '',
        longitude: branch.longitude || '',
        latitude: branch.latitude || '',
        phone1: branch.phone1 || '',
        phone2: branch.phone2 || '',
        organization_id: branch.organization_id || ''
      });
    } else {
      setFormData({
        branch_name_ar: '',
        branch_name_en: '',
        description_ar: '',
        description_en: '',
        longitude: '',
        latitude: '',
        phone1: '',
        phone2: '',
        organization_id: ''
      });
    }
  }, [branch]);

  const handleSubmit = async () => {
    if (!formData.branch_name_ar && !formData.branch_name_en) {
      alert(t('fillBranchName'));
      return;
    }
    if (!formData.organization_id) {
      alert(t('selectOrganizationRequired'));
      return;
    }

    // Validate phone numbers - only validate if they have content
    const phone1Trimmed = formData.phone1?.trim() || '';
    const phone2Trimmed = formData.phone2?.trim() || '';
    const phoneNumbers = [phone1Trimmed, phone2Trimmed].filter(p => p && p.length > 0);

    // Validate each phone number that has content (must be exactly 8 digits)
    for (const phone of phoneNumbers) {
      if (!/^\d{8}$/.test(phone)) {
        alert('Phone number must be exactly 8 digits');
        return;
      }
    }

    setLoading(true);

    try {
      // Prepare data with proper coordinate handling
      // Send null for empty phone fields instead of empty strings
      const submitData: any = {
        ...formData,
        longitude: formData.longitude === '' ? undefined : Number(formData.longitude),
        latitude: formData.latitude === '' ? undefined : Number(formData.latitude),
        phone1: phone1Trimmed || null,
        phone2: phone2Trimmed || null
      };

      if (branch) {
        await branchAPI.updateBranch(branch.id, submitData);
      } else {
        await branchAPI.createBranch(submitData);
      }
      onSave();
      onClose();
    } catch (error) {
      alert(`${t('errorSaving')}: ${error instanceof Error ? error.message : t('unknownError')}`);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedOrganizationName = (organization: Organization) => {
    if (!organization) return '';
    if (locale === 'ar' && organization.name_ar) {
      return organization.name_ar;
    }
    if (locale === 'en' && organization.name_en) {
      return organization.name_en;
    }
    return organization.name || organization.name_en || organization.name_ar || '';
  };

  // Removed unused function getSelectedOrganizationName

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {branch ? t('editBranch') : t('createBranch')}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('branchNameAr')}
            </label>
            <input
              type="text"
              value={formData.branch_name_ar}
              onChange={(e) => setFormData({ ...formData, branch_name_ar: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('enterBranchNameAr')}
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('branchNameEn')}
            </label>
            <input
              type="text"
              value={formData.branch_name_en}
              onChange={(e) => setFormData({ ...formData, branch_name_en: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('enterBranchNameEn')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('organization')}
            </label>
            {organizationsLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                {t('loadingOrganizations')}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={formData.organization_id}
                  onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  required
                >
                  <option value="">{t('selectOrganization')}</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {getLocalizedOrganizationName(org)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 pointer-events-none" size={16} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('descriptionAr')}
            </label>
            <textarea
              value={formData.description_ar}
              onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('enterDescriptionAr')}
              rows={3}
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('descriptionEn')}
            </label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('enterDescriptionEn')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone 1
              </label>
              <input
                type="text"
                value={formData.phone1 ?? ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setFormData({ ...formData, phone1: value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="8 digits"
                maxLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone 2
              </label>
              <input
                type="text"
                value={formData.phone2 ?? ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setFormData({ ...formData, phone2: value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="8 digits"
                maxLength={8}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('longitude')}
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('enterLongitude')}
                min="-180"
                max="180"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('latitude')}
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('enterLatitude')}
                min="-90"
                max="90"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading || organizationsLoading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('saving') : (branch ? t('update') : t('create'))}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Branch Card Component
const BranchCard = ({ branch, onEdit, onDelete, organizations, locale }: {
  branch: Branch;
  onEdit: (branch: Branch) => void;
  onDelete: (branchId: string) => void;
  organizations: Organization[];
  locale: string;
}) => {
  const t = useTranslations('branches');
  const getLocalizedBranchName = () => {
    if (locale === 'ar' && branch.branch_name_ar) {
      return branch.branch_name_ar;
    }
    if (locale === 'en' && branch.branch_name_en) {
      return branch.branch_name_en;
    }
    return branch.branch_name_ar || branch.branch_name_en || t('unnamedBranch');
  };

  const getLocalizedOrganizationName = () => {
    const organization = organizations.find((org: Organization) => org.id === branch.organization_id);
    if (!organization) return branch.organization_id;

    if (locale === 'ar' && organization.name_ar) {
      return organization.name_ar;
    }
    if (locale === 'en' && organization.name_en) {
      return organization.name_en;
    }
    return organization.name || organization.name_en || organization.name_ar;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Building size={20} className="text-blue-600" />
            {getLocalizedBranchName()}
          </h3>
          <p className="text-sm text-gray-500">
            {t('organizationLabel')} {getLocalizedOrganizationName()}
          </p>
          {(branch.description_ar || branch.description_en) && (
            <p className="text-sm text-gray-600 mt-2">
              {locale === 'ar' && branch.description_ar ? branch.description_ar :
                locale === 'en' && branch.description_en ? branch.description_en :
                  branch.description_ar || branch.description_en}
            </p>
          )}
          {(branch.phone1 || branch.phone2) && (
            <div className="text-xs text-gray-600 mt-1">
              {branch.phone1 && <p>📞 {branch.phone1}</p>}
              {branch.phone2 && <p>📞 {branch.phone2}</p>}
            </div>
          )}
          {(branch.longitude && branch.latitude) && (
            <p className="text-xs text-gray-500 mt-1">
              📍 {branch.latitude.toFixed(6)}, {branch.longitude.toFixed(6)}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {t('createdLabel')} {formatDateOnly(branch.created_at)}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(branch)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title={t('editBranch')}
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(branch.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title={t('deleteBranch')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Branch Management Component
export default function Branch() {
  const locale = useLocale();
  const t = useTranslations('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await branchAPI.getAllBranches(0, 100, organizationFilter || null);
      setBranches(data);
    } catch (error) {
      alert(`${t('errorLoadingBranches')}: ${error instanceof Error ? error.message : t('unknownError')}`);
    } finally {
      setLoading(false);
    }
  }, [organizationFilter, t]);

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

  const handleCreateBranch = () => {
    setSelectedBranch(null);
    setShowBranchModal(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    setShowBranchModal(true);
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (window.confirm(t('deleteConfirm'))) {
      try {
        await branchAPI.deleteBranch(branchId);
        fetchBranches();
      } catch (error) {
        alert(`${t('errorDeletingBranch')}: ${error instanceof Error ? error.message : t('unknownError')}`);
      }
    }
  };

  const getLocalizedBranchName = (branch: Branch) => {
    if (locale === 'ar' && branch.branch_name_ar) {
      return branch.branch_name_ar;
    }
    if (locale === 'en' && branch.branch_name_en) {
      return branch.branch_name_en;
    }
    return branch.branch_name_ar || branch.branch_name_en || t('unnamedBranch');
  };

  const getLocalizedOrganizationName = (organization: Organization) => {
    if (!organization) return '';
    if (locale === 'ar' && organization.name_ar) {
      return organization.name_ar;
    }
    if (locale === 'en' && organization.name_en) {
      return organization.name_en;
    }
    return organization.name || organization.name_en || organization.name_ar || '';
  };

  const filteredBranches = branches.filter((branch: Branch) => {
    const organization = organizations.find((org: Organization) => org.id === branch.organization_id);
    const branchName = getLocalizedBranchName(branch);
    const organizationName = organization ? getLocalizedOrganizationName(organization) : '';

    return branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      organizationName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <ProtectedPage requiredPermission="can_manage_branches">
      <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#3277AE]" size={20} />
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-[#3277AE]"
                  style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#3277AE]" size={16} />
                <select
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-[#3277AE] appearance-none bg-white"
                  style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
                >
                  <option value="">{t('allOrganizations')}</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {getLocalizedOrganizationName(org)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#3277AE] pointer-events-none" size={16} />
              </div>
            </div>
            <button
              onClick={handleCreateBranch}
              className="flex items-center gap-2 bg-[#3277AE] text-white px-4 py-2 rounded-md hover:bg-[#3277AE]/80 transition-colors"
            >
              <Plus size={20} />
              {t('createBranch')}
            </button>
          </div>
        </div>

        {/* Branch List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3277AE] mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('loadingBranches')}</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noBranchesFound')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || organizationFilter ? t('noBranchesMessage') : t('getStartedMessage')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBranches.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                organizations={organizations}
                locale={locale}
                onEdit={handleEditBranch}
                onDelete={handleDeleteBranch}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        <BranchFormModal
          isOpen={showBranchModal}
          onClose={() => setShowBranchModal(false)}
          branch={selectedBranch}
          onSave={fetchBranches}
          locale={locale}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}