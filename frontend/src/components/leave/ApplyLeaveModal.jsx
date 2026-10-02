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
  Loader2,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { leaveService } from '../../services/leaveService.js';
import { managerService } from '../../services/managerService.js';
import { employeeService } from '../../services/employeeService.js';
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


export const isUnpaidLeave = (lt) => {
  if (!lt) return false;
  if (lt.isPaid === false || lt.is_paid === false) {
    const code = String(lt.code || lt.leaveTypeCode || '').trim().toUpperCase();
    if (code === 'AWOL') return false;
    return true;
  }
  const code = String(lt.code || lt.leaveTypeCode || '').trim().toUpperCase();
  const name = String(lt.name || lt.leaveTypeName || '').trim().toLowerCase();
  return (
    code === 'LOP' ||
    code === 'LWP' ||
    name.includes('without pay') ||
    name.includes('loss of pay') ||
    name.includes('unpaid')
  );
};

export const getRemainingBalance = (lt, balances = []) => {
  if (!lt || !Array.isArray(balances)) return 0;
  const targetCode = String(lt.code || lt.leaveTypeCode || '').trim().toUpperCase();
  const targetName = String(lt.name || lt.leaveTypeName || '').trim().toLowerCase();
  const targetId = lt.id || lt.leaveTypeId;

  const match = balances.find((b) => {
    if (targetId && (b.leaveTypeId === targetId || b.id === targetId)) {
      return true;
    }
    const bCode = String(b.leaveTypeCode || b.code || '').trim().toUpperCase();
    if (targetCode && bCode && targetCode === bCode) {
      return true;
    }
    const bName = String(b.leaveTypeName || b.name || '').trim().toLowerCase();
    if (targetName && bName && targetName === bName) {
      return true;
    }
    return false;
  });

  if (!match) return 0;
  const rem = parseFloat(match.remainingDays !== undefined ? match.remainingDays : match.remaining_days);
  return isNaN(rem) ? 0 : Math.max(0, rem);
};

// SPECIAL LEAVE TYPES: 6 leave categories that have 0 balance and can only be assigned by Admin/HR/Manager
const SPECIAL_LEAVE_CODES = ['HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL'];
const SPECIAL_LEAVE_NAMES = [
  'holiday',
  'absent without leave',
  'awol',
  'leave without pay',
  'loss of pay',
  'lop',
  'lwp',
  'maternity leave',
  'maternity',
  'sabbatical leave',
  'sabbatical',
  'paternity leave',
  'paternity',
];

const isSpecialLeaveType = (lt) => {
  if (!lt) return false;
  const code = String(lt.code || lt.leaveTypeCode || '').trim().toUpperCase();
  const name = String(lt.name || lt.leaveTypeName || '').trim().toLowerCase();
  if (SPECIAL_LEAVE_CODES.includes(code)) return true;
  if (SPECIAL_LEAVE_NAMES.some(sn => name === sn || name.includes(sn))) return true;
  return (
    name.includes('holiday') ||
    name.includes('absent without leave') ||
    name.includes('awol') ||
    name.includes('without pay') ||
    name.includes('loss of pay') ||
    name.includes('maternity') ||
    name.includes('sabbatical') ||
    name.includes('paternity')
  );
};

const isRestrictedType = isSpecialLeaveType;

