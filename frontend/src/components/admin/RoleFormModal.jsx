import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const RoleFormModal = ({ isOpen, onClose, onSuccess, initialRole = null, role = null }) => {
  const toast = useToast();
  const activeRole = role || initialRole;
  const isEdit = !!activeRole?.id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Active',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeRole) {
      setFormData({
        name: activeRole.name || '',
        description: activeRole.description || '',
        status: activeRole.status || 'Active',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'Active',
      });
    }
    setError(null);
  }, [activeRole, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setError('Role name must be at least 2 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let res;
      if (isEdit) {
        res = await adminService.updateRole(activeRole.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          status: formData.status,
        });
        toast.success(`Role "${formData.name}" updated successfully.`);
      } else {
        res = await adminService.createRole({
          name: formData.name.trim(),
          description: formData.description.trim(),
          permissions: [],
        });
        toast.success(`Role "${formData.name}" created. You can now configure its permissions.`);
      }

      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Role — ${activeRole?.name}` : 'Create New System Role'}
      subtitle="Define organizational access role and responsibilities"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Role Identifier Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., ComplianceOfficer, PayrollLead..."
          required
        />

        <Select
          label="Role Lifecycle Status"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          options={[
            { value: 'Active', label: 'Active — Can be assigned to users' },
            { value: 'Inactive', label: 'Inactive — Suspended / Disabled' },
          ]}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description & Scope</label>
          <textarea
            rows="3"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder="Explain duties, module access boundaries, and authorization level..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={isEdit ? Edit : Plus} isLoading={isSubmitting}>
            {isEdit ? 'Save Role Changes' : 'Create Role'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
