"use client";
import React, { useState, useEffect } from 'react';
import {
  Edit, Trash2, CheckCircle, AlertCircle, Save, X
} from 'lucide-react';

const PermissionsManager = () => {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assignedPermissions, setAssignedPermissions] = useState([]);
  const [editingPermissionId, setEditingPermissionId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [newPermission, setNewPermission] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_BASE = 'http://localhost:8000';

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
    const res = await fetch(`${API_BASE}/permissions/all`, { headers: getAuthHeaders() });
    const data = await res.json();
    setPermissions(data);
  };

  const fetchRoles = async () => {
    const res = await fetch(`${API_BASE}/roles/all`, { headers: getAuthHeaders() });
    const data = await res.json();
    setRoles(data);
  };

  const fetchAssignedPermissions = async (roleId) => {
    const res = await fetch(`${API_BASE}/permissions/role/${roleId}`, { headers: getAuthHeaders() });
    const data = await res.json();
    setAssignedPermissions(data.map(p => p.id));
  };

  const handlePermissionToggle = (permissionId) => {
    setAssignedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleAssign = async () => {
    try {
      const res = await fetch(`${API_BASE}/permissions/assign-multiple-to-role`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role_id: selectedRoleId,
          permission_ids: assignedPermissions
        })
      });
      if (!res.ok) throw new Error();
      setSuccess('Permissions assigned successfully');
    } catch {
      setError('Failed to assign permissions');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this permission?')) return;
    const res = await fetch(`${API_BASE}/permissions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      setPermissions(permissions.filter(p => p.id !== id));
      setSuccess('Permission deleted');
    } else {
      setError('Failed to delete permission');
    }
  };

  const handleEdit = (perm) => {
    setEditingPermissionId(perm.id);
    setEditForm({ name: perm.name, description: perm.description || '' });
  };

  const handleUpdate = async () => {
    const res = await fetch(`${API_BASE}/permissions/${editingPermissionId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(editForm)
    });
    if (res.ok) {
      const updated = await res.json();
      setPermissions(permissions.map(p => p.id === updated.id ? updated : p));
      setEditingPermissionId(null);
      setSuccess('Permission updated');
    } else {
      setError('Failed to update permission');
    }
  };

  const handleCreate = async () => {
    const res = await fetch(`${API_BASE}/permissions/add-new-permission`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newPermission)
    });
    if (res.ok) {
      const created = await res.json();
      setPermissions([...permissions, created]);
      setNewPermission({ name: '', description: '' });
      setSuccess('Permission created');
    } else {
      setError('Failed to create permission');
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
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Permission Management</h2>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-3 flex items-center"><AlertCircle className="w-5 h-5 mr-2" />{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-3 flex items-center"><CheckCircle className="w-5 h-5 mr-2" />{success}</div>}

      {/* Create New Permission */}
      <div className="mb-6 border p-4 rounded-lg bg-white">
        <h3 className="font-semibold mb-2">Add New Permission</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            className="border px-3 py-2 rounded"
            placeholder="Permission name"
            value={newPermission.name}
            onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
          />
          <input
            type="text"
            className="border px-3 py-2 rounded"
            placeholder="Description (optional)"
            value={newPermission.description}
            onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
          />
        </div>
        <button
          onClick={handleCreate}
          className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Create Permission
        </button>
      </div>

      {/* Role Selector */}
      <div className="mb-6">
        <label className="block font-medium mb-1">Assign Permissions to Role</label>
        <select
          value={selectedRoleId}
          onChange={(e) => setSelectedRoleId(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">-- Select a role --</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>

      {/* Permissions List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {permissions.map(perm => (
          <div key={perm.id} className="border rounded-lg p-4 bg-white shadow-sm">
            {editingPermissionId === perm.id ? (
              <>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border px-2 py-1 mb-2 rounded"
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full border px-2 py-1 mb-2 rounded"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded flex items-center gap-1">
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button onClick={() => setEditingPermissionId(null)} className="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded flex items-center gap-1">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <h4 className="font-semibold text-blue-700">{perm.name}</h4>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(perm)} className="text-blue-600 hover:text-blue-800">
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
                    Assign to role
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
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Save Role Permissions
        </button>
      )}
    </div>
  );
};

export default PermissionsManager;
