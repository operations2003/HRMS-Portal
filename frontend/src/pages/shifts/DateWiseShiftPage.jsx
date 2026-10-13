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
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const PRESET_SHIFTS = [
  { label: '11:00 AM - 07:00 PM', desc: 'Standard Day (8 hrs)' },
  { label: '10:00 AM - 07:00 PM', desc: 'General Day (9 hrs)' },
  { label: '02:00 PM - 10:00 PM', desc: 'Evening Shift (8 hrs)' },
  { label: '06:00 AM - 02:00 PM', desc: 'Morning Shift (8 hrs)' },
  { label: '10:00 PM - 06:00 AM', desc: 'Night / Overnight Shift (8 hrs)' },
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

  // Can this user modify shift assignments?
  const canEditShifts = isHrOrAdmin || isManager;

  // Month & Year state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12

  // View Mode: 'CALENDAR' (Schedule Overview) vs 'ADJUST' (Date-wise Shift Adjuster)
  const [viewMode, setViewMode] = useState('CALENDAR');

  // Employee Selection State: default to 'ALL' for authorized managers/HR, or empty
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
    return canEditShifts ? 'ALL' : '';
  });
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
  const [allEmployeesViewMode, setAllEmployeesViewMode] = useState('DATE_WISE'); // 'DATE_WISE' | 'MATRIX'
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('ALL');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedMatrixCellDetails, setSelectedMatrixCellDetails] = useState(null);

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

      const formatted = (Array.isArray(list) ? list : []).map((e) => ({
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
          if (prev === 'ALL') return 'ALL';
          if (prev && formatted.some((e) => e.id === prev)) return prev;
          if (canEditShifts) return 'ALL';
          const callerMatch = formatted.find((e) => e.id === user?.employeeId);
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
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      const customAssignment = scheduleData?.customShiftsByDate?.[dateKey] || null;
      const holiday = scheduleData?.holidaysByDate?.[dateKey] || null;
      const approvedLeave = (scheduleData?.approvedLeaves || []).find((l) => {
        const start = l.startDate?.slice(0, 10);
        const end = l.endDate?.slice(0, 10);
        return dateKey >= start && dateKey <= end;
      });
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
    let list = scheduleData.roster;
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
    let list = scheduleData.roster.map((r) => ({
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
        if (cell.holiday) return `Holiday (${cell.holiday.name || 'Holiday'})`;
        if (cell.isHalfDay || cell.displayType === 'HALF_DAY') return 'Half Day';
        if (cell.leave || cell.displayType === 'LEAVE') {
          const lCode = cell.leave?.leaveCode || cell.cellText || '';
          const lName = cell.leave?.leaveName || cell.cellText || 'Leave';
          return `"${lCode ? `${lCode}: ${lName}` : lName}"`;
        }
        if (cell.shiftType === 'WO' || cell.displayType === 'WO') return 'Weekly Off';
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
      toast.error(err.message || 'Failed to assign shift timings.');
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
      toast.error(err.message || 'Failed to reset shifts.');
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* =================================================================== */}
      {/* 1. Header & Quick Actions                                           */}
      {/* =================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-xs">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {canEditShifts ? 'Monthly Roster & Schedule' : 'My Monthly Roster & Schedule'}
                <Badge variant="brand" size="sm">Live HRMS Data</Badge>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {canEditShifts
                  ? 'Organization & team monthly rosters, date-specific shift changes, actual attendance punches, hours worked, weekly offs, holidays, and leaves.'
                  : 'Your live monthly roster, assigned shifts, actual hours worked, attendance records, weekly offs, and holidays.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls for Managers / HR / Admin */}
        {canEditShifts && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('CALENDAR')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  viewMode === 'CALENDAR'
                    ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Roster Calendar View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('ADJUST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  viewMode === 'ADJUST'
                    ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Shift Adjuster
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={History}
              onClick={handleOpenHistory}
              title="View shift change audit trail"
            >
              History
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={Clock}
              disabled={selectedDates.size === 0}
              onClick={handleOpenAssignModal}
              className="shadow-sm"
            >
              Assign Shift ({selectedDates.size})
            </Button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. Employee Selector & Profile Card                                 */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Employee Selection Dropdown / Search (Only for Managers & HR/Admin) */}
        {canEditShifts && (
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Employee
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                    {employees.length} available
                  </span>
                  <button
                    type="button"
                    onClick={fetchEmployees}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded"
                    title="Refresh employee list"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Quick dropdown for instant switching */}
              <div className="mb-2">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium cursor-pointer"
                >
                  {canEditShifts && (
                    <option value="ALL">
                      👥 All Employees (Monthly Roster Grid - {employees.length})
                    </option>
                  )}
                  {employees.length === 0 ? (
                    <option value="">No employees available</option>
                  ) : (
                    employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode}) - {emp.defaultShiftTiming || '11:00 AM - 07:00 PM'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Filter Tabs: All vs With Custom Shifts */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800 rounded-xl mb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEmployeeFilterTab('ALL')}
                  className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer font-medium text-[11px] ${
                    employeeFilterTab === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  All ({employees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeFilterTab('CUSTOM')}
                  className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer font-medium text-[11px] ${
                    employeeFilterTab === 'CUSTOM'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Adjusted ({withCustomCount})
                </button>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search name, code, dept, shift..."
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {isLoadingEmployees ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" /> Loading employees...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                    <p>No matching employees found.</p>
                    <Button variant="ghost" size="sm" onClick={() => { setEmployeeSearch(''); setEmployeeFilterTab('ALL'); }} className="text-xs text-brand-600">
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <>
                    {canEditShifts && (
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId('ALL')}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer mb-1.5 ${
                          isAllMode
                            ? 'bg-brand-50 dark:bg-brand-950/40 border border-brand-300 dark:border-brand-700 text-brand-900 dark:text-brand-100 font-bold shadow-2xs'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>All Employees</span>
                            <span className="text-[10px] bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 px-1.5 py-0.2 rounded font-bold">
                              Grid ({employees.length})
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">Consolidated rows & columns roster</p>
                        </div>
                      </button>
                    )}
                    {filteredEmployees.map((emp) => {
                    const isSelected = emp.id === selectedEmployeeId;
                    const hasCustom = (emp.customShiftCount || 0) > 0;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-100 font-semibold shadow-2xs'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Avatar
                          src={emp.avatarUrl}
                          name={emp.fullName}
                          size="sm"
                          shape="rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate">{emp.fullName}</span>
                            <span className="text-[10px] text-slate-400 ml-1 shrink-0">
                              {emp.employeeCode}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-[10px] text-slate-400 truncate">
                              {emp.designationTitle || emp.departmentName || 'Staff'}
                            </p>
                            {hasCustom && (
                              <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0">
                                Adjusted ({emp.customShiftCount})
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Employee Details & Profile Card */}
        <div className={`${canEditShifts ? 'lg:col-span-8' : 'lg:col-span-12'} bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-850 dark:via-slate-900 dark:to-slate-850 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between`}>
          {isAllMode ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 min-w-[3.5rem] min-h-[3.5rem] rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700/50 flex items-center justify-center shadow-xs">
                    <Users className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Organization Monthly Roster Matrix
                      </h3>
                      <Badge variant="brand" size="sm">
                        {filteredRosterRows.length} of {employees.length} Employees
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Consolidated date-wise schedule for all active employees across all departments for {monthNames[currentMonth - 1]} {currentYear}.
                    </p>
                  </div>
                </div>

                {/* Export CSV Button */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    onClick={handleExportRosterCSV}
                    title="Export Monthly Roster as CSV Spreadsheet"
                  >
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Guarantees & Summary Notice */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Consolidated Grid Overview:</strong> Rows show each employee and columns represent all dates of {monthNames[currentMonth - 1]} {currentYear}. Each cell displays active shift timing, custom override indicator (✨), leave, weekly off, or holiday, plus attendance punch dots. Click any cell to view punch logs or edit shifts!
                </p>
              </div>
            </div>
          ) : activeEmployee ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <Avatar
                    src={activeEmployee.avatarUrl}
                    name={activeEmployee.fullName}
                    size="lg"
                    shape="rounded-2xl"
                    className="w-14 h-14 min-w-[3.5rem] min-h-[3.5rem] border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {activeEmployee.fullName}
                      </h3>
                      <Badge variant="neutral" size="sm">
                        {activeEmployee.employeeCode}
                      </Badge>
                      {!canEditShifts && (
                        <Badge variant="brand" size="sm">My Schedule</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeEmployee.designationTitle || 'Staff'} • {activeEmployee.departmentName || 'General'}
                    </p>
                  </div>
                </div>

                {/* Permanent Default Shift Display */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs self-start sm:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Permanent Default Shift
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-brand-500" />
                    <span>{scheduleData?.defaultShiftTiming || activeEmployee.defaultShiftTiming || '11:00 AM - 07:00 PM'}</span>
                  </div>
                </div>
              </div>

              {/* Guarantees & Summary Notice */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Zero-Leakage Invariant:</strong> The permanent default shift is never overwritten. Date-specific shift modifications apply strictly to selected dates. All attendance punches and working hours reflect live against each day's active shift.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Select an employee to manage their date-wise shift schedule.
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. Monthly Overview KPIs Summary Bar                                */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            {isAllMode ? <Users className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
              {isAllMode ? 'Employees in Roster' : 'Attendance Logged'}
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {isAllMode ? (
                <>
                  {filteredRosterRows.length} <span className="text-xs font-normal text-slate-400">/ {employees.length} active</span>
                </>
              ) : (
                <>
                  {monthStats.attendanceLoggedDays} <span className="text-xs font-normal text-slate-400">/ {monthStats.totalDays}d</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
              {isAllMode ? 'Total Punches Logged' : 'Actual Hours Worked'}
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {isAllMode ? `${monthStats.attendanceLoggedDays} punch records` : monthStats.totalWorkHoursStr}
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
              {monthStats.customOverridesCount} <span className="text-xs font-normal text-slate-400">{isAllMode ? 'active overrides' : 'day(s)'}</span>
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

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Sun className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Company Holidays</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {monthStats.holidaysCount} <span className="text-xs font-normal text-slate-400">day(s)</span>
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. Schedule View: All Employees Matrix vs Single Employee Calendar  */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
        {isAllMode ? (
          /* ================================================================= */
          /* 4A. ORGANIZATION ALL EMPLOYEES ROSTER (DUAL MODE)                 */
          /* ================================================================= */
          <div className="space-y-4">
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

            {/* View Mode Toggle: Date-Wise Daily Roster vs Monthly Matrix Grid */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setAllEmployeesViewMode('DATE_WISE')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    allEmployeesViewMode === 'DATE_WISE'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Date-Wise Daily Roster</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAllEmployeesViewMode('MATRIX')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    allEmployeesViewMode === 'MATRIX'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Monthly Matrix Grid (31 Days)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Users className="w-4 h-4 text-brand-500" />
                <span>
                  Authorized Employees: <strong>{employees.length}</strong>
                </span>
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoadingSchedule ? (
              <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="lg" />
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Loading complete employee roster data from database...
                </span>
              </div>
            ) : allEmployeesViewMode === 'DATE_WISE' ? (
              /* ============================================================= */
              /* TAB 1: DATE-WISE DAILY ROSTER TABLE                           */
              /* ============================================================= */
              <div className="space-y-4">
                {/* Daily Roster Date Navigation & Filters Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  {/* Date Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePrevDay}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="Previous Day"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
                      <input
                        type="date"
                        value={selectedRosterDate}
                        onChange={(e) => handleRosterDateChange(e.target.value)}
                        className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleNextDay}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="Next Day"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTodayDay}
                      className="text-xs text-brand-600 dark:text-brand-400 font-bold"
                    >
                      Today
                    </Button>

                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                      {formatRosterDateHeading(selectedRosterDate)}
                      {selectedRosterDate === todayDateStr && (
                        <span className="ml-2 inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                          Today
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Filters: Department & Search */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Department dropdown */}
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

                    {/* Search */}
                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        placeholder="Search employee, dept, shift..."
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Status KPI Filter Pills Strip */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Status Filter:</span>
                  {[
                    { key: 'ALL', label: 'All', count: dailyRosterStats.total },
                    { key: 'WORKING', label: 'Working Shift', count: dailyRosterStats.working },
                    { key: 'WO', label: 'Weekly Off', count: dailyRosterStats.weeklyOff },
                    { key: 'LEAVE', label: 'Leave / Half Day', count: dailyRosterStats.leave },
                    { key: 'OVERRIDE', label: 'Shift Overrides', count: dailyRosterStats.override },
                    { key: 'PRESENT', label: 'Punched In', count: dailyRosterStats.present },
                  ].map((filterTab) => {
                    const isActive = rosterStatusFilter === filterTab.key;
                    return (
                      <button
                        key={filterTab.key}
                        type="button"
                        onClick={() => setRosterStatusFilter(filterTab.key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-brand-50 dark:bg-brand-950/50 border-brand-400 text-brand-700 dark:text-brand-300 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <span>{filterTab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {filterTab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Date-Wise Table */}
                {dailyRosterRows.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      No employee records found for the selected date or filter.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDepartmentFilter('ALL');
                        setRosterStatusFilter('ALL');
                        setMatrixSearch('');
                      }}
                    >
                      Reset Filters
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs max-w-full">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/95 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold select-none">
                          <th className="p-3 min-w-[220px]">Employee</th>
                          <th className="p-3 min-w-[130px]">Department</th>
                          <th className="p-3 min-w-[110px]">Assigned Date</th>
                          <th className="p-3 min-w-[160px]">Assigned Shift Timing</th>
                          <th className="p-3 min-w-[140px]">Assignment Status</th>
                          <th className="p-3 min-w-[210px]">Attendance & Punches</th>
                          <th className="p-3 text-right min-w-[130px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {dailyRosterRows.map(({ employee: emp, cell }) => {
                          const hasHoliday = Boolean(cell?.holiday || cell?.displayType === 'HOLIDAY');
                          const isHalfDay = Boolean(cell?.isHalfDay || cell?.displayType === 'HALF_DAY');
                          const hasLeave = Boolean((cell?.leave || cell?.displayType === 'LEAVE') && !isHalfDay);
                          const isWO = Boolean(cell?.shiftType === 'WO' || cell?.displayType === 'WO');
                          const isOverride = Boolean(cell?.isOverride || cell?.displayType === 'OVERRIDE');
                          const att = cell?.attendance;

                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              {/* Employee */}
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEmployeeId(emp.id)}
                                  className="flex items-center gap-2.5 text-left w-full cursor-pointer group"
                                  title="Click to view this employee's individual schedule calendar"
                                >
                                  <Avatar
                                    src={emp.avatarUrl}
                                    name={emp.fullName}
                                    size="sm"
                                    shape="rounded-lg"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-brand-600 transition-colors">
                                      {emp.fullName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                      <span className="font-mono font-medium">{emp.employeeCode}</span>
                                      <span>•</span>
                                      <span className="truncate">{emp.designationTitle || 'Staff'}</span>
                                    </div>
                                  </div>
                                </button>
                              </td>

                              {/* Department */}
                              <td className="p-3 text-slate-600 dark:text-slate-300">
                                <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {emp.departmentName || 'General'}
                                </span>
                              </td>

                              {/* Assigned Date */}
                              <td className="p-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                {selectedRosterDate}
                              </td>

                              {/* Assigned Shift Timing */}
                              <td className="p-3 font-medium">
                                {hasHoliday ? (
                                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                    <Sun className="w-3.5 h-3.5" />
                                    <span>{cell?.holiday?.name || 'Company Holiday'}</span>
                                  </div>
                                ) : isWO ? (
                                  <div className="flex items-center gap-1.5 text-slate-500">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    <span>Weekly Off (WO)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                                    <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                                    <span className="font-semibold">{cell?.shiftLabel || emp.defaultShiftTiming || '11:00 AM - 07:00 PM'}</span>
                                  </div>
                                )}
                              </td>

                              {/* Assignment Status Badge */}
                              <td className="p-3">
                                {hasHoliday ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">
                                    🎉 Holiday
                                  </span>
                                ) : isHalfDay ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 shadow-2xs">
                                    🌗 Half Day
                                  </span>
                                ) : hasLeave ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200">
                                    🏖️ Leave ({cell?.leave?.leaveCode || cell?.cellText || 'Leave'})
                                  </span>
                                ) : isWO ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                    🛋️ Weekly Off
                                  </span>
                                ) : isOverride ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-2xs">
                                    <Sparkles className="w-3 h-3" />
                                    ✨ Override
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60">
                                    Normal Shift
                                  </span>
                                )}
                              </td>

                              {/* Attendance Punches & Hours */}
                              <td className="p-3">
                                {att ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          att.status === 'PRESENT'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                            : att.status === 'HALF_DAY'
                                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                                            : att.status === 'LATE'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'
                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                        }`}
                                      >
                                        {att.status}
                                      </span>
                                      {att.isOnBreak && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 animate-pulse">
                                          ☕ On Break
                                        </span>
                                      )}
                                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                        {att.formattedWorkHours}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      In: {formatTime12h(att.checkIn) || '-'} • Out: {formatTime12h(att.checkOut) || 'Active / None'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">
                                    No punch recorded
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canEditShifts && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickEditEmployeeShift(emp, selectedRosterDate)}
                                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                                      title="Edit shift for this date"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEmployeeId(emp.id)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-400 transition-colors"
                                    title="View individual monthly schedule calendar"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================= */
              /* TAB 2: ORGANIZATION MONTHLY ROSTER MATRIX (ROWS & COLUMNS)    */
              /* ============================================================= */
              <div className="space-y-4">
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
                      className="text-xs text-brand-600 dark:text-brand-400"
                    >
                      Today
                    </Button>
                  </div>

                  {/* Filters for Matrix View */}
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
                    <div className="relative min-w-[190px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        placeholder="Filter employee rows..."
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <Badge variant="neutral" size="sm">
                      {filteredRosterRows.length} Rows
                    </Badge>
                  </div>
                </div>

                {/* Legend for Matrix */}
                <div className="flex items-center gap-3.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap p-2.5 bg-slate-50/60 dark:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Roster Legend:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60">11-7</span>
                    <span>Full Day Shift</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 shadow-2xs">
                      <Sparkles className="w-2.5 h-2.5" /> 10-6
                    </span>
                    <span>Shift Override</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 shadow-2xs">Half Day</span>
                    <span>Half Day</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200">PL</span>
                    <span>Planned Leave</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-200">CL</span>
                    <span>Casual Leave</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">WO</span>
                    <span>Weekly Off</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">Holiday</span>
                    <span>Holiday</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>Punch Logged</span>
                  </div>
                </div>

                {/* Matrix Table */}
                {filteredRosterRows.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No employee roster records found for the selected filter.</p>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedDepartmentFilter('ALL'); setMatrixSearch(''); }}>
                      Reset Filters
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs max-w-full">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/95 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold select-none">
                          {/* Sticky 1: Employee Column */}
                          <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 p-2.5 w-[220px] min-w-[220px] max-w-[220px] border-r border-slate-200 dark:border-slate-700 shadow-xs">
                            Employee
                          </th>
                          {/* Non-sticky 2: Default Shift */}
                          <th className="p-2.5 min-w-[140px] border-r border-slate-200 dark:border-slate-700">
                            Default Shift
                          </th>
                          {/* Days columns 1..N */}
                          {scheduleData?.days?.map((day) => (
                            <th
                              key={day.dateKey}
                              className={`p-1.5 text-center min-w-[62px] border-r border-slate-200/60 dark:border-slate-700/60 ${
                                day.isWeekend ? 'bg-slate-200/50 dark:bg-slate-800/50 text-rose-500' : ''
                              }`}
                            >
                              <div className="text-[10px] uppercase font-bold text-slate-400">
                                {day.dayName}
                              </div>
                              <div className={`text-xs font-bold inline-block px-1.5 py-0.2 rounded ${
                                day.dateKey === todayDateStr ? 'bg-brand-600 text-white shadow-2xs' : ''
                              }`}>
                                {String(day.dayNumber).padStart(2, '0')}
                              </div>
                              {day.holiday && (
                                <div className="text-[9px] text-rose-500 font-semibold truncate" title={day.holiday.name}>
                                  🎉
                                </div>
                              )}
                            </th>
                          ))}
                          {/* Right summary totals */}
                          <th className="p-2 text-center min-w-[50px] bg-slate-50 dark:bg-slate-850 border-r border-slate-200 dark:border-slate-700" title="Scheduled Days">
                            Sched
                          </th>
                          <th className="p-2 text-center min-w-[50px] bg-emerald-50/50 dark:bg-emerald-950/20 border-r border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400" title="Present / Logged Days">
                            Att
                          </th>
                          <th className="p-2 text-center min-w-[50px] bg-amber-50/50 dark:bg-amber-950/20 border-r border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400" title="Half Days">
                            HD
                          </th>
                          <th className="p-2 text-center min-w-[65px] bg-indigo-50/50 dark:bg-indigo-950/20 border-r border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-400" title="Custom Shift Overrides">
                            Overrides
                          </th>
                          <th className="p-2 text-center min-w-[50px] bg-orange-50/50 dark:bg-orange-950/20 border-r border-slate-200 dark:border-slate-700 text-orange-700 dark:text-orange-400" title="Approved Leaves">
                            Leave
                          </th>
                          <th className="p-2 text-center min-w-[50px] bg-slate-50 dark:bg-slate-850 border-r border-slate-200 dark:border-slate-700" title="Weekly Offs">
                            Off
                          </th>
                          <th className="p-2 text-center min-w-[75px] bg-slate-100 dark:bg-slate-800" title="Total Actual Hours Worked">
                            Work Hrs
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {filteredRosterRows.map((row) => (
                          <tr key={row.employee.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            {/* Sticky 1: Employee */}
                            <td className="sticky left-0 z-20 bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/90 p-2.5 w-[220px] min-w-[220px] max-w-[220px] border-r border-slate-200 dark:border-slate-700 shadow-xs">
                              <button
                                type="button"
                                onClick={() => setSelectedEmployeeId(row.employee.id)}
                                className="flex items-center gap-2.5 text-left w-full cursor-pointer group"
                                title="Click to view this employee's individual schedule calendar"
                              >
                                <Avatar
                                  src={row.employee.avatarUrl}
                                  name={row.employee.fullName}
                                  size="sm"
                                  shape="rounded-lg"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-brand-600 transition-colors">
                                    {row.employee.fullName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                    <span className="font-mono font-medium">{row.employee.employeeCode}</span>
                                    <span>•</span>
                                    <span className="truncate">{row.employee.departmentName}</span>
                                  </div>
                                </div>
                              </button>
                            </td>

                            {/* Non-sticky 2: Default Shift */}
                            <td className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-brand-500 shrink-0" />
                                <span className="truncate">{row.employee.defaultShiftTiming || '11:00 AM - 07:00 PM'}</span>
                              </div>
                            </td>

                            {/* Day Cells 1..N */}
                            {scheduleData?.days?.map((day) => {
                              const cell = row.cells[day.dateKey];
                              if (!cell) {
                                return (
                                  <td key={day.dateKey} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800/60 text-slate-300">
                                    -
                                  </td>
                                );
                              }

                              const isOverride = Boolean(cell.isOverride || cell.displayType === 'OVERRIDE');
                              const hasHoliday = Boolean(cell.holiday || cell.displayType === 'HOLIDAY');
                              const isHalfDay = Boolean(cell.isHalfDay || cell.displayType === 'HALF_DAY');
                              const hasLeave = Boolean((cell.leave || cell.displayType === 'LEAVE') && !isHalfDay);
                              const isWO = Boolean(cell.shiftType === 'WO' || cell.displayType === 'WO');
                              const att = cell.attendance;

                              return (
                                <td
                                  key={day.dateKey}
                                  onClick={() => setSelectedMatrixCellDetails({ employee: row.employee, dateKey: day.dateKey, cell })}
                                  className={`p-1.5 text-center border-r border-slate-100 dark:border-slate-800/60 cursor-pointer transition-all hover:bg-brand-50/50 dark:hover:bg-brand-950/30 ${
                                    day.isWeekend ? 'bg-slate-50/40 dark:bg-slate-850/40' : ''
                                  }`}
                                  title={`${row.employee.fullName} | ${day.dateKey}\n${isHalfDay ? 'Half Day' : hasHoliday ? `Holiday (${cell.holiday?.name || 'Holiday'})` : hasLeave ? `Leave (${cell.leave?.leaveName || cell.cellText || 'Leave'})` : isWO ? 'Weekly Off' : cell.shiftLabel}${isOverride ? ' (✨ Override)' : ''}${att ? `\nAtt: ${att.status} (${att.formattedWorkHours})` : ''}`}
                                >
                                  <div className="flex flex-col items-center justify-center gap-0.5 min-h-[36px]">
                                    {hasHoliday ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">
                                        Holiday
                                      </span>
                                    ) : isHalfDay ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 shadow-2xs">
                                        Half Day
                                      </span>
                                    ) : hasLeave ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200">
                                        {cell.leave?.leaveCode || cell.cellText || 'Leave'}
                                      </span>
                                    ) : isWO ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        WO
                                      </span>
                                    ) : isOverride ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-2xs">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        {cell.shortLabel}
                                      </span>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60">
                                        {cell.shortLabel}
                                      </span>
                                    )}

                                    {/* Attendance status dot and hours */}
                                    {att && (
                                      <div className="flex items-center gap-1 text-[9px] font-mono leading-none">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            att.status === 'PRESENT'
                                              ? 'bg-emerald-500'
                                              : att.status === 'HALF_DAY'
                                              ? 'bg-orange-500'
                                              : att.status === 'LATE'
                                              ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                          }`}
                                        />
                                        {att.workMinutes > 0 && (
                                          <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                            {Math.round(att.workMinutes / 60)}h
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Right Summary Columns */}
                            <td className="p-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-850/50 border-r border-slate-200 dark:border-slate-700">
                              {row.stats.scheduledDays}
                            </td>
                            <td className="p-2 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 border-r border-slate-200 dark:border-slate-700">
                              {row.stats.presentDays}
                            </td>
                            <td className="p-2 text-center text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/10 border-r border-slate-200 dark:border-slate-700">
                              {row.stats.halfDays || 0}
                            </td>
                            <td className="p-2 text-center text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/10 border-r border-slate-200 dark:border-slate-700">
                              {row.stats.overridesCount > 0 ? `✨ ${row.stats.overridesCount}` : '0'}
                            </td>
                            <td className="p-2 text-center text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-950/10 border-r border-slate-200 dark:border-slate-700">
                              {row.stats.leavesDays}
                            </td>
                            <td className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-850/50 border-r border-slate-200 dark:border-slate-700">
                              {row.stats.weeklyOffsCount}
                            </td>
                            <td className="p-2 text-center text-xs font-bold text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/50 whitespace-nowrap">
                              {row.stats.totalWorkHoursFormatted}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================= */
          /* 4B. SINGLE EMPLOYEE CALENDAR VIEW (UNTOUCHED & PRESERVED)         */
          /* ================================================================= */
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
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
              className="text-xs text-brand-600 dark:text-brand-400"
            >
              Today
            </Button>
          </div>

          {/* Selection Actions for Managers / HR / Admin */}
          {canEditShifts && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {selectedDates.size > 0 && (
                <>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {selectedDates.size} date(s) selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-xs text-slate-500"
                  >
                    Clear Selection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => handleResetToDefault()}
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    title="Remove custom shifts on selected dates and revert to default"
                  >
                    Reset Selected
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllDays}
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                Select All Month Days
              </Button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-indigo-500 shadow-xs" />
            <span>Shift Override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-slate-200 dark:bg-slate-700" />
            <span>Default Shift</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500" />
            <span>Weekly Off (WO) / Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500" />
            <span>Approved Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/60 text-emerald-800" />
            <span>Actual Attendance / Worked</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. Calendar Days Grid                                               */}
        {/* =================================================================== */}
        {isLoadingSchedule ? (
          <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <LoadingSpinner size="md" /> Loading monthly schedule data...
          </div>
        ) : (
          <div className="space-y-2">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-1 border-b border-slate-100 dark:border-slate-800">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-rose-500">Sat</span>
              <span className="text-rose-500">Sun</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                if (day.empty) {
                  return (
                    <div
                      key={day.key}
                      className="min-h-[110px] rounded-xl bg-slate-50/30 dark:bg-slate-900/30 border border-transparent"
                    />
                  );
                }

                const isSelected = selectedDates.has(day.dateKey);
                const isCustom = Boolean(day.customAssignment);
                const isWO = day.customAssignment?.shiftType === 'WO';
                const hasHoliday = Boolean(day.holiday);
                const hasLeave = Boolean(day.approvedLeave);
                const att = day.attendance;

                // Format Punch times
                const inTime = formatTime12h(att?.checkIn);
                const outTime = formatTime12h(att?.checkOut);

                return (
                  <div
                    key={day.dateKey}
                    onClick={() => {
                      if (canEditShifts) {
                        handleToggleDate(day.dateKey);
                      } else {
                        setSelectedDayDetails(day);
                      }
                    }}
                    className={`min-h-[115px] p-2.5 rounded-xl border transition-all flex flex-col justify-between select-none relative group ${
                      canEditShifts ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/30 shadow-xs ring-2 ring-brand-500/30'
                        : isCustom
                        ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10 hover:border-indigo-300'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Date & Status indicator */}
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          day.isToday
                            ? 'bg-brand-600 text-white shadow-2xs'
                            : day.isWeekend
                            ? 'text-rose-500'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {/* Attendance Badge or Selection Checkbox */}
                      <div className="flex items-center gap-1">
                        {att?.status && (
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border shrink-0 ${
                              att.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : att.status === 'LATE'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : att.status === 'HALF_DAY'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                                : att.status === 'ABSENT'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200'
                            }`}
                          >
                            {att.status === 'PRESENT' ? 'Present' : att.status === 'LATE' ? 'Late' : att.status === 'HALF_DAY' ? 'Half Day' : att.status}
                          </span>
                        )}

                        {canEditShifts && (
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 group-hover:border-brand-400'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Section: Shift & Leave Badges */}
                    <div className="space-y-1 my-1">
                      {hasHoliday ? (
                        <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5 truncate" title={day.holiday.name}>
                          🎉 {day.holiday.name}
                        </div>
                      ) : day.isHalfDay ? (
                        <div className="text-[10px] font-bold text-amber-900 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 truncate" title={day.approvedLeave?.leaveName ? `Half Day (${day.approvedLeave.leaveName})` : 'Half Day'}>
                          🌗 Half Day
                        </div>
                      ) : hasLeave ? (
                        <div className="text-[10px] font-semibold text-orange-800 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded px-1.5 py-0.5 truncate" title={day.approvedLeave.leaveName}>
                          ⛱️ {day.approvedLeave.leaveName}
                        </div>
                      ) : isWO ? (
                        <div className="text-[10px] font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded px-1.5 py-0.5">
                          Weekly Off
                        </div>
                      ) : isCustom ? (
                        <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded px-1.5 py-0.5 truncate" title={`Custom Shift: ${day.customAssignment.shiftLabel}`}>
                          ✨ {day.customAssignment.shiftLabel}
                        </div>
                      ) : (
                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded px-1.5 py-0.5 truncate" title={`Default Shift: ${scheduleData?.defaultShiftTiming || 'Standard'}`}>
                          {scheduleData?.defaultShiftTiming || '11:00 AM - 07:00 PM'}
                        </div>
                      )}

                      {/* Actual Hours Worked & Punches */}
                      {att && (
                        <div className="pt-0.5">
                          {inTime && (
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                              <span>In: {inTime}</span>
                              {outTime ? <span>• Out: {outTime}</span> : <span className="text-emerald-600 font-bold">• Active</span>}
                            </div>
                          )}

                          {att.formattedWorkHours && att.formattedWorkHours !== '-' && (
                            <div className="mt-0.5 flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                              <span>⏱️ {att.formattedWorkHours}</span>
                              {att.overtimeHours > 0 && (
                                <span className="text-[9px] text-brand-600">+{att.overtimeHours}h OT</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Quick Actions (Click to edit or reset single day) */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="text-[9px]">
                        {isCustom ? 'Override' : 'Default'}
                      </span>

                      {canEditShifts && isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetToDefault([day.dateKey]);
                          }}
                          className="hover:text-rose-500 transition-colors p-0.5 cursor-pointer"
                          title="Reset this day back to default shift"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </>
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
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    shiftType === 'SHIFT'
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
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    shiftType === 'WO'
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
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
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
      {/* 8. Cell Inspector Modal for Organization Roster Matrix Grid         */}
      {/* =================================================================== */}
      {selectedMatrixCellDetails && (
        <Modal
          isOpen={Boolean(selectedMatrixCellDetails)}
          onClose={() => setSelectedMatrixCellDetails(null)}
          title={`Roster Details: ${selectedMatrixCellDetails.dateKey}`}
          subtitle={`${selectedMatrixCellDetails.employee.fullName} (${selectedMatrixCellDetails.employee.employeeCode})`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            {/* Employee Quick Header */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Avatar
                src={selectedMatrixCellDetails.employee.avatarUrl}
                name={selectedMatrixCellDetails.employee.fullName}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {selectedMatrixCellDetails.employee.fullName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {selectedMatrixCellDetails.employee.designationTitle || 'Staff'} • {selectedMatrixCellDetails.employee.departmentName || 'General'}
                </p>
              </div>
            </div>

            {/* Shift Timing Details */}
            <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Shift</span>
                {selectedMatrixCellDetails.cell.isOverride ? (
                  <Badge variant="brand" size="xs">✨ Date Override</Badge>
                ) : selectedMatrixCellDetails.cell.shiftType === 'WO' ? (
                  <Badge variant="neutral" size="xs">Weekly Off</Badge>
                ) : (
                  <Badge variant="neutral" size="xs">Default Contract</Badge>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedMatrixCellDetails.cell.shiftLabel}
              </p>
              {selectedMatrixCellDetails.cell.customAssignment?.notes && (
                <p className="text-[11px] text-slate-500 italic">
                  Remarks: {selectedMatrixCellDetails.cell.customAssignment.notes}
                </p>
              )}
            </div>

            {/* Attendance Punch Details if any */}
            {selectedMatrixCellDetails.cell.attendance ? (
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Attendance Punches</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {selectedMatrixCellDetails.cell.attendance.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Check-In</span>
                    <span className="font-semibold">{formatTime12h(selectedMatrixCellDetails.cell.attendance.checkIn) || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Check-Out</span>
                    <span className="font-semibold">{formatTime12h(selectedMatrixCellDetails.cell.attendance.checkOut) || 'Active / None'}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 flex justify-between">
                    <span className="text-[11px] text-slate-500">Total Worked:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">{selectedMatrixCellDetails.cell.attendance.formattedWorkHours}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 text-center text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                No punch attendance record logged for this date.
              </div>
            )}

            {/* Leave / Holiday / Half Day Info if any */}
            {selectedMatrixCellDetails.cell.holiday || selectedMatrixCellDetails.cell.displayType === 'HOLIDAY' ? (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
                🎉 Company Holiday: <strong>{selectedMatrixCellDetails.cell.holiday?.name || 'Company Holiday'}</strong>
              </div>
            ) : null}
            {selectedMatrixCellDetails.cell.isHalfDay || selectedMatrixCellDetails.cell.displayType === 'HALF_DAY' ? (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/50 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
                🌗 Half Day (0.5 Day): <strong>{selectedMatrixCellDetails.cell.leave?.leaveName ? `Leave - ${selectedMatrixCellDetails.cell.leave.leaveName}` : 'Half Day Shift / Attendance'}</strong>
              </div>
            ) : selectedMatrixCellDetails.cell.leave || selectedMatrixCellDetails.cell.displayType === 'LEAVE' ? (
              <div className="p-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-xl text-orange-900 dark:text-orange-200 text-xs">
                🏖️ Approved Leave: <strong>{selectedMatrixCellDetails.cell.leave?.leaveName || selectedMatrixCellDetails.cell.cellText} ({selectedMatrixCellDetails.cell.leave?.leaveCode || selectedMatrixCellDetails.cell.cellText})</strong>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const empId = selectedMatrixCellDetails.employee.id;
                  setSelectedMatrixCellDetails(null);
                  setSelectedEmployeeId(empId);
                }}
              >
                View Individual Calendar
              </Button>

              {canEditShifts && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Edit3}
                  onClick={() => {
                    const emp = selectedMatrixCellDetails.employee;
                    const dateStr = selectedMatrixCellDetails.dateKey;
                    setSelectedMatrixCellDetails(null);
                    handleQuickEditEmployeeShift(emp, dateStr);
                  }}
                >
                  Edit Shift For Date
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DateWiseShiftPage;
