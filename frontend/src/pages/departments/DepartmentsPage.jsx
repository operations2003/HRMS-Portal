import React, { useEffect, useState } from 'react';
import { employeeService } from '../../services/employeeService.js';
import { departmentService } from '../../services/departmentService.js';
import { designationService } from '../../services/designationService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Briefcase, Award, Building2, Users, Search, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';

export const DepartmentsPage = () => {
  const { hasPermission, hasRole } = useAuth();
  const canManage = hasPermission(['dept:write', 'employee:write']) || hasRole(['Admin', 'SuperAdmin', 'OrgAdmin', 'HRManager', 'HR']);

  const [metadata, setMetadata] = useState({ departments: [], designations: [], organizations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('departments'); // 'departments' | 'designations'
  const [searchTerm, setSearchTerm] = useState('');

  // Add Department Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Add Designation Modal State
  const [isAddDesigModalOpen, setIsAddDesigModalOpen] = useState(false);
  const [desigFormData, setDesigFormData] = useState({ title: '', code: '' });
  const [submittingDesig, setSubmittingDesig] = useState(false);
  const [desigFormError, setDesigFormError] = useState(null);

  // Delete State
  const [departmentToDelete, setDepartmentToDelete] = useState(null);
  const [designationToDelete, setDesignationToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMeta = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.getMetadata();
      setMetadata(data);
    } catch (err) {
      setError(err.message || 'Failed to load organizational units.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({ name: '', code: '', description: '' });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenAddDesigModal = () => {
    setDesigFormData({ title: '', code: '' });
    setDesigFormError(null);
    setIsAddDesigModalOpen(true);
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Department name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await departmentService.createDepartment({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
      });
      setIsAddModalOpen(false);
      setSuccessMessage(`Department "${formData.name.trim()}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchMeta();
    } catch (err) {
      setFormError(err.message || 'Failed to create department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDesignation = async (e) => {
    e.preventDefault();
    if (!desigFormData.title.trim()) {
      setDesigFormError('Designation title is required.');
      return;
    }

    try {
      setSubmittingDesig(true);
      setDesigFormError(null);
      await designationService.createDesignation({
        title: desigFormData.title.trim(),
        code: desigFormData.code.trim().toUpperCase(),
      });
      setIsAddDesigModalOpen(false);
      setSuccessMessage(`Designation "${desigFormData.title.trim()}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchMeta();
    } catch (err) {
      setDesigFormError(err.message || 'Failed to create designation.');
    } finally {
      setSubmittingDesig(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) return;
    try {
      setIsDeleting(true);
      setError(null);
      await departmentService.deleteDepartment(departmentToDelete.id);
      setDepartmentToDelete(null);
      setSuccessMessage(`Department "${departmentToDelete.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchMeta();
    } catch (err) {
      setError(err.message || 'Failed to delete department.');
      setDepartmentToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDesignation = async () => {
    if (!designationToDelete) return;
    try {
      setIsDeleting(true);
      setError(null);
      await designationService.deleteDesignation(designationToDelete.id);
      setDesignationToDelete(null);
      setSuccessMessage(`Designation "${designationToDelete.title}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchMeta();
    } catch (err) {
      setError(err.message || 'Failed to delete designation.');
      setDesignationToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDepartments = metadata.departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDesignations = metadata.designations.filter(
    (ds) =>
      ds.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ds.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deptColumns = [
    {
      header: 'Department',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shadow-sm">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-400 font-mono tracking-wider">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Organization',
      accessor: 'orgId',
      render: (row) => {
        const org = metadata.organizations.find((o) => o.id === row.orgId);
        return org ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{org.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => (
        <span className="text-xs text-slate-600 max-w-md truncate block">
          {row.description || 'Core operational departmental unit.'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: () => <Badge variant="success">Active</Badge>,
    },
    ...(canManage
      ? [
          {
            header: 'Actions',
            accessor: 'actions',
            align: 'right',
            render: (row) => (
              <button
                type="button"
                onClick={() => setDepartmentToDelete(row)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Delete Department"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ),
          },
        ]
      : []),
  ];

  const desigColumns = [
    {
      header: 'Designation Title',
      accessor: 'title',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs shadow-sm">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.title}</div>
            <div className="text-xs text-slate-400 font-mono tracking-wider">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Organization / Scope',
      accessor: 'orgId',
      render: (row) => {
        const org = metadata.organizations.find((o) => o.id === row.orgId);
        return (
          <span className="text-xs font-medium text-slate-700">
            {org?.name || 'Tasknera Global HR Solutions'}
          </span>
        );
      },
    },
    {
      header: 'Classification',
      accessor: 'level',
      render: () => <Badge variant="brand">Standard Staff</Badge>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: () => <Badge variant="success">Active</Badge>,
    },
    ...(canManage
      ? [
          {
            header: 'Actions',
            accessor: 'actions',
            align: 'right',
            render: (row) => (
              <button
                type="button"
                onClick={() => setDesignationToDelete(row)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Delete Designation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand-500" />
            Departments & Designations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational hierarchy, departmental units, and standardized corporate job titles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab switch */}
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('departments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'departments'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Departments ({metadata.departments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('designations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'designations'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Designations ({metadata.designations.length})
            </button>
          </div>

          {/* Admin Add Action */}
          {canManage && activeTab === 'departments' && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenAddModal}
            >
              Add Department
            </Button>
          )}

          {canManage && activeTab === 'designations' && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenAddDesigModal}
            >
              Add Designation
            </Button>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <Input
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={Search}
        />
      </div>

      {/* Table based on active tab */}
      {activeTab === 'departments' ? (
        <DataTable
          columns={deptColumns}
          data={filteredDepartments}
          isLoading={loading}
          error={error}
          emptyTitle="No departments found"
        />
      ) : (
        <DataTable
          columns={desigColumns}
          data={filteredDesignations}
          isLoading={loading}
          error={error}
          emptyTitle="No designations found"
        />
      )}

      {/* Create Department Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Department"
        subtitle="Create a new functional department unit for Tasknera Global HR Solutions."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-4">
          {formError && (
            <Alert variant="danger">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Finance & Accounts"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. FIN (auto-generated if empty)"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Unique uppercase abbreviation for this department (e.g. OPS, HR, IT).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              rows={3}
              placeholder="Brief description of department scope and operations..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={submitting}
              icon={Plus}
            >
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Designation Modal */}
      <Modal
        isOpen={isAddDesigModalOpen}
        onClose={() => setIsAddDesigModalOpen(false)}
        title="Add New Designation"
        subtitle="Define a new standardized corporate role or title."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateDesignation} className="space-y-4">
          {desigFormError && (
            <Alert variant="danger">
              {desigFormError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designation Title <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Operations Team Leader"
              value={desigFormData.title}
              onChange={(e) => setDesigFormData({ ...desigFormData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designation Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. OPS-TL (auto-generated if empty)"
              value={desigFormData.code}
              onChange={(e) => setDesigFormData({ ...desigFormData, code: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsAddDesigModalOpen(false)}
              disabled={submittingDesig}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={submittingDesig}
              icon={Plus}
            >
              Create Designation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Department Dialog */}
      <ConfirmDialog
        isOpen={!!departmentToDelete}
        onClose={() => setDepartmentToDelete(null)}
        onConfirm={handleDeleteDepartment}
        title="Delete Department"
        message={`Are you sure you want to delete "${departmentToDelete?.name}" (${departmentToDelete?.code})? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Confirm Delete Designation Dialog */}
      <ConfirmDialog
        isOpen={!!designationToDelete}
        onClose={() => setDesignationToDelete(null)}
        onConfirm={handleDeleteDesignation}
        title="Delete Designation"
        message={`Are you sure you want to delete "${designationToDelete?.title}" (${designationToDelete?.code})? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
