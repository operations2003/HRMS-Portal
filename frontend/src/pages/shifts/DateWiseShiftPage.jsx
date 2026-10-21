import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  Users,
  Check,
  RotateCcw,
  History,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  ShieldAlert,
  Info,
  CalendarDays,
  FileText,
  Sliders,
  TrendingUp,
  Activity,
  Award,
  Sun,
  Eye,
  Edit3,
  Download,
  Building,
  Grid,
} from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Avatar } from '../../components/common/Avatar.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { shiftService } from '../../services/shiftService.js';
import { employeeService } from '../../services/employeeService.js';
import { leaveService } from '../../services/leaveService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const PRESET_SHIFTS = [
  { label: '01:00 PM - 04:00 PM, 10:00 PM - 01:00 AM', desc: '1 - 4 PM & 10 PM - 1 AM (6 hrs Split)' },
  { label: '11:00 AM - 08:00 PM', desc: '11 - 8 PM (9 hrs)' },
  { label: '12:00 PM - 06:00 PM', desc: '12 - 6 PM (6 hrs)' },
  { label: '02:00 PM - 08:00 PM', desc: '2 - 8 PM (6 hrs)' },
  { label: '11:00 AM - 07:00 PM', desc: '11 - 7 PM (8 hrs)' },
  { label: '01:00 PM - 07:00 PM', desc: '1 - 7 PM (6 hrs)' },
  { label: '05:00 PM - 11:00 PM', desc: '5 - 11 PM (6 hrs)' },
  { label: '02:00 PM - 10:00 PM', desc: '2 - 10 PM (8 hrs)' },
  { label: '10:00 AM - 07:00 PM', desc: '10 - 7 PM (9 hrs)' },
  { label: '12:00 PM - 08:00 PM', desc: '12 - 8 PM (8 hrs)' },
  { label: '09:00 AM - 05:00 PM', desc: '9 - 5 PM (8 hrs)' },
  { label: '10:00 AM - 06:00 PM', desc: '10 - 6 PM (8 hrs)' },
  { label: '09:30 AM - 05:30 PM', desc: '9:30 - 5:30 PM (8 hrs)' },
  { label: '03:30 PM - 08:00 PM', desc: '3:30 - 8 PM (4.5 hrs)' },
];

/**
 * Format ISO datetime string to 12-hour AM/PM format (e.g. 09:45 AM)
 */
const formatTime12h = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
};

/**
 * Format 12-hour AM/PM string to 24-hour HH:MM:00 (e.g. "11:00 AM" -> "11:00:00", "07:00 PM" -> "19:00:00")
 */
