"use client"
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building, Search, Filter, X, ChevronDown } from 'lucide-react';
import { useLocale } from 'next-intl';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

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
  async getAllBranches(skip = 0, limit = 100, organizationId = null) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (organizationId) params.append('organization_id', organizationId);
    
    const response = await fetch(`${API_BASE_URL}/api/branches?${params}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch branches');
    return response.json();
  },

  async getBranchById(branchId) {
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch branch');
    return response.json();
  },

  async createBranch(branchData) {
    const response = await fetch(`${API_BASE_URL}/api/branches`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(branchData)
    });
    if (!response.ok) throw new Error('Failed to create branch');
    return response.json();
  },

  async updateBranch(branchId, branchData) {
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(branchData)
    });
    if (!response.ok) throw new Error('Failed to update branch');
    return response.json();
  },

  async deleteBranch(branchId) {
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete branch');
  },

  async getBranchAddresses(branchId, skip = 0, limit = 100) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    const response = await fetch(`${API_BASE_URL}/api/branches/${branchId}/addresses?${params}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch addresses');
    return response.json();
  },

  async createAddress(addressData) {
    const response = await fetch(`${API_BASE_URL}/api/addresses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(addressData)
    });
    if (!response.ok) throw new Error('Failed to create address');
    return response.json();
  },

  async deleteAddress(addressId) {
    const response = await fetch(`${API_BASE_URL}/api/addresses/${addressId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete address');
  }
};

// Organization API functions
const organizationAPI = {
  async getAllOrganizations(skip = 0, limit = 1000) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    const response = await fetch(`${API_BASE_URL}/api/organizations?${params}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch organizations');
    return response.json();
  }
};

// Branch Form Modal Component
const BranchFormModal = ({ isOpen, onClose, branch, onSave, locale }) => {
  const [formData, setFormData] = useState({
    branch_name: '',
    branch_name_ar: '',
    branch_name_en: '',
    organization_id: ''
  });
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (branch) {
      setFormData({
        branch_name: branch.branch_name || '',
        branch_name_ar: branch.branch_name_ar || '',
        branch_name_en: branch.branch_name_en || '',
        organization_id: branch.organization_id || ''
      });
    } else {
      setFormData({ branch_name: '', branch_name_ar: '', branch_name_en: '', organization_id: '' });
    }
  }, [branch]);

  const fetchOrganizations = async () => {
    setOrganizationsLoading(true);
    try {
      const data = await organizationAPI.getAllOrganizations();
      setOrganizations(data);
    } catch (error) {
      alert(`Error loading organizations: ${error.message}`);
    } finally {
      setOrganizationsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.branch_name || !formData.organization_id) {
      alert('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      if (branch) {
        await branchAPI.updateBranch(branch.id, formData);
      } else {
        await branchAPI.createBranch(formData);
      }
      onSave();
      onClose();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedOrganizationName = (organization) => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {branch ? 'Edit Branch' : 'Create Branch'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Name
            </label>
            <input
              type="text"
              value={formData.branch_name}
              onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter branch name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Name (Arabic)
            </label>
            <input
              type="text"
              value={formData.branch_name_ar}
              onChange={(e) => setFormData({ ...formData, branch_name_ar: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter branch name in Arabic"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Name (English)
            </label>
            <input
              type="text"
              value={formData.branch_name_en}
              onChange={(e) => setFormData({ ...formData, branch_name_en: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter branch name in English"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            {organizationsLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                Loading organizations...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={formData.organization_id}
                  onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  required
                >
                  <option value="">Select an organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {getLocalizedOrganizationName(org)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading || organizationsLoading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : (branch ? 'Update' : 'Create')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Branch Card Component
const BranchCard = ({ branch, onEdit, onDelete, organizations, locale }) => {
  const getLocalizedBranchName = () => {
    if (locale === 'ar' && branch.branch_name_ar) {
      return branch.branch_name_ar;
    }
    if (locale === 'en' && branch.branch_name_en) {
      return branch.branch_name_en;
    }
    return branch.branch_name || branch.branch_name_en || branch.branch_name_ar;
  };

  const getLocalizedOrganizationName = () => {
    const organization = organizations.find(org => org.id === branch.organization_id);
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
            <Building size={20} />
            {getLocalizedBranchName()}
          </h3>
          <p className="text-sm text-gray-500">
            Organization: {getLocalizedOrganizationName()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Created: {new Date(branch.created_at).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(branch)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Edit branch"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(branch.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Delete branch"
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
  const [branches, setBranches] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const data = await branchAPI.getAllBranches(0, 100, organizationFilter || null);
      setBranches(data);
    } catch (error) {
      alert(`Error loading branches: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    setOrganizationsLoading(true);
    try {
      const data = await organizationAPI.getAllOrganizations();
      setOrganizations(data);
    } catch (error) {
      alert(`Error loading organizations: ${error.message}`);
    } finally {
      setOrganizationsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleCreateBranch = () => {
    setSelectedBranch(null);
    setShowBranchModal(true);
  };

  const handleEditBranch = (branch) => {
    setSelectedBranch(branch);
    setShowBranchModal(true);
  };

  const handleDeleteBranch = async (branchId) => {
    if (window.confirm('Are you sure you want to delete this branch?')) {
      try {
        await branchAPI.deleteBranch(branchId);
        fetchBranches();
      } catch (error) {
        alert(`Error deleting branch: ${error.message}`);
      }
    }
  };

  const getLocalizedBranchName = (branch) => {
    if (locale === 'ar' && branch.branch_name_ar) {
      return branch.branch_name_ar;
    }
    if (locale === 'en' && branch.branch_name_en) {
      return branch.branch_name_en;
    }
    return branch.branch_name || branch.branch_name_en || branch.branch_name_ar || '';
  };

  const getLocalizedOrganizationName = (organization) => {
    if (!organization) return '';
    if (locale === 'ar' && organization.name_ar) {
      return organization.name_ar;
    }
    if (locale === 'en' && organization.name_en) {
      return organization.name_en;
    }
    return organization.name || organization.name_en || organization.name_ar || '';
  };

  const filteredBranches = branches.filter(branch => {
    const organization = organizations.find(org => org.id === branch.organization_id);
    const branchName = getLocalizedBranchName(branch);
    const organizationName = getLocalizedOrganizationName(organization);
    
    return branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           organizationName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Branch Management</h1>
          <p className="text-gray-600">Manage your organization branches and their addresses</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search branches or organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <select
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {getLocalizedOrganizationName(org)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
            <button
              onClick={handleCreateBranch}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Branch
            </button>
          </div>
        </div>

        {/* Branch List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading branches...</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No branches found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || organizationFilter ? 'Try adjusting your search or filter criteria.' : 'Get started by creating a new branch.'}
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
  );
}