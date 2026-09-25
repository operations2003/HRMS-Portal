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
  Users,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { leaveService } from '../../services/leaveService.js';
import { managerService } from '../../services/managerService.js';
import { useAuth } from '../../context/AuthContext.jsx';


const DEFAULT_LEAVE_CATEGORIES = [
  { id: 'lt-pl', name: 'Planned Leave', code: 'PL', description: 'Pre-planned annual leave and scheduled vacations', genderEligibility: 'ALL' },
  { id: 'lt-cl', name: 'Casual Leave', code: 'CL', description: 'Casual leave for personal affairs and short breaks', genderEligibility: 'ALL' },
  { id: 'lt-sl', name: 'Sick Leave', code: 'SL', description: 'Medical leave for illness or health recovery', genderEligibility: 'ALL' },
  { id: 'lt-hl', name: 'Holiday', code: 'HL', description: 'Official public holiday or declared company day-off', genderEligibility: 'ALL' },
  { id: 'lt-hdl', name: 'Half Day', code: 'HDL', description: 'Half-day leave for morning or afternoon session (0.5 day)', genderEligibility: 'ALL' },
  { id: 'lt-awol', name: 'Absent Without Leave(AWOL)', code: 'AWOL', description: 'Unauthorized absence without prior notice or approved leave', genderEligibility: 'ALL' },
  { id: 'lt-lop', name: 'Leave without pay (LOP)', code: 'LOP', description: 'Loss of pay / unpaid leave of absence', genderEligibility: 'ALL' },
  { id: 'lt-ml', name: 'Maternity Leave', code: 'ML', description: 'Maternity leave for prenatal, postnatal, and childcare recovery', genderEligibility: 'FEMALE' },
  { id: 'lt-sbl', name: 'Sabbatical Leave', code: 'SBL', description: 'Extended leave for research, education, or personal enrichment', genderEligibility: 'ALL' },
  { id: 'lt-ptl', name: 'Paternity Leave', code: 'PTL', description: 'Paternity leave for new fathers upon birth or adoption', genderEligibility: 'MALE' },
];

/**
 * Returns the next upcoming business day (Mon - Sat, 6 working days) formatted as YYYY-MM-DD.
 * If today is Sunday (0), advances to Monday (+1 day).
 */