const formatTime24h = (time12h) => {
  if (!time12h || typeof time12h !== 'string') return null;
  const match = time12h.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2] ? match[2] : '00';
  const period = (match[3] || '').toUpperCase();
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}:00`;
};

export const DateWiseShiftPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  const isManager =
    hasRole('Manager') ||
    hasRole('TeamLead') ||
    hasRole('Supervisor');

  const isCeo =
    hasRole('CEO') ||
    hasRole('Director') ||
    (user?.email || '').toLowerCase() === 'sheetalbedi@tasknera.com' ||
    (user?.designationTitle || user?.designation?.title || '').toUpperCase() === 'CEO';

  // Rule: Every employee can see only their record, but Manager, CEO, and HR can see everyone's record
  const canSeeEveryone = isHrOrAdmin || isManager || isCeo;

  // Can this user modify shift assignments?
  const canEditShifts = canSeeEveryone;

  // Month & Year state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12

  // View Mode: 'CALENDAR' (Schedule Overview) vs 'ADJUST' (Date-wise Shift Adjuster)
  const [viewMode, setViewMode] = useState('CALENDAR');

  // Employee Selection State: default to 'ALL' for Manager/CEO/HR, or caller's employeeId for regular employees
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => (canSeeEveryone ? 'ALL' : (user?.employeeId || 'ALL')));
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeFilterTab, setEmployeeFilterTab] = useState('ALL'); // 'ALL' | 'CUSTOM'

  // Shift Schedule State
  const [scheduleData, setScheduleData] = useState(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);

  // Date Selection State (Set of 'YYYY-MM-DD')
  const [selectedDates, setSelectedDates] = useState(new Set());

  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [modalTargetEmployee, setModalTargetEmployee] = useState(null);
  const [shiftType, setShiftType] = useState('SHIFT'); // 'SHIFT' | 'WO'
  const [selectedPreset, setSelectedPreset] = useState('11:00 AM - 07:00 PM');
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [shiftNotes, setShiftNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // History / Audit Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Day Details Modal State (for viewing punch logs & full details of a single day)
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  // Organization Roster Matrix State (When "All Employees" is selected)
  // Default to 'MATRIX' for Excel-like structure
  const [allEmployeesViewMode, setAllEmployeesViewMode] = useState('MATRIX'); // 'MATRIX' | 'DATE_WISE'
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('ALL');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedMatrixCellDetails, setSelectedMatrixCellDetails] = useState(null);

  // Matrix Cell Action Modal State (Change Shift Timing & Apply Leave with bucket deduction)
  const [matrixModalTab, setMatrixModalTab] = useState('SHIFT'); // 'SHIFT' | 'LEAVE' | 'ATTENDANCE'
  const [cellShiftType, setCellShiftType] = useState('SHIFT'); // 'SHIFT' | 'WO'
  const [cellSelectedPreset, setCellSelectedPreset] = useState('11:00 AM - 07:00 PM');
  const [cellCustomStart, setCellCustomStart] = useState('');
  const [cellCustomEnd, setCellCustomEnd] = useState('');
  const [cellIsCustom, setCellIsCustom] = useState(false);
  const [cellShiftNotes, setCellShiftNotes] = useState('');
  const [isSavingCellShift, setIsSavingCellShift] = useState(false);

  // Leave application states for cell
  const [cellLeaveTypes, setCellLeaveTypes] = useState([]);
  const [cellLeaveBalances, setCellLeaveBalances] = useState([]);
  const [isLoadingCellLeaves, setIsLoadingCellLeaves] = useState(false);
  const [selectedCellLeaveTypeId, setSelectedCellLeaveTypeId] = useState('');
  const [isCellHalfDay, setIsCellHalfDay] = useState(false);
  const [cellHalfDayPeriod, setCellHalfDayPeriod] = useState('FIRST_HALF');
  const [cellLeaveReason, setCellLeaveReason] = useState('');
  const [isApplyingCellLeave, setIsApplyingCellLeave] = useState(false);

  // Today ISO Date string
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedRosterDate, setSelectedRosterDate] = useState(todayDateStr);
  const [rosterStatusFilter, setRosterStatusFilter] = useState('ALL'); // 'ALL' | 'WORKING' | 'WO' | 'LEAVE' | 'OVERRIDE'

  // 1. Fetch eligible employees on mount
  const fetchEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      let list = [];

      try {
        list = await shiftService.getEligibleEmployees();
      } catch (err) {
        console.warn('[ShiftPage] shiftService.getEligibleEmployees warning:', err.message);
      }

      // If empty and user is HR/Admin/Manager, fallback to universal employeeService
      if ((!Array.isArray(list) || list.length === 0) && canEditShifts) {
        try {
          const empRes = await employeeService.listEmployees({ limit: 500 });
          list = empRes?.employees || empRes?.data || empRes?.items || [];
        } catch (err) {
          console.warn('[ShiftPage] employeeService fallback warning:', err.message);
        }
      }

      const isCeoEmp = (e) => {
        const desig = (e.designationTitle || e.designation?.title || '').toLowerCase();
        const email = (e.email || '').toLowerCase();
        const id = e.id || '';
        return (
          id === 'emp-shubham-admin' ||
          email === 'sheetalbedi@tasknera.com' ||
          email === 'sheetal@tasknera.com' ||
          desig.includes('ceo')
        );
      };

      const formatted = (Array.isArray(list) ? list : [])
        .filter((e) => !isCeoEmp(e))
        .map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode || e.code || '',
          firstName: e.firstName || '',
          lastName: e.lastName || '',
          fullName:
            e.fullName ||
            `${e.firstName || ''} ${e.lastName || ''}`.trim() ||
            'Employee',
          email: e.email || '',
          defaultShiftTiming: e.shiftTiming || e.defaultShiftTiming || '11:00 AM - 07:00 PM',
          avatarUrl: e.avatarUrl || null,
          departmentName: e.departmentName || e.department?.name || '',
          departmentId: e.departmentId || e.dept_id || '',
          designationTitle: e.designationTitle || e.designation?.title || '',
          customShiftCount: e.customShiftCount || 0,
        }));

      setEmployees(formatted);

      if (formatted.length > 0) {
        setSelectedEmployeeId((prev) => {
          if (canSeeEveryone) {
            if (prev === 'ALL') return 'ALL';
            if (prev && formatted.some((e) => e.id === prev)) return prev;
            return 'ALL';
          }
          const callerMatch = formatted.find((e) => e.id === user?.employeeId) || formatted[0];
          return callerMatch ? callerMatch.id : formatted[0].id;
        });
      }
    } catch (err) {
      toast.error('Failed to load eligible employees for schedule.');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // 2. Fetch shift schedule & attendance when employee or month/year changes
  const fetchSchedule = async () => {
    if (!selectedEmployeeId) return;

    try {
      setIsLoadingSchedule(true);
      setScheduleError(null);
      const data = await shiftService.getEmployeeShifts({
        employeeId: selectedEmployeeId,
        month: currentMonth,
        year: currentYear,
        departmentId: selectedDepartmentFilter !== 'ALL' ? selectedDepartmentFilter : undefined,
      });
      setScheduleData(data);
      // Clear selected dates on month/employee switch
      setSelectedDates(new Set());
    } catch (err) {
      console.error('[ShiftPage] fetchSchedule error:', err);
      setScheduleError(err.message || 'Failed to retrieve monthly schedule data.');
      toast.error('Failed to retrieve monthly schedule data.');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedEmployeeId, currentMonth, currentYear, selectedDepartmentFilter]);

  // Date Navigation Handlers for Date-wise Roster
  const handleRosterDateChange = (newDateStr) => {
    if (!newDateStr) return;
    setSelectedRosterDate(newDateStr);
    const parts = newDateStr.split('-');
    if (parts.length >= 2) {
      const newY = parseInt(parts[0], 10);
      const newM = parseInt(parts[1], 10);
      if (newY && newM && (newY !== currentYear || newM !== currentMonth)) {
        setCurrentYear(newY);
        setCurrentMonth(newM);
      }
    }
  };

  const handlePrevDay = () => {
    try {
      const cur = new Date(`${selectedRosterDate}T00:00:00`);
      cur.setDate(cur.getDate() - 1);
      const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      handleRosterDateChange(dStr);
    } catch {
      handleRosterDateChange(todayDateStr);
    }
  };

  const handleNextDay = () => {
    try {
      const cur = new Date(`${selectedRosterDate}T00:00:00`);
      cur.setDate(cur.getDate() + 1);
      const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      handleRosterDateChange(dStr);
    } catch {
      handleRosterDateChange(todayDateStr);
    }
  };

  const handleTodayDay = () => {
    handleRosterDateChange(todayDateStr);
    handleTodayMonth();
  };

  const formatRosterDateHeading = (dateStr) => {
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Is "All Employees" consolidated matrix view active?
  const isAllMode = selectedEmployeeId === 'ALL';

  // Selected employee object (for single employee view)
  const activeEmployee = useMemo(() => {
    if (isAllMode) return null;
    return employees.find((e) => e.id === selectedEmployeeId) || scheduleData?.employee || null;
  }, [employees, selectedEmployeeId, scheduleData, isAllMode]);

  // Count employees with custom/adjusted shifts
  const withCustomCount = useMemo(() => {
    return employees.filter((e) => (e.customShiftCount || 0) > 0).length;
  }, [employees]);

  // Filtered employees for dropdown
  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (employeeFilterTab === 'CUSTOM') {
      list = list.filter((e) => (e.customShiftCount || 0) > 0);
    }
    if (!employeeSearch.trim()) return list;
    const q = employeeSearch.toLowerCase();
    return list.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.departmentName?.toLowerCase().includes(q) ||
        e.designationTitle?.toLowerCase().includes(q) ||
        e.defaultShiftTiming?.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch, employeeFilterTab]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleTodayMonth = () => {
    setCurrentMonth(today.getMonth() + 1);
    setCurrentYear(today.getFullYear());
  };

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun, 1 = Mon...
    // Adjust to Monday start (0 = Mon, 6 = Sun)
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];

    // Leading empty slots for previous month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push({ empty: true, key: `empty-prev-${i}` });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const mStr = String(currentMonth).padStart(2, '0');
      const dateKey = `${currentYear}-${mStr}-${dayStr}`;

      const dateObj = new Date(currentYear, currentMonth - 1, d);
      const isSunday = dateObj.getDay() === 0;
      const isWeekend = isSunday;

      const customAssignment = scheduleData?.customShiftsByDate?.[dateKey] || null;
      const holiday = scheduleData?.holidaysByDate?.[dateKey] || null;
      const approvedLeave = !isSunday
        ? (scheduleData?.approvedLeaves || []).find((l) => {
          const start = l.startDate?.slice(0, 10);
          const end = l.endDate?.slice(0, 10);
          return dateKey >= start && dateKey <= end;
        })
        : null;
      const attendance = scheduleData?.attendanceByDate?.[dateKey] || null;

      const isHalfDay = Boolean(
        approvedLeave?.isHalfDay ||
        approvedLeave?.leaveCode === 'HDL' ||
        (approvedLeave?.leaveName && approvedLeave.leaveName.toLowerCase().includes('half')) ||
        attendance?.status === 'HALF_DAY'
      );

      days.push({
        dayNumber: d,
        dateKey,
        isWeekend,
        isSunday,
        customAssignment,
        holiday,
        approvedLeave,
        isHalfDay,
        attendance,
        isToday:
          today.getFullYear() === currentYear &&
          today.getMonth() + 1 === currentMonth &&
          today.getDate() === d,
      });
    }

    return days;
  }, [currentYear, currentMonth, scheduleData]);

  // Monthly Overview Statistics
  const monthStats = useMemo(() => {
    if (isAllMode) {
      const summary = scheduleData?.summary || {};
      const rosterList = scheduleData?.roster || [];
      let totalWorkMins = 0;
      rosterList.forEach((r) => {
        const str = r.stats?.totalWorkHoursFormatted || '';
        const match = str.match(/(\d+)h\s*(\d+)m/);
        if (match) {
          totalWorkMins += parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        }
      });
      const totalHrs = Math.floor(totalWorkMins / 60);
      const totalMins = totalWorkMins % 60;

      return {
        totalDays: scheduleData?.days?.length || 31,
        attendanceLoggedDays: summary.totalAttendancePunches || 0,
        totalWorkHoursStr: `${totalHrs}h ${totalMins}m`,
        customOverridesCount: summary.totalOverrides || 0,
        leavesCount: summary.totalApprovedLeaves || 0,
        holidaysCount: summary.totalHolidays || 0,
      };
    }

    if (!scheduleData) {
      return {
        totalDays: 0,
        attendanceLoggedDays: 0,
        totalWorkHoursStr: '0h 0m',
        customOverridesCount: 0,
        leavesCount: 0,
        holidaysCount: 0,
      };
    }

    const attendanceByDate = scheduleData.attendanceByDate || {};
    const customShifts = scheduleData.customShiftsByDate || {};
    const holidays = scheduleData.holidaysByDate || {};
    const leaves = scheduleData.approvedLeaves || [];

    let totalMinutes = 0;
    let loggedDays = 0;

    Object.values(attendanceByDate).forEach((att) => {
      if (att.checkIn || ['PRESENT', 'LATE', 'HALF_DAY'].includes(att.status)) {
        loggedDays += 1;
      }
      if (att.workMinutes > 0) {
        totalMinutes += att.workMinutes;
      }
    });

    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalWorkHoursStr = `${hrs}h ${mins}m`;

    return {
      totalDays: calendarDays.filter((d) => !d.empty).length,
      attendanceLoggedDays: loggedDays,
      totalWorkHoursStr,
      customOverridesCount: Object.keys(customShifts).length,
      leavesCount: leaves.length,
      holidaysCount: Object.keys(holidays).length,
    };
  }, [scheduleData, calendarDays, isAllMode]);

  // Filtered rows for All Employees Matrix Grid
  const filteredRosterRows = useMemo(() => {
    if (!scheduleData?.roster) return [];
    let list = scheduleData.roster.filter((r) => {
      const desig = (r.employee?.designationTitle || '').toLowerCase();
      const email = (r.employee?.email || '').toLowerCase();
      const id = r.employee?.id || '';
      return id !== 'emp-shubham-admin' && email !== 'sheetalbedi@tasknera.com' && email !== 'sheetal@tasknera.com' && !desig.includes('ceo');
    });

    if (selectedDepartmentFilter && selectedDepartmentFilter !== 'ALL') {
      const filterLower = selectedDepartmentFilter.toLowerCase();
      list = list.filter((r) =>
        (r.employee.departmentName && r.employee.departmentName.toLowerCase() === filterLower) ||
        (r.employee.departmentId && r.employee.departmentId.toLowerCase() === filterLower)
      );
    }
    if (!matrixSearch.trim()) return list;
    const q = matrixSearch.toLowerCase();
    return list.filter(
      (r) =>
        r.employee.fullName?.toLowerCase().includes(q) ||
        r.employee.employeeCode?.toLowerCase().includes(q) ||
        r.employee.departmentName?.toLowerCase().includes(q) ||
        r.employee.designationTitle?.toLowerCase().includes(q) ||
        r.employee.defaultShiftTiming?.toLowerCase().includes(q)
    );
  }, [scheduleData?.roster, selectedDepartmentFilter, matrixSearch]);

  // Filtered rows for Date-Wise Daily Roster (All Employees for selectedRosterDate)
  const dailyRosterRows = useMemo(() => {
    if (!scheduleData?.roster) return [];
    let list = scheduleData.roster
      .filter((r) => {
        const desig = (r.employee?.designationTitle || '').toLowerCase();
        const email = (r.employee?.email || '').toLowerCase();
        const id = r.employee?.id || '';
        return id !== 'emp-shubham-admin' && email !== 'sheetalbedi@tasknera.com' && email !== 'sheetal@tasknera.com' && !desig.includes('ceo');
      })
      .map((r) => ({
        employee: r.employee,
        cell: r.cells?.[selectedRosterDate] || null,
        stats: r.stats,
      }));

    // Department filter
    if (selectedDepartmentFilter && selectedDepartmentFilter !== 'ALL') {
      const filterLower = selectedDepartmentFilter.toLowerCase();
      list = list.filter(
        (row) =>
          (row.employee.departmentName && row.employee.departmentName.toLowerCase() === filterLower) ||
          (row.employee.departmentId && row.employee.departmentId.toLowerCase() === filterLower)
      );
    }

    // Status filter
    if (rosterStatusFilter && rosterStatusFilter !== 'ALL') {
      list = list.filter((row) => {
        const c = row.cell;
        if (!c) return false;
        if (rosterStatusFilter === 'WORKING') {
          return c.displayType === 'SHIFT' || c.displayType === 'OVERRIDE' || (!c.holiday && !c.leave && c.shiftType !== 'WO');
        }
        if (rosterStatusFilter === 'WO') {
          return c.shiftType === 'WO' || c.displayType === 'WO';
        }
        if (rosterStatusFilter === 'LEAVE') {
          return Boolean(c.leave || c.isHalfDay || c.displayType === 'LEAVE' || c.displayType === 'HALF_DAY');
        }
        if (rosterStatusFilter === 'OVERRIDE') {
          return Boolean(c.isOverride || c.displayType === 'OVERRIDE');
        }
        if (rosterStatusFilter === 'HOLIDAY') {
          return Boolean(c.holiday || c.displayType === 'HOLIDAY');
        }
        if (rosterStatusFilter === 'PRESENT') {
          return c.attendance && ['PRESENT', 'LATE', 'HALF_DAY', 'ON_DUTY'].includes(c.attendance.status);
        }
        return true;
      });
    }

    // Search query across name, code, dept, designation, shift
    if (matrixSearch.trim()) {
      const q = matrixSearch.toLowerCase();
      list = list.filter(
        (row) =>
          row.employee.fullName?.toLowerCase().includes(q) ||
          row.employee.employeeCode?.toLowerCase().includes(q) ||
          row.employee.departmentName?.toLowerCase().includes(q) ||
          row.employee.designationTitle?.toLowerCase().includes(q) ||
          row.employee.defaultShiftTiming?.toLowerCase().includes(q) ||
          row.cell?.shiftLabel?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [scheduleData?.roster, selectedRosterDate, selectedDepartmentFilter, rosterStatusFilter, matrixSearch]);

  // Daily statistics for selectedRosterDate
  const dailyRosterStats = useMemo(() => {
    if (!scheduleData?.roster) {
      return { total: 0, working: 0, weeklyOff: 0, leave: 0, holiday: 0, override: 0, present: 0 };
    }
    let total = 0;
    let working = 0;
    let weeklyOff = 0;
    let leave = 0;
    let holiday = 0;
    let override = 0;
    let present = 0;

    scheduleData.roster.forEach((r) => {
      total++;
      const cell = r.cells?.[selectedRosterDate];
      if (!cell) return;
      if (cell.holiday || cell.displayType === 'HOLIDAY') {
        holiday++;
      } else if (cell.isHalfDay || cell.leave || cell.displayType === 'LEAVE' || cell.displayType === 'HALF_DAY') {
        leave++;
      } else if (cell.shiftType === 'WO' || cell.displayType === 'WO') {
        weeklyOff++;
      } else {
        working++;
      }
      if (cell.isOverride || cell.displayType === 'OVERRIDE') {
        override++;
      }
      if (cell.attendance && ['PRESENT', 'LATE', 'HALF_DAY', 'ON_DUTY'].includes(cell.attendance.status)) {
        present++;
      }
    });

    return { total, working, weeklyOff, leave, holiday, override, present };
  }, [scheduleData?.roster, selectedRosterDate]);

  // Quick edit shift for a specific employee on a specific date
  const handleQuickEditEmployeeShift = (emp, dateStr) => {
    if (!canEditShifts) return;
    if (hasRole('HR') && !hasRole('Admin') && !hasRole('SuperAdmin') && user?.employeeId === emp.id) {
      toast.error('You cannot modify your own shift timings.');
      return;
    }
    setModalTargetEmployee(emp);
    setSelectedDates(new Set([dateStr]));
    setIsAssignModalOpen(true);
  };

  // Unique department options for filtering
  const departmentOptions = useMemo(() => {
    if (scheduleData?.departments && Array.isArray(scheduleData.departments) && scheduleData.departments.length > 0) {
      return scheduleData.departments;
    }
    const set = new Set();
    employees.forEach((e) => {
      if (e.departmentName) set.add(e.departmentName);
    });
    return Array.from(set).sort();
  }, [scheduleData?.departments, employees]);

  // Export Roster to CSV Spreadsheet
  const handleExportRosterCSV = () => {
    if (!scheduleData?.roster || !scheduleData?.days) {
      toast.error('No roster data available to export.');
      return;
    }

    const days = scheduleData.days;
    const dayHeaders = days.map((d) => `Day ${d.dayNumber} (${d.dayName})`).join(',');
    const headerRow = `Employee Code,Employee Name,Department,Designation,Default Shift,${dayHeaders},Scheduled Days,Present Days,Half Days,Shift Overrides,Approved Leaves,Weekly Offs,Total Hours Worked\n`;

    const rows = filteredRosterRows.map((r) => {
      const emp = r.employee;
      const dayValues = days.map((d) => {
        const cell = r.cells[d.dateKey];
        if (!cell) return '-';
        if (d.dayName === 'Sun' || cell.isSunday || cell.shiftType === 'WO' || cell.displayType === 'WO') return 'Weekly Off';
        if (cell.holiday) return `Holiday (${cell.holiday.name || 'Holiday'})`;
        if (cell.shiftType === 'HL' || cell.shiftType === 'HOLIDAY' || cell.cellText === 'HL' || cell.displayType === 'HOLIDAY') return 'Holiday (HL)';
        if (cell.isHalfDay || cell.displayType === 'HALF_DAY') return 'Half Day';
        if (cell.leave || cell.displayType === 'LEAVE') {
          const lCode = cell.leave?.leaveCode || cell.cellText || '';
          const lName = cell.leave?.leaveName || cell.cellText || 'Leave';
          return `"${lCode ? `${lCode}: ${lName}` : lName}"`;
        }
        const shift = cell.shiftLabel || emp.defaultShiftTiming || 'Shift';
        const att = cell.attendance ? ` [Att: ${cell.attendance.status} ${cell.attendance.formattedWorkHours}]` : '';
        return `"${shift}${att}"`;
      }).join(',');

      return `"${emp.employeeCode}","${emp.fullName}","${emp.departmentName}","${emp.designationTitle}","${emp.defaultShiftTiming}",${dayValues},${r.stats.scheduledDays},${r.stats.presentDays},${r.stats.halfDays || 0},${r.stats.overridesCount},${r.stats.leavesDays},${r.stats.weeklyOffsCount},"${r.stats.totalWorkHoursFormatted}"`;
    }).join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headerRow + rows);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `Monthly_Roster_${monthNames[currentMonth - 1]}_${currentYear}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Monthly Roster CSV exported successfully.');
  };

  // Toggle selection of a single date
  const handleToggleDate = (dateKey) => {
    if (!canEditShifts) return;
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Select all days in current month
  const handleSelectAllDays = () => {
    if (!canEditShifts) return;
    const all = new Set();
    calendarDays.forEach((d) => {
      if (!d.empty) all.add(d.dateKey);
    });
    setSelectedDates(all);
  };

  // Clear date selection
  const handleClearSelection = () => {
    setSelectedDates(new Set());
  };

  // Quick Open Modal for single date
  const handleOpenAssignForDate = (dateKey) => {
    if (!canEditShifts) return;
    setSelectedDates(new Set([dateKey]));
    setIsAssignModalOpen(true);
  };

  // Open Assign Modal for current selected set
  const handleOpenAssignModal = () => {
    if (!canEditShifts) return;
    if (selectedDates.size === 0) {
      toast.error('Please select at least one date on the calendar.');
      return;
    }
    setIsAssignModalOpen(true);
  };

  // Handle Save Shift Assignment
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (selectedDates.size === 0) {
      toast.error('No dates selected.');
      return;
    }

    const targetEmpId = modalTargetEmployee?.id || selectedEmployeeId;
    if (!targetEmpId || targetEmpId === 'ALL') {
      toast.error('Please select an employee.');
      return;
    }

    try {
      setIsSaving(true);
      let payload = {
        employeeId: targetEmpId,
        dates: Array.from(selectedDates),
        shiftType,
        notes: shiftNotes.trim(),
      };

      if (shiftType === 'WO') {
        payload.shiftLabel = 'Weekly Off';
      } else {
        if (isCustomMode) {
          if (!customStartTime || !customEndTime) {
            toast.error('Please enter both custom start time and end time.');
            setIsSaving(false);
            return;
          }
          payload.shiftStartTime = `${customStartTime}:00`;
          payload.shiftEndTime = `${customEndTime}:00`;
          payload.shiftLabel = `${customStartTime} - ${customEndTime}`;
        } else {
          payload.shiftLabel = selectedPreset;
        }
      }

      const res = await shiftService.assignShifts(payload);
      toast.success(res.message || 'Shift timings successfully assigned!');
      setIsAssignModalOpen(false);
      setModalTargetEmployee(null);
      setSelectedDates(new Set());
      setShiftNotes('');
      // Refresh schedule and employees
      await fetchSchedule();
      await fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to assign shift timings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reset Dates to Default Shift
  const handleResetToDefault = async (datesToReset = null, targetEmp = null) => {
    if (!canEditShifts) return;
    const targetDates = datesToReset || Array.from(selectedDates);

    if (targetDates.length === 0) {
      toast.error('Please select at least one date to reset back to default shift.');
      return;
    }

    const empId = targetEmp?.id || modalTargetEmployee?.id || selectedEmployeeId;
    if (!empId || empId === 'ALL') {
      toast.error('Please select a specific employee to reset shifts.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await shiftService.resetShifts({
        employeeId: empId,
        dates: targetDates,
      });

      toast.success(res.message || 'Reset selected dates back to default contract shift.');
      setSelectedDates(new Set());
      await fetchSchedule();
      await fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reset shifts.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch Audit Trail
  const handleOpenHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setIsHistoryModalOpen(true);
      const res = await shiftService.getAuditHistory({
        employeeId: selectedEmployeeId,
        limit: 50,
      });
      setAuditHistory(res?.history || []);
    } catch (err) {
      toast.error('Failed to load shift change history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Open Matrix Cell Modal (Excel-like Interactive Editor)
  const handleOpenMatrixCell = async (employee, dateKey, cell) => {
    setSelectedMatrixCellDetails({ employee, dateKey, cell });
    setMatrixModalTab('SHIFT');

    const isSunday = cell.isSunday || (dateKey ? new Date(`${dateKey}T00:00:00`).getDay() === 0 : false);

    if (cell.shiftType === 'WO' || isSunday) {
      setCellShiftType('WO');
      setCellSelectedPreset('11:00 AM - 07:00 PM');
      setCellIsCustom(false);
    } else {
      setCellShiftType('SHIFT');
      const timing = cell.shiftLabel || employee.defaultShiftTiming || '11:00 AM - 07:00 PM';
      const foundPreset = PRESET_SHIFTS.find((p) => p.label === timing);
      if (foundPreset) {
        setCellSelectedPreset(foundPreset.label);
        setCellIsCustom(false);
      } else {
        setCellSelectedPreset('11:00 AM - 07:00 PM');
        setCellIsCustom(true);
        if (cell.customAssignment?.shiftStartTime && cell.customAssignment?.shiftEndTime) {
          setCellCustomStart(cell.customAssignment.shiftStartTime.slice(0, 5));
          setCellCustomEnd(cell.customAssignment.shiftEndTime.slice(0, 5));
        }
      }
    }
    setCellShiftNotes(cell.customAssignment?.notes || '');
    setIsCellHalfDay(false);
    setCellHalfDayPeriod('FIRST_HALF');
    setCellLeaveReason('');

    // Fetch leave types and employee balances in background
    try {
      setIsLoadingCellLeaves(true);
      const [typesRes, balancesRes] = await Promise.allSettled([
        leaveService.getLeaveTypes({ all: true }),
        leaveService.getEmployeeBalances(employee.id, currentYear),
      ]);
      const types = typesRes.status === 'fulfilled' ? typesRes.value : [];
      const balances = balancesRes.status === 'fulfilled' ? balancesRes.value : [];
      const validTypes = Array.isArray(types) ? types : [];
      setCellLeaveTypes(validTypes);
      setCellLeaveBalances(Array.isArray(balances) ? balances : []);
      if (validTypes.length > 0) {
        const preferred = validTypes.find((t) => ['CL', 'PL', 'SL'].includes(t.code)) || validTypes[0];
        setSelectedCellLeaveTypeId(preferred.id);
      }
    } catch (e) {
      console.warn('Failed to load leave types/balances for cell modal:', e.message);
    } finally {
      setIsLoadingCellLeaves(false);
    }
  };

  // Save Shift Timing from Matrix Cell Modal
  const handleSaveMatrixCellShift = async () => {
    if (!selectedMatrixCellDetails) return;
    const { employee, dateKey } = selectedMatrixCellDetails;

    try {
      setIsSavingCellShift(true);
      let payload = {
        employeeId: employee.id,
        dates: [dateKey],
        shiftType: cellShiftType,
        notes: cellShiftNotes.trim(),
      };

      if (cellShiftType === 'WO') {
        payload.shiftLabel = 'Weekly Off';
      } else if (cellIsCustom) {
        if (!cellCustomStart || !cellCustomEnd) {
          toast.error('Please enter both custom start time and end time.');
          setIsSavingCellShift(false);
          return;
        }
        const sTime = `${cellCustomStart}:00`;
        const eTime = `${cellCustomEnd}:00`;
        payload.shiftStartTime = sTime;
        payload.shiftEndTime = eTime;
        payload.shiftLabel = `${formatTime12h(`2000-01-01T${sTime}`)} - ${formatTime12h(`2000-01-01T${eTime}`)}`;
      } else {
        payload.shiftLabel = cellSelectedPreset;
        const [startPart, endPart] = cellSelectedPreset.split(/\s*-\s*/);
        if (startPart && endPart) {
          payload.shiftStartTime = formatTime24h(startPart);
          payload.shiftEndTime = formatTime24h(endPart);
        }
      }

      const res = await shiftService.assignShifts(payload);
      toast.success(res.message || `Shift updated for ${employee.fullName} on ${dateKey}. Daily login/logout timing updated.`);
      setSelectedMatrixCellDetails(null);
      await fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update shift timing.');
    } finally {
      setIsSavingCellShift(false);
    }
  };

  // Reset Shift Timing from Matrix Cell Modal back to contract default
  const handleResetMatrixCellShift = async () => {
    if (!selectedMatrixCellDetails) return;
    const { employee, dateKey } = selectedMatrixCellDetails;
    try {
      setIsSavingCellShift(true);
      await shiftService.resetShifts({
        employeeId: employee.id,
        dates: [dateKey],
      });
      toast.success(`Reset ${dateKey} back to contract default shift for ${employee.fullName}.`);
      setSelectedMatrixCellDetails(null);
      await fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reset shift timing.');
    } finally {
      setIsSavingCellShift(false);
    }
  };

  // Apply Leave from Matrix Cell Modal (deducts from bucket)
  const handleApplyMatrixCellLeave = async () => {
    if (!selectedMatrixCellDetails) return;
    const { employee, dateKey } = selectedMatrixCellDetails;

    if (!selectedCellLeaveTypeId) {
      toast.error('Please select a leave category.');
      return;
    }

    try {
      setIsApplyingCellLeave(true);
      await leaveService.applyLeave({
        employeeId: employee.id,
        leaveTypeId: selectedCellLeaveTypeId,
        dates: [dateKey],
        startDate: dateKey,
        endDate: dateKey,
        isHalfDay: isCellHalfDay,
        halfDayPeriod: isCellHalfDay ? cellHalfDayPeriod : null,
        reason: cellLeaveReason.trim() || `Applied from Monthly Roster on ${dateKey}`,
      });

      const selectedLt = cellLeaveTypes.find((t) => t.id === selectedCellLeaveTypeId);
      const ltName = selectedLt?.name || selectedLt?.code || 'Leave';
      const daysCount = isCellHalfDay ? '0.5 day' : '1.0 day';
      toast.success(`Leave applied successfully! Deducted ${daysCount} from ${ltName} bucket for ${employee.fullName}.`);
      setSelectedMatrixCellDetails(null);
      await fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to apply leave.');
    } finally {
      setIsApplyingCellLeave(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-5 w-full max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-6 py-5 animate-fade-in">
      {/* =================================================================== */}
      {/* 1. Header & Quick Actions                                           */}
      {/* =================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-xs">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {canSeeEveryone ? 'Monthly Roster & Schedule' : 'My Monthly Shift Schedule'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {canSeeEveryone
                  ? 'Consolidated monthly roster spreadsheet. Click any cell to update shift timing or apply leaves.'
                  : 'Personal monthly schedule spreadsheet. Click any day to view shift timing and daily punch details.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={handleExportRosterCSV}
            title="Export Monthly Roster as CSV spreadsheet matching layout"
          >
            Export CSV
          </Button>

          {canEditShifts && (
            <Button
              variant="outline"
              size="sm"
              icon={History}
              onClick={handleOpenHistory}
              title="View shift change audit trail"
            >
              History
            </Button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. Monthly Overview KPIs Summary Bar                                */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1e3a8a] dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
              {canSeeEveryone ? 'Employees in Roster' : 'My Schedule Record'}
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {canSeeEveryone ? (
                <>
                  {filteredRosterRows.length} <span className="text-xs font-normal text-slate-400">/ {employees.length} active</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">Self Only</span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
              Schedule Policy
            </p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              Standard Weekly Schedule
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Shift Overrides</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {monthStats.customOverridesCount} <span className="text-xs font-normal text-slate-400">active overrides</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Approved Leaves</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {monthStats.leavesCount} <span className="text-xs font-normal text-slate-400">request(s)</span>
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. Organization Monthly Roster Spreadsheet Matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4">
        {/* Error Notification Banner with Retry button */}
        {scheduleError && (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="font-bold text-xs">Error loading roster schedule</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-300">{scheduleError}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" icon={RotateCcw} onClick={fetchSchedule} className="shrink-0 text-xs bg-white text-rose-700 border-rose-300 hover:bg-rose-50">
              Retry
            </Button>
          </div>
        )}

        {/* Top Toolbar: Month Navigation, Dept filter, Search, Export */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-slate-900 dark:text-white min-w-[170px] text-center">
              {monthNames[currentMonth - 1]} {currentYear}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTodayMonth}
              className="text-xs text-brand-600 dark:text-brand-400 font-medium"
            >
              Today
            </Button>
          </div>

          {/* Filters for Matrix View */}
          {canSeeEveryone ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Department filter */}
              <div className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedDepartmentFilter}
                  onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
                  className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium cursor-pointer"
                >
                  <option value="ALL">All Departments ({employees.length})</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search in Rows */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  placeholder="Search employee, designation..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <Badge variant="neutral" size="sm">
                {filteredRosterRows.length} Rows
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="brand" size="sm">Personal Record</Badge>
            </div>
          )}
        </div>

        {/* Legend strip */}
        <div className="flex items-center gap-3.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap p-2.5 bg-slate-50/80 dark:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Roster Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">WO</span>
            <span>Weekly Off (Sundays)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">11 - 8 PM</span>
            <span>Working Shifts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fef08a] text-amber-950 border border-amber-300 shadow-2xs">CL / PL / SL / HD / UP</span>
            <span>Approved Leaves & Half Days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-300 dark:text-slate-600">NA</span>
            <span>Not Scheduled / Inactive</span>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoadingSchedule ? (
          <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Loading employee monthly roster spreadsheet...
            </span>
          </div>
        ) : filteredRosterRows.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No employee roster records found for the selected filter.</p>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedDepartmentFilter('ALL'); setMatrixSearch(''); }}>
              Reset Filters
            </Button>
          </div>
        ) : (
          /* ============================================================= */
          /* THE EXCEL SPREADSHEET MATRIX (MATCHING USER PDF LAYOUT)       */
          /* ============================================================= */
          <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm max-w-full">
            <table className="w-full text-left border-collapse text-xs">
              {/* 2-Tier Deep Navy Blue Header */}
              <thead>
                {/* Header Row 1: Day Numbers + Column Titles */}
                <tr className="bg-[#1e3a8a] text-white border-b border-blue-900 select-none">
                  {/* Sticky 1: Employee Name */}
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 bg-[#1e3a8a] text-white p-2.5 w-[180px] min-w-[180px] max-w-[180px] border-r border-blue-800 font-bold text-xs uppercase tracking-wider text-left shadow-xs align-middle"
                  >
                    Employee Name
                  </th>

                  {/* Sticky 2: Designation */}
                  <th
                    rowSpan={2}
                    className="sticky left-[180px] z-30 bg-[#1e3a8a] text-white p-2.5 w-[140px] min-w-[140px] max-w-[140px] border-r border-blue-800 font-bold text-xs uppercase tracking-wider text-left shadow-xs align-middle"
                  >
                    Designation
                  </th>

                  {/* Day numbers 1..N directly following Designation */}
                  {scheduleData?.days?.map((day) => (
                    <th
                      key={day.dateKey}
                      className="p-1.5 text-center min-w-[62px] max-w-[76px] border-r border-blue-800 bg-[#1e3a8a] text-white font-extrabold text-xs"
                    >
                      {day.dayNumber}
                    </th>
                  ))}

                  {/* Right: Working Days Column */}
                  <th
                    className="p-1.5 text-center min-w-[75px] max-w-[85px] border-l border-blue-800 bg-[#1e3a8a] text-white font-extrabold text-xs whitespace-nowrap"
                  >
                    Working
                  </th>
                </tr>

                {/* Header Row 2: Day Names (Sat, Sun, Mon...) */}
                <tr className="bg-[#1e3a8a] text-white border-b-2 border-blue-900 select-none">
                  {/* Day Names under each Day Number */}
                  {scheduleData?.days?.map((day) => {
                    const isSun = day.dayName === 'Sun' || day.isSunday;
                    return (
                      <th
                        key={'dayName-' + day.dateKey}
                        className={'p-1 text-center min-w-[62px] max-w-[76px] border-r border-blue-800 text-[10px] font-bold ' + (
                          isSun ? 'bg-blue-950 text-amber-300' : 'bg-[#1e3a8a] text-blue-100'
                        )}
                      >
                        {day.dayName}
                      </th>
                    );
                  })}

                  {/* Days label under Working */}
                  <th className="p-1 text-center min-w-[75px] max-w-[85px] border-l border-blue-800 bg-[#1e3a8a] text-blue-100 text-[10px] font-bold">
                    Days
                  </th>
                </tr>
              </thead>

              {/* Table Body Rows */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredRosterRows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Sticky 1: Employee Name */}
                    <td className="sticky left-0 z-20 bg-white dark:bg-slate-900 p-2.5 w-[180px] min-w-[180px] max-w-[180px] border-r border-slate-200 dark:border-slate-800 shadow-xs">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate" title={row.employee.fullName}>
                        {row.employee.fullName}
                      </div>
                    </td>

                    {/* Sticky 2: Designation */}
                    <td className="sticky left-[180px] z-20 bg-white dark:bg-slate-900 p-2.5 w-[140px] min-w-[140px] max-w-[140px] border-r border-slate-200 dark:border-slate-800 shadow-xs">
                      <div className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium" title={row.employee.designationTitle || 'Staff'}>
                        {row.employee.designationTitle || 'Staff'}
                      </div>
                    </td>

                    {/* Day Cells 1..N */}
                    {scheduleData?.days?.map((day) => {
                      const cell = row.cells?.[day.dateKey];
                      const isSun = day.dayName === 'Sun' || cell?.isSunday;
                      const isWO = cell?.shiftType === 'WO' || cell?.displayType === 'WO' || isSun;
                      const isHoliday = cell?.holiday || cell?.shiftType === 'HL' || cell?.shiftType === 'HOLIDAY' || cell?.displayType === 'HOLIDAY';
                      const isHalfDay = Boolean(!isHoliday && (cell?.isHalfDay || cell?.displayType === 'HALF_DAY'));
                      const isLeave = Boolean(!isHoliday && (cell?.leave || cell?.displayType === 'LEAVE') && !isHalfDay);
                      const isOverride = Boolean(cell?.isOverride || cell?.displayType === 'OVERRIDE');
                      const isNA = cell?.shortLabel === 'NA' || cell?.displayType === 'NA';
                      const text = cell?.cellText || cell?.shortLabel || (isWO ? 'WO' : '-');
                      const att = cell?.attendance;

                      const isYellowBadge = isHalfDay || isLeave || ['CL', 'PL', 'SL', 'HD', 'UP', 'LEAVE'].includes(text);
                      const isHolidayBadge = isHoliday || text === 'HL' || text === 'HOLIDAY';

                      return (
                        <td
                          key={day.dateKey}
                          onClick={() => {
                            if (canEditShifts) {
                              handleOpenMatrixCell(row.employee, day.dateKey, cell || {});
                            } else {
                              setSelectedDayDetails({
                                date: day.dateKey,
                                isSunday: isSun,
                                isWeeklyOff: isWO,
                                shiftLabel: cell?.shiftLabel || (isWO ? 'Weekly Off (WO)' : text),
                                isHalfDay,
                                isLeave,
                                leave: cell?.leave,
                                attendance: att,
                                employee: row.employee,
                              });
                            }
                          }}
                          className={'p-1 text-center min-w-[62px] max-w-[76px] border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-all hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:ring-1 hover:ring-blue-400 select-none ' + (
                            isSun ? 'bg-slate-50/60 dark:bg-slate-850/40' : ''
                          )}
                          title={(canEditShifts ? 'Click to edit shift or apply leave\n' : 'Click to view day details\n') + row.employee.fullName + ' | ' + day.dateKey + '\nShift: ' + (cell?.shiftLabel || (isWO ? 'Weekly Off (WO)' : text)) + (isOverride ? ' (Override)' : '')}
                        >
                          <div className="flex flex-col items-center justify-center min-h-[30px] leading-tight">
                            {isHolidayBadge ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs leading-none">
                                HL
                              </span>
                            ) : isYellowBadge ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-[#fef08a] text-amber-950 border border-amber-300 shadow-2xs leading-none">
                                {text === 'Half Day' ? 'HD' : text}
                              </span>
                            ) : isWO ? (
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                WO
                              </span>
                            ) : isNA ? (
                              <span className="text-[11px] font-medium text-slate-300 dark:text-slate-600">
                                NA
                              </span>
                            ) : (
                              <span className={'text-[11px] font-semibold whitespace-nowrap ' + (
                                isOverride ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-800 dark:text-slate-200'
                              )}>
                                {text}
                              </span>
                            )}

                            {/* Tiny Punch status dot if logged */}
                            {att && att.workMinutes > 0 && (
                              <span
                                className={'w-1.5 h-1.5 rounded-full mt-0.5 ' + (
                                  att.status === 'PRESENT'
                                    ? 'bg-emerald-500'
                                    : att.status === 'HALF_DAY'
                                      ? 'bg-amber-500'
                                      : 'bg-indigo-500'
                                )}
                                title={'Punch: ' + att.formattedWorkHours}
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Working Days Column */}
                    <td className="p-2 text-center text-xs font-bold text-slate-900 dark:text-white bg-slate-50/80 dark:bg-slate-850 border-l border-slate-200 dark:border-slate-700">
                      {row.stats.scheduledDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 6. Assign Shift Modal                                               */}
      {/* =================================================================== */}
      {isAssignModalOpen && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setModalTargetEmployee(null);
          }}
          title="Assign / Edit Shift Timing"
          subtitle={`Scheduling ${selectedDates.size} selected date(s) for ${modalTargetEmployee?.fullName || activeEmployee?.fullName || 'employee'}`}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveShift} className="space-y-4">
            {/* Selected Dates Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Dates ({selectedDates.size})
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {Array.from(selectedDates).sort().map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 shadow-2xs"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Shift Type: Working Shift vs Weekly Off */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Shift Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShiftType('SHIFT')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${shiftType === 'SHIFT'
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Clock className="w-4 h-4" />
                  Working Shift
                </button>
                <button
                  type="button"
                  onClick={() => setShiftType('WO')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${shiftType === 'WO'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Weekly Off (WO)
                </button>
              </div>
            </div>

            {/* Presets vs Custom Timing (When Shift Type is SHIFT) */}
            {shiftType === 'SHIFT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Shift Timing Options
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                  >
                    {isCustomMode ? 'Use Standard Presets' : 'Enter Custom Timing'}
                  </button>
                </div>

                {!isCustomMode ? (
                  <div className="space-y-2">
                    {PRESET_SHIFTS.map((ps) => {
                      const isSelected = selectedPreset === ps.label;
                      return (
                        <div
                          key={ps.label}
                          onClick={() => setSelectedPreset(ps.label)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected
                            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-100 shadow-2xs font-semibold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Clock className={`w-4 h-4 ${isSelected ? 'text-brand-500' : 'text-slate-400'}`} />
                            <span className="text-xs">{ps.label}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {ps.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <Input
                      label="Start Time (e.g. 14:00)"
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      required
                    />
                    <Input
                      label="End Time (e.g. 22:00)"
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Scheduling Remarks / Notes (Optional)
              </label>
              <input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="e.g. Deployment coverage, client meeting shift..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Invariant guarantee reminder */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] text-slate-500 border border-slate-200/80 dark:border-slate-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Changes apply <strong>only</strong> to the {selectedDates.size} selected date(s). The employee’s default contract shift ({scheduleData?.defaultShiftTiming || '11:00 AM - 07:00 PM'}) will remain unchanged.
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setModalTargetEmployee(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Check}
                isLoading={isSaving}
              >
                Apply Shift Timing
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* 7. Shift Change Audit History Modal                                 */}
      {/* =================================================================== */}
      {isHistoryModalOpen && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title="Shift Change Audit History"
          subtitle="Complete audit trail of all manual shift timing overrides"
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" /> Loading audit history...
              </div>
            ) : auditHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No shift timing adjustments recorded yet.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {auditHistory.map((item) => {
                  const newVals = typeof item.newValue === 'string' ? JSON.parse(item.newValue || '{}') : item.newValue || {};
                  const oldVals = typeof item.oldValue === 'string' ? JSON.parse(item.oldValue || '{}') : item.oldValue || {};

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.employeeName} ({item.employeeCode})
                          </span>
                          <Badge variant="neutral" size="sm">
                            {item.assignmentDate?.slice(0, 10)}
                          </Badge>
                          <Badge
                            variant={item.changeType === 'DELETED' ? 'danger' : 'brand'}
                            size="sm"
                          >
                            {item.changeType}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                        {oldVals?.shiftLabel && (
                          <span className="line-through text-slate-400">
                            {oldVals.shiftLabel}
                          </span>
                        )}
                        <span>➔</span>
                        <span className="font-bold text-brand-600 dark:text-brand-400">
                          {newVals?.shiftLabel || newVals?.shiftType || (item.changeType === 'DELETED' ? 'Reverted to Default' : 'Updated')}
                        </span>
                        {newVals?.notes && (
                          <span className="text-[11px] text-slate-400 italic">
                            ({newVals.notes})
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Changed by: {item.changedByName || 'System'} ({item.changedByRole || 'Admin'})</span>
                        <span>Source: {item.changeSource}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* 8. Interactive Excel-Like Cell Action Modal                         */}
      {/* =================================================================== */}
      {selectedMatrixCellDetails && (
        <Modal
          isOpen={Boolean(selectedMatrixCellDetails)}
          onClose={() => setSelectedMatrixCellDetails(null)}
          title={`Edit Schedule & Attendance`}
          subtitle={`${selectedMatrixCellDetails.employee.fullName} • ${selectedMatrixCellDetails.dateKey}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            {/* Employee Quick Info Header */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <Avatar
                src={selectedMatrixCellDetails.employee.avatarUrl}
                name={selectedMatrixCellDetails.employee.fullName}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900 dark:text-white truncate text-sm">
                    {selectedMatrixCellDetails.employee.fullName}
                  </p>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {selectedMatrixCellDetails.employee.employeeCode}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="truncate">{selectedMatrixCellDetails.employee.departmentName || 'General'}</span>
                  <span>•</span>
                  <span className="truncate text-brand-600 dark:text-brand-400 font-medium">
                    Contract: {selectedMatrixCellDetails.employee.defaultShiftTiming || '11:00 AM - 07:00 PM'}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Day Status Banner */}
            <div className="p-2.5 rounded-lg border bg-white dark:bg-slate-850 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatRosterDateHeading(selectedMatrixCellDetails.dateKey)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedMatrixCellDetails.cell.shiftType === 'WO' || selectedMatrixCellDetails.cell.isSunday ? (
                  <Badge variant="neutral" size="xs">🛑 Weekly Off (WO)</Badge>
                ) : selectedMatrixCellDetails.cell.holiday || selectedMatrixCellDetails.cell.shiftType === 'HL' || selectedMatrixCellDetails.cell.shiftType === 'HOLIDAY' ? (
                  <Badge variant="rose" size="xs">🎉 {selectedMatrixCellDetails.cell.holiday?.name || 'Holiday (HL)'}</Badge>
                ) : selectedMatrixCellDetails.cell.isHalfDay ? (
                  <Badge variant="amber" size="xs">🌗 Half Day</Badge>
                ) : selectedMatrixCellDetails.cell.leave ? (
                  <Badge variant="warning" size="xs">🏖️ {selectedMatrixCellDetails.cell.leave.leaveName || 'Leave'}</Badge>
                ) : selectedMatrixCellDetails.cell.isOverride ? (
                  <Badge variant="brand" size="xs">✨ Override: {selectedMatrixCellDetails.cell.shiftLabel}</Badge>
                ) : (
                  <Badge variant="neutral" size="xs">🕒 {selectedMatrixCellDetails.cell.shiftLabel || selectedMatrixCellDetails.employee.defaultShiftTiming}</Badge>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 gap-1">
              <button
                type="button"
                onClick={() => setMatrixModalTab('SHIFT')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${matrixModalTab === 'SHIFT'
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Change Shift Timing</span>
              </button>

              <button
                type="button"
                onClick={() => setMatrixModalTab('LEAVE')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${matrixModalTab === 'LEAVE'
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Apply Leave (Bucket Deduction)</span>
              </button>

              <button
                type="button"
                onClick={() => setMatrixModalTab('ATTENDANCE')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${matrixModalTab === 'ATTENDANCE'
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Punches & Attendance</span>
              </button>
            </div>

            {/* TAB 1: CHANGE SHIFT TIMING */}
            {matrixModalTab === 'SHIFT' && (
              <div className="space-y-4 pt-1">
                {!canEditShifts ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200">
                    You do not have permissions to modify shift timings.
                  </div>
                ) : (
                  <>
                    {/* Shift Mode: Regular Working Shift vs Weekly Off */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Shift Schedule Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCellShiftType('SHIFT')}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${cellShiftType === 'SHIFT'
                            ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-950/50 dark:border-brand-500 dark:text-brand-300 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                            }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Working Shift Timing</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCellShiftType('WO')}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${cellShiftType === 'WO'
                            ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/50 dark:border-rose-500 dark:text-rose-300 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                            }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Weekly Off (WO)</span>
                        </button>
                      </div>
                    </div>

                    {/* Presets & Custom Timings */}
                    {cellShiftType === 'SHIFT' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Select Shift Preset
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {PRESET_SHIFTS.map((preset) => {
                              const isSelected = !cellIsCustom && cellSelectedPreset === preset.label;
                              return (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => {
                                    setCellSelectedPreset(preset.label);
                                    setCellIsCustom(false);
                                  }}
                                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${isSelected
                                    ? 'bg-brand-50 border-brand-500 text-brand-900 dark:bg-brand-950/40 dark:border-brand-500 dark:text-brand-300 ring-1 ring-brand-500/30'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-300'
                                    }`}
                                >
                                  <div className="font-bold text-[11px] flex items-center justify-between">
                                    <span>{preset.label}</span>
                                    {isSelected && <Check className="w-3 h-3 text-brand-600 shrink-0" />}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">{preset.desc}</div>
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => setCellIsCustom(true)}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${cellIsCustom
                                ? 'bg-brand-50 border-brand-500 text-brand-900 dark:bg-brand-950/40 dark:border-brand-500 dark:text-brand-300 ring-1 ring-brand-500/30'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-300'
                                }`}
                            >
                              <div className="font-bold text-[11px] flex items-center justify-between">
                                <span>Custom Shift</span>
                                {cellIsCustom && <Check className="w-3 h-3 text-brand-600 shrink-0" />}
                              </div>
                              <div className="text-[10px] text-slate-400">Specify custom hours</div>
                            </button>
                          </div>
                        </div>

                        {/* Custom Time inputs */}
                        {cellIsCustom && (
                          <div className="p-3 bg-brand-50/40 dark:bg-brand-950/20 rounded-xl border border-brand-200 dark:border-brand-800/40 space-y-2">
                            <span className="font-bold text-[11px] text-brand-800 dark:text-brand-300 block">
                              Custom Shift Start & End
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Start Time (24h)</label>
                                <input
                                  type="time"
                                  value={cellCustomStart}
                                  onChange={(e) => setCellCustomStart(e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">End Time (24h)</label>
                                <input
                                  type="time"
                                  value={cellCustomEnd}
                                  onChange={(e) => setCellCustomEnd(e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Remarks Input */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Remarks / Reason (Optional)
                      </label>
                      <input
                        type="text"
                        value={cellShiftNotes}
                        onChange={(e) => setCellShiftNotes(e.target.value)}
                        placeholder="e.g. Covering project deadline, client visit"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/40 flex items-start gap-2 text-[11px] text-blue-800 dark:text-blue-300">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                      <span>
                        Updated shift timing will automatically re-evaluate this employee's check-in/out punctuality (Late vs Present) and recalculate overtime for {selectedMatrixCellDetails.dateKey}.
                      </span>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {selectedMatrixCellDetails.cell.isOverride ? (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={RotateCcw}
                          onClick={handleResetMatrixCellShift}
                          disabled={isSavingCellShift}
                          className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                        >
                          Revert to Contract Default
                        </Button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMatrixCellDetails(null)}
                          disabled={isSavingCellShift}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Check}
                          onClick={handleSaveMatrixCellShift}
                          loading={isSavingCellShift}
                        >
                          Save Shift Timing
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: APPLY LEAVE & DEDUCT BUCKET */}
            {matrixModalTab === 'LEAVE' && (
              <div className="space-y-4 pt-1">
                {/* Employee Leave Balance Buckets */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Leave Balance Buckets ({currentYear})
                  </span>
                  {isLoadingCellLeaves ? (
                    <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-1.5">
                      <LoadingSpinner size="sm" />
                      <span>Loading leave balances...</span>
                    </div>
                  ) : cellLeaveBalances.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {cellLeaveBalances.map((b) => {
                        const rem = parseFloat(b.remainingDays) || 0;
                        const used = parseFloat(b.usedDays) || 0;
                        const isUnpaid = ['LWP', 'LOP', 'AWOL'].includes(String(b.leaveTypeCode || '').toUpperCase()) || b.isPaid === false;
                        const isZero = rem <= 0 && !isUnpaid;
                        return (
                          <div
                            key={b.leaveTypeId || b.leaveTypeCode}
                            className={`p-2 rounded-lg border text-center ${isZero
                              ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 text-slate-400'
                              : isUnpaid && used > 0
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                              : isUnpaid
                              ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 text-slate-700 dark:text-slate-300'
                              : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300'
                              }`}
                          >
                            <div className="font-bold text-[11px] truncate">{b.leaveTypeName || b.leaveTypeCode}</div>
                            <div className="text-sm font-extrabold mt-0.5">
                              {isUnpaid ? (used > 0 ? `${used} used` : '0 used') : rem}
                              <span className="text-[10px] font-normal text-slate-500 ml-0.5">{isUnpaid ? '' : 'days'}</span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {isUnpaid ? (used > 0 ? `${used} days consumed (unpaid)` : 'Unpaid (No limit)') : `of ${b.totalAllocated || b.allocatedDays || 0} allocated`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2.5 text-center text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-200">
                      Standard organization leave buckets apply.
                    </div>
                  )}
                </div>

                {/* Select Leave Category */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Leave Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCellLeaveTypeId}
                    onChange={(e) => setSelectedCellLeaveTypeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer font-medium"
                  >
                    <option value="" disabled>Select Leave Category</option>
                    {cellLeaveTypes.map((t) => {
                      const bal = cellLeaveBalances.find((b) => b.leaveTypeId === t.id || b.leaveTypeCode === t.code);
                      const remText = bal ? ` (${bal.remainingDays} days available)` : '';
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code}){remText}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Day Fraction: Full Day vs Half Day */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Leave Duration & Deduct Amount
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCellHalfDay(false)}
                      className={`p-2 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${!isCellHalfDay
                        ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-950/40 dark:border-brand-500 dark:text-brand-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                        }`}
                    >
                      <div>Full Day</div>
                      <div className="text-[10px] font-normal text-slate-500">Deducts 1.0 Day</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCellHalfDay(true)}
                      className={`p-2 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${isCellHalfDay
                        ? 'bg-amber-50 border-amber-500 text-amber-800 dark:bg-amber-950/40 dark:border-amber-500 dark:text-amber-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                        }`}
                    >
                      <div>Half Day</div>
                      <div className="text-[10px] font-normal text-slate-500">Deducts 0.5 Day</div>
                    </button>
                  </div>
                </div>

                {/* Half Day Period Selector */}
                {isCellHalfDay && (
                  <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-1.5">
                    <span className="font-bold text-[11px] text-amber-900 dark:text-amber-300 block">
                      Half Day Session
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCellHalfDayPeriod('FIRST_HALF')}
                        className={`p-1.5 text-xs font-semibold rounded border ${cellHalfDayPeriod === 'FIRST_HALF'
                          ? 'bg-amber-100 border-amber-500 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        First Half (Morning)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCellHalfDayPeriod('SECOND_HALF')}
                        className={`p-1.5 text-xs font-semibold rounded border ${cellHalfDayPeriod === 'SECOND_HALF'
                          ? 'bg-amber-100 border-amber-500 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        Second Half (Afternoon)
                      </button>
                    </div>
                  </div>
                )}

                {/* Reason Text */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Reason for Leave (Optional)
                  </label>
                  <input
                    type="text"
                    value={cellLeaveReason}
                    onChange={(e) => setCellLeaveReason(e.target.value)}
                    placeholder="e.g. Medical appointment, family event"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/40 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Submitting will immediately deduct the required days from {selectedMatrixCellDetails.employee.fullName}'s bucket and mark attendance as Leave / Half Day.
                  </span>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMatrixCellDetails(null)}
                    disabled={isApplyingCellLeave}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Sun}
                    onClick={handleApplyMatrixCellLeave}
                    loading={isApplyingCellLeave}
                    disabled={!selectedCellLeaveTypeId}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Apply Leave & Deduct Bucket
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: ATTENDANCE & PUNCHES */}
            {matrixModalTab === 'ATTENDANCE' && (
              <div className="space-y-3 pt-1">
                {selectedMatrixCellDetails.cell.attendance ? (
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Attendance Record
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        {selectedMatrixCellDetails.cell.attendance.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block">Check-In Time</span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {formatTime12h(selectedMatrixCellDetails.cell.attendance.checkIn) || '-'}
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block">Check-Out Time</span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {formatTime12h(selectedMatrixCellDetails.cell.attendance.checkOut) || 'Active / None'}
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block">Total Work Hours</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xs">
                          {selectedMatrixCellDetails.cell.attendance.formattedWorkHours || '-'}
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block">Overtime Hours</span>
                        <span className="font-bold text-brand-600 text-xs">
                          {selectedMatrixCellDetails.cell.attendance.overtimeHours > 0 ? `+${selectedMatrixCellDetails.cell.attendance.overtimeHours} hrs` : '0 hrs'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-1">
                    <Activity className="w-5 h-5 mx-auto text-slate-300" />
                    <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">No punch records found</p>
                    <p className="text-[11px]">No check-in or check-out logs recorded for this date.</p>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const empId = selectedMatrixCellDetails.employee.id;
                      setSelectedMatrixCellDetails(null);
                      setSelectedEmployeeId(empId);
                    }}
                  >
                    Open Employee Full Calendar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMatrixCellDetails(null)}

                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DateWiseShiftPage;
