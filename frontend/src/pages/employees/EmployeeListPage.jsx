import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { employeeService } from '../../services/employeeService.js';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  DollarSign,
  Lock,
  X,
} from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Can } from '../../components/rbac/Can.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const EmployeeListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [metadata, setMetadata] = useState({ organizations: [], departments: [], designations: [] });
  const [error, setError] = useState(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [loadingViewProfile, setLoadingViewProfile] = useState(false);

  const [formData, setFormData] = useState({
    orgId: '',
    deptId: '',
    desigId: '',
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfJoining: '',
    employmentType: 'Full-Time',
    status: 'Active',
    salary: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formApiError, setFormApiError] = useState(null);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEmployees = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await employeeService.listEmployees({
        search,
        orgId: orgFilter,
        deptId: deptFilter,
        status: statusFilter,
        page,
        limit: 10,
      });
      setEmployees(res.employees);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const meta = await employeeService.getMetadata();
      setMetadata(meta);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchEmployees(1);
  }, [search, orgFilter, deptFilter, statusFilter]);

  // Handle URL action (e.g. ?action=new)
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleOpenCreate();
      setSearchParams({});
    }
  }, [searchParams]);

  const handleOpenView = async (emp) => {
    setViewingEmployee(emp);
    try {
      setLoadingViewProfile(true);
      const full = await employeeService.getEmployeeById(emp.id);
      setViewingEmployee(full);
    } catch (err) {
      console.warn('Using cached employee row:', err);
    } finally {
      setLoadingViewProfile(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData({
      orgId: metadata.organizations[0]?.id || '',
      deptId: metadata.departments[0]?.id || '',
      desigId: metadata.designations[0]?.id || '',
      employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      employmentType: 'Full-Time',
      status: 'Active',
      salary: '85000',
    });
    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      orgId: emp.orgId || '',
      deptId: emp.deptId || '',
      desigId: emp.desigId || '',
      employeeCode: emp.employeeCode || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      dateOfJoining: emp.dateOfJoining || '',
      employmentType: emp.employmentType || 'Full-Time',
      status: emp.status || 'Active',
      salary: emp.salary?.toString() || '',
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
      errs.email = 'Work email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!formData.orgId) errs.orgId = 'Organization selection is required.';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormApiError(null);

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      if (editingEmployee) {
        await employeeService.updateEmployee(editingEmployee.id, formData);
        toast.success(`Profile for '${formData.firstName} ${formData.lastName}' updated successfully.`);
      } else {
        await employeeService.createEmployee(formData);
        toast.success(`Employee '${formData.firstName} ${formData.lastName}' registered successfully.`);
      }
      setIsFormOpen(false);
      await fetchEmployees(pagination?.page || 1);
    } catch (err) {
      setFormApiError({
        message: err.message || 'Failed to save employee profile.',
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
      await employeeService.deleteEmployee(deleteTarget.id);
      toast.success(`Employee record for '${deleteTarget.firstName} ${deleteTarget.lastName}' deactivated.`);
      setDeleteTarget(null);
      await fetchEmployees(pagination?.page || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to delete employee.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setOrgFilter('');
    setDeptFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = Boolean(search || orgFilter || deptFilter || statusFilter);

  // Determine if logged in user has salary view privilege
  const canViewSalary = (emp) => {
    if (!emp) return false;
    if (['Admin', 'SuperAdmin', 'OrgAdmin', 'HR', 'HRManager'].includes(user?.roleName)) {
      return true;
    }
    return user?.email === emp.email;
  };

  const columns = [
    {
      header: 'Employee',
      accessor: 'firstName',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
            {row.firstName?.[0]}
            {row.lastName?.[0]}
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span>
                {row.firstName} {row.lastName}
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {row.employeeCode}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Organization',
      accessor: (row) => row.organization?.name || '—',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.organization?.name || '—'}
        </span>
      ),
    },
    {
      header: 'Department',
      accessor: (row) => row.department?.name || 'Unassigned',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.department?.name || 'Unassigned'}</div>
          <div className="text-xs text-slate-400">{row.designation?.title || 'Staff'}</div>
        </div>
      ),
    },
    {
      header: 'Employment',
      accessor: 'employmentType',
      render: (row) => (
        <div>
          <div className="text-xs font-medium text-slate-700">{row.employmentType}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            Joined {row.dateOfJoining || '—'}
          </div>
        </div>
      ),
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
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={() => handleOpenView(row)}
            className="text-slate-600 hover:text-indigo-600"
            title="View Details"
          >
            View
          </Button>
          <Can permission="employee:write">
            <Button
              variant="ghost"
              size="sm"
              icon={Edit2}
              onClick={() => handleOpenEdit(row)}
              className="text-slate-600 hover:text-indigo-600"
              title="Edit Profile"
            >
              Edit
            </Button>
          </Can>
          <Can permission="employee:delete">
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => setDeleteTarget(row)}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              title="Deactivate/Delete"
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
            <Users className="w-6 h-6 text-indigo-600" />
            Employees Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, manage, and maintain centralized employment and department records.
          </p>
        </div>

        <Can permission="employee:write">
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Add Employee
          </Button>
        </Can>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Input
              placeholder="Search by name, email, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <div>
            <Select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              placeholder="All Organizations"
              options={[
                { value: '', label: 'All Organizations' },
                ...metadata.organizations.map((o) => ({ value: o.id, label: o.name })),
              ]}
            />
          </div>
          <div>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              placeholder="All Departments"
              options={[
                { value: '', label: 'All Departments' },
                ...metadata.departments.map((d) => ({ value: d.id, label: d.name })),
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
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filtered results active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <X className="w-3.5 h-3.5" />
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Reusable Data Table */}
      <DataTable
        columns={columns}
        data={employees}
        isLoading={loading}
        error={error}
        pagination={pagination}
        onPageChange={(p) => fetchEmployees(p)}
        emptyTitle="No employees found"
        emptyDescription="Try adjusting your department or search filters."
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        maxWidth="max-w-2xl"
        title={editingEmployee ? `Edit ${editingEmployee.firstName} ${editingEmployee.lastName}` : 'Register New Employee'}
        subtitle={
          editingEmployee
            ? 'Update corporate employee parameters and departmental designations.'
            : 'Fill in the form to register an employee under an organization.'
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
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="e.g. Liam"
              error={formErrors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="e.g. Vance"
              error={formErrors.lastName}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Work Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="liam.vance@company.com"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Organization"
              value={formData.orgId}
              onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
              error={formErrors.orgId}
              required
              options={metadata.organizations.map((o) => ({ value: o.id, label: o.name }))}
            />
            <Select
              label="Department"
              value={formData.deptId}
              onChange={(e) => setFormData({ ...formData, deptId: e.target.value })}
              options={metadata.departments.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Select
              label="Designation"
              value={formData.desigId}
              onChange={(e) => setFormData({ ...formData, desigId: e.target.value })}
              options={metadata.designations.map((ds) => ({ value: ds.id, label: ds.title }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Employee Code"
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
              placeholder="EMP-100"
            />
            <Select
              label="Employment Type"
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              options={[
                { value: 'Full-Time', label: 'Full-Time' },
                { value: 'Part-Time', label: 'Part-Time' },
                { value: 'Contract', label: 'Contract' },
                { value: 'Intern', label: 'Intern' },
              ]}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date of Joining"
              type="date"
              value={formData.dateOfJoining}
              onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
            />
            <Input
              label="Annual Salary ($)"
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              placeholder="e.g. 95000"
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
              {editingEmployee ? 'Save Changes' : 'Register Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Employee Detail Modal */}
      <Modal
        isOpen={!!viewingEmployee}
        onClose={() => setViewingEmployee(null)}
        maxWidth="max-w-lg"
        title="Employee Profile"
        subtitle="Detailed employment record and organizational assignment"
      >
        {loadingViewProfile ? (
          <div className="p-8">
            <LoadingSpinner message="Refreshing employee record..." />
          </div>
        ) : viewingEmployee ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {viewingEmployee.firstName?.[0]}
                {viewingEmployee.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {viewingEmployee.firstName} {viewingEmployee.lastName}
                </h3>
                <p className="text-xs text-indigo-600 font-semibold">
                  {viewingEmployee.designation?.title || 'Staff Member'}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{viewingEmployee.status}</Badge>
                  <span className="text-xs text-slate-500 font-medium">
                    Code: {viewingEmployee.employeeCode}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </div>
                <div className="font-medium text-slate-800 break-all">{viewingEmployee.email}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5" />
                  Phone
                </div>
                <div className="font-medium text-slate-800">{viewingEmployee.phone || '—'}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  Organization
                </div>
                <div className="font-medium text-slate-800">
                  {viewingEmployee.organization?.name || 'Default Org'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  Department
                </div>
                <div className="font-medium text-slate-800">
                  {viewingEmployee.department?.name || 'General'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Date of Joining
                </div>
                <div className="font-medium text-slate-800">
                  {viewingEmployee.dateOfJoining || '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Compensation
                </div>
                <div className="font-medium text-slate-800 flex items-center gap-1.5">
                  {canViewSalary(viewingEmployee) ? (
                    viewingEmployee.salary ? (
                      `$${Number(viewingEmployee.salary).toLocaleString()} / yr`
                    ) : (
                      'Not specified'
                    )
                  ) : (
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1 italic">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Confidential
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Can permission="employee:write">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Edit2}
                  onClick={() => {
                    const empToEdit = viewingEmployee;
                    setViewingEmployee(null);
                    handleOpenEdit(empToEdit);
                  }}
                >
                  Edit Profile
                </Button>
              </Can>
              <div className="ml-auto">
                <Button variant="primary" size="sm" onClick={() => setViewingEmployee(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Employee Record"
        message={`Are you sure you want to delete ${deleteTarget?.firstName} ${deleteTarget?.lastName} (${deleteTarget?.employeeCode})? This action removes employee employment records.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
