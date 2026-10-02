import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
  Sun,
  Sunset,
  ShieldCheck,
  Loader2,
  X,
  Edit3,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Badge } from '../common/Badge.jsx';
import { leaveService } from '../../services/leaveService.js';
import { isUnpaidLeave } from './ApplyLeaveModal.jsx';

const DEFAULT_LEAVE_CATEGORIES = [
  { id: 'lt-pl', name: 'Planned Leave', code: 'PL', description: 'Pre-planned annual leave and scheduled vacations', genderEligibility: 'ALL' },
  { id: 'lt-cl', name: 'Casual Leave', code: 'CL', description: 'Casual leave for personal affairs and short breaks', genderEligibility: 'ALL' },
  { id: 'lt-sl', name: 'Sick Leave', code: 'SL', description: 'Medical leave for illness or health recovery', genderEligibility: 'ALL' },
  { id: 'lt-hl', name: 'Holiday', code: 'HL', description: 'Official public holiday or declared company day-off', genderEligibility: 'ALL' },
  { id: 'lt-hdl', name: 'Half Day', code: 'HDL', description: 'Half-day leave for morning or afternoon session (0.5 day)', genderEligibility: 'ALL' },
  { id: 'lt-awol', name: 'Absent Without Leave(AWOL)', code: 'AWOL', description: 'Unauthorized absence without prior notice or approved leave', genderEligibility: 'ALL' },
  { id: 'lt-lop', name: 'Leave Without Pay', code: 'LWP', description: 'Unpaid leave of absence / Leave Without Pay (LWP)', genderEligibility: 'ALL' },
  { id: 'lt-ml', name: 'Maternity Leave', code: 'ML', description: 'Maternity leave for prenatal, postnatal, and childcare recovery', genderEligibility: 'FEMALE' },
  { id: 'lt-sbl', name: 'Sabbatical Leave', code: 'SBL', description: 'Extended leave for research, education, or personal enrichment', genderEligibility: 'ALL' },
  { id: 'lt-ptl', name: 'Paternity Leave', code: 'PTL', description: 'Paternity leave for new fathers upon birth or adoption', genderEligibility: 'MALE' },
];

export const isSpecialLeaveCode = (code = '') => {
  const c = String(code).trim().toUpperCase();
  return ['HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL'].includes(c);
};

