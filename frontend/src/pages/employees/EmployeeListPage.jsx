import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { employeeService } from '../../services/employeeService.js';
import { designationService } from '../../services/designationService.js';
import { departmentService } from '../../services/departmentService.js';
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
  IndianRupee,
  Lock,
  KeyRound,
  Clock,
  X,
} from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { PasswordInput } from '../../components/common/PasswordInput.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Can } from '../../components/rbac/Can.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { EmployeeTimelineModal } from '../../components/employees/EmployeeTimelineModal.jsx';

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
  const [metadata, setMetadata] = useState({ organizations: [], departments: [], designations: [], roles: [] });
  const [error, setError] = useState(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [loadingViewProfile, setLoadingViewProfile] = useState(false);
  const [timelineEmployee, setTimelineEmployee] = useState(null);

  // Manual Shift Timing State (From & To with AM/PM)
  const [shiftFromTime, setShiftFromTime] = useState('11:00');
  const [shiftFromPeriod, setShiftFromPeriod] = useState('AM');
  const [shiftToTime, setShiftToTime] = useState('07:00');
  const [shiftToPeriod, setShiftToPeriod] = useState('PM');

  const parseShiftTiming = (str) => {
    if (!str) return { fromTime: '11:00', fromPeriod: 'AM', toTime: '07:00', toPeriod: 'PM' };
    const match = str.match(/^(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i);
    if (match) {
      return {
        fromTime: match[1],
        fromPeriod: match[2].toUpperCase(),
        toTime: match[3],
        toPeriod: match[4].toUpperCase(),
      };
    }
    return { fromTime: '11:00', fromPeriod: 'AM', toTime: '07:00', toPeriod: 'PM' };
  };

  // Quick Add Department Modal
  const [isQuickAddDeptOpen, setIsQuickAddDeptOpen] = useState(false);
  const [quickDeptName, setQuickDeptName] = useState('');
  const [quickDeptCode, setQuickDeptCode] = useState('');
  const [quickDeptDescription, setQuickDeptDescription] = useState('');
  const [quickDeptLoading, setQuickDeptLoading] = useState(false);
  const [quickDeptError, setQuickDeptError] = useState(null);

  const handleQuickAddDepartment = async (e) => {
    e.preventDefault();
    if (!quickDeptName.trim()) {
      setQuickDeptError('Department name is required.');
      return;
    }
    try {
      setQuickDeptLoading(true);
      setQuickDeptError(null);
      const res = await departmentService.createDepartment({
        name: quickDeptName.trim(),
        code: quickDeptCode.trim().toUpperCase(),
        description: quickDeptDescription.trim(),
        orgId: formData.orgId || metadata.organizations?.[0]?.id || 'org-1',
      });
      const freshMeta = await employeeService.getMetadata();
      setMetadata(freshMeta);
      const newDeptId =
        res?.id ||
        res?.data?.id ||
        freshMeta.departments?.find(
          (d) => d.name.toLowerCase() === quickDeptName.trim().toLowerCase()
        )?.id;
      if (newDeptId) {
        setFormData((prev) => ({ ...prev, deptId: newDeptId }));
      }
      setIsQuickAddDeptOpen(false);
      setQuickDeptName('');
      setQuickDeptCode('');
      setQuickDeptDescription('');
      toast?.success?.(`Department "${quickDeptName.trim()}" added successfully!`);
    } catch (err) {
      setQuickDeptError(err.message || 'Failed to create department.');
    } finally {
      setQuickDeptLoading(false);
    }
  };

  // Quick Add Designation Modal
  const [isQuickAddDesigOpen, setIsQuickAddDesigOpen] = useState(false);
  const [quickDesigTitle, setQuickDesigTitle] = useState('');
  const [quickDesigCode, setQuickDesigCode] = useState('');
  const [quickDesigLoading, setQuickDesigLoading] = useState(false);
  const [quickDesigError, setQuickDesigError] = useState(null);

  const handleQuickAddDesignation = async (e) => {
    e.preventDefault();
    if (!quickDesigTitle.trim()) {
      setQuickDesigError('Designation title is required.');
      return;
    }
    try {
      setQuickDesigLoading(true);
      setQuickDesigError(null);
      const res = await designationService.createDesignation({
        title: quickDesigTitle.trim(),
        code: quickDesigCode.trim().toUpperCase(),
      });
      const freshMeta = await employeeService.getMetadata();
      setMetadata(freshMeta);
      if (res?.data?.id) {
        setFormData((prev) => ({ ...prev, desigId: res.data.id }));
      }
      setIsQuickAddDesigOpen(false);
      setQuickDesigTitle('');
      setQuickDesigCode('');
      toast?.success?.(`Designation "${quickDesigTitle.trim()}" added successfully!`);
    } catch (err) {
      setQuickDesigError(err.message || 'Failed to create designation.');
    } finally {
      setQuickDesigLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    orgId: '',
    deptId: '',
    desigId: '',
    roleId: '',
    password: '',
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfJoining: '',
    employmentType: 'Full-Time',
    status: 'Active',
    salary: '',
    shiftTiming: '11:00 AM - 07:00 PM',
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
    const defaultRole =
      metadata.roles?.find((r) => r.name.toLowerCase() === 'employee')?.id ||
      metadata.roles?.[0]?.id ||
      'role-employee';
    setFormData({
      orgId: metadata.organizations[0]?.id || '',
      deptId: metadata.departments[0]?.id || '',
      desigId: metadata.designations[0]?.id || '',
      roleId: defaultRole,
      password: '',
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      employmentType: 'Full-Time',
      status: 'Active',
      salary: '',
      shiftTiming: '11:00 AM - 07:00 PM',
    });
    setShiftFromTime('11:00');
    setShiftFromPeriod('AM');
    setShiftToTime('07:00');
    setShiftToPeriod('PM');
    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    const existingRoleId =
      emp.user?.roleId ||
      metadata.roles?.find((r) => r.name.toLowerCase() === 'employee')?.id ||
      'role-employee';
    setFormData({
      orgId: emp.orgId || '',
      deptId: emp.deptId || '',
      desigId: emp.desigId || '',
      roleId: existingRoleId,
      password: '',
      employeeCode: emp.employeeCode || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      dateOfJoining: emp.dateOfJoining || '',
      employmentType: emp.employmentType || 'Full-Time',
      status: emp.status || 'Active',
      salary: emp.salary?.toString() || '',
      shiftTiming: emp.shiftTiming || '11:00 AM - 07:00 PM',
    });
    const parsedShift = parseShiftTiming(emp.shiftTiming || '11:00 AM - 07:00 PM');
    setShiftFromTime(parsedShift.fromTime);
    setShiftFromPeriod(parsedShift.fromPeriod);
    setShiftToTime(parsedShift.toTime);
    setShiftToPeriod(parsedShift.toPeriod);
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

    // Password validation: required when registering new employee, optional on edit
    if (!editingEmployee) {
      if (!formData.password) {
        errs.password = 'Login password is required for portal access.';
      } else if (formData.password.length < 6) {
        errs.password = 'Password must be at least 6 characters.';
      }
    } else {
      if (formData.password && formData.password.length < 6) {
        errs.password = 'New password must be at least 6 characters.';
      }
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
      const computedShift = `${shiftFromTime.trim() || '11:00'} ${shiftFromPeriod} - ${shiftToTime.trim() || '07:00'} ${shiftToPeriod}`;
      const payload = {
        ...formData,
        shiftTiming: computedShift,
      };

      if (editingEmployee) {
        await employeeService.updateEmployee(editingEmployee.id, payload);
        toast.success(`Profile for '${formData.firstName} ${formData.lastName}' updated successfully.`);
      } else {
        await employeeService.createEmployee(payload);
        toast.success(`Employee '${formData.firstName} ${formData.lastName}' registered successfully with portal credentials.`);
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
    if (['Admin', 'HR', 'Manager'].includes(user?.roleName)) {
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
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
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
              {row.user?.roleName && (
                <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 flex items-center gap-1">
                  <KeyRound className="w-2.5 h-2.5" />
                  {row.user.roleName}
                </span>
              )}
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
          <div className="text-[11px] text-brand-700 flex items-center gap-1 mt-0.5 font-medium">
            <Clock className="w-3 h-3 text-brand-500" />
            {row.shiftTiming || '11:00 AM - 07:00 PM'}
          </div>
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
            className="text-slate-600 hover:text-brand-600"
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
              className="text-slate-600 hover:text-brand-600"
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
            <Users className="w-6 h-6 text-brand-500" />
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
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium"
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
              placeholder="First name"
              error={formErrors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Last name"
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
              placeholder="name@company.com"
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

          {/* Portal Login Credentials Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {editingEmployee ? 'Portal Access & Credentials' : 'Login Credentials (Required for Portal Access)'}
                </h4>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                  editingEmployee
                    ? 'text-slate-600 bg-white border-slate-200'
                    : 'text-brand-700 bg-brand-50 border-brand-200 font-semibold'
                }`}
              >
                {editingEmployee ? 'Optional Reset' : 'Required'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {editingEmployee
                ? 'Leave password empty to preserve current credentials, or enter a new password to reset employee login access.'
                : 'Set the initial password for this employee. They and authorized administrators will log in using this work email and password.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <PasswordInput
                label={editingEmployee ? 'Reset Password' : 'Login Password'}
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingEmployee ? 'Leave empty to keep unchanged' : 'Min. 6 characters'}
                error={formErrors.password}
                required={!editingEmployee}
                helperText={!editingEmployee ? 'Minimum 6 characters' : undefined}
              />
              <Select
                label="System Role"
                value={formData.roleId || ''}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                options={
                  metadata.roles?.length
                    ? metadata.roles.map((r) => ({ value: r.id, label: r.name }))
                    : [
                        { value: 'role-employee', label: 'Employee' },
                        { value: 'role-manager', label: 'Manager' },
                        { value: 'role-hr', label: 'HR' },
                        { value: 'role-admin', label: 'Admin' },
                      ]
                }
                helperText="Determines permissions when logging into the HRMS portal"
              />
            </div>
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
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Department
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickDeptName('');
                    setQuickDeptCode('');
                    setQuickDeptDescription('');
                    setQuickDeptError(null);
                    setIsQuickAddDeptOpen(true);
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add More
                </button>
              </div>
              <select
                value={formData.deptId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setQuickDeptName('');
                    setQuickDeptCode('');
                    setQuickDeptDescription('');
                    setQuickDeptError(null);
                    setIsQuickAddDeptOpen(true);
                  } else {
                    setFormData({ ...formData, deptId: e.target.value });
                  }
                }}
                className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              >
                <option value="" disabled>
                  Select an option
                </option>
                {metadata.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="__add_new__" className="font-semibold text-brand-600 bg-brand-50">
                  + Add more department...
                </option>
              </select>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Designation
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickDesigTitle('');
                    setQuickDesigCode('');
                    setQuickDesigError(null);
                    setIsQuickAddDesigOpen(true);
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add More
                </button>
              </div>
              <select
                value={formData.desigId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setQuickDesigTitle('');
                    setQuickDesigCode('');
                    setQuickDesigError(null);
                    setIsQuickAddDesigOpen(true);
                  } else {
                    setFormData({ ...formData, desigId: e.target.value });
                  }
                }}
                className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              >
                <option value="" disabled>
                  Select an option
                </option>
                {metadata.designations.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.title}
                  </option>
                ))}
                <option value="__add_new__" className="font-semibold text-brand-600 bg-brand-50">
                  + Add more designation...
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Employee Code"
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
              placeholder="e.g. EMP-001"
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
              label="Annual Salary (₹)"
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              placeholder="e.g. 1200000"
            />
          </div>

          {/* Work Shift & Time Slot Segment */}
          <div className="p-4 rounded-2xl bg-brand-50/40 border border-brand-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Assigned Work Shift & Time Slot
                </span>
              </div>
              <span className="text-[11px] text-brand-700 bg-brand-100/80 border border-brand-200/60 px-2.5 py-0.5 rounded-full font-bold">
                {shiftFromTime || '--:--'} {shiftFromPeriod} – {shiftToTime || '--:--'} {shiftToPeriod}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* From Time Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  From (Start Time)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={shiftFromTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShiftFromTime(val);
                        setFormData((prev) => ({
                          ...prev,
                          shiftTiming: `${val.trim()} ${shiftFromPeriod} - ${shiftToTime.trim()} ${shiftToPeriod}`,
                        }));
                      }}
                      placeholder="e.g. 11:00"
                      className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                      required
                    />
                  </div>
                  <select
                    value={shiftFromPeriod}
                    onChange={(e) => {
                      const period = e.target.value;
                      setShiftFromPeriod(period);
                      setFormData((prev) => ({
                        ...prev,
                        shiftTiming: `${shiftFromTime.trim()} ${period} - ${shiftToTime.trim()} ${shiftToPeriod}`,
                      }));
                    }}
                    className="rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 font-bold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              {/* To Time Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  To (End Time)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={shiftToTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShiftToTime(val);
                        setFormData((prev) => ({
                          ...prev,
                          shiftTiming: `${shiftFromTime.trim()} ${shiftFromPeriod} - ${val.trim()} ${shiftToPeriod}`,
                        }));
                      }}
                      placeholder="e.g. 07:00"
                      className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                      required
                    />
                  </div>
                  <select
                    value={shiftToPeriod}
                    onChange={(e) => {
                      const period = e.target.value;
                      setShiftToPeriod(period);
                      setFormData((prev) => ({
                        ...prev,
                        shiftTiming: `${shiftFromTime.trim()} ${shiftFromPeriod} - ${shiftToTime.trim()} ${period}`,
                      }));
                    }}
                    className="rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 font-bold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Type the exact working hours manually. Active shift displays on employee's clock in/out timer.
            </p>
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

      {/* Quick Add Department Modal */}
      <Modal
        isOpen={isQuickAddDeptOpen}
        onClose={() => setIsQuickAddDeptOpen(false)}
        title="Add New Department"
        subtitle="Quickly define a new corporate department or business division."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickAddDepartment} className="space-y-4">
          {quickDeptError && (
            <Alert variant="danger">
              {quickDeptError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Finance & Accounting"
              value={quickDeptName}
              onChange={(e) => setQuickDeptName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. FIN (auto-generated if empty)"
              value={quickDeptCode}
              onChange={(e) => setQuickDeptCode(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="Brief description of department scope..."
              value={quickDeptDescription}
              onChange={(e) => setQuickDeptDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsQuickAddDeptOpen(false)}
              disabled={quickDeptLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={quickDeptLoading}
              icon={Plus}
            >
              Add Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Designation Modal */}
      <Modal
        isOpen={isQuickAddDesigOpen}
        onClose={() => setIsQuickAddDesigOpen(false)}
        title="Add New Designation"
        subtitle="Quickly define a new corporate title or job role."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickAddDesignation} className="space-y-4">
          {quickDesigError && (
            <Alert variant="danger">
              {quickDesigError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designation Title <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Operations Team Leader"
              value={quickDesigTitle}
              onChange={(e) => setQuickDesigTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designation Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. OPS-TL (auto-generated if empty)"
              value={quickDesigCode}
              onChange={(e) => setQuickDesigCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsQuickAddDesigOpen(false)}
              disabled={quickDesigLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={quickDesigLoading}
              icon={Plus}
            >
              Add Designation
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
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-brand-50/50 border border-brand-100">
              <div className="w-14 h-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {viewingEmployee.firstName?.[0]}
                {viewingEmployee.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {viewingEmployee.firstName} {viewingEmployee.lastName}
                </h3>
                <p className="text-xs text-brand-600 font-semibold">
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
                  <IndianRupee className="w-3.5 h-3.5" />
                  Compensation
                </div>
                <div className="font-medium text-slate-800 flex items-center gap-1.5">
                  {canViewSalary(viewingEmployee) ? (
                    viewingEmployee.salary ? (
                      `₹${Number(viewingEmployee.salary).toLocaleString('en-IN')} / yr`
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

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-brand-600" />
                  Assigned Work Shift & Time Slot
                </div>
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>{viewingEmployee.shiftTiming || '11:00 AM - 07:00 PM'}</span>
                  <span className="text-[11px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded font-medium border border-brand-100">
                    Timer Schedule
                  </span>
                </div>
              </div>

              {/* Portal Account Status Card */}
              <div className="p-3.5 rounded-xl bg-brand-50/60 border border-brand-100/80 flex items-center justify-between col-span-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center shadow-xs">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Portal Login Account</div>
                    <div className="text-xs text-slate-500">
                      {viewingEmployee.user
                        ? `Linked User Account • Role: ${viewingEmployee.user.roleName || 'Employee'}`
                        : 'No linked portal account'}
                    </div>
                  </div>
                </div>
                <Badge variant={viewingEmployee.user ? 'success' : 'neutral'}>
                  {viewingEmployee.user ? 'Login Active' : 'No Account'}
                </Badge>
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
              <Button
                variant="neutral"
                size="sm"
                icon={Clock}
                onClick={() => {
                  setTimelineEmployee(viewingEmployee);
                }}
              >
                Lifecycle Timeline
              </Button>
              <div className="ml-auto">
                <Button variant="primary" size="sm" onClick={() => setViewingEmployee(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Employee Lifecycle Timeline Modal */}
      <EmployeeTimelineModal
        isOpen={!!timelineEmployee}
        onClose={() => setTimelineEmployee(null)}
        employeeId={timelineEmployee?.id}
        employeeName={`${timelineEmployee?.firstName || ''} ${timelineEmployee?.lastName || ''}`}
      />

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