const getNextWorkingDay = (baseDate = new Date()) => {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0) {
    d.setDate(d.getDate() + 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};


const RESTRICTED_LEAVE_CODES = ['SBL', 'ML', 'PTL', 'AWOL', 'LOP', 'LWP', 'UPL'];
const isRestrictedType = (lt) => {
  if (!lt) return false;
  const code = String(lt.code || '').trim().toUpperCase();
  const name = String(lt.name || '').trim().toLowerCase();
  if (RESTRICTED_LEAVE_CODES.includes(code)) return true;
  return (
    code === 'UPL' ||
    name.includes('unplanned') ||
    name.includes('sabbatical') ||
    name.includes('maternity') ||
    name.includes('paternity') ||
    name.includes('awol') ||
    name.includes('without pay') ||
    name.includes('loss of pay')
  );
};

export const ApplyLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveTypes = [],
  leaveBalances = [],
}) => {
  const { user, hasRole } = useAuth();
  const normRole = (user?.roleName || '').toLowerCase();
  const isAdminOrCeo = ['admin', 'superadmin', 'orgadmin'].some(r => normRole.includes(r)) || user?.email === 'sheetalbedi@tasknera.com';
  const canApplyForTeam = hasRole(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);
  
  const [targetEmployeeId, setTargetEmployeeId] = useState(isAdminOrCeo ? '' : 'SELF');
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Fetch direct reports if the user is a manager or HR/Admin
  useEffect(() => {
    if (isOpen && canApplyForTeam) {
      setLoadingTeam(true);
      managerService
        .getTeam()
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setTeamMembers(list);
          if (isAdminOrCeo && list.length > 0 && (!targetEmployeeId || targetEmployeeId === 'SELF')) {
            setTargetEmployeeId(list[0].id);
          }
        })
        .catch((err) => {
          console.warn('Could not load direct reports for manager leave application:', err);
        })
        .finally(() => setLoadingTeam(false));
    }
  }, [isOpen, canApplyForTeam, isAdminOrCeo]);

  const selectedMember = teamMembers.find((m) => m.id === targetEmployeeId);
  const userGender = String(user?.gender || user?.employee?.gender || '').toUpperCase();
  const targetGender = targetEmployeeId === 'SELF'
    ? userGender
    : String(selectedMember?.gender || 'Male').toUpperCase();

  const allAvailableTypes = leaveTypes && leaveTypes.length > 0 ? leaveTypes : DEFAULT_LEAVE_CATEGORIES;
  const effectiveLeaveTypes = allAvailableTypes.filter((lt) => {
    const code = String(lt.code || '').toUpperCase();
    const name = String(lt.name || '').toLowerCase();
    if (code === 'UPL' || name.includes('unplanned')) {
      return false;
    }

    // When applying for SELF: restricted leaves (Sabbatical, Maternity, Paternity, AWOL, LOP) MUST NOT appear!
    if (targetEmployeeId === 'SELF' && isRestrictedType(lt)) {
      return false;
    }

    const ge = String(lt.genderEligibility || lt.gender_eligibility || 'ALL').toUpperCase();
    if (ge === 'FEMALE' || code === 'ML') {
      return targetGender !== 'MALE';
    }
    if (ge === 'MALE' || code === 'PTL' || code === 'PATL') {
      return targetGender !== 'FEMALE';
    }
    return true;
  });

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayPeriod: 'FIRST_HALF',
    reason: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Duration calculation preview from backend
  const [durationPreview, setDurationPreview] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Reset or switch category if targetEmployeeId changes or on open
  useEffect(() => {
    if (isOpen) {
      const defaultWorkingDay = getNextWorkingDay();
      const currentValid = effectiveLeaveTypes.some((t) => t.id === formData.leaveTypeId);
      const defaultType = currentValid ? formData.leaveTypeId : (effectiveLeaveTypes[0]?.id || '');

      setFormData((prev) => ({
        ...prev,
        leaveTypeId: defaultType,
        startDate: prev.startDate || defaultWorkingDay,
        endDate: prev.endDate || defaultWorkingDay,
      }));
      setFormErrors({});
      setApiError(null);
    }
  }, [isOpen, targetEmployeeId]);

  // Initialize form on initial modal open
  useEffect(() => {
    if (isOpen) {
      const defaultType = effectiveLeaveTypes[0]?.id || '';
      const defaultWorkingDay = getNextWorkingDay();
      setTargetEmployeeId('SELF');
      setFormData({
        leaveTypeId: defaultType,
        startDate: defaultWorkingDay,
        endDate: defaultWorkingDay,
        isHalfDay: false,
        halfDayPeriod: 'FIRST_HALF',
        reason: '',
      });
      setFormErrors({});
      setApiError(null);
      setDurationPreview(null);
    }
  }, [isOpen]);

  // Handle live duration calculation from backend when dates change
  useEffect(() => {
    if (!formData.startDate || !formData.endDate) {
      setDurationPreview(null);
      return;
    }

    if (formData.startDate > formData.endDate && !formData.isHalfDay) {
      setDurationPreview(null);
      return;
    }

    let isMounted = true;
    const calculate = async () => {
      try {
        setIsCalculating(true);
        const result = await leaveService.calculateDuration({
          startDate: formData.startDate,
          endDate: formData.isHalfDay ? formData.startDate : formData.endDate,
          isHalfDay: formData.isHalfDay,
          halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
        });
        if (isMounted) {
          setDurationPreview(result);
        }
      } catch (err) {
        if (isMounted) {
          setDurationPreview({
            isNonWorkingPeriod: true,
            totalDays: 0,
            warning: err.message || 'Cannot calculate duration for selected dates.',
          });
        }
      } finally {
        if (isMounted) setIsCalculating(false);
      }
    };

    const timer = setTimeout(calculate, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.startDate, formData.endDate, formData.isHalfDay, formData.halfDayPeriod]);

  // Real-time client validation (backend remains authoritative)
  const validateForm = () => {
    const errs = {};

    if (!formData.leaveTypeId) {
      errs.leaveTypeId = 'Please select a leave category.';
    }

    if (!formData.startDate) {
      errs.startDate = 'Start date is required.';
    }

    if (!formData.isHalfDay) {
      if (!formData.endDate) {
        errs.endDate = 'End date is required.';
      } else if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        errs.endDate = 'End date cannot be earlier than start date.';
      }
    }

    if (durationPreview && (durationPreview.isNonWorkingPeriod || durationPreview.totalDays === 0)) {
      errs.startDate = durationPreview.warning || 'Selected dates contain no working business days (Mon–Sat).';
    }

    if (formData.isHalfDay && !formData.halfDayPeriod) {
      errs.halfDayPeriod = 'Please choose First Half or Second Half.';
    }

    if (!formData.reason || formData.reason.trim().length < 5) {
      errs.reason = 'Reason must be at least 5 characters long.';
    } else if (formData.reason.trim().length > 1000) {
      errs.reason = 'Reason cannot exceed 1000 characters.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStartDateChange = (val) => {
    setFormData((prev) => ({
      ...prev,
      startDate: val,
      endDate: prev.isHalfDay ? val : prev.endDate < val ? val : prev.endDate,
    }));
  };

  const handleHalfDayToggle = (checked) => {
    setFormData((prev) => ({
      ...prev,
      isHalfDay: checked,
      endDate: checked ? prev.startDate : prev.endDate,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setApiError(null);

      const payload = {
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.isHalfDay ? formData.startDate : formData.endDate,
        isHalfDay: formData.isHalfDay,
        halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
        reason: formData.reason.trim(),
      };

      if (targetEmployeeId && targetEmployeeId !== 'SELF') {
        payload.employeeId = targetEmployeeId;
      }


      const newRecord = await leaveService.applyLeave(payload);
      if (onSuccess) {
        onSuccess(newRecord);
      }
      onClose();
    } catch (err) {
      setApiError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leave Category options mapping (Emergency, Sick, Casual)
  const typeOptions = effectiveLeaveTypes.map((t) => {
    return {
      value: t.id,
      label: t.name,
    };
  });

  const selectedTypeObj = effectiveLeaveTypes.find((t) => t.id === formData.leaveTypeId);
  const selectedBalanceObj = leaveBalances.find((b) => b.leaveTypeId === formData.leaveTypeId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Submit a new time-off request with duration calculation"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Alert from Server */}
        {apiError && (
          <Alert variant="danger" dismissible onDismiss={() => setApiError(null)}>
            {apiError}
          </Alert>
        )}

        {/* Apply Leave For (Manager / Team Member selector) */}
        {canApplyForTeam && teamMembers.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                Apply Leave For <span className="text-rose-500">*</span>
              </span>
              {targetEmployeeId !== 'SELF' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  Manager Action on Behalf of Employee
                </span>
              )}
            </label>
            <Select
              value={targetEmployeeId}
              onChange={(e) => setTargetEmployeeId(e.target.value)}
              options={[
                ...(!isAdminOrCeo ? [{ value: 'SELF', label: `Self (${user?.firstName || 'My Account'}) - Standard Leaves` }] : []),
                ...teamMembers.map((m) => ({
                  value: m.id,
                  label: `${m.firstName} ${m.lastName} (${m.employeeCode || m.designation?.title || 'Reportee'})`,
                })),
              ]}
            />
            {targetEmployeeId === 'SELF' ? (
              <p className="text-[11px] text-slate-500">
                Note: Sabbatical, Maternity, Paternity, AWOL, and LOP can only be initiated by your manager.
              </p>
            ) : (
              <p className="text-[11px] text-emerald-700 font-medium">
                As manager, you can grant standard and special leaves (Sabbatical, Maternity, Paternity, AWOL, LOP) for this reportee.
              </p>
            )}
          </div>
        )}

        {/* 1. Leave Type Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Leave Category <span className="text-rose-500">*</span>
            </label>
            {selectedTypeObj && isRestrictedType(selectedTypeObj) && (
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Restricted Leave Type
              </span>
            )}
          </div>
          <Select
            value={formData.leaveTypeId}
            onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
            options={typeOptions}
            error={formErrors.leaveTypeId}
          />

          {selectedTypeObj && (
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>{selectedTypeObj.description}</span>
              {selectedBalanceObj && (
                <span className="font-semibold text-brand-600">
                  Available: {selectedBalanceObj.remainingDays} / {selectedBalanceObj.entitledDays} days
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2. Half-Day Control (Supported by Backend) */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isHalfDay"
              checked={formData.isHalfDay}
              onChange={(e) => handleHalfDayToggle(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
            />
            <label htmlFor="isHalfDay" className="text-xs font-bold text-slate-800 cursor-pointer">
              Apply for Half Day Leave (0.5 Day)
            </label>
          </div>

          {formData.isHalfDay && (
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="halfDayPeriod"
                  value="FIRST_HALF"
                  checked={formData.halfDayPeriod === 'FIRST_HALF'}
                  onChange={(e) => setFormData({ ...formData, halfDayPeriod: e.target.value })}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>First Half (Morning)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="halfDayPeriod"
                  value="SECOND_HALF"
                  checked={formData.halfDayPeriod === 'SECOND_HALF'}
                  onChange={(e) => setFormData({ ...formData, halfDayPeriod: e.target.value })}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <Sunset className="w-3.5 h-3.5 text-indigo-500" />
                <span>Second Half (Afternoon)</span>
              </label>
            </div>
          )}
        </div>

        {/* 3. Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {formData.isHalfDay ? 'Leave Date' : 'Start Date'} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              error={formErrors.startDate}
            />
          </div>

          {!formData.isHalfDay && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                End Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                min={formData.startDate}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                error={formErrors.endDate}
              />
            </div>
          )}
        </div>

        {/* 4. Backend-Calculated Duration Preview */}
        {durationPreview && (
          durationPreview.isNonWorkingPeriod || durationPreview.totalDays === 0 ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-900">Non-Working Day Selected</div>
                <div className="text-amber-800 mt-0.5 leading-relaxed">
                  {durationPreview.warning || 'Selected dates fall on a Sunday or public holiday. Standard leaves only deduct working business days (Monday to Saturday). Please select a working day.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-brand-50/60 border border-brand-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-brand-900">
                  Calculated Duration:{' '}
                  <strong className="text-brand-700 font-bold">
                    {durationPreview.totalDays} {durationPreview.totalDays === 1 ? 'day' : 'days'}
                  </strong>
                </span>
              </div>
              <div className="text-slate-500">
                {durationPreview.weekendDays > 0 && `(Excludes ${durationPreview.weekendDays} Sunday${durationPreview.weekendDays > 1 ? 's' : ''})`}
                {durationPreview.holidayDays > 0 && `(Excludes ${durationPreview.holidayDays} holiday days)`}
              </div>
            </div>
          )
        )}

        {/* 5. Reason for Leave */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Reason for Leave <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Please specify the reason for taking leave (minimum 5 characters)..."
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              formErrors.reason
                ? 'border-rose-300 focus:ring-rose-400'
                : 'border-slate-200 focus:border-brand-500 focus:ring-brand-400/20'
            }`}
          />
          {formErrors.reason && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{formErrors.reason}</p>
          )}
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>Enforced by backend validation (minimum 5 characters).</span>
            <span>{formData.reason.length} / 1000</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={CalendarDays}
            isLoading={isSubmitting}
            disabled={isSubmitting || durationPreview?.isNonWorkingPeriod || durationPreview?.totalDays === 0}
          >
            {isSubmitting ? 'Submitting Application...' : 'Submit Leave Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
