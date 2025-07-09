"use client"
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Building, Search, Filter, X } from 'lucide-react';

// API configuration
const API_BASE_URL = 'http://localhost:8000'; // Adjust to your FastAPI server

// API service functions
const branchAPI = {
  async getAllBranches(skip = 0, limit = 100, organizationId = null) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (organizationId) params.append('organization_id', organizationId);
    
    const response = await fetch(`${API_BASE_URL}/branch/branches`);
    if (!response.ok) throw new Error('Failed to fetch branches');
    return response.json();
  },

  async getBranchById(branchId) {
    const response = await fetch(`${API_BASE_URL}/branch/${branchId}`);
    if (!response.ok) throw new Error('Failed to fetch branch');
    return response.json();
  },

  async createBranch(branchData) {
    const response = await fetch(`${API_BASE_URL}/branch/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branchData)
    });
    if (!response.ok) throw new Error('Failed to create branch');
    return response.json();
  },

  async updateBranch(branchId, branchData) {
    const response = await fetch(`${API_BASE_URL}/branch/${branchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branchData)
    });
    if (!response.ok) throw new Error('Failed to update branch');
    return response.json();
  },

  async deleteBranch(branchId) {
    const response = await fetch(`${API_BASE_URL}/branch/branches/${branchId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete branch');
  },

  async getBranchAddresses(branchId, skip = 0, limit = 100) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    const response = await fetch(`${API_BASE_URL}/branch/${branchId}/addresses/?${params}`);
    if (!response.ok) throw new Error('Failed to fetch addresses');
    return response.json();
  },

  async createAddress(addressData) {
    const response = await fetch(`${API_BASE_URL}/addresses/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addressData)
    });
    if (!response.ok) throw new Error('Failed to create address');
    return response.json();
  },

  async deleteAddress(addressId) {
    const response = await fetch(`${API_BASE_URL}/addresses/${addressId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete address');
  }
};

// Branch Form Modal Component
const BranchFormModal = ({ isOpen, onClose, branch, onSave }) => {
  const [formData, setFormData] = useState({
    branch_name: '',
    organization_id: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branch) {
      setFormData({
        branch_name: branch.branch_name || '',
        organization_id: branch.organization_id || ''
      });
    } else {
      setFormData({ branch_name: '', organization_id: '' });
    }
  }, [branch]);

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
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization ID
            </label>
            <input
              type="text"
              value={formData.organization_id}
              onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
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

// Address Form Modal Component
// const AddressFormModal = ({ isOpen, onClose, branchId, onSave }) => {
//   const [formData, setFormData] = useState({
//     item_id: '',
//     is_current: true
//   });
//   const [loading, setLoading] = useState(false);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
    
//     try {
//       await branchAPI.createAddress({
//         ...formData,
//         branch_id: branchId
//       });
//       onSave();
//       onClose();
//       setFormData({ item_id: '', is_current: true });
//     } catch (error) {
//       alert(`Error: ${error.message}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       <div className="bg-white rounded-lg p-6 w-full max-w-md">
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-xl font-bold">Add Address</h2>
//           <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
//             <X size={24} />
//           </button>
//         </div>

//         <div className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-1">
//               Item ID
//             </label>
//             <input
//               type="text"
//               value={formData.item_id}
//               onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
//               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               required
//             />
//           </div>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="is_current"
//               checked={formData.is_current}
//               onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
//               className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
//             />
//             <label htmlFor="is_current" className="text-sm font-medium text-gray-700">
//               Set as current address
//             </label>
//           </div>

//           <div className="flex gap-2 pt-4">
//             <button
//               onClick={handleSubmit}
//               disabled={loading}
//               className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
//             >
//               {loading ? 'Adding...' : 'Add Address'}
//             </button>
//             <button
//               onClick={onClose}
//               className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
//             >
//               Cancel
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// Branch Card Component
const BranchCard = ({ branch, onEdit, onDelete }) => {
  
  

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Building size={20} />
            {branch.branch_name}
          </h3>
          <p className="text-sm text-gray-500">
            Organization: {branch.organization?.name || branch.organization_id}
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
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedBranchForAddress, setSelectedBranchForAddress] = useState(null);

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

  useEffect(() => {
    fetchBranches();
  }, [organizationFilter]);

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

 

  const filteredBranches = branches.filter(branch =>
    branch.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (branch.organization?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  placeholder="Search branches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Filter by organization ID..."
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                onEdit={handleEditBranch}
                onDelete={handleDeleteBranch}
                // onViewAddresses={handleViewAddresses}
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
        />

        
      </div>
    </div>
  );
}