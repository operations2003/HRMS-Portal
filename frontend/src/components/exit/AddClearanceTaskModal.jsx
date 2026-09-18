import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const AddClearanceTaskModal = ({ isOpen, onClose, onSuccess, exitRequestId }) => {
  const toast = useToast();

  const [formData, setFormData] = useState({
    taskTitle: '',
    departmentScope: 'IT',
    checklistCategory: 'IT_ACCESS',
    description: '',
    recoveryAmount: 0,
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.taskTitle.trim() || formData.taskTitle.trim().length < 3) {
      setError('Task title must be at least 3 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await exitService.createClearanceTask(exitRequestId, {
        ...formData,
        recoveryAmount: parseFloat(formData.recoveryAmount) || 0,
      });
      toast.success('Clearance task added successfully.');
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create clearance task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Custom Clearance Task"
      subtitle="Define an ad-hoc departmental sign-off or asset return item"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Task Title"
          value={formData.taskTitle}
          onChange={(e) => setFormData({ ...formData, taskTitle: e.target.value })}
          placeholder="e.g., Return Specialized Lab Equipment..."
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Department Scope"
            value={formData.departmentScope}
            onChange={(e) => setFormData({ ...formData, departmentScope: e.target.value })}
            options={[
              { value: 'IT', label: 'IT Department' },
              { value: 'FINANCE', label: 'Finance & Payroll' },
              { value: 'ADMIN', label: 'Facilities & Admin' },
              { value: 'MANAGER', label: 'Reporting Manager' },
              { value: 'HR', label: 'Human Resources' },
              { value: 'OPERATIONS', label: 'Operations' },
              { value: 'LEGAL', label: 'Legal & Compliance' },
            ]}
          />

          <Select
            label="Task Category"
            value={formData.checklistCategory}
            onChange={(e) => setFormData({ ...formData, checklistCategory: e.target.value })}
            options={[
              { value: 'IT_ACCESS', label: 'IT Access & Credentials' },
              { value: 'ASSETS_RETURNED', label: 'Hardware & Asset Return' },
              { value: 'FINANCE_PAYROLL', label: 'Expense & Advance Settlement' },
              { value: 'MANAGER_HANDOVER', label: 'Manager Project Handover' },
              { value: 'KNOWLEDGE_TRANSFER', label: 'Knowledge Transfer & KT' },
              { value: 'DOCUMENTS', label: 'Legal & NDAs' },
              { value: 'HR_CLEARANCE', label: 'HR Exit Formalities' },
              { value: 'GENERAL', label: 'General Task' },
            ]}
          />
        </div>

        <Input
          label="Preliminary Recovery Amount ($)"
          type="number"
          min="0"
          step="0.01"
          value={formData.recoveryAmount}
          onChange={(e) => setFormData({ ...formData, recoveryAmount: e.target.value })}
          helperText="Estimated damage or lost hardware deduction if not cleared"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Task Description / Instructions</label>
          <textarea
            rows="2"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder="Specify items, asset serials, or deliverable links..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Plus} isLoading={isSubmitting}>
            Add Clearance Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
