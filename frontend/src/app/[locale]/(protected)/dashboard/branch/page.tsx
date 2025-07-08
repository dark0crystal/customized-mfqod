"use client"
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Building, MapPin, Calendar, Search, Filter } from 'lucide-react';

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'view'
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [formData, setFormData] = useState({
    branch_name: '',
    organization_id: ''
  });

  // Mock data - replace with actual API calls
  const mockOrganizations = [
    { id: '1', name: 'Tech Corp', description: 'Technology company' },
    { id: '2', name: 'Finance Ltd', description: 'Financial services' },
    { id: '3', name: 'Healthcare Inc', description: 'Healthcare provider' }
  ];

  const mockBranches = [
    {
      id: '1',
      branch_name: 'Downtown Branch',
      organization_id: '1',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      organization: { id: '1', name: 'Tech Corp', description: 'Technology company' }
    },
    {
      id: '2',
      branch_name: 'Uptown Branch',
      organization_id: '1',
      created_at: '2024-01-20T10:00:00Z',
      updated_at: '2024-01-20T10:00:00Z',
      organization: { id: '1', name: 'Tech Corp', description: 'Technology company' }
    },
    {
      id: '3',
      branch_name: 'Central Branch',
      organization_id: '2',
      created_at: '2024-01-25T10:00:00Z',
      updated_at: '2024-01-25T10:00:00Z',
      organization: { id: '2', name: 'Finance Ltd', description: 'Financial services' }
    }
  ];

  useEffect(() => {
    // Initialize with mock data
    setBranches(mockBranches);
    setOrganizations(mockOrganizations);
  }, []);

  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleFilterOrg = (orgId) => {
    setFilterOrg(orgId);
    setCurrentPage(1);
  };

  const filteredBranches = branches.filter(branch => {
    const matchesSearch = branch.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         branch.organization?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterOrg || branch.organization_id === filterOrg;
    return matchesSearch && matchesFilter;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredBranches.length / itemsPerPage);
  const paginatedBranches = filteredBranches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openModal = (mode, branch = null) => {
    setModalMode(mode);
    setSelectedBranch(branch);
    setShowModal(true);
    
    if (mode === 'create') {
      setFormData({ branch_name: '', organization_id: '' });
    } else if (branch) {
      setFormData({
        branch_name: branch.branch_name,
        organization_id: branch.organization_id
      });
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBranch(null);
    setFormData({ branch_name: '', organization_id: '' });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.branch_name.trim() || !formData.organization_id) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      if (modalMode === 'create') {
        // Mock create - replace with actual API call
        const newBranch = {
          id: Date.now().toString(),
          branch_name: formData.branch_name,
          organization_id: formData.organization_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          organization: organizations.find(org => org.id === formData.organization_id)
        };
        setBranches([...branches, newBranch]);
      } else if (modalMode === 'edit') {
        // Mock update - replace with actual API call
        const updatedBranches = branches.map(branch => 
          branch.id === selectedBranch.id 
            ? { 
                ...branch, 
                branch_name: formData.branch_name,
                organization_id: formData.organization_id,
                updated_at: new Date().toISOString(),
                organization: organizations.find(org => org.id === formData.organization_id)
              }
            : branch
        );
        setBranches(updatedBranches);
      }
      closeModal();
    } catch (error) {
      console.error('Error saving branch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (branchId) => {
    if (window.confirm('Are you sure you want to delete this branch?')) {
      setLoading(true);
      try {
        // Mock delete - replace with actual API call
        setBranches(branches.filter(branch => branch.id !== branchId));
      } catch (error) {
        console.error('Error deleting branch:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Building className="h-8 w-8 text-blue-600" />
                Branch Management
              </h1>
              <p className="text-gray-600 mt-2">Manage your organization branches</p>
            </div>
            <button
              onClick={() => openModal('create')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Branch
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="sm:w-64">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={filterOrg}
                  onChange={(e) => handleFilterOrg(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  <option value="">All Organizations</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {branch.branch_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {branch.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {branch.organization?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {branch.organization?.description || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(branch.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(branch.updated_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openModal('view', branch)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openModal('edit', branch)}
                          className="text-yellow-600 hover:text-yellow-900 p-1 rounded-md hover:bg-yellow-50"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(branch.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredBranches.length)}</span> of{' '}
                    <span className="font-medium">{filteredBranches.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === i + 1
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {modalMode === 'create' && 'Add New Branch'}
                {modalMode === 'edit' && 'Edit Branch'}
                {modalMode === 'view' && 'Branch Details'}
              </h3>
              
              {modalMode === 'view' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Branch Name</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBranch?.branch_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organization</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBranch?.organization?.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedBranch?.created_at)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Updated</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedBranch?.updated_at)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={formData.branch_name}
                      onChange={(e) => setFormData({...formData, branch_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization
                    </label>
                    <select
                      value={formData.organization_id}
                      onChange={(e) => setFormData({...formData, organization_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select an organization</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : (modalMode === 'create' ? 'Create' : 'Update')}
                    </button>
                  </div>
                </div>
              )}
              
              {modalMode === 'view' && (
                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}