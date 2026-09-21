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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { AttendancePunchCard } from '../../components/attendance/AttendancePunchCard.jsx';
import { AttendanceStatsBar } from '../../components/attendance/AttendanceStatsBar.jsx';
import { AttendanceHistoryTable } from '../../components/attendance/AttendanceHistoryTable.jsx';
import { AttendanceDetailModal } from '../../components/attendance/AttendanceDetailModal.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';

export const AttendanceDashboardPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();

  // Role permissions
  const canViewTeam = hasRole(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);
  const canViewOrg = hasRole(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);

  // Active view tab: 'my' | 'team' | 'org'
  const [activeTab, setActiveTab] = useState('my');

  // Today's attendance state for punch card
  const [todayRecord, setTodayRecord] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [isPunchingIn, setIsPunchingIn] = useState(false);
  const [isPunchingOut, setIsPunchingOut] = useState(false);
  const [isBreakLoading, setIsBreakLoading] = useState(false);
  const [punchError, setPunchError] = useState(null);

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
      const res = await attendanceService.getMyAttendance({ limit: 5 });
      if (res?.employeeProfile) {
        setEmployeeProfile(res.employeeProfile);
      }
      const records = res.records || [];
      const localToday = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"
      const rec =
        records.find((r) => {
          if (!r.attendanceDate) return false;
          const dStr = typeof r.attendanceDate === 'string' ? r.attendanceDate.split('T')[0] : '';
          return dStr === localToday;
        }) || (records[0] && !records[0].checkOut ? records[0] : null);

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
        } else if (activeTab === 'team') {
          const res = await attendanceService.getTeamAttendance({
            startDate: filters.startDate,
            endDate: filters.endDate,
            status: filters.status,
            page,
            limit: 15,
          });
          setRecords(res.records);
          setPagination(res.pagination || null);
        } else if (activeTab === 'org') {
          const res = await attendanceService.getOrgAttendance({
            date: filters.startDate && filters.startDate === filters.endDate ? filters.startDate : undefined,
            startDate: filters.startDate,
            endDate: filters.endDate,
            status: filters.status,
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
    fetchTodayRecord();
  }, [fetchTodayRecord]);

  useEffect(() => {
    fetchTableData(1);
  }, [fetchTableData]);

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
        `Logged out successfully! Total work time: ${record.totalHours || 0} hrs.`
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


  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: '',
      search: '',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Workforce Management • Phase 4</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Attendance Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            Record daily work punches, track active hours, and review history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={() => {
              fetchTodayRecord();
              fetchTableData(pagination?.page || 1);
            }}
          >
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Top Section: Punch Card + Metrics Bar */}
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
                Standard schedule with break tracking. 10-minute arrival grace applies. Overtime accrued automatically for work exceeding 8.0 net hours.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-3.5 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-slate-200 border border-white/10 backdrop-blur-sm">
                8.0 hrs Baseline
              </span>
            </div>
          </div>

          <AttendanceStatsBar
            statistics={statistics}
            summary={summary}
            isOrgView={activeTab === 'org'}
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'my'
                ? 'border-brand-500 text-brand-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>My Attendance</span>
          </button>

          {canViewTeam && (
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'border-brand-500 text-brand-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Attendance</span>
            </button>
          )}

          {canViewOrg && (
            <button
              type="button"
              onClick={() => setActiveTab('org')}
              className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'org'
                  ? 'border-brand-500 text-brand-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Organization Logs</span>
            </button>
          )}
        </nav>
      </div>

      {/* Attendance History Table */}
      <AttendanceHistoryTable
        records={records}
        pagination={pagination}
        isLoading={loading}
        error={error}
        onPageChange={(p) => fetchTableData(p)}
        onViewDetails={(rec) => setSelectedDetailRecord(rec)}
        showEmployeeCol={activeTab !== 'my'}
        showSearch={activeTab === 'org'}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onRetry={() => fetchTableData(pagination?.page || 1)}
      />

      {/* Attendance Details Modal */}
      <AttendanceDetailModal
        isOpen={Boolean(selectedDetailRecord)}
        onClose={() => setSelectedDetailRecord(null)}
        record={selectedDetailRecord}
      />
    </div>
  );
};
