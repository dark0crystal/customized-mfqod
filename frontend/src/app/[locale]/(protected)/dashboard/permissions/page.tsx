"use client";
import React, { useState, useEffect } from 'react';
import {
  Edit, Trash2, CheckCircle, AlertCircle, Save, X
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import ProtectedPage from '@/components/protection/ProtectedPage';

const PermissionsManager = () => {
  const t = useTranslations('permissions');

  interface Permission {
    id: string;
    name: string;
    description: string;
  }

  interface Role {
    id: string;
    name: string;
  }

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assignedPermissions, setAssignedPermissions] = useState<string[]>([]);
  const [editingPermissionId, setEditingPermissionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [newPermission, setNewPermission] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

  const getAuthHeaders = () => {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];

    return {
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/permissions/all`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPermissions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setError(t('failedToLoadPermissions'));
      setPermissions([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/roles/all`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      setError(t('failedToLoadRoles'));
      setRoles([]);
    }
  };

  const fetchAssignedPermissions = async (roleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/permissions/role/${roleId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssignedPermissions(Array.isArray(data) ? data.map((p: Permission) => p.id) : []);
    } catch (error) {
      console.error('Failed to fetch assigned permissions:', error);
      setError(t('failedToLoadRolePermissions'));
      setAssignedPermissions([]);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setAssignedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleAssign = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/permissions/assign-multiple-to-role`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role_id: selectedRoleId,
          permission_ids: assignedPermissions
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(t('permissionsAssignedSuccessfully'));
    } catch (error) {
      console.error('Failed to assign permissions:', error);
      setError(t('failedToAssignPermissions'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDeletePermission'))) return;
    try {
      const res = await fetch(`${API_BASE}/api/permissions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setPermissions(permissions.filter(p => p.id !== id));
        setSuccess(t('permissionDeleted'));
      } else {
        setError(t('failedToDeletePermission'));
      }
    } catch (error) {
      console.error('Failed to delete permission:', error);
      setError(t('failedToDeletePermission'));
    }
  };

  const handleEdit = (perm: Permission) => {
    setEditingPermissionId(perm.id);
    setEditForm({ name: perm.name, description: perm.description || '' });
  };

  const handleUpdate = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/permissions/${editingPermissionId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setPermissions(permissions.map(p => p.id === updated.id ? updated : p));
        setEditingPermissionId(null);
        setSuccess(t('permissionUpdated'));
      } else {
        setError(t('failedToUpdatePermission'));
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      setError(t('failedToUpdatePermission'));
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/permissions/add-new-permission`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPermission)
      });
      if (res.ok) {
        const created = await res.json();
        setPermissions([...permissions, created]);
        setNewPermission({ name: '', description: '' });
        setSuccess(t('permissionCreated'));
      } else {
        setError(t('failedToCreatePermission'));
      }
    } catch (error) {
      console.error('Failed to create permission:', error);
      setError(t('failedToCreatePermission'));
    }
  };

  useEffect(() => {
    fetchPermissions();
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRoleId) fetchAssignedPermissions(selectedRoleId);
  }, [selectedRoleId]);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  return (
    <ProtectedPage requiredPermission="can_manage_permissions">
      <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4" style={{ color: '#3277AE' }}>{t('title')}</h2>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-3 flex items-center"><AlertCircle className="w-5 h-5 mr-2" />{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-3 flex items-center"><CheckCircle className="w-5 h-5 mr-2" />{success}</div>}

      {/* Create New Permission */}
      <div className="mb-6 p-4 rounded-lg bg-white shadow">
        <h3 className="font-semibold mb-2">{t('addNewPermission')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            className="border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            style={{
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            placeholder={t('permissionNamePlaceholder')}
            value={newPermission.name}
            onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
          />
          <input
            type="text"
            className="border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            style={{
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            placeholder={t('descriptionPlaceholder')}
            value={newPermission.description}
            onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
          />
        </div>
        <button
          onClick={handleCreate}
          className="mt-3 text-white px-4 py-2 rounded transition-colors"
          style={{ backgroundColor: '#3277AE' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2c6a9a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3277AE'}
        >
          {t('createPermission')}
        </button>
      </div>

      {/* Role Selector */}
      <div className="mb-6">
        <label className="block font-medium mb-1">{t('assignPermissionsToRole')}</label>
        <select
          value={selectedRoleId}
          onChange={(e) => setSelectedRoleId(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          style={{
            '--tw-ring-color': '#3277AE',
            '--tw-ring-offset-color': '#3277AE'
          } as React.CSSProperties & { [key: string]: string }}
        >
          <option value="">{t('selectRole')}</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>

      {/* Permissions List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {permissions.map(perm => (
          <div key={perm.id} className="rounded-lg p-4 bg-white shadow-sm">
            {editingPermissionId === perm.id ? (
              <>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 px-2 py-1 mb-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  style={{
                    '--tw-ring-color': '#3277AE',
                    '--tw-ring-offset-color': '#3277AE'
                  } as React.CSSProperties & { [key: string]: string }}
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full border border-gray-300 px-2 py-1 mb-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  style={{
                    '--tw-ring-color': '#3277AE',
                    '--tw-ring-offset-color': '#3277AE'
                  } as React.CSSProperties & { [key: string]: string }}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-1">
                    <Save className="w-4 h-4" /> {t('save')}
                  </button>
                  <button onClick={() => setEditingPermissionId(null)} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded flex items-center gap-1">
                    <X className="w-4 h-4" /> {t('cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <h4 className="font-semibold" style={{ color: '#3277AE' }}>{perm.name}</h4>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(perm)} className="transition-colors" style={{ color: '#3277AE' }} onMouseEnter={(e) => e.currentTarget.style.color = '#2c6a9a'} onMouseLeave={(e) => e.currentTarget.style.color = '#3277AE'}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(perm.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{perm.description}</p>

                {selectedRoleId && (
                  <label className="flex items-center mt-3">
                    <input
                      type="checkbox"
                      checked={assignedPermissions.includes(perm.id)}
                      onChange={() => handlePermissionToggle(perm.id)}
                      className="mr-2"
                    />
                    {t('assignToRole')}
                  </label>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {selectedRoleId && (
        <button
          onClick={handleAssign}
          className="mt-6 text-white px-4 py-2 rounded transition-colors"
          style={{ backgroundColor: '#3277AE' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2c6a9a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3277AE'}
        >
          {t('saveRolePermissions')}
        </button>
      )}
    </div>
    </ProtectedPage>
  );
};

export default PermissionsManager;
