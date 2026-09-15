import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orgService } from '../../services/orgService.js';
import { Building2, Plus, Search, Edit2, Trash2, Globe, Phone, Mail, MapPin } from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Can } from '../../components/rbac/Can.jsx';

export const OrganizationListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    status: 'Active',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formApiError, setFormApiError] = useState(null);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orgService.listOrganizations({ search, status: statusFilter });
      setOrgs(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [search, statusFilter]);

  // Handle URL action trigger (e.g. ?action=new)
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleOpenCreate();
      setSearchParams({});
    }
  }, [searchParams]);

  const handleOpenCreate = () => {
    setEditingOrg(null);
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      status: 'Active',
    });
    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (org) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      code: org.code,
      email: org.email,
      phone: org.phone || '',
      website: org.website || '',
      address: org.address || '',
      status: org.status || 'Active',
    });
    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Organization name is required.';
    if (!formData.code.trim()) errs.code = 'Organization code is required.';
    if (!formData.email.trim()) {
      errs.email = 'Official email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormApiError(null);

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      if (editingOrg) {
        await orgService.updateOrganization(editingOrg.id, formData);
      } else {
        await orgService.createOrganization(formData);
      }
      setIsFormOpen(false);
      await fetchOrgs();
    } catch (err) {
      setFormApiError({
        message: err.message || 'Failed to save organization.',
        errors: err.errors || [],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await orgService.deleteOrganization(deleteTarget.id);
      setDeleteTarget(null);
      await fetchOrgs();
    } catch (err) {
      alert(err.message || 'Failed to delete organization.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      header: 'Organization',
      accessor: 'name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <span>{row.name}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {row.code}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {row.email}
            </span>
            {row.website && (
              <a
                href={row.website}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                <Globe className="w-3 h-3" />
                Visit
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Departments',
      accessor: (row) => `${row.stats?.departmentsCount || 0} depts`,
      className: 'text-center',
      cellClassName: 'text-center text-slate-600 font-medium',
    },
    {
      header: 'Headcount',
      accessor: (row) => `${row.stats?.employeesCount || 0} employees`,
      className: 'text-center',
      cellClassName: 'text-center text-slate-600 font-medium',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <Badge>{row.status}</Badge>,
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Can permission="org:write">
            <Button
              variant="ghost"
              size="sm"
              icon={Edit2}
              onClick={() => handleOpenEdit(row)}
              className="text-slate-600 hover:text-indigo-600"
            >
              Edit
            </Button>
          </Can>
          <Can permission="org:delete">
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => setDeleteTarget(row)}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              Delete
            </Button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Organizations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage corporate entities, enterprise subsidiaries, and organizational hierarchy.
          </p>
        </div>

        <Can permission="org:write">
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Add Organization
          </Button>
        </Can>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by name, code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="w-full sm:w-48">
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

      {/* Reusable Data Table */}
      <DataTable
        columns={columns}
        data={orgs}
        isLoading={loading}
        error={error}
        emptyTitle="No organizations found"
        emptyDescription="Try adjusting your search filters or register a new organization."
      />

      {/* Add/Edit Organization Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingOrg ? `Edit ${editingOrg.name}` : 'Create Organization'}
        subtitle={
          editingOrg
            ? 'Update corporate information and operational details.'
            : 'Register a new enterprise entity into the HRMS ecosystem.'
        }
      >
        {formApiError && (
          <Alert
            type="error"
            title="Operation Failed"
            message={formApiError.message}
            errors={formApiError.errors}
            onClose={() => setFormApiError(null)}
            className="mb-5"
          />
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Organization Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Acme Corp Technologies"
              error={formErrors.name}
              required
            />
            <Input
              label="Organization Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. ACME"
              error={formErrors.code}
              disabled={!!editingOrg}
              helperText={editingOrg ? 'Unique identifier cannot be modified.' : '2-10 characters'}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Official Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@acme.com"
              error={formErrors.email}
              required
            />
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Website URL"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://acme.example.com"
            />
            <Select
              label="Operational Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              placeholder=""
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <Input
            label="Corporate Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Business Avenue, Suite 100, City, Country"
          />

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
              {editingOrg ? 'Save Changes' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Organization"
        message={`Are you sure you want to delete '${deleteTarget?.name}'? All related departments and employee associations will be affected.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
