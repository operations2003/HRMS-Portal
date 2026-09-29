import React, { useState, useEffect, useMemo } from 'react';
import {
  UserX,
  AlertTriangle,
  Calendar,
  DollarSign,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Badge } from '../common/Badge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { employeeService } from '../../services/employeeService.js';
import { exitService } from '../../services/exitService.js';

const TERMINATION_CATEGORIES = [
  { value: 'PERFORMANCE', label: 'Performance / Probation Unsatisfactory' },
  { value: 'MISCONDUCT', label: 'Gross Misconduct / Behavioral Violation' },
  { value: 'RESTRUCTURING', label: 'Company Restructuring / Role Redundancy' },
  { value: 'POLICY_VIOLATION', label: 'Policy, Safety or Compliance Breach' },
  { value: 'ABSCONDING', label: 'Prolonged Unauthorized Absence (Absconding)' },
  { value: 'MUTUAL_SEPARATION', label: 'Mutual Separation Agreement' },
  { value: 'CONTRACT_EXPIRY', label: 'Contract Expiry / Project End' },
  { value: 'OTHER', label: 'Other Justified Administrative Cause' },
];

export const InitiateTerminationModal = ({ isOpen, onClose, onSuccess, preselectedEmployee = null }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [activeEmployees, setActiveEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState(preselectedEmployee?.id || '');

  // Form states
  const [terminationCategory, setTerminationCategory] = useState('PERFORMANCE');
  const [timelineMode, setTimelineMode] = useState('IMMEDIATE'); // 'IMMEDIATE' | 'NOTICE'
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [noticePeriodDays, setNoticePeriodDays] = useState(0);
  const [severanceAmount, setSeveranceAmount] = useState('');
  const [rehireEligible, setRehireEligible] = useState(false);
  const [revokeAccessImmediately, setRevokeAccessImmediately] = useState(true);
  const [reason, setReason] = useState('');
  const [hrNotes, setHrNotes] = useState('');
  const [confirmedAuth, setConfirmedAuth] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load active employees when modal opens
  useEffect(() => {
    if (isOpen) {
      loadActiveEmployees();
      if (preselectedEmployee?.id) {
        setSelectedEmpId(preselectedEmployee.id);
      }
    } else {
      // Reset form on close
      setError(null);
      setConfirmedAuth(false);
      setReason('');
      setHrNotes('');
      setSeveranceAmount('');
      setTimelineMode('IMMEDIATE');
      setNoticePeriodDays(0);
      setEffectiveDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, preselectedEmployee]);

  const loadActiveEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      const res = await employeeService.getAllEmployees({ status: 'Active' });
      const list = res.employees || res.items || (Array.isArray(res) ? res : []);
      // Filter out self
      const filtered = list.filter((e) => e.userId !== user?.id && e.id !== user?.employeeId);
      setActiveEmployees(filtered);
    } catch (err) {
      console.error('Failed to load active employees:', err);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const selectedEmployee = useMemo(() => {
    if (!selectedEmpId) return null;
    return activeEmployees.find((e) => e.id === selectedEmpId) || preselectedEmployee;
  }, [selectedEmpId, activeEmployees, preselectedEmployee]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return activeEmployees.slice(0, 50);
    const q = employeeSearch.toLowerCase();
    return activeEmployees
      .filter((e) => {
        const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
        const code = (e.employeeCode || e.empCode || '').toLowerCase();
        const dept = (e.department?.name || e.department?.title || e.departmentName || '').toLowerCase();
        return name.includes(q) || code.includes(q) || dept.includes(q);
      })
      .slice(0, 50);
  }, [activeEmployees, employeeSearch]);

  const handleTimelineChange = (mode) => {
    setTimelineMode(mode);
    if (mode === 'IMMEDIATE') {
      setNoticePeriodDays(0);
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setRevokeAccessImmediately(true);
    } else {
      setNoticePeriodDays(30);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);
      setEffectiveDate(targetDate.toISOString().split('T')[0]);
      setRevokeAccessImmediately(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedEmpId) {
      setError('Please select an employee to terminate.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A comprehensive justification statement (minimum 5 characters) is required.');
      return;
    }

    if (!effectiveDate) {
      setError('Please provide a valid effective termination date.');
      return;
    }

    if (!confirmedAuth) {
      setError('You must confirm executive authorization before proceeding with employee termination.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        employeeId: selectedEmpId,
        effectiveDate,
        terminationCategory,
        timeline: timelineMode,
        immediate: timelineMode === 'IMMEDIATE',
        noticePeriodDays: timelineMode === 'IMMEDIATE' ? 0 : parseInt(noticePeriodDays, 10) || 0,
        severanceAmount: severanceAmount ? parseFloat(severanceAmount) : 0,
        rehireEligible,
        revokeAccessImmediately,
        reason: reason.trim(),
        hrNotes: hrNotes.trim(),
        exitType: terminationCategory === 'MUTUAL_SEPARATION' ? 'MUTUAL' : (terminationCategory === 'CONTRACT_EXPIRY' ? 'CONTRACT_END' : 'INVOLUNTARY'),
      };

      const result = await exitService.terminateEmployee(payload);
      toast.success(
        `Termination for ${selectedEmployee?.firstName || 'employee'} initiated. Departmental clearances and offboarding workflow activated.`
      );
      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to initiate employee termination.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Initiate Employee Termination"
      subtitle="Company-authorized involuntary separation, severance setup, and offboarding"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="danger" title="Termination Precondition Error">
            {error}
          </Alert>
        )}

        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="text-sm">
            <span className="font-semibold block text-red-800 dark:text-red-300">Executive Separation Action</span>
            This action initiates formal company termination. It changes the employee's active status, generates mandatory
            clearance tasks across IT, Finance, Admin and HR, and optionally deprovisions credentials immediately.
          </div>
        </div>

        {/* 1. Target Employee Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Target Employee <span className="text-red-500">*</span>
          </label>

          {preselectedEmployee ? (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={`${preselectedEmployee.firstName} ${preselectedEmployee.lastName}`}
                  src={preselectedEmployee.avatarUrl}
                  size="md"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {preselectedEmployee.firstName} {preselectedEmployee.lastName}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{preselectedEmployee.employeeCode || preselectedEmployee.empCode}</span>
                    <span>•</span>
                    <span>{preselectedEmployee.department?.name || preselectedEmployee.departmentName || 'General'}</span>
                  </div>
                </div>
              </div>
              <Badge variant="warning">Selected for Separation</Badge>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search active employees by name, ID code, or department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {isLoadingEmployees ? (
                  <div className="p-4 text-center text-sm text-slate-500">Loading active employees...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">No active employees found matching query.</div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Staff';
                    const dept = emp.department?.name || emp.departmentName || 'General';
                    const desig = emp.designation?.title || emp.designationName || 'Employee';
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmpId(emp.id)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-red-500/10 border-l-4 border-l-red-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={fullName} src={emp.avatarUrl} size="sm" />
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{fullName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <span className="font-mono text-slate-600 dark:text-slate-300">{emp.employeeCode || emp.empCode}</span>
                              <span>•</span>
                              <span>{dept}</span>
                              <span>•</span>
                              <span>{desig}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-red-600 dark:text-red-400" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Grounds / Category & Timeline Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Termination Grounds <span className="text-red-500">*</span>
            </label>
            <select
              value={terminationCategory}
              onChange={(e) => setTerminationCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              {TERMINATION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Departure Timeline <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTimelineChange('IMMEDIATE')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  timelineMode === 'IMMEDIATE'
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Immediate Departure
              </button>
              <button
                type="button"
                onClick={() => handleTimelineChange('NOTICE')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  timelineMode === 'NOTICE'
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Notice / Severance Period
              </button>
            </div>
          </div>
        </div>

        {/* 3. Effective Dates & Notice Period */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Effective Last Working Day <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Notice Period (Days)
            </label>
            <input
              type="number"
              min="0"
              value={noticePeriodDays}
              disabled={timelineMode === 'IMMEDIATE'}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Severance Amount (₹ INR)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              placeholder="e.g. 50000"
              value={severanceAmount}
              onChange={(e) => setSeveranceAmount(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 4. Justification & Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Grounds & Company Justification <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Specify in detail the grounds, performance record, disciplinary inquiry, or administrative necessity..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            required
          />
        </div>

        {/* 5. Policy Toggles: Rehire & Immediate Access Revocation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={revokeAccessImmediately}
              onChange={(e) => setRevokeAccessImmediately(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                Revoke System Access Immediately
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                Deactivate Google/Microsoft SSO, email, VPN, and database access upon submission.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rehireEligible}
              onChange={(e) => setRehireEligible(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                Rehire Eligible in Future
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                Leave unchecked to mark employee profile as non-rehireable / blacklisted.
              </span>
            </div>
          </label>
        </div>

        {/* 6. Executive Authorization Acknowledgment */}
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedAuth}
              onChange={(e) => setConfirmedAuth(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-amber-400 text-red-600 focus:ring-red-500"
              required
            />
            <span className="text-xs font-medium leading-relaxed">
              I certify that this involuntary termination has received verified sign-off from company leadership and HR
              management. All statutory separation notice protocols and severance packages adhere to employment agreements.
            </span>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={isSubmitting || !confirmedAuth || !selectedEmpId}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm"
          >
            <UserX className="w-4 h-4" />
            {isSubmitting ? 'Processing Termination...' : 'Execute Termination'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default InitiateTerminationModal;
