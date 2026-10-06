import React, { useState, useEffect } from 'react';
import { UserX, ShieldAlert, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { employeeService } from '../../services/employeeService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const AccessDeprovisionModal = ({ isOpen, onClose, onSuccess, record }) => {
  const toast = useToast();

  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadManagers();
    }
  }, [isOpen]);

  const loadManagers = async () => {
    try {
      const res = await employeeService.getAllEmployees({ status: 'Active' });
      const empList = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.employees)
        ? res.employees
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      // Filter out the exiting employee
      const departingId = record?.employeeId || record?.employee?.id;
      const filtered = empList.filter((e) => e.id !== departingId && e.employeeCode !== record?.employeeCode);
      setManagers(filtered);
    } catch (err) {
      console.warn('Failed to load active employees for manager reassignment:', err);
    }
  };

  if (!record) return null;

  const empName =
    record.employee?.fullName ||
    `${record.employee?.firstName || ''} ${record.employee?.lastName || ''}`.trim() ||
    record.employeeName ||
    'Employee';

  const handleDeprovision = async (e) => {
    e.preventDefault();
    const targetExitId = record.id || record.exitRequestId;
    if (!targetExitId) {
      setError('Invalid exit record reference. Please refresh and try again.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await exitService.removeAccess(targetExitId, {
        reassignManagerId: selectedManagerId || undefined,
        comments: comments.trim() || 'System credentials permanently deleted during exit offboarding.',
      });

      toast.success(`Access revoked and credentials for ${empName} permanently deleted.`);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to execute access deprovisioning.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Revoke Access & Deprovision — ${empName}`}
      subtitle="Permanent credential deletion, user account removal, and team reassignment"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleDeprovision} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Security Gate Caution</p>
            <p className="leading-relaxed">
              This action immediately terminates all active portal sessions, permanently deletes login credentials
              and user accounts from the system and database, marks the employee profile as{' '}
              <span className="font-bold text-rose-900">Exited</span>, and logs an immutable deprovisioning audit.
            </p>
          </div>
        </div>

        <Select
          label="Reassign Direct Reports (If Departing is a Manager)"
          value={selectedManagerId}
          onChange={(e) => setSelectedManagerId(e.target.value)}
          placeholder="Select an option"
          options={[
            { value: '', label: 'None / No Direct Reports to Reassign (Optional)' },
            ...managers.map((m) => {
              const desigStr =
                (typeof m.designation === 'object' ? m.designation?.title || m.designation?.name : m.designation) ||
                (typeof m.department === 'object' ? m.department?.name : m.department) ||
                'Staff';
              const nameStr = `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.fullName || 'Employee';
              const codeStr = m.employeeCode || m.empCode || '';
              return {
                value: m.id,
                label: `${nameStr} (${codeStr ? `${codeStr} • ` : ''}${desigStr})`,
              };
            }),
          ]}
          helperText="Any team members reporting to this employee will be transferred to the selected manager"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deprovisioning Rationale / Notes</label>
          <textarea
            rows="3"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            placeholder="Document confirmation of credential purge, asset receipt, and security token invalidation..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" icon={UserX} isLoading={isSubmitting}>
            Revoke Access & Delete Credentials
          </Button>
        </div>
      </form>
    </Modal>
  );
};
