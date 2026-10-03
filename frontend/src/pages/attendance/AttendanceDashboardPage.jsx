import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  RefreshCw,
  UserCheck,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Download,
} from 'lucide-react';
import { exportAttendanceToExcel } from '../../utils/attendanceExcelExport.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { AttendancePunchCard } from '../../components/attendance/AttendancePunchCard.jsx';
import { AttendanceStatsBar } from '../../components/attendance/AttendanceStatsBar.jsx';
import { AttendanceHistoryTable } from '../../components/attendance/AttendanceHistoryTable.jsx';
import { AttendanceDetailModal } from '../../components/attendance/AttendanceDetailModal.jsx';
import { AttendanceRemarkModal } from '../../components/attendance/AttendanceRemarkModal.jsx';
import { EditAttendanceTimingModal } from '../../components/attendance/EditAttendanceTimingModal.jsx';
import { ConvertAbsenceToLeaveModal } from '../../components/attendance/ConvertAbsenceToLeaveModal.jsx';
import { ExportAttendanceModal } from '../../components/attendance/ExportAttendanceModal.jsx';
import { AttendanceAnalyticsSection } from '../../components/attendance/AttendanceAnalyticsSection.jsx';
import { departmentService } from '../../services/departmentService.js';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { isCeoOrAdmin } from '../../utils/roleUtils.js';
import { formatHoursToClock } from '../../utils/timeUtils.js';

export const AttendanceDashboardPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();
  const isCeo = isCeoOrAdmin(user);

  // Role permissions: HR, Admin, and Manager can see the whole organization's attendance
  const canViewOrg = hasRole(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin', 'Manager']);
  const canEditTiming = hasRole(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin', 'Manager']) || hasPermission('attendance:regularize');
  // Tagging / remark option is authorized for HR Manager, Admin, and Manager
  const canRemark = hasRole(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin', 'Manager']);

  // Active view tab: Admin, HR, and Manager default to 'org', regular Employees have 'my'. CEO stays exclusively on 'org'
  const [activeTab, setActiveTab] = useState(() => (canViewOrg ? 'org' : 'my'));

  useEffect(() => {
    if (isCeo && activeTab !== 'org') {
      setActiveTab('org');
    }
  }, [isCeo, activeTab]);

  // Today's attendance state for punch card
  const [todayRecord, setTodayRecord] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [isPunchingIn, setIsPunchingIn] = useState(false);
  const [isPunchingOut, setIsPunchingOut] = useState(false);
  const [isBreakLoading, setIsBreakLoading] = useState(false);
  const [punchError, setPunchError] = useState(null);
  const [selectedRemarkRecord, setSelectedRemarkRecord] = useState(null);
  const [selectedEditTimingRecord, setSelectedEditTimingRecord] = useState(null);
  const [selectedConvertRecord, setSelectedConvertRecord] = useState(null);
  const [isSyncingAbsences, setIsSyncingAbsences] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [departments, setDepartments] = useState([]);

  // History & Metrics state
  const [records, setRecords] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    search: '',
    deptId: '',
  });

  // Modals state
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);

  // Today's Date String YYYY-MM-DD
  const todayDateString = new Date().toISOString().split('T')[0];

  /**
   * Fetch today's record to populate the punch card directly from backend API
   */
  const fetchTodayRecord = useCallback(async () => {
    try {
      // 1. Try dedicated today endpoint first
      const todayRes = await attendanceService.getMyTodayRecord();
      if (todayRes?.employeeProfile) {
        setEmployeeProfile(todayRes.employeeProfile);
      }
      if (todayRes && todayRes.todayRecord !== undefined) {
        setTodayRecord(todayRes.todayRecord);
        return;
      }
    } catch {
      // Non-blocking fallback to getMyAttendance
    }

    try {
      // 2. Fallback to getMyAttendance with higher limit and robust matching
      const res = await attendanceService.getMyAttendance({ limit: 30 });
      if (res?.employeeProfile) {
        setEmployeeProfile(res.employeeProfile);
      }
      if (res?.todayRecord) {
        setTodayRecord(res.todayRecord);
        return;
      }

      const records = res.records || [];
      const localToday = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"

      // Prioritize active unclosed session with check-in (excluding future leaves/holidays)
      const activeUnclosed = records.find(
        (r) => r.checkIn && !r.checkOut && r.status !== 'ON_LEAVE' && r.status !== 'HOLIDAY'
      );

      // Then check for today's record match
      const todayMatch = records.find((r) => {
        if (!r.attendanceDate) return false;
        const dStr = typeof r.attendanceDate === 'string' ? r.attendanceDate.split('T')[0] : '';
        return dStr === localToday;
      });

      const rec = activeUnclosed || todayMatch || null;
      setTodayRecord(rec);
    } catch (err) {
      console.warn('Failed to fetch today attendance record:', err);
    }
  }, []);

  /**
   * Fetch attendance records based on current active tab & filters
   */
  const fetchTableData = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === 'my') {
          const res = await attendanceService.getMyAttendance({
            startDate: filters.startDate,
            endDate: filters.endDate,
            status: filters.status,
            page,
            limit: 15,
          });
          setRecords(res.records);
          setStatistics(res.statistics || {});
          setPagination(res.pagination || null);
        } else if (activeTab === 'org' && canViewOrg) {
          const res = await attendanceService.getOrgAttendance({
            date: filters.startDate && filters.startDate === filters.endDate ? filters.startDate : undefined,
            startDate: filters.startDate,
            endDate: filters.endDate,
            status: filters.status,
            deptId: filters.deptId,
            search: filters.search,
            page,
            limit: 15,
          });
          setRecords(res.records);
          setSummary(res.summary || {});
          setPagination(res.pagination || null);
        }
      } catch (err) {
        setError(err.message || 'Failed to load attendance records.');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, filters]
  );

  useEffect(() => {
    if (!isCeo) {
      fetchTodayRecord();
    }
  }, [fetchTodayRecord, isCeo]);

  useEffect(() => {
    fetchTableData(1);
  }, [fetchTableData]);

  // Load departments for export filter selector
  useEffect(() => {
    if (canViewOrg) {
      departmentService.getAllDepartments().then((res) => {
        const list = res?.items || res?.data || (Array.isArray(res) ? res : []);
        setDepartments(list);
      }).catch(() => {});
    }
  }, [canViewOrg]);

  // Handle Login (Punch In)
  const handleCheckIn = async (punchData) => {
    if (isPunchingIn || isPunchingOut) return;
    try {
      setIsPunchingIn(true);
      setPunchError(null);
      const record = await attendanceService.checkIn(punchData);
      setTodayRecord(record);
      toast.success(
        `Logged in successfully at ${new Date(record.checkIn).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}!`
      );
      // Refresh backend attendance state
      fetchTodayRecord();
      fetchTableData(1);
    } catch (err) {
      const msg = err.message || 'Login failed. Please try again.';
      setPunchError(msg);
      toast.error(msg);
    } finally {
      setIsPunchingIn(false);
    }
  };

  // Handle Logout (Punch Out)
  const handleCheckOut = async (punchData) => {
    if (isPunchingIn || isPunchingOut) return;
    try {
      setIsPunchingOut(true);
      setPunchError(null);
      const record = await attendanceService.checkOut(punchData);
      setTodayRecord(record);
      toast.success(
        `Logged out successfully! Total work time: ${formatHoursToClock(record.totalHours || 0)}.`
      );
      // Refresh backend attendance state
      fetchTodayRecord();
      fetchTableData(1);
    } catch (err) {
      const msg = err.message || 'Logout failed. Please try again.';
      setPunchError(msg);
      toast.error(msg);
    } finally {
      setIsPunchingOut(false);
    }
  };

  // Handle Pause for Break
  const handlePauseBreak = async () => {
    if (isBreakLoading || isPunchingOut) return;
    try {
      setIsBreakLoading(true);
      setPunchError(null);
      const record = await attendanceService.pauseBreak();
      setTodayRecord(record);
      toast.success('Shift paused for break. Timer paused.');
      fetchTodayRecord();
    } catch (err) {
      const msg = err.message || 'Failed to pause for break.';
      setPunchError(msg);
      toast.error(msg);
    } finally {
      setIsBreakLoading(false);
    }
  };

  // Handle Resume Work (End Break)
  const handleResumeBreak = async () => {
    if (isBreakLoading || isPunchingOut) return;
    try {
      setIsBreakLoading(true);
      setPunchError(null);
      const record = await attendanceService.resumeBreak();
      setTodayRecord(record);
      toast.success('Break ended. Work session resumed!');
      fetchTodayRecord();
    } catch (err) {
      const msg = err.message || 'Failed to resume work.';
      setPunchError(msg);
      toast.error(msg);
    } finally {
      setIsBreakLoading(false);
    }
  };

  /**
   * Open Month Selector Modal to pick exact month (e.g. September 2026, October 2026)
   * Prevents two months from getting merged together.
   */
  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  /**
   * Execute single-month export once user confirms month in modal
   */
  const handleConfirmExportMonthly = async ({ month, monthLabel, deptId }) => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      toast.info(`Preparing ${monthLabel} attendance report...`);

      const isAllMonths = month === 'all';
      let startDate = undefined;
      let endDate = undefined;

      if (!isAllMonths && month.includes('-')) {
        const [yearStr, monthNumStr] = month.split('-');
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthNumStr, 10);
        const daysInMonth = new Date(y, m, 0).getDate();
        startDate = `${month}-01`;
        endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;
      }

      let exportRecords = [];
      if (activeTab === 'org' && canViewOrg) {
        const res = await attendanceService.getOrgAttendance({
          startDate,
          endDate,
          deptId: deptId || undefined,
          page: 1,
          limit: 10000,
        });
        exportRecords = res.records || [];
      } else {
        const res = await attendanceService.getMyAttendance({
          startDate,
          endDate,
          page: 1,
          limit: 10000,
        });
        exportRecords = res.records || [];
      }

      if (!exportRecords || exportRecords.length === 0) {
        toast.warning(`No attendance records found for ${monthLabel}.`);
        return;
      }

      const result = await exportAttendanceToExcel(exportRecords, {
        month,
        monthLabel,
        orgName: 'TaskNera HRMS',
      });

      toast.success(
        `Successfully exported ${monthLabel} report for ${result.employeeCount} employee(s) to Excel!`
      );
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Failed to export monthly attendance:', err);
      toast.error(err.message || 'Failed to export attendance to Excel.');
    } finally {
      setIsExporting(false);
    }
  };


  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: '',
      search: '',
      deptId: '',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>{isCeo ? 'Executive Cockpit • Attendance Oversight' : 'Workforce Management • Attendance'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {isCeo ? 'Attendance & Workforce Supervision' : 'Attendance Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            {isCeo
              ? 'Supervise organization-wide daily punches, review punctuality trends, and audit employee attendance records.'
              : 'Record daily work punches, track active hours, and review history.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={() => {
              if (!isCeo) fetchTodayRecord();
              fetchTableData(pagination?.page || 1);
            }}
          >
            Refresh Logs
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={Download}
            onClick={handleOpenExportModal}
            title="Select Month to download single-month attendance report"
          >
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Tabs Navigation for HR / Admin / Manager */}
      {canViewOrg && (
        <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <nav className="-mb-px flex space-x-6">
            <button
              type="button"
              onClick={() => setActiveTab('org')}
              className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'org'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Organization Attendance & Analytics</span>
            </button>

            {!isCeo && (
              <button
                type="button"
                onClick={() => setActiveTab('my')}
                className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'my'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>My Punch & Attendance</span>
              </button>
            )}
          </nav>

          {isCeo && (
            <div className="pb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" /> Executive Supervisor • Attendance Tracking Exempt
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Section: Analytics Graphs (Org view) vs Personal Punch Card (My view) */}
      {activeTab === 'org' && canViewOrg ? (
        <AttendanceAnalyticsSection
          selectedDeptId={filters.deptId}
          onDeptChange={(dId) => handleFilterChange('deptId', dId)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Punch In/Out Card */}
          <div className="lg:col-span-5 flex flex-col">
            <AttendancePunchCard
              todayRecord={todayRecord}
              assignedShift={employeeProfile?.shiftTiming || todayRecord?.employee?.shiftTiming || '11:00 AM - 07:00 PM'}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onPauseBreak={handlePauseBreak}
              onResumeBreak={handleResumeBreak}
              isPunchingIn={isPunchingIn}
              isPunchingOut={isPunchingOut}
              isBreakLoading={isBreakLoading}
              error={punchError}
              onClearError={() => setPunchError(null)}
            />
          </div>

          {/* Dynamic Metric Cards */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-md border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                  Assigned Shift & Policy Overview
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  {employeeProfile?.shiftTiming
                    ? `Assigned Shift: ${employeeProfile.shiftTiming}`
                    : 'Standard Shift (11:00 AM – 07:00 PM)'}
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-md">
                  Standard schedule with live break tracking. Work beyond scheduled hours is counted as Overtime (OT). Unclosed sessions automatically log out 10 hours after shift end.
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-start sm:items-end gap-1.5">
                <span className="px-3.5 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-slate-200 border border-white/10 backdrop-blur-sm">
                  Universal Shift Policy
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-brand-500/20 text-[11px] font-semibold text-brand-300 border border-brand-500/30">
                  +10h Auto-Logout Cap
                </span>
              </div>
            </div>

            <AttendanceStatsBar
              statistics={statistics}
              summary={summary}
              isOrgView={false}
            />
          </div>
        </div>
      )}

      {/* Attendance History Table */}
      <AttendanceHistoryTable
        records={records}
        pagination={pagination}
        isLoading={loading}
        error={error}
        onPageChange={(p) => fetchTableData(p)}
        onViewDetails={(rec) => setSelectedDetailRecord(rec)}
        onAddRemark={(rec) => setSelectedRemarkRecord(rec)}
        canRemark={canRemark}
        onEditTiming={(rec) => setSelectedEditTimingRecord(rec)}
        canEditTiming={canEditTiming}
        showEmployeeCol={activeTab !== 'my'}
        showSearch={activeTab === 'org'}
        onConvertAbsence={(rec) => setSelectedConvertRecord(rec)}
        currentUser={user}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onRetry={() => fetchTableData(pagination?.page || 1)}
        onExport={handleOpenExportModal}
        isExporting={isExporting}
      />

      {/* Attendance Details Modal */}
      <AttendanceDetailModal
        isOpen={Boolean(selectedDetailRecord)}
        onClose={() => setSelectedDetailRecord(null)}
        record={selectedDetailRecord}
        onAddRemark={
          canRemark
            ? (rec) => {
                setSelectedDetailRecord(null);
                setSelectedRemarkRecord(rec);
              }
            : undefined
        }
        canRemark={canRemark}
        onEditTiming={(rec) => {
          setSelectedDetailRecord(null);
          setSelectedEditTimingRecord(rec);
        }}
        canEditTiming={canEditTiming}
      />

      {/* Convert Absence to Leave Modal */}
      <ConvertAbsenceToLeaveModal
        isOpen={Boolean(selectedConvertRecord)}
        onClose={() => setSelectedConvertRecord(null)}
        record={selectedConvertRecord}
        onSuccess={() => {
          fetchTableData(pagination?.page || 1);
          fetchTodayRecord();
        }}
      />

      {/* Attendance Remark Modal (Emergency vs OT for 10h+ Post-Shift) - HR, Admin & Manager */}
      {canRemark && (
        <AttendanceRemarkModal
          isOpen={Boolean(selectedRemarkRecord)}
          onClose={() => setSelectedRemarkRecord(null)}
          record={selectedRemarkRecord}
          onSuccess={(updated) => {
            fetchTableData(pagination?.page || 1);
            if (todayRecord && todayRecord.id === updated.id) {
              setTodayRecord(updated);
            }
          }}
        />
      )}

      {/* Attendance Timing Adjustment Modal (for Late Arrival / Technical Issues) */}
      <EditAttendanceTimingModal
        isOpen={Boolean(selectedEditTimingRecord)}
        onClose={() => setSelectedEditTimingRecord(null)}
        record={selectedEditTimingRecord}
        onSuccess={(updated) => {
          fetchTableData(pagination?.page || 1);
          if (todayRecord && todayRecord.id === updated.id) {
            setTodayRecord(updated);
          }
        }}
      />

      {/* Single-Month Attendance Export Modal */}
      <ExportAttendanceModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleConfirmExportMonthly}
        isExporting={isExporting}
        departments={departments}
        currentDeptId={filters.deptId}
      />
    </div>
  );
};