export const ApplyLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveTypes = [],
  leaveBalances = [],
  initialEmployeeId = null,
  isAssignMode: explicitAssignMode = null,
}) => {
  const { user, hasRole } = useAuth();
  const normRole = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase();
  const isAdminOrCeo = ['admin', 'superadmin', 'orgadmin'].some(r => normRole.includes(r)) || user?.email === 'sheetalbedi@tasknera.com';
  const isHr = ['hr', 'hrmanager'].some(r => normRole.includes(r)) || hasRole(['HR', 'HRManager']);
  const isHrOrAdmin = isHr || isAdminOrCeo || hasRole(['Admin', 'SuperAdmin', 'OrgAdmin']);
  const isManager = ['manager', 'lead', 'teamlead', 'supervisor'].some(r => normRole.includes(r)) || hasRole(['Manager', 'Lead', 'TeamLead', 'Supervisor']);
  const canApplyForTeam = isHrOrAdmin || isManager;

  // Determine whether this modal is in Assign Leave mode or Apply Leave (self) mode
  const isAssignMode = explicitAssignMode !== null
    ? explicitAssignMode
    : (isAdminOrCeo || (Boolean(initialEmployeeId) && initialEmployeeId !== 'SELF'));
  
  const [targetEmployeeId, setTargetEmployeeId] = useState(
    initialEmployeeId || (isAssignMode ? '' : 'SELF')
  );
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamLoadError, setTeamLoadError] = useState(null);

  // Target employee leave balances (fetched dynamically when assigning leave to an employee)
  const [targetBalances, setTargetBalances] = useState([]);
  const [loadingTargetBalances, setLoadingTargetBalances] = useState(false);

  // Fetch employees: Admin & HR can assign to ALL employees in the org; Managers can assign to their team
  const fetchTeamMembers = async () => {
    if (!canApplyForTeam && !isAssignMode) return;
    try {
      setLoadingTeam(true);
      setTeamLoadError(null);
      const loader = isHrOrAdmin
        ? employeeService.listEmployees({ limit: 300 })
        : managerService.getTeam();

      const res = await loader;
      let list = [];
      if (Array.isArray(res)) {
        list = res;
      } else if (Array.isArray(res?.employees)) {
        list = res.employees;
      } else if (Array.isArray(res?.data)) {
        list = res.data;
      } else if (Array.isArray(res?.items)) {
        list = res.items;
      }

      // Filter out inactive / terminated / exited employees
      let activeList = list.filter((emp) => {
        const s = (emp.status || emp.user?.status || '').toUpperCase();
        return !['INACTIVE', 'TERMINATED', 'EXITED', 'SUSPENDED', 'ARCHIVED'].includes(s);
      });

      // Exclude Admin from self-assigning leave (company admins don't take employee leave)
      if (isAdminOrCeo && user?.email) {
        activeList = activeList.filter((emp) => {
          const empEmail = (emp.email || '').toLowerCase();
          const userEmail = (user.email || '').toLowerCase();
          return empEmail !== userEmail && emp.id !== 'emp-shubham-admin';
        });
      }

      setTeamMembers(activeList);

      // Pre-select employee if assigned or default to first eligible
      if (initialEmployeeId && initialEmployeeId !== 'SELF') {
        setTargetEmployeeId(initialEmployeeId);
      } else if (isAssignMode && activeList.length > 0) {
        setTargetEmployeeId((prev) => {
          if (prev && prev !== 'SELF' && activeList.some((m) => m.id === prev)) {
            return prev;
          }
          return activeList[0].id;
        });
      }
    } catch (err) {
      console.warn('Could not load employees for leave assignment:', err);
      setTeamLoadError(err.message || 'Failed to load employee list.');
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (isOpen && (canApplyForTeam || isAssignMode)) {
      fetchTeamMembers();
    }
  }, [isOpen, canApplyForTeam, isAssignMode, isHrOrAdmin, isAdminOrCeo, initialEmployeeId]);

  // Fetch balances for selected target employee when in Assign Mode
  useEffect(() => {
    let isMounted = true;
    if (isOpen && targetEmployeeId && targetEmployeeId !== 'SELF') {
      setLoadingTargetBalances(true);
      leaveService
        .getEmployeeBalances(targetEmployeeId, new Date().getFullYear())
        .then((res) => {
          if (isMounted) {
            setTargetBalances(Array.isArray(res) ? res : []);
          }
        })
        .catch((err) => {
          console.warn('Could not load balances for employee:', err);
          if (isMounted) setTargetBalances([]);
        })
        .finally(() => {
          if (isMounted) setLoadingTargetBalances(false);
        });
    } else {
      setTargetBalances([]);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, targetEmployeeId]);

  // Active balances to show (target employee balances for assignment, personal balances for self-apply)
  const activeBalances = (targetEmployeeId && targetEmployeeId !== 'SELF')
    ? targetBalances
    : leaveBalances;

  const selectedMember = teamMembers.find((m) => m.id === targetEmployeeId);
  const userGender = String(user?.gender || user?.employee?.gender || '').toUpperCase();
  const targetGender = targetEmployeeId === 'SELF'
    ? userGender
    : String(selectedMember?.gender || 'Male').toUpperCase();

  const baseTypes = leaveTypes && leaveTypes.length > 0 ? [...leaveTypes] : [...DEFAULT_LEAVE_CATEGORIES];
  if (!baseTypes.some(isUnpaidLeave)) {
    const defaultLop = DEFAULT_LEAVE_CATEGORIES.find(isUnpaidLeave);
    if (defaultLop) {
      baseTypes.push(defaultLop);
    }
  }

  const effectiveLeaveTypes = baseTypes.filter((lt) => {
    const code = String(lt.code || '').trim().toUpperCase();
    const name = String(lt.name || '').trim().toLowerCase();
    if (code === 'UPL' || name.includes('unplanned')) {
      return false;
    }

    const ge = String(lt.genderEligibility || lt.gender_eligibility || 'ALL').toUpperCase();
    if (ge === 'FEMALE' || code === 'ML') {
      if (targetGender === 'MALE') return false;
    }
    if (ge === 'MALE' || code === 'PTL' || code === 'PATL') {
      if (targetGender === 'FEMALE') return false;
    }

    // When applying for SELF:
    if (targetEmployeeId === 'SELF' && !isAssignMode) {
      // SPECIAL LEAVE TYPES: Employees cannot self-apply for these 6 leave types
      // Only Admin, HR, or Reporting Manager can assign these
      if (isSpecialLeaveType(lt)) {
        return false;
      }

      // Restricted unauthorized leaves (AWOL, Sabbatical) cannot be self-applied
      if (code === 'AWOL' || name.includes('awol') || code === 'SBL' || name.includes('sabbatical')) {
        return false;
      }

      // Unpaid Leave (LOP / LWP): This is now a special leave type, so filtered above
      // But if it somehow passes through, allow it
      if (isUnpaidLeave(lt)) {
        return false; // Block it since it's a special leave type
      }

      // Paid Leave Types: strictly check remaining balance
      const remaining = getRemainingBalance(lt, activeBalances);
      return remaining > 0;
    }

    // When assigning for another team member (Admin/HR/Manager):
    // ALL leave types (PL, CL, SL, Holiday, Half Day, AWOL, LOP, Sabbatical, Maternity, Paternity) are assignable
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

  const [selectionMode, setSelectionMode] = useState('range'); // 'range' | 'specific'
  const [selectedDates, setSelectedDates] = useState([]);
  const [specificDateInput, setSpecificDateInput] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Duration calculation preview from backend
  const [durationPreview, setDurationPreview] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Initialize form state when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultWorkingDay = getNextWorkingDay();
      const initialTarget = initialEmployeeId || (isAssignMode ? (teamMembers[0]?.id || '') : 'SELF');
      setTargetEmployeeId(initialTarget);
      setSelectionMode('range');
      setSelectedDates([defaultWorkingDay]);
      setSpecificDateInput(defaultWorkingDay);
      setFormData({
        leaveTypeId: effectiveLeaveTypes[0]?.id || '',
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
  }, [isOpen, initialEmployeeId, isAssignMode]);

  // Adjust selected leave category if targetEmployeeId or category eligibility changes
  useEffect(() => {
    if (isOpen && effectiveLeaveTypes.length > 0) {
      const currentValid = effectiveLeaveTypes.some((t) => t.id === formData.leaveTypeId);
      if (!currentValid) {
        setFormData((prev) => ({
          ...prev,
          leaveTypeId: effectiveLeaveTypes[0]?.id || '',
        }));
      }
    }
  }, [isOpen, targetEmployeeId, effectiveLeaveTypes.length]);

  // Handle live duration calculation from backend when dates change
  useEffect(() => {
    let isMounted = true;
    const calculate = async () => {
      try {
        setIsCalculating(true);
        let payload;

        if (selectionMode === 'specific') {
          if (!selectedDates || selectedDates.length === 0) {
            setDurationPreview(null);
            return;
          }
          payload = {
            dates: selectedDates,
            isHalfDay: formData.isHalfDay,
            halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
            leaveTypeId: formData.leaveTypeId,
          };
        } else {
          if (!formData.startDate || !formData.endDate) {
            setDurationPreview(null);
            return;
          }
          if (formData.startDate > formData.endDate && !formData.isHalfDay) {
            setDurationPreview(null);
            return;
          }
          payload = {
            startDate: formData.startDate,
            endDate: formData.isHalfDay ? formData.startDate : formData.endDate,
            isHalfDay: formData.isHalfDay,
            halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
            leaveTypeId: formData.leaveTypeId,
          };
        }

        const result = await leaveService.calculateDuration(payload);
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
  }, [
    selectionMode,
    selectedDates,
    formData.startDate,
    formData.endDate,
    formData.isHalfDay,
    formData.halfDayPeriod,
    formData.leaveTypeId,
  ]);

  const selectedTypeObj = effectiveLeaveTypes.find((t) => t.id === formData.leaveTypeId);
  const selectedBalanceObj = activeBalances.find((b) => {
    if (b.leaveTypeId === formData.leaveTypeId || b.id === formData.leaveTypeId) return true;
    if (selectedTypeObj) {
      const targetCode = String(selectedTypeObj.code || '').trim().toUpperCase();
      const bCode = String(b.leaveTypeCode || b.code || '').trim().toUpperCase();
      if (targetCode && bCode && targetCode === bCode) return true;
      const targetName = String(selectedTypeObj.name || '').trim().toLowerCase();
      const bName = String(b.leaveTypeName || b.name || '').trim().toLowerCase();
      if (targetName && bName && targetName === bName) return true;
    }
    return false;
  });

  // Real-time client validation (backend remains authoritative)
  const validateForm = () => {
    const errs = {};

    if (isAssignMode || targetEmployeeId !== 'SELF') {
      if (!targetEmployeeId || targetEmployeeId === 'SELF') {
        errs.employeeId = 'Please select an employee to assign leave to.';
      }
    }

    if (!formData.leaveTypeId) {
      errs.leaveTypeId = 'Please select a leave category.';
    } else if (targetEmployeeId === 'SELF' && selectedTypeObj) {
      // SPECIAL LEAVE TYPES: Should never appear for SELF, but double-check
      if (isSpecialLeaveType(selectedTypeObj)) {
        errs.leaveTypeId = `${selectedTypeObj.name} can only be assigned by Admin, HR, or your Reporting Manager.`;
      } else if (!isUnpaidLeave(selectedTypeObj)) {
        // ENHANCED BALANCE VALIDATION: Check both zero balance and insufficient balance
        const remainingDays = getRemainingBalance(selectedTypeObj, activeBalances);
        
        // Critical Check 1: Block if balance is exactly 0
        if (remainingDays === 0) {
          errs.leaveTypeId = `Insufficient leave balance. You have 0 days available for ${selectedTypeObj.name}. Please contact HR if you need additional leave allocation.`;
        } else if (remainingDays < 0) {
          // Additional safety: warn if balance is already negative
          errs.leaveTypeId = `Your leave balance for ${selectedTypeObj.name} is currently negative (${remainingDays} days). Please contact HR to resolve this issue.`;
        } else if (durationPreview && durationPreview.totalDays > 0) {
          // Critical Check 2: Block if requested days exceed available balance
          const requestedDays = durationPreview.totalDays;
          if (requestedDays > remainingDays) {
            errs.duration = `Insufficient leave balance. You have only ${remainingDays} day${remainingDays === 1 ? '' : 's'} available for ${selectedTypeObj.name}, but you are requesting ${requestedDays} day${requestedDays === 1 ? '' : 's'}.`;
          }
        }
      }
    }

    if (selectionMode === 'specific') {
      if (!selectedDates || selectedDates.length === 0) {
        errs.selectedDates = 'Please select at least one leave date.';
      }
    } else {
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

  const handleAddSpecificDate = () => {
    if (!specificDateInput) return;
    if (!selectedDates.includes(specificDateInput)) {
      const updated = [...selectedDates, specificDateInput].sort();
      setSelectedDates(updated);
      setFormErrors((prev) => ({ ...prev, selectedDates: undefined }));
    }
  };

  const handleRemoveSpecificDate = (dToRemove) => {
    if (selectedDates.length <= 1) return;
    setSelectedDates(selectedDates.filter((d) => d !== dToRemove));
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
        isHalfDay: formData.isHalfDay,
        halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
        reason: formData.reason.trim(),
      };

      if (selectionMode === 'specific') {
        payload.dates = selectedDates;
        payload.startDate = selectedDates[0];
        payload.endDate = selectedDates[selectedDates.length - 1];
      } else {
        payload.startDate = formData.startDate;
        payload.endDate = formData.isHalfDay ? formData.startDate : formData.endDate;
      }

      if (isAssignMode || (targetEmployeeId && targetEmployeeId !== 'SELF')) {
        if (!targetEmployeeId || targetEmployeeId === 'SELF') {
          setFormErrors((prev) => ({ ...prev, employeeId: 'Please select an employee to assign leave to.' }));
          setIsSubmitting(false);
          return;
        }
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAssignMode || targetEmployeeId !== 'SELF' ? 'Assign Leave' : 'Apply for Leave'}
      subtitle={
        isAssignMode || targetEmployeeId !== 'SELF'
          ? (isHrOrAdmin
            ? 'Assign exact leave dates for an employee across the organization'
            : 'Assign exact leave dates for reporting team member')
          : 'Submit a new time-off request with duration calculation'
      }
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Alert from Server */}
        {apiError && (
          <Alert variant="danger" dismissible onDismiss={() => setApiError(null)}>
            {apiError}
          </Alert>
        )}

        {/* Apply Leave For (Manager / Admin / HR selector) */}
        {(canApplyForTeam || isAssignMode) && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                <span>Select Target Employee</span>
                <span className="text-rose-500">*</span>
              </label>
              {targetEmployeeId && targetEmployeeId !== 'SELF' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  <ShieldCheck className="w-3 h-3 text-brand-600" />
                  {isHrOrAdmin ? 'Admin / HR Assignment' : 'Manager Team Scope'}
                </span>
              )}
            </div>

            {loadingTeam ? (
              <div className="flex items-center gap-2 py-2.5 px-3 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg">
                <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                <span>Loading active employee directory...</span>
              </div>
            ) : teamLoadError ? (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                <span>{teamLoadError}</span>
                <button
                  type="button"
                  onClick={fetchTeamMembers}
                  className="underline font-bold hover:text-rose-800 cursor-pointer ml-2"
                >
                  Retry
                </button>
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                No active employees found to assign leave.
              </div>
            ) : (
              <Select
                value={targetEmployeeId}
                onChange={(e) => {
                  setTargetEmployeeId(e.target.value);
                  setFormErrors((prev) => ({ ...prev, employeeId: undefined }));
                }}
                error={formErrors.employeeId}
                options={[
                  ...(isAssignMode
                    ? [{ value: '', label: '-- Select an Employee to Assign Leave --' }]
                    : (!isAdminOrCeo ? [{ value: 'SELF', label: `Self (${user?.firstName || 'My Account'}) - Standard Leaves` }] : [])),
                  ...teamMembers.map((m) => ({
                    value: m.id,
                    label: `${m.firstName} ${m.lastName} (${m.employeeCode || m.employeeNumber || m.designation?.title || 'Employee'}${m.department?.name ? ` • ${m.department.name}` : ''})`,
                  })),
                ]}
              />
            )}

            {targetEmployeeId === 'SELF' ? (
              <p className="text-[11px] text-slate-500">
                Note: AWOL, Maternity, Sabbatical, and Paternity leaves must be assigned with exact dates by Admin, HR, or your Manager.
              </p>
            ) : targetEmployeeId ? (
              <div className="flex items-center justify-between text-[11px] text-emerald-700">
                <span className="font-medium">
                  {isHrOrAdmin ? 'As Admin/HR' : 'As Manager'}, assigning leave automatically records it directly as Approved.
                </span>
                {loadingTargetBalances && (
                  <span className="text-slate-400 italic">Refreshing balances...</span>
                )}
              </div>
            ) : null}
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
              {selectedBalanceObj && !isUnpaidLeave(selectedTypeObj) && (
                <span className="font-semibold text-brand-600">
                  Available: {selectedBalanceObj.remainingDays} / {selectedBalanceObj.allocatedDays || selectedBalanceObj.entitledDays || 0} days
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

        {/* 3. Date Selection Mode & Inputs */}
        <div className="space-y-3">
          {!formData.isHalfDay && (
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-slate-700">Selection Mode:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectionMode('range')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                    selectionMode === 'range'
                      ? 'bg-white text-brand-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Date Range</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode('specific');
                    if (selectedDates.length === 0 && formData.startDate) {
                      setSelectedDates([formData.startDate]);
                      setSpecificDateInput(formData.startDate);
                    }
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                    selectionMode === 'specific'
                      ? 'bg-white text-brand-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Multiple Specific Dates</span>
                </button>
              </div>
            </div>
          )}

          {selectionMode === 'specific' && !formData.isHalfDay ? (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Select a Date to Add
                  </label>
                  <Input
                    type="date"
                    value={specificDateInput}
                    onChange={(e) => setSpecificDateInput(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleAddSpecificDate}
                  disabled={!specificDateInput || selectedDates.includes(specificDateInput)}
                >
                  + Add Date
                </Button>
              </div>

              {formErrors.selectedDates && (
                <p className="text-xs text-rose-500 font-medium">{formErrors.selectedDates}</p>
              )}

              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Selected Dates ({selectedDates.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedDates.map((dStr) => {
                    const dObj = new Date(dStr + 'T00:00:00');
                    const label = dObj.toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    return (
                      <span
                        key={dStr}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-300 shadow-xs"
                      >
                        <CalendarDays className="w-3 h-3 text-brand-600" />
                        <span>{label}</span>
                        {selectedDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecificDate(dStr)}
                            className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5 font-bold"
                            title="Remove date"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
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
            <>
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

              {/* Balance Validation Warning for SELF applications */}
              {targetEmployeeId === 'SELF' && selectedTypeObj && !isSpecialLeaveType(selectedTypeObj) && !isUnpaidLeave(selectedTypeObj) && (
                (() => {
                  const remainingDays = getRemainingBalance(selectedTypeObj, activeBalances);
                  const requestedDays = durationPreview.totalDays;
                  
                  if (remainingDays === 0) {
                    return (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-rose-900">Insufficient Leave Balance</div>
                          <div className="text-rose-800 mt-0.5 leading-relaxed">
                            You have <strong>0 days available</strong> for {selectedTypeObj.name}. This leave request cannot be submitted. Please contact HR if you need additional leave allocation.
                          </div>
                        </div>
                      </div>
                    );
                  } else if (requestedDays > remainingDays) {
                    return (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-rose-900">Insufficient Leave Balance</div>
                          <div className="text-rose-800 mt-0.5 leading-relaxed">
                            You are requesting <strong>{requestedDays} day{requestedDays === 1 ? '' : 's'}</strong>, but you only have <strong>{remainingDays} day{remainingDays === 1 ? '' : 's'} available</strong> for {selectedTypeObj.name}. Please reduce your leave duration or select a different leave type.
                          </div>
                        </div>
                      </div>
                    );
                  } else if (remainingDays < 0) {
                    return (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-rose-900">Negative Leave Balance Detected</div>
                          <div className="text-rose-800 mt-0.5 leading-relaxed">
                            Your leave balance for {selectedTypeObj.name} is currently <strong>{remainingDays} days</strong> (negative). Please contact HR to resolve this issue before applying for new leave.
                          </div>
                        </div>
                      </div>
                    );
                  } else if (requestedDays <= remainingDays && remainingDays - requestedDays < 2) {
                    // Success case with low balance warning
                    return (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-emerald-900">Balance Available</div>
                          <div className="text-emerald-800 mt-0.5 leading-relaxed">
                            You have <strong>{remainingDays} day{remainingDays === 1 ? '' : 's'} available</strong> for {selectedTypeObj.name}. After this request, you will have <strong>{remainingDays - requestedDays} day{remainingDays - requestedDays === 1 ? '' : 's'} remaining</strong>.
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Success case with good balance
                    return (
                      <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center gap-2 text-xs text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>
                          Balance available: <strong className="text-emerald-900">{remainingDays} days</strong> → After request: <strong className="text-emerald-900">{remainingDays - requestedDays} days remaining</strong>
                        </span>
                      </div>
                    );
                  }
                })()
              )}
            </>
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
            disabled={
              isSubmitting || 
              durationPreview?.isNonWorkingPeriod || 
              durationPreview?.totalDays === 0 ||
              (targetEmployeeId === 'SELF' && selectedTypeObj && !isSpecialLeaveType(selectedTypeObj) && !isUnpaidLeave(selectedTypeObj) && durationPreview && (() => {
                const remainingDays = getRemainingBalance(selectedTypeObj, activeBalances);
                const requestedDays = durationPreview.totalDays;
                return remainingDays === 0 || requestedDays > remainingDays || remainingDays < 0;
              })())
            }
          >
            {isSubmitting
              ? (isAssignMode || targetEmployeeId !== 'SELF' ? 'Assigning Leave...' : 'Submitting Application...')
              : (isAssignMode || targetEmployeeId !== 'SELF' ? 'Assign Leave' : 'Submit Leave Request')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
