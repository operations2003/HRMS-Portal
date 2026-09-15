import React, { useEffect, useState } from 'react';
import { userService } from '../../services/userService.js';
import { UserCheck, Plus, Shield, Mail, Key } from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Can } from '../../components/rbac/Can.jsx';

export const UserListPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add User Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: '',
    status: 'Active',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formApiError, setFormApiError] = useState(null);

  const fetchUsersAndRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userData, rolesData] = await Promise.all([
        userService.listUsers(),
        userService.getRoles(),
      ]);
      setUsers(userData);
      setRoles(rolesData);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleId: roles[0]?.id || '',
      status: 'Active',
    });
    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.firstName.trim()) errs.firstName = 'First name is required.';
    if (!formData.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!formData.password || formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (!formData.roleId) errs.roleId = 'Role selection is required.';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormApiError(null);

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      await userService.createUser(formData);
      setIsFormOpen(false);
      await fetchUsersAndRoles();
    } catch (err) {
      setFormApiError({
        message: err.message || 'Failed to create user account.',
        errors: err.errors || [],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'User Account',
      accessor: 'firstName',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
            {row.firstName?.[0]}
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              {row.firstName} {row.lastName}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {row.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'System Role',
      accessor: 'roleName',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="brand">{row.roleName}</Badge>
        </div>
      ),
    },
    {
      header: 'Permissions Granted',
      accessor: (row) => `${row.permissions?.length || 0} permissions`,
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.roleName === 'SuperAdmin' ? (
            <span className="text-xs text-indigo-600 font-semibold">System Administrator (Full Access)</span>
          ) : (
            row.permissions?.slice(0, 3).map((p) => (
              <span key={p} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                {p}
              </span>
            ))
          )}
          {row.permissions?.length > 3 && row.roleName !== 'SuperAdmin' && (
            <span className="text-[10px] text-slate-400 font-medium">+{row.permissions.length - 3} more</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <Badge>{row.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600" />
            User Accounts & RBAC
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage administrative and system access logins and role privileges.
          </p>
        </div>

        <Can permission="user:write">
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Add User Account
          </Button>
        </Can>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={loading}
        error={error}
        emptyTitle="No users found"
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Create System User Account"
        subtitle="Provision a user login and assign an RBAC role."
      >
        {formApiError && (
          <Alert
            type="error"
            title="Failed to create user"
            message={formApiError.message}
            errors={formApiError.errors}
            onClose={() => setFormApiError(null)}
            className="mb-5"
          />
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="e.g. Jordan"
              error={formErrors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="e.g. Hayes"
              error={formErrors.lastName}
              required
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="jordan.hayes@company.com"
            error={formErrors.email}
            required
          />

          <Input
            label="Initial Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Minimum 6 characters"
            error={formErrors.password}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Assigned Role"
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              options={roles.map((r) => ({ value: r.id, label: `${r.name} - ${r.description}` }))}
              error={formErrors.roleId}
              required
            />
            <Select
              label="Account Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Create User Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
