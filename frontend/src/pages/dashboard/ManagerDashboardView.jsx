import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  CalendarDays,
  Award,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Briefcase,
  UserCheck,
  Calendar,
  Check,
  X,
  Plus,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  LogIn,
  LogOut,
  Bell,
  ShieldCheck,
  Send,
  Coffee,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { managerService } from '../../services/managerService.js';
import { attendanceService } from '../../services/attendanceService.js';
import { leaveService } from '../../services/leaveService.js';
import { notificationService } from '../../services/notificationService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';

export const ManagerDashboardView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Manager data states
  const [dashboardData, setDashboardData] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamAttendance, setTeamAttendance] = useState([]);
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState({ leaves: [], appraisals: [] });
  const [myLeaveBalances, setMyLeaveBalances] = useState([]);
  const [myTodayAttendance, setMyTodayAttendance] = useState(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Roster search filter
  const [rosterSearch, setRosterSearch] = useState('');

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const todayStr = new Date().toISOString().split('T')[0];

      const [
        dashRes,
        teamRes,
        attRes,
        leavesRes,
        approvalsRes,
        balancesRes,
        myAttRes,
      ] = await Promise.allSettled([
        managerService.getDashboard(),
        managerService.getTeam(),
        managerService.getTeamAttendance({ date: todayStr }),
        managerService.getTeamLeaves(),
        managerService.getPendingApprovals(),
        leaveService.getMyBalances(),
        attendanceService.getMyAttendance({ limit: 1 }),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value || {});
      }

      if (teamRes.status === 'fulfilled') {
        const t = teamRes.value;
        const list = Array.isArray(t?.items) ? t.items : Array.isArray(t?.data) ? t.data : Array.isArray(t) ? t : [];
        setTeamMembers(list);
      }

      if (attRes.status === 'fulfilled') {
        const a = attRes.value;
        const list = Array.isArray(a?.records) ? a.records : Array.isArray(a?.data) ? a.data : Array.isArray(a) ? a : [];
        setTeamAttendance(list);
      }

      if (leavesRes.status === 'fulfilled') {
        const l = leavesRes.value;
        const list = Array.isArray(l?.items) ? l.items : Array.isArray(l?.data) ? l.data : Array.isArray(l) ? l : [];
        setTeamLeaves(list);
      }

      if (approvalsRes.status === 'fulfilled') {
        const app = approvalsRes.value || {};
        setPendingApprovals({
          leaves: Array.isArray(app.leaves) ? app.leaves : [],
          appraisals: Array.isArray(app.appraisals) ? app.appraisals : [],
        });
      }

      if (balancesRes.status === 'fulfilled') {
        setMyLeaveBalances(Array.isArray(balancesRes.value) ? balancesRes.value : []);
      }

      if (myAttRes.status === 'fulfilled') {
        const recs = myAttRes.value?.records || [];
        const todayRec = recs.find((r) => {
          const rDate = r.attendanceDate || r.attendance_date;
          return rDate && rDate.startsWith(todayStr);
        }) || recs[0];
        setMyTodayAttendance(todayRec || null);
      }
    } catch (err) {
      console.error('Error loading manager dashboard data:', err);
      toast.showError('Failed to refresh dashboard intelligence.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick punch handler for manager's personal attendance
  const handleQuickPunch = async () => {
    try {
      setPunchLoading(true);
      if (!myTodayAttendance?.checkInTime && !myTodayAttendance?.check_in_time) {
        await attendanceService.checkIn({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          source: 'WEB_PORTAL',
        });
        toast.showSuccess('Clocked in successfully! Have a productive day.');
      } else {
        await attendanceService.checkOut({
          notes: 'Standard shift completion',
        });
        toast.showSuccess('Clocked out successfully.');
      }
      // Refresh personal attendance
      const myAttRes = await attendanceService.getMyAttendance({ limit: 1 });
      const recs = myAttRes?.records || [];
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = recs.find((r) => {
        const rDate = r.attendanceDate || r.attendance_date;
        return rDate && rDate.startsWith(todayStr);
      }) || recs[0];
      setMyTodayAttendance(todayRec || null);
    } catch (err) {
      toast.showError(err.message || 'Failed to record attendance punch.');
    } finally {
      setPunchLoading(false);
    }
  };

  // Quick Leave Approval from Dashboard
  const handleQuickApproveLeave = async (leaveId) => {
    try {
      setActionLoadingId(leaveId);
      await managerService.approveTeamLeave(leaveId, { comments: 'Approved via Manager Dashboard' });
      toast.showSuccess('Leave request approved successfully.');
      // Remove from pending
      setPendingApprovals((prev) => ({
        ...prev,
        leaves: prev.leaves.filter((l) => l.id !== leaveId),
      }));
      // Refresh dashboard
      loadData(true);
    } catch (err) {
      toast.showError(err.message || 'Failed to approve leave request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Assembling manager intelligence console..." />;
  }

  // Derive metrics
  const teamSummary = dashboardData?.teamSummary || {};
  const totalReports = teamSummary.totalMembers || teamMembers.length;
  const presentToday = teamSummary.presentToday || teamAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'HALF_DAY').length;
  const lateToday = teamSummary.lateToday || teamAttendance.filter((a) => a.status === 'LATE').length;
  const onLeaveToday = teamSummary.onLeaveToday || 0;
  const attendanceRate = totalReports > 0 ? Math.round(((presentToday + lateToday) / totalReports) * 100) : 100;

  const totalPendingAction = pendingApprovals.leaves.length + pendingApprovals.appraisals.length;

  // Filter team members for roster
  const filteredTeam = teamMembers.filter((m) => {
    const fullName = `${m.firstName || ''} ${m.lastName || ''} ${m.email || ''}`.toLowerCase();
    return fullName.includes(rosterSearch.toLowerCase());
  });

  // Upcoming leaves (next 7 days)
  const today = new Date();
  const upcomingLeaves = teamLeaves
    .filter((l) => l.status === 'APPROVED' || l.status === 'PENDING')
    .slice(0, 5);

  const isCheckedIn = Boolean(myTodayAttendance?.checkInTime || myTodayAttendance?.check_in_time);
  const isCheckedOut = Boolean(myTodayAttendance?.checkOutTime || myTodayAttendance?.check_out_time);

  return (
    <div className="space-y-6">
      {/* 1. Manager Executive Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-sm border border-indigo-400/30">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                <span>Supervisory Command & Executive Hub</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Team Roster Live: {presentToday}/{totalReports} On Duty
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, {user?.firstName || 'Manager'}!
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl leading-relaxed">
              Track team attendance, review operational requests, and guide department goals from your central management cockpit.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              icon={Briefcase}
              onClick={() => navigate('/manager')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 border-0"
            >
              Open Manager Cockpit
              {totalPendingAction > 0 && (
                <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold">
                  {totalPendingAction}
                </span>
              )}
            </Button>

            <Button
              variant="secondary"
              size="md"
              icon={CheckCircle2}
              onClick={() => navigate('/approvals')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shadow-none"
            >
              Approvals Center
            </Button>

            <Button
              variant="secondary"
              size="md"
              icon={Users}
              onClick={() => navigate('/team')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shadow-none"
            >
              Team Directory
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadData(true)}
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Ambient background styling */}
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-64 h-64 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
      </div>

      {/* 2. Top Metric KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Assigned Team */}
        <div
          onClick={() => navigate('/team')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
              Direct Reports
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalReports}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>{teamSummary.activeMembers || totalReports} active profiles</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* KPI 2: Today's Team Presence */}
        <div
          onClick={() => navigate('/team?tab=attendance')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Today Presence
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {attendanceRate}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {presentToday} present • {lateToday} late
            </div>
          </div>
        </div>

        {/* KPI 3: Team On Leave */}
        <div
          onClick={() => navigate('/approvals')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              On Leave Today
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {onLeaveToday}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {upcomingLeaves.length} upcoming scheduled
            </div>
          </div>
        </div>

        {/* KPI 4: Pending Supervisory Actions */}
        <div
          onClick={() => navigate('/approvals')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Pending Actions
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalPendingAction}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {pendingApprovals.leaves.length} leaves • {pendingApprovals.appraisals.length} reviews
            </div>
          </div>
        </div>

        {/* KPI 5: Manager's Personal Clock-In Widget */}
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/30 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              My Attendance
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {isCheckedOut
                ? 'Shift Completed'
                : isCheckedIn
                ? `Clocked In (${myTodayAttendance.checkInTime || myTodayAttendance.check_in_time})`
                : 'Not Clocked In'}
            </div>
            <Button
              variant={isCheckedIn && !isCheckedOut ? 'danger' : 'primary'}
              size="xs"
              className="mt-2.5 w-full text-xs"
              loading={punchLoading}
              icon={isCheckedIn && !isCheckedOut ? LogOut : LogIn}
              onClick={handleQuickPunch}
            >
              {isCheckedIn && !isCheckedOut ? 'Clock Out Shift' : 'Quick Clock In'}
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Main Operational Sections (2:1 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Team Operations & Schedule */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section A: Today's Team Roster Status */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Today's Team Attendance & Roster ({totalReports})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Live presence indicators and check-in timestamps for your direct reports.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter team member..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white w-44 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => navigate('/team')}
                >
                  Manage Team
                </Button>
              </div>
            </div>

            {filteredTeam.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {rosterSearch ? 'No team members match your search.' : 'No direct reports currently mapped.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {filteredTeam.map((member) => {
                  const name = member.fullName || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Team Member';
                  // Find attendance record for member
                  const att = teamAttendance.find((a) => a.employeeId === member.id || a.employee_id === member.id);
                  const isPresent = att?.status === 'PRESENT' || att?.status === 'HALF_DAY';
                  const isLate = att?.status === 'LATE';

                  return (
                    <div
                      key={member.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center text-sm shrink-0">
                          {name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {member.designation?.title || member.jobTitle || 'Team Staff'} • {member.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isLate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Late ({att.checkInTime || att.check_in_time || 'Check-in'})
                          </span>
                        ) : isPresent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present ({att?.checkInTime || att?.check_in_time || 'On Shift'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Not Checked In
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => navigate(`/team?member=${member.id}`)}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: Priority Pending Approvals Queue */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  Priority Supervisory Approvals ({pendingApprovals.leaves.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct report requests awaiting your supervisory sign-off.
                </p>
              </div>

              <Button
                variant="outline"
                size="xs"
                icon={ArrowRight}
                onClick={() => navigate('/approvals')}
              >
                Approvals Center
              </Button>
            </div>

            {pendingApprovals.leaves.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  All Caught Up!
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  You have no pending leave applications or reviews requiring action.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingApprovals.leaves.slice(0, 4).map((req) => (
                  <div
                    key={req.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {req.employeeName || req.fullName || 'Team Member'}
                        </span>
                        <Badge variant="warning" size="sm">
                          {req.leaveType || req.leave_type || 'Leave Request'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Dates: {req.startDate || req.start_date} to {req.endDate || req.end_date} ({req.durationDays || req.duration_days || 1} day(s))
                      </p>
                      {req.reason && (
                        <p className="text-xs text-slate-400 italic mt-0.5">
                          "{req.reason}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="success"
                        size="xs"
                        icon={Check}
                        loading={actionLoadingId === req.id}
                        onClick={() => handleQuickApproveLeave(req.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => navigate('/approvals')}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Upcoming Team Time-Off (7-Day Forecast) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Upcoming Team Availability
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Plan your team capacity and coverage over the coming days.
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                icon={ArrowRight}
                onClick={() => navigate('/leaves')}
              >
                Leave Matrix
              </Button>
            </div>

            {upcomingLeaves.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No scheduled team leaves in the immediate horizon. Full team capacity expected.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingLeaves.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {l.employeeName || l.fullName || 'Team Member'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {l.startDate || l.start_date} to {l.endDate || l.end_date}
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {l.leaveType || 'Leave'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Manager Hub & Quick Navigations */}
        <div className="space-y-6">
          {/* Widget 1: Direct Management Shortcuts */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              Manager Quick Shortcuts
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              <div
                onClick={() => navigate('/manager')}
                className="p-3 rounded-xl border border-indigo-200/80 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-900/60 hover:border-indigo-400 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                      Manager Cockpit
                    </h4>
                    <p className="text-[11px] text-slate-500">Full operational supervisory command center</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>

              <div
                onClick={() => navigate('/team')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      Team Management
                    </h4>
                    <p className="text-[11px] text-slate-500">Manage direct reports, profiles & hierarchy</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div
                onClick={() => navigate('/performance')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                      Performance & Reviews
                    </h4>
                    <p className="text-[11px] text-slate-500">Conduct quarterly appraisals & ratings</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div
                onClick={() => navigate('/probation')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                      Probation Pipeline
                    </h4>
                    <p className="text-[11px] text-slate-500">Evaluate probation milestones & confirmations</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Widget 2: Manager's Personal Leave Balances */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Coffee className="w-4 h-4 text-emerald-600" />
                My Personal Leave Balances
              </h3>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate('/leaves')}
              >
                Apply
              </Button>
            </div>

            {myLeaveBalances.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Leave balances synchronized with policy.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {myLeaveBalances.slice(0, 4).map((b) => (
                  <div
                    key={b.id || b.leave_type_id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                  >
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate block">
                      {b.leaveTypeName || b.leave_type_name || 'Leave'}
                    </span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                      {b.balanceDays ?? b.balance_days ?? 0}
                      <span className="text-[11px] font-normal text-slate-400 ml-1">days left</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Widget 3: Organization Details Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm border border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-sm">
                <Building2 className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {user?.organization?.name || 'TaskNera Portal'}
                </h4>
                <p className="text-xs text-indigo-200">
                  {user?.department?.name || 'Management Operations'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-indigo-200">
              <span>Employee Code: {user?.employeeCode || 'MGR'}</span>
              <span className="text-emerald-300 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Active Manager
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboardView;
