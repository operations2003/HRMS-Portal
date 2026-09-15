import React, { useEffect, useState, useMemo } from 'react';
import { userService } from '../../services/userService.js';
import { orgService } from '../../services/orgService.js';
import {
  UserCheck,
  Plus,
  Shield,
  Mail,
  Building2,
  Search,
  Key,
  ShieldCheck,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { PasswordInput } from '../../components/common/PasswordInput.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Can } from '../../components/rbac/Can.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const UserListPage = () => {
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // View Permissions Modal State
  const [viewingUser, setViewingUser] = useState(null);

  // Add User Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    orgId: '',
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
      const [userData, rolesData, orgsData] = await Promise.all([
        userService.listUsers(),
        userService.getRoles(),
        orgService.listOrganizations(),
      ]);
      setUsers(userData);
      setRoles(rolesData);
      setOrganizations(orgsData);
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
      orgId: organizations[0]?.id || '',
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
      toast.success(`User account for '${formData.firstName} ${formData.lastName}' created successfully.`);
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

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        searchTerm === '' ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.organization?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === '' || u.roleName === roleFilter;
      const matchesStatus = statusFilter === '' || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const columns = [
    {
      header: 'User Account',
      accessor: 'firstName',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-slate-700">
            {row.firstName?.[0]}
            {row.lastName?.[0]}
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
      header: 'Organization',
      accessor: (row) => row.organization?.name || 'System-wide',
      render: (row) =>
        row.organization ? (
          <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-medium text-slate-800">{row.organization.name}</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              {row.organization.code}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">System-wide</span>
        ),
    },
    {
      header: 'Permissions',
      accessor: (row) => `${row.permissions?.length || 0} permissions`,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1 max-w-xs">
            {row.roleName === 'Admin' || row.roleName === 'SuperAdmin' ? (
              <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Full System Access
              </span>
            ) : (
              row.permissions?.slice(0, 2).map((p) => (
                <span
                  key={p}
                  className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono"
                >
                  {p}
                </span>
              ))
            )}
            {row.permissions?.length > 2 && row.roleName !== 'Admin' && row.roleName !== 'SuperAdmin' && (
              <span className="text-[10px] text-slate-400 font-medium">
                +{row.permissions.length - 2} more
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setViewingUser(row)}
            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
            title="View full permission details"
          >
            <Eye className="w-4 h-4" />
          </button>
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600" />
            User Accounts & RBAC
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage administrative and system access logins, organizational affiliations, and role privileges.
          </p>
        </div>

        <Can permission="user:write">
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Add User Account
          </Button>
        </Can>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Input
            placeholder="Search by name, email, or org..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={Search}
          />
        </div>
        <div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            placeholder="All Roles"
            options={[
              { value: '', label: 'All Roles' },
              ...roles.map((r) => ({ value: r.name, label: r.name })),
            ]}
          />
        </div>
        <div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      {/* User Accounts Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={loading}
        error={error}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your role or search filters."
      />

      {/* View User Permissions Modal */}
      <Modal
        isOpen={!!viewingUser}
        onClose={() => setViewingUser(null)}
        maxWidth="max-w-md"
        title="User Permissions & Scope"
        subtitle={`Role: ${viewingUser?.roleName} • ${viewingUser?.firstName} ${viewingUser?.lastName}`}
      >
        {viewingUser && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Assigned Organization:</span>
                <span className="ml-1.5 font-semibold text-slate-800">
                  {viewingUser.organization?.name || 'System-wide (All Orgs)'}
                </span>
              </div>
              <Badge variant="brand">{viewingUser.roleName}</Badge>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Active Privileges ({viewingUser.roleName === 'Admin' || viewingUser.roleName === 'SuperAdmin' ? 'All (Admin)' : viewingUser.permissions?.length || 0})
              </h5>

              {viewingUser.roleName === 'Admin' || viewingUser.roleName === 'SuperAdmin' ? (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                  <p className="font-semibold mb-1">Unrestricted Administrative Authority</p>
                  Admin bypasses granular permission constraints with full CRUD access to organizations, employees, users, departments, and metrics across all tenants.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {viewingUser.permissions?.map((perm) => (
                    <div
                      key={perm}
                      className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <span className="font-mono text-slate-700 font-medium">{perm}</span>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Granted
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setViewingUser(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        maxWidth="max-w-lg"
        title="Create System User Account"
        subtitle="Provision a user login, assign an organization, and establish an RBAC role."
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

          <PasswordInput
            label="Initial Password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Minimum 6 characters"
            error={formErrors.password}
            required
          />

          <Select
            label="Assigned Organization"
            value={formData.orgId}
            onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
            placeholder="Select Organization"
            options={organizations.map((org) => ({
              value: org.id,
              label: `${org.name} (${org.code})`,
            }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Assigned Role"
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              options={roles.map((r) => ({ value: r.id, label: `${r.name}` }))}
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
