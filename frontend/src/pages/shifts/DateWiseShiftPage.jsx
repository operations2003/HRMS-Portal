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
} from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Avatar } from '../../components/common/Avatar.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { shiftService } from '../../services/shiftService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const PRESET_SHIFTS = [
  { label: '11:00 AM - 07:00 PM', desc: 'Standard Day (8 hrs)' },
  { label: '10:00 AM - 07:00 PM', desc: 'General Day (9 hrs)' },
  { label: '02:00 PM - 10:00 PM', desc: 'Evening Shift (8 hrs)' },
  { label: '06:00 AM - 02:00 PM', desc: 'Morning Shift (8 hrs)' },
  { label: '10:00 PM - 06:00 AM', desc: 'Night / Overnight Shift (8 hrs)' },
];

export const DateWiseShiftPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  // Month & Year state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12

  // Employee Selection State
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  // Shift Schedule State
  const [scheduleData, setScheduleData] = useState(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Date Selection State (Set of 'YYYY-MM-DD')
  const [selectedDates, setSelectedDates] = useState(new Set());

  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
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

  // 1. Fetch eligible employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const list = await shiftService.getEligibleEmployees();
        setEmployees(list || []);

        if (list && list.length > 0) {
          // If caller is an employee and in list, default to self; else pick first
          const callerMatch = list.find((e) => e.id === user?.employeeId);
          setSelectedEmployeeId(callerMatch ? callerMatch.id : list[0].id);
        }
      } catch (err) {
        toast.error('Failed to load eligible employees for shift management.');
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  // 2. Fetch shift schedule when employee or month/year changes
  const fetchSchedule = async () => {
    if (!selectedEmployeeId) return;

    try {
      setIsLoadingSchedule(true);
      const data = await shiftService.getEmployeeShifts({
        employeeId: selectedEmployeeId,
        month: currentMonth,
        year: currentYear,
      });
      setScheduleData(data);
      // Clear selected dates on month/employee switch
      setSelectedDates(new Set());
    } catch (err) {
      toast.error('Failed to retrieve shift schedule.');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedEmployeeId, currentMonth, currentYear]);

  // Selected employee object
  const activeEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || scheduleData?.employee || null;
  }, [employees, selectedEmployeeId, scheduleData]);

  // Filtered employees for dropdown
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q) ||
        e.departmentName?.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

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

      days.push({
        dayNumber: d,
        dateKey,
        isWeekend,
        customAssignment,
        holiday,
        approvedLeave,
        isToday:
          today.getFullYear() === currentYear &&
          today.getMonth() + 1 === currentMonth &&
          today.getDate() === d,
      });
    }

    return days;
  }, [currentYear, currentMonth, scheduleData]);

  // Toggle selection of a single date
  const handleToggleDate = (dateKey) => {
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
    setSelectedDates(new Set([dateKey]));
    setIsAssignModalOpen(true);
  };

  // Open Assign Modal for current selected set
  const handleOpenAssignModal = () => {
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

    let finalLabel = selectedPreset;
    let finalStart = null;
    let finalEnd = null;

    if (shiftType === 'WO') {
      finalLabel = 'Weekly Off';
    } else if (isCustomMode) {
      if (!customStartTime || !customEndTime) {
        toast.error('Please enter both custom start and end times.');
        return;
      }
      finalStart = customStartTime.length === 5 ? `${customStartTime}:00` : customStartTime;
      finalEnd = customEndTime.length === 5 ? `${customEndTime}:00` : customEndTime;
      finalLabel = `${customStartTime} - ${customEndTime}`;
    }

    try {
      setIsSaving(true);
      const res = await shiftService.assignShifts({
        employeeId: selectedEmployeeId,
        dates: Array.from(selectedDates),
        shiftType,
        shiftLabel: finalLabel,
        shiftStartTime: finalStart,
        shiftEndTime: finalEnd,
        notes: shiftNotes.trim(),
      });

      toast.success(res?.message || `Updated shift timing for ${selectedDates.size} date(s).`);
      setIsAssignModalOpen(false);
      setShiftNotes('');
      fetchSchedule();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save shift assignment.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset selected dates to default
  const handleResetToDefault = async (datesToReset) => {
    const list = Array.isArray(datesToReset) ? datesToReset : Array.from(selectedDates);
    if (list.length === 0) return;

    try {
      setIsSaving(true);
      const res = await shiftService.resetShifts({
        employeeId: selectedEmployeeId,
        dates: list,
      });
      toast.success(res?.message || `Reset ${list.length} date(s) to default shift.`);
      fetchSchedule();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset shifts.';
      toast.error(msg);
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
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Shift Management
                <Badge variant="brand" size="sm">Date-wise</Badge>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Assign and modify shift timings for specific dates. Employee default shift is strictly preserved.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={History}
            onClick={handleOpenHistory}
            title="View shift change audit trail"
          >
            Shift History
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={CalendarCheck}
            disabled={selectedDates.size === 0}
            onClick={handleOpenAssignModal}
            className="shadow-sm"
          >
            Assign Shift ({selectedDates.size})
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. Employee Selector & Profile Card                                 */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Employee Selection Dropdown / Search (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Select Employee</span>
              <span className="text-[11px] font-normal text-slate-400">
                {employees.length} available
              </span>
            </label>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search by name, ID, dept..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {isLoadingEmployees ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Loading employees...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching employees found.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = emp.id === selectedEmployeeId;
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
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {emp.designationTitle || emp.departmentName || 'Staff'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Selected Employee Details Card (8 cols) */}
        <div className="lg:col-span-8 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-850 dark:via-slate-900 dark:to-slate-850 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          {activeEmployee ? (
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
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeEmployee.designationTitle || 'Staff'} • {activeEmployee.departmentName || 'General'}
                    </p>
                  </div>
                </div>

                {/* Default Contract Shift Display */}
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
                  <strong>Zero-Leakage Invariant:</strong> The employee’s default contract shift is never overwritten. When you select specific dates below, only those dates receive shift overrides, and all other dates naturally preserve their standard shift timing.
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
      {/* 3. Month Navigation & Calendar Controls                             */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
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

          {/* Selection Actions */}
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
                  Reset Selected to Default
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
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-brand-500 shadow-xs" />
            <span>Custom Shift Override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-slate-200 dark:bg-slate-700" />
            <span>Default Contract Shift</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500" />
            <span>Weekly Off (WO) / Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500" />
            <span>Approved Leave</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. Calendar Days Grid                                               */}
        {/* =================================================================== */}
        {isLoadingSchedule ? (
          <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <LoadingSpinner size="md" /> Loading shift assignments...
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
                      className="min-h-[96px] rounded-xl bg-slate-50/30 dark:bg-slate-900/30 border border-transparent"
                    />
                  );
                }

                const isSelected = selectedDates.has(day.dateKey);
                const isCustom = Boolean(day.customAssignment);
                const isWO = day.customAssignment?.shiftType === 'WO';
                const hasHoliday = Boolean(day.holiday);
                const hasLeave = Boolean(day.approvedLeave);

                return (
                  <div
                    key={day.dateKey}
                    onClick={() => handleToggleDate(day.dateKey)}
                    className={`min-h-[105px] p-2 rounded-xl border transition-all flex flex-col justify-between cursor-pointer select-none relative group ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/30 shadow-xs ring-2 ring-brand-500/30'
                        : isCustom
                        ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10 hover:border-indigo-300'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Date & Checkbox indicator */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
                          day.isToday
                            ? 'bg-brand-600 text-white shadow-2xs'
                            : day.isWeekend
                            ? 'text-rose-500'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 group-hover:border-brand-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>

                    {/* Middle: Shift / Leave Status Badges */}
                    <div className="space-y-1 my-1">
                      {hasHoliday ? (
                        <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5 truncate" title={day.holiday.name}>
                          🎉 {day.holiday.name}
                        </div>
                      ) : hasLeave ? (
                        <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5 truncate" title={day.approvedLeave.leaveName}>
                          ⛱️ {day.approvedLeave.leaveName}
                        </div>
                      ) : isWO ? (
                        <div className="text-[10px] font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded px-1.5 py-0.5">
                          Weekly Off
                        </div>
                      ) : isCustom ? (
                        <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded px-1.5 py-0.5 truncate" title={`Custom: ${day.customAssignment.shiftLabel}`}>
                          ✨ {day.customAssignment.shiftLabel}
                        </div>
                      ) : (
                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded px-1.5 py-0.5 truncate" title={`Default: ${scheduleData?.defaultShiftTiming || 'Standard'}`}>
                          {scheduleData?.defaultShiftTiming || '11:00 AM - 07:00 PM'}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Quick Actions (Click to edit or reset single day) */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="text-[9px]">
                        {isCustom ? 'Custom' : 'Default'}
                      </span>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetToDefault([day.dateKey]);
                          }}
                          className="hover:text-rose-500 transition-colors p-0.5"
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
      </div>

      {/* =================================================================== */}
      {/* 5. Assign Shift Modal                                               */}
      {/* =================================================================== */}
      {isAssignModalOpen && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Assign / Edit Shift Timing"
          subtitle={`Scheduling ${selectedDates.size} selected date(s) for ${activeEmployee?.fullName || 'employee'}`}
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
                onClick={() => setIsAssignModalOpen(false)}
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
      {/* 6. Shift Change Audit History Modal                                 */}
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
    </div>
  );
};

export default DateWiseShiftPage;