export const EditLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveRecord,
  leaveTypes = [],
}) => {
  if (!leaveRecord) return null;

  const employeeName =
    `${leaveRecord.employee?.firstName || ''} ${leaveRecord.employee?.lastName || ''}`.trim() ||
    leaveRecord.employeeName ||
    'Employee';

  const employeeGender = String(leaveRecord.employee?.gender || 'ALL').toUpperCase();

  // Combine fetched leave types with defaults
  const baseTypes = leaveTypes && leaveTypes.length > 0 ? [...leaveTypes] : [...DEFAULT_LEAVE_CATEGORIES];
  const availableLeaveTypes = baseTypes.filter((lt) => {
    const code = String(lt.code || '').trim().toUpperCase();
    if (code === 'UPL') return false;
    const ge = String(lt.genderEligibility || lt.gender_eligibility || 'ALL').toUpperCase();
    if (ge === 'FEMALE' && employeeGender === 'MALE') return false;
    if (ge === 'MALE' && employeeGender === 'FEMALE') return false;
    return true;
  });

  // Extract initial dates safely
  const initialStartDate = leaveRecord.startDate
    ? String(leaveRecord.startDate).split('T')[0]
    : '';
  const initialEndDate = leaveRecord.endDate
    ? String(leaveRecord.endDate).split('T')[0]
    : initialStartDate;

  const [formData, setFormData] = useState({
    leaveTypeId: leaveRecord.leaveTypeId || '',
    startDate: initialStartDate,
    endDate: initialEndDate,
    isHalfDay: Boolean(leaveRecord.isHalfDay),
    halfDayPeriod: leaveRecord.halfDayPeriod || 'FIRST_HALF',
    reason: leaveRecord.reason || '',
  });

  const [selectionMode, setSelectionMode] = useState('range');
  const [selectedDates, setSelectedDates] = useState([]);
  const [specificDateInput, setSpecificDateInput] = useState('');

  // Target employee balances
  const [employeeBalances, setEmployeeBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Calculation and submission states
  const [calculation, setCalculation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Initialize form state when record opens
  useEffect(() => {
    if (isOpen && leaveRecord) {
      const sDate = leaveRecord.startDate ? String(leaveRecord.startDate).split('T')[0] : '';
      const eDate = leaveRecord.endDate ? String(leaveRecord.endDate).split('T')[0] : sDate;

      setFormData({
        leaveTypeId: leaveRecord.leaveTypeId || '',
        startDate: sDate,
        endDate: eDate,
        isHalfDay: Boolean(leaveRecord.isHalfDay),
        halfDayPeriod: leaveRecord.halfDayPeriod || 'FIRST_HALF',
        reason: leaveRecord.reason || '',
      });

      if (Array.isArray(leaveRecord.dateDecisions) && leaveRecord.dateDecisions.length > 1) {
        const dates = leaveRecord.dateDecisions.map((d) => d.date).filter(Boolean);
        if (dates.length > 1) {
          setSelectedDates(dates);
        }
      } else {
        setSelectedDates([]);
      }

      setSelectionMode('range');
      setErrorMessage(null);

      // Fetch employee's current balances
      if (leaveRecord.employeeId) {
        setLoadingBalances(true);
        leaveService
          .getEmployeeBalances(leaveRecord.employeeId, new Date().getFullYear())
          .then((res) => {
            setEmployeeBalances(Array.isArray(res) ? res : []);
          })
          .catch((err) => {
            console.warn('Could not load balances for employee:', err);
          })
          .finally(() => {
            setLoadingBalances(false);
          });
      }
    }
  }, [isOpen, leaveRecord]);

  // Recalculate duration whenever dates, half-day, or leave type changes
  useEffect(() => {
    if (!isOpen) return;

    if (selectionMode === 'range') {
      if (!formData.startDate || !formData.endDate) {
        setCalculation(null);
        return;
      }
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setCalculation(null);
        return;
      }

      let isMounted = true;
      setIsCalculating(true);
      leaveService
        .calculateDuration({
          leaveTypeId: formData.leaveTypeId || undefined,
          startDate: formData.startDate,
          endDate: formData.endDate,
          isHalfDay: formData.isHalfDay,
          halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : null,
        })
        .then((res) => {
          if (isMounted) setCalculation(res);
        })
        .catch(() => {
          if (isMounted) setCalculation(null);
        })
        .finally(() => {
          if (isMounted) setIsCalculating(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      if (selectedDates.length === 0) {
        setCalculation(null);
        return;
      }
      let isMounted = true;
      setIsCalculating(true);
      leaveService
        .calculateDuration({
          leaveTypeId: formData.leaveTypeId || undefined,
          dates: selectedDates,
          isHalfDay: formData.isHalfDay,
          halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : null,
        })
        .then((res) => {
          if (isMounted) setCalculation(res);
        })
        .catch(() => {
          if (isMounted) setCalculation(null);
        })
        .finally(() => {
          if (isMounted) setIsCalculating(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [
    isOpen,
    selectionMode,
    formData.startDate,
    formData.endDate,
    formData.isHalfDay,
    formData.halfDayPeriod,
    formData.leaveTypeId,
    selectedDates,
  ]);

  const handleAddSpecificDate = () => {
    if (!specificDateInput) return;
    if (!selectedDates.includes(specificDateInput)) {
      const next = [...selectedDates, specificDateInput].sort();
      setSelectedDates(next);
    }
    setSpecificDateInput('');
  };

  const handleRemoveSpecificDate = (dateStr) => {
    setSelectedDates((prev) => prev.filter((d) => d !== dateStr));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.leaveTypeId) {
      setErrorMessage('Please select a leave category.');
      return;
    }

    if (selectionMode === 'range') {
      if (!formData.startDate || !formData.endDate) {
        setErrorMessage('Please specify start and end dates.');
        return;
      }
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setErrorMessage('End date cannot precede start date.');
        return;
      }
    } else {
      if (selectedDates.length === 0) {
        setErrorMessage('Please add at least one specific date.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        leaveTypeId: formData.leaveTypeId,
        isHalfDay: formData.isHalfDay,
        halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : null,
        reason: formData.reason.trim(),
      };

      if (selectionMode === 'range') {
        payload.startDate = formData.startDate;
        payload.endDate = formData.endDate;
      } else {
        payload.dates = selectedDates;
      }

      const updated = await leaveService.updateLeave(leaveRecord.id, payload);
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update leave request:', err);
      setErrorMessage(err.message || 'Failed to update leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLeaveType = availableLeaveTypes.find((lt) => lt.id === formData.leaveTypeId);
  const isSelectedSpecial = selectedLeaveType && isSpecialLeaveCode(selectedLeaveType.code);
  const matchingBal = employeeBalances.find(
    (b) => b.leaveTypeId === formData.leaveTypeId || b.code === selectedLeaveType?.code
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Leave Request"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-3">
            <Avatar
              src={leaveRecord.employee?.avatarUrl}
              firstName={leaveRecord.employee?.firstName}
              lastName={leaveRecord.employee?.lastName}
              name={employeeName}
              size="md"
            />
            <div>
              <div className="font-bold text-slate-900 text-sm">{employeeName}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="font-mono">{leaveRecord.employee?.employeeCode || '—'}</span>
                {leaveRecord.employee?.departmentName && (
                  <>
                    <span>•</span>
                    <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded text-[10px]">
                      {leaveRecord.employee.departmentName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Status</span>
            <Badge
              variant={
                leaveRecord.status === 'APPROVED'
                  ? 'success'
                  : leaveRecord.status === 'PENDING'
                  ? 'warning'
                  : 'secondary'
              }
              size="sm"
            >
              {leaveRecord.status}
            </Badge>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="danger" title="Update Error">
            {errorMessage}
          </Alert>
        )}

        {/* Category / Leave Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
            Leave Category <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={formData.leaveTypeId}
              onChange={(e) => setFormData((prev) => ({ ...prev, leaveTypeId: e.target.value }))}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
              required
            >
              <option value="" disabled>
                -- Select Leave Category --
              </option>
              {availableLeaveTypes.map((lt) => {
                const isSpecial = isSpecialLeaveCode(lt.code);
                const bal = employeeBalances.find(
                  (b) => b.leaveTypeId === lt.id || b.code === lt.code
                );
                const rem = bal ? parseFloat(bal.remainingDays || 0) : 0;
                return (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.code}) {isSpecial ? '— [Special: 0 days default]' : `— Available: ${rem}d`}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedLeaveType && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>
                {selectedLeaveType.description || 'Standard category leave.'}
                {isSelectedSpecial && (
                  <strong className="text-brand-600 font-semibold ml-1">
                    (Special category leave: does not consume normal paid balances).
                  </strong>
                )}
              </span>
            </p>
          )}
        </div>

        {/* Date Selection Mode Toggle */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Date Mode
            </label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectionMode('range')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  selectionMode === 'range'
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('specific')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  selectionMode === 'specific'
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Specific Dates
              </button>
            </div>
          </div>

          {selectionMode === 'range' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                      endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate,
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  min={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={specificDateInput}
                  onChange={(e) => setSpecificDateInput(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddSpecificDate}
                  disabled={!specificDateInput}
                >
                  Add Date
                </Button>
              </div>

              {selectedDates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[42px]">
                  {selectedDates.map((dateStr) => (
                    <span
                      key={dateStr}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs"
                    >
                      {new Date(dateStr).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecificDate(dateStr)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No specific dates added yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Half Day Option */}
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.isHalfDay}
              onChange={(e) => setFormData((prev) => ({ ...prev, isHalfDay: e.target.checked }))}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs font-bold text-slate-800">Half Day Session</span>
          </label>

          {formData.isHalfDay && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
              <label
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  formData.halfDayPeriod === 'FIRST_HALF'
                    ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="editHalfDayPeriod"
                  value="FIRST_HALF"
                  checked={formData.halfDayPeriod === 'FIRST_HALF'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, halfDayPeriod: e.target.value }))}
                  className="sr-only"
                />
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Morning Half (1st)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  formData.halfDayPeriod === 'SECOND_HALF'
                    ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="editHalfDayPeriod"
                  value="SECOND_HALF"
                  checked={formData.halfDayPeriod === 'SECOND_HALF'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, halfDayPeriod: e.target.value }))}
                  className="sr-only"
                />
                <Sunset className="w-4 h-4 text-orange-500 shrink-0" />
                <span>Afternoon Half (2nd)</span>
              </label>
            </div>
          )}
        </div>

        {/* Live Duration Calculation Card */}
        {calculation && (
          <div className="p-3 bg-brand-50/60 border border-brand-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <div>
                <span className="text-xs font-bold text-brand-900">
                  Calculated Duration:{' '}
                  <span className="text-sm font-extrabold text-brand-700">
                    {calculation.totalDays} {calculation.totalDays === 1 ? 'day' : 'days'}
                  </span>
                </span>
                <div className="text-[11px] text-brand-700/80 flex items-center gap-2">
                  <span>Working: {calculation.workingDays || calculation.totalDays}d</span>
                  {calculation.weekendDays > 0 && <span>• Excludes {calculation.weekendDays} Sunday{calculation.weekendDays > 1 ? 's' : ''}</span>}
                  {calculation.holidayDays > 0 && <span>• Includes {calculation.holidayDays} holiday{calculation.holidayDays > 1 ? 's' : ''}</span>}
                </div>
              </div>
            </div>
            {isCalculating && <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />}
          </div>
        )}

        {/* Reason / Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Reason / Assignment Note
          </label>
          <textarea
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Explain reason for leave or correction note..."
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={Edit3}
            disabled={submitting || isCalculating}
          >
            {submitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
