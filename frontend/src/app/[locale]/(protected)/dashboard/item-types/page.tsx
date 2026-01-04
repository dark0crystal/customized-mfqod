"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, AlertCircle, CheckCircle, Upload, X } from 'lucide-react';
import { usePermissions } from "@/PermissionsContext"
import { useLocale, useTranslations } from "next-intl";
import { formatDateOnly } from '@/utils/dateFormatter';
import Image from 'next/image';
import ProtectedPage from '@/components/protection/ProtectedPage';

interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  image_url?: string;
  category?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

interface ItemTypeFormData {
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  category: string;
  is_active: boolean;
}

// API base URL - moved outside component as it's a constant
const API_BASE = `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/item-types`;

// Helper function to get cookie (same as in PermissionsContext)
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

const ItemTypesManager = () => {
  const locale = useLocale();
  const t = useTranslations("dashboard.itemTypes");
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemType | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Form state
  const [formData, setFormData] = useState<ItemTypeFormData>({
    name_ar: '',
    name_en: '',
    description_ar: '',
    description_en: '',
    category: '',
    is_active: true
  });

  // ✅ Get token from cookies - Updated to match your PermissionsContext
  const getTokenFromCookies = useCallback((): string | null => {
    if (typeof document !== 'undefined') {
      // Try the same cookie names as in your PermissionsContext
      const token = getCookie('token') || getCookie('jwt') || getCookie('access_token');
      return token;
    }
    return null;
  }, []);

  // ✅ Generate headers
  const getAuthHeaders = useCallback(() => {
    const token = getTokenFromCookies();
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  }, [getTokenFromCookies]);

  // Fetch all item types
  const fetchItemTypes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_BASE, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ItemType[] = await response.json();
      setItemTypes(data);
    } catch (err) {
      setError(t("errors.failedToFetch", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  }, [t, getAuthHeaders]);

  // Create new item type
  const createItemType = async (payload: {
    name_ar: string;
    name_en: string;
    description_ar?: string;
    description_en?: string;
    category?: string;
    is_active?: boolean;
  }) => {
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
      
      const newItemType: ItemType = await response.json();
      setItemTypes([...itemTypes, newItemType]);
      setSuccess(t("success.created"));
      resetForm();
    } catch (err) {
      setError(t("errors.failedToCreate", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  };

  // Update item type
  const updateItemType = async (id: string, payload: {
    name_ar: string;
    name_en: string;
    description_ar?: string;
    description_en?: string;
    category?: string;
    is_active?: boolean;
  }) => {
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
      setSuccess(t("success.updated"));
      resetForm();
    } catch (err) {
      setError(t("errors.failedToUpdate", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  };

  // Delete item type
  const deleteItemType = async (id: string) => {
    if (!window.confirm(t("confirmDelete"))) {
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
      setSuccess(t("success.deleted"));
    } catch (err) {
      setError(t("errors.failedToDelete", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name_ar: '',
      name_en: '',
      description_ar: '',
      description_en: '',
      category: '',
      is_active: true
    });
    setShowCreateForm(false);
    setEditingItem(null);
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.name_ar.trim() && !formData.name_en.trim()) {
      setError(t("validation.nameRequired"));
      return;
    }

    if (editingItem) {
      await updateItemType(editingItem.id, formData);
    } else {
      await createItemType(formData);
    }
  };

  // Start editing
  const startEdit = (item: ItemType) => {
    setFormData({
      name_ar: item.name_ar || '',
      name_en: item.name_en || '',
      description_ar: item.description_ar || '',
      description_en: item.description_en || '',
      category: item.category || '',
      is_active: item.is_active || true
    });
    setEditingItem(item);
    setSelectedImage(null);
    setImagePreview(null);
    // Set preview from existing image if available
    if (item.image_url) {
      const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
      let imageUrl = item.image_url;
      if (!imageUrl.startsWith('/')) {
        imageUrl = '/' + imageUrl;
      }
      setImagePreview(`${baseUrl}${imageUrl}`);
    }
    setShowCreateForm(true);
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image for item type
  const uploadImage = async (itemTypeId: string) => {
    if (!selectedImage) return;

    setUploadingImage(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedImage);

      const token = getTokenFromCookies();
      const response = await fetch(`${API_BASE}/${itemTypeId}/upload-image/`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const updatedItemType = await response.json();
      setItemTypes(itemTypes.map(item => 
        item.id === itemTypeId ? updatedItemType : item
      ));
      setSuccess(t("success.imageUploaded"));
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(t("errors.failedToUploadImage", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setUploadingImage(false);
    }
  };

  // Delete image from item type
  const deleteImage = async (itemTypeId: string) => {
    if (!window.confirm(t("confirmDeleteImage"))) {
      return;
    }

    setUploadingImage(true);
    setError('');
    try {
      const token = getTokenFromCookies();
      const response = await fetch(`${API_BASE}/${itemTypeId}/image/`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const updatedItemType = await response.json();
      setItemTypes(itemTypes.map(item => 
        item.id === itemTypeId ? updatedItemType : item
      ));
      setSuccess(t("success.imageDeleted"));
      
      // Clear preview if editing this item
      if (editingItem?.id === itemTypeId) {
        setImagePreview(null);
        setSelectedImage(null);
      }
    } catch (err) {
      setError(t("errors.failedToDeleteImage", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setUploadingImage(false);
    }
  };

  // Get image URL for display
  const getImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return null;
    const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
    let url = imageUrl;
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    return `${baseUrl}${url}`;
  };

  // Filter items based on search term
  const filteredItems = itemTypes.filter(item =>
    (item.name_ar && item.name_ar.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.name_en && item.name_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.description_ar && item.description_ar.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.description_en && item.description_en.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Load data on component mount
  useEffect(() => {
    if (!permissionsLoading) {
      fetchItemTypes();
    }
  }, [permissionsLoading, fetchItemTypes]);

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

  // Show loading while permissions are being loaded
  if (permissionsLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">{t("loadingPermissions")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedPage requiredPermission="can_manage_item_types">
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="mb-8 p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("title")}</h1>
          <p className="text-gray-600">{t("subtitle")}</p>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* ✅ FIXED: Changed from !hasPermission to hasPermission */}
            {hasPermission("can_create_item_types") && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-4 py-2 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
                  style={{ 
                    backgroundColor: '#3277AE',
                    '--tw-ring-color': '#3277AE'
                  } as React.CSSProperties & { [key: string]: string }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2a5f94';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3277AE';
                  }}
                >
                  <Plus className="h-4 w-4 inline mr-2" />
                  {t("addItemType")}
                </button>
            )}
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              {editingItem ? t("editItemType") : t("createItemType")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("form.nameArabic")}
                  </label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t("form.nameArabicPlaceholder")}
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("form.nameEnglish")}
                  </label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t("form.nameEnglishPlaceholder")}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("form.description")}
                </label>
                <textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({...formData, description_ar: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t("form.descriptionPlaceholder")}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("form.descriptionArabic")}
                  </label>
                  <textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({...formData, description_ar: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t("form.descriptionArabicPlaceholder")}
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("form.descriptionEnglish")}
                  </label>
                  <textarea
                    value={formData.description_en}
                    onChange={(e) => setFormData({...formData, description_en: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t("form.descriptionEnglishPlaceholder")}
                  />
                </div>
              </div>
              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("form.image")}
                </label>
                <div className="space-y-3">
                  {/* Image Preview */}
                  {(imagePreview || (editingItem && editingItem.image_url)) && (
                    <div className="relative w-full h-48 border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={imagePreview || getImageUrl(editingItem?.image_url) || ''}
                        alt={t("form.imagePreview")}
                        fill
                        className="object-contain"
                        sizes="400px"
                      />
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setImagePreview(editingItem?.image_url ? getImageUrl(editingItem.image_url) : null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          title={t("form.deleteImage")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Upload Area - Styled like other forms */}
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/bmp,image/webp"
                      onChange={handleImageSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="image-upload"
                    />
                    <div 
                      className="border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 bg-gray-50 hover:bg-blue-50"
                      style={{ borderColor: '#3277AE' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2a5f8f';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#3277AE';
                      }}
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Upload className="h-6 w-6" style={{ color: '#3277AE' }} />
                        <span className="text-sm font-medium" style={{ color: '#3277AE' }}>
                          {selectedImage ? t("form.changeImage") : t("form.selectImage")}
                        </span>
                        <span className="text-xs text-gray-500">
                          {selectedImage ? selectedImage.name : "JPG, PNG, GIF, BMP, WEBP (Max 10MB)"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Delete Button (only show when editing and image exists, no new image selected) */}
                  {editingItem && editingItem.image_url && !selectedImage && (
                    <button
                      type="button"
                      onClick={() => deleteImage(editingItem.id)}
                      disabled={uploadingImage}
                      className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{t("form.deleteImage")}</span>
                    </button>
                  )}
                  
                  {/* Upload Button (only show when editing and image is selected) */}
                  {editingItem && selectedImage && (
                    <button
                      type="button"
                      onClick={() => uploadImage(editingItem.id)}
                      disabled={uploadingImage}
                      className="w-full px-4 py-2 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        backgroundColor: '#3277AE',
                      } as React.CSSProperties & { [key: string]: string }}
                      onMouseEnter={(e) => {
                        if (!uploadingImage) {
                          e.currentTarget.style.backgroundColor = '#2a5f94';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!uploadingImage) {
                          e.currentTarget.style.backgroundColor = '#3277AE';
                        }
                      }}
                    >
                      {uploadingImage ? t("processing") : t("form.uploadImage")}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ 
                    backgroundColor: '#3277AE',
                    '--tw-ring-color': '#3277AE'
                  } as React.CSSProperties & { [key: string]: string }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#2a5f94';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#3277AE';
                    }
                  }}
                >
                  {loading ? t("processing") : editingItem ? t("update") : t("create")}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
                  style={{ 
                    backgroundColor: '#6B7280',
                    '--tw-ring-color': '#6B7280'
                  } as React.CSSProperties & { [key: string]: string }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4B5563';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6B7280';
                  }}
                >
                  {t("cancel")}
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
              <p className="mt-2 text-gray-600">{t("loading")}</p>
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>{t("noItemTypesFound")}</p>
              {searchTerm && (
                <p className="mt-2">{t("tryAdjustingSearch")}</p>
              )}
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] border-l-4 border-gray-200 p-4">
                  {/* Image Preview */}
                  {item.image_url && (
                    <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={getImageUrl(item.image_url) || ''}
                        alt={getLocalizedName(item.name_ar, item.name_en) || "Item type"}
                        fill
                        className="object-cover"
                        sizes="300px"
                      />
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{getLocalizedName(item.name_ar, item.name_en) || t("unnamed")}</h3>
                    </div>
                    <div className="flex gap-2">
                      {/* ✅ Added permission checks for edit and delete buttons */}
                      {hasPermission('can_edit_item_types') && (
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title={t("edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission("can_delete_item_types") && (
                        <button
                          onClick={() => deleteItemType(item.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title={t("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {item.description_ar || item.description_en ? (
                    <p className="text-gray-600 text-sm mb-3">{getLocalizedName(item.description_ar, item.description_en)}</p>
                  ) : null}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {t("created")}: {formatDateOnly(item.created_at)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t("id")}: {item.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
    </ProtectedPage>
  );
};

export default ItemTypesManager;