"use client"
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, AlertCircle, CheckCircle } from 'lucide-react';

const ItemTypesManager = () => {
  const [itemTypes, setItemTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    is_active: true
  });

  // API base URL - adjust this to your backend URL
  const API_BASE = 'http://localhost:8000/item-types';

  // Mock token - replace with actual token management
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token') || 'your-auth-token'}`,
    'Content-Type': 'application/json'
  });

  // Fetch all item types
  const fetchItemTypes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_BASE, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setItemTypes(data);
    } catch (err) {
      setError(`Failed to fetch item types: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create new item type
  const createItemType = async (payload) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      const newItemType = await response.json();
      setItemTypes([...itemTypes, newItemType]);
      setSuccess('Item type created successfully!');
      resetForm();
    } catch (err) {
      setError(`Failed to create item type: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update item type
  const updateItemType = async (id, payload) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      const updatedItemType = await response.json();
      setItemTypes(itemTypes.map(item => 
        item.id === id ? updatedItemType : item
      ));
      setSuccess('Item type updated successfully!');
      resetForm();
    } catch (err) {
      setError(`Failed to update item type: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete item type
  const deleteItemType = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item type?')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      setItemTypes(itemTypes.filter(item => item.id !== id));
      setSuccess('Item type deleted successfully!');
    } catch (err) {
      setError(`Failed to delete item type: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      is_active: true
    });
    setShowCreateForm(false);
    setEditingItem(null);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (editingItem) {
      await updateItemType(editingItem.id, formData);
    } else {
      await createItemType(formData);
    }
  };

  // Start editing
  const startEdit = (item) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      is_active: item.is_active
    });
    setEditingItem(item);
    setShowCreateForm(true);
  };

  // Filter items based on search term
  const filteredItems = itemTypes.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Load data on component mount
  useEffect(() => {
    fetchItemTypes();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <h1 className="text-3xl font-bold">Item Types Manager</h1>
          <p className="text-blue-100 mt-2">Manage your item types and categories</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Controls */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search item types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Item Type
            </button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              {editingItem ? 'Edit Item Type' : 'Create New Item Type'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter item type name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter description"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Processing...' : editingItem ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item Types List */}
        <div className="p-6">
          {loading && !showCreateForm && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading item types...</p>
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No item types found.</p>
              {searchTerm && (
                <p className="mt-2">Try adjusting your search term.</p>
              )}
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {item.category && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteItemType(item.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {item.description && (
                    <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      item.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-500">
                      ID: {item.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemTypesManager;