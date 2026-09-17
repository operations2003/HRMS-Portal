import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldAlert, User, Check } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { teamService } from '../../services/teamService.js';
import { employeeService } from '../../services/employeeService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const AssignManagerModal = ({ isOpen, onClose, onSuccess, employee }) => {
  const toast = useToast();
  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && employee) {
      loadManagers();
      setSelectedManagerId(employee.managerId || employee.manager_id || '');
      setError(null);
    }
  }, [isOpen, employee]);

  const loadManagers = async () => {
    try {
      setIsLoadingManagers(true);
      const res = await employeeService.getAllEmployees({ limit: 100 });
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      // Filter out self to avoid cyclical hierarchy
      const filtered = list.filter((m) => m.id !== employee?.id);
      setManagers(filtered);
    } catch (err) {
      toast.error('Failed to load eligible managers list.');
    } finally {
      setIsLoadingManagers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedManagerId) {
      setError('Please select a manager to assign.');
      return;
    }

    if (selectedManagerId === employee?.id) {
      setError('An employee cannot be their own reporting manager.');
      return;
    }

    try {
      setIsSubmitting(true);
      await teamService.assignManager({
        employeeId: employee.id,
        managerId: selectedManagerId,
      });
      toast.success(`Reporting manager successfully updated for ${employee.firstName || 'employee'}!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reassign reporting manager.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  const empName =
    employee.fullName ||
    `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
    'Employee';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Reporting Manager"
      subtitle={`Configure reporting hierarchy for ${empName}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {error && <Alert variant="error" message={error} />}

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Employee:</span>
            <span className="font-semibold text-slate-800">{empName}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Department:</span>
            <span className="font-medium text-slate-800">{employee.department?.name || 'Assigned Dept'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Select Reporting Manager <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedManagerId}
            onChange={(e) => setSelectedManagerId(e.target.value)}
            disabled={isLoadingManagers}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
          >
            <option value="">Choose reporting manager...</option>
            {managers.map((m) => {
              const name =
                m.fullName || `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim();
              return (
                <option key={m.id} value={m.id}>
                  {name} ({m.designation?.name || m.department?.name || 'Staff'})
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={UserCheck}
            isLoading={isSubmitting}
          >
            Confirm Assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
