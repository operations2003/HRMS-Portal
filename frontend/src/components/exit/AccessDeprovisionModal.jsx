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
      const res = await employeeService.listEmployees({ status: 'Active' });
      const empList = res.items || (Array.isArray(res) ? res : []);
      // Filter out the exiting employee
      const filtered = empList.filter((e) => e.id !== record?.employeeId);
      setManagers(filtered);
    } catch {
      // Fallback
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
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await exitService.removeAccess(record.id, {
        reassignManagerId: selectedManagerId || undefined,
        comments: comments.trim() || 'System credentials revoked during exit offboarding.',
      });

      toast.success(`Access for ${empName} revoked. Profile marked as Exited.`);
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
      subtitle="Finalize account deactivation, credential revocation, and team reassignment"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleDeprovision} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Security Gate Caution</p>
            <p className="leading-relaxed">
              This action immediately terminates all portal sessions, deactivates login credentials, marks the
              employee profile as <span className="font-bold text-rose-900">Exited</span>, and logs an immutable
              deprovisioning audit.
            </p>
          </div>
        </div>

        <Select
          label="Reassign Direct Reports (If Departing is a Manager)"
          value={selectedManagerId}
          onChange={(e) => setSelectedManagerId(e.target.value)}
          options={[
            { value: '', label: 'Select Interim Manager (Optional)' },
            ...managers.map((m) => ({
              value: m.id,
              label: `${m.fullName || `${m.firstName} ${m.lastName}`} (${m.empCode || m.designation || 'Staff'})`,
            })),
          ]}
          helperText="Any team members reporting to this employee will be transferred to the selected manager"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deprovisioning Rationale / Notes</label>
          <textarea
            rows="3"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            placeholder="Document confirmation of asset receipt, email archiving, and security token invalidation..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" icon={UserX} isLoading={isSubmitting}>
            Confirm & Revoke Access
          </Button>
        </div>
      </form>
    </Modal>
  );
};
