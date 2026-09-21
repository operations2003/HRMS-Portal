import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldCheck, User, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { teamService } from '../../services/teamService.js';
import { employeeService } from '../../services/employeeService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const AssignManagerModal = ({ isOpen, onClose, onSuccess, employee }) => {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedHrId, setSelectedHrId] = useState('');
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && employee) {
      loadHierarchyOptions();
      setSelectedManagerId(employee.managerId || employee.manager?.id || employee.manager_id || '');
      setSelectedHrId(employee.hrId || employee.hr?.id || employee.hr_id || '');
      setError(null);
    }
  }, [isOpen, employee]);

  const loadHierarchyOptions = async () => {
    try {
      setIsLoadingMetadata(true);
      const meta = await employeeService.getMetadata();
      const emps = meta.managers || [];
      // Filter out target employee to prevent self-assignment
      const filtered = emps.filter((m) => m.id !== employee?.id);
      setCandidates(filtered);
    } catch (err) {
      toast.error('Failed to load eligible hierarchy personnel.');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (selectedManagerId && selectedManagerId === employee?.id) {
      setError('An employee cannot be their own reporting manager.');
      return;
    }

    if (selectedHrId && selectedHrId === employee?.id) {
      setError('An employee cannot be their own assigned HR partner.');
      return;
    }

    try {
      setIsSubmitting(true);
      await teamService.assignManager({
        employeeId: employee.id,
        managerId: selectedManagerId || null,
        hrId: selectedHrId || null,
      });
      toast.success(`Reporting hierarchy successfully updated for ${employee.firstName || 'employee'}!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reassign reporting hierarchy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  const empName =
    employee.fullName ||
    `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
    'Employee';

  // Extract HR-qualified staff or allow all staff
  const hrCandidates = candidates.filter((c) => {
    const role = (c.roleName || '').toLowerCase();
    const desig = (c.designationTitle || '').toLowerCase();
    const dept = (c.departmentName || '').toLowerCase();
    return role.includes('hr') || desig.includes('hr') || dept.includes('human resource') || dept.includes('hr');
  });

  const finalHrList = hrCandidates.length > 0 ? hrCandidates : candidates;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Reporting Manager & HR Partner"
      subtitle={`Configure supervisory and HR governance hierarchy for ${empName}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {error && <Alert variant="error" message={error} />}

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-1.5">
          <div className="flex justify-between items-center text-slate-600">
            <span>Employee:</span>
            <span className="font-bold text-slate-900 text-sm">{empName}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Employee Code:</span>
            <span className="font-mono font-medium text-slate-800">{employee.employeeCode || employee.id?.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Department & Role:</span>
            <span className="font-medium text-slate-800">
              {employee.department?.name || 'Department'} &bull; {employee.designation?.title || employee.designation?.name || 'Staff'}
            </span>
          </div>
        </div>

        {/* Reporting Manager Select */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-brand-600" />
            Reporting Manager
          </label>
          <select
            value={selectedManagerId}
            onChange={(e) => setSelectedManagerId(e.target.value)}
            disabled={isLoadingMetadata}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium text-sm"
          >
            <option value="">No Direct Manager (Direct to Organization)</option>
            {candidates.map((m) => {
              const name = m.fullName || `${m.firstName || ''} ${m.lastName || ''}`.trim();
              return (
                <option key={m.id} value={m.id}>
                  {name} ({m.employeeCode || m.id?.slice(0, 7)}) {m.designationTitle ? `— ${m.designationTitle}` : ''}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-slate-500">
            Direct manager conducts reviews, approves leaves & regularizations, and oversees daily attendance.
          </p>
        </div>

        {/* Assigned HR Partner Select */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Assigned HR Partner (HRBP)
          </label>
          <select
            value={selectedHrId}
            onChange={(e) => setSelectedHrId(e.target.value)}
            disabled={isLoadingMetadata}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-sm"
          >
            <option value="">No Assigned HR (General HR Pool)</option>
            {finalHrList.map((h) => {
              const name = h.fullName || `${h.firstName || ''} ${h.lastName || ''}`.trim();
              return (
                <option key={h.id} value={h.id}>
                  {name} ({h.employeeCode || h.id?.slice(0, 7)}) {h.roleName ? `[${h.roleName}]` : ''}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-slate-500">
            Assigned HR oversees compliance, grievances, onboarding, offboarding, and personnel records.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Check}
            isLoading={isSubmitting}
          >
            Save Hierarchy
          </Button>
        </div>
      </form>
    </Modal>
  );
};
