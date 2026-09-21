import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  CalendarDays,
  Award,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bell,
  RefreshCw,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  UserCheck,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { managerService } from '../../services/managerService.js';
import { notificationService } from '../../services/notificationService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { TeamMemberDetailModal } from '../../components/team/TeamMemberDetailModal.jsx';
import { ApprovalActionModal } from '../../components/approvals/ApprovalActionModal.jsx';
import { ManagerReviewModal } from '../../components/performance/ManagerReviewModal.jsx';

export const ManagerDashboardPage = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const isAuthorized = hasRole(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const [dashboardData, setDashboardData] = useState(null);
  const [directReports, setDirectReports] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState({ leaves: [], appraisals: [] });
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [selectedMember, setSelectedMember] = useState(null);
  const [approvalAction, setApprovalAction] = useState({ isOpen: false, item: null, type: 'APPROVE' });
  const [reviewingRecord, setReviewingRecord] = useState(null);

  useEffect(() => {
    if (isAuthorized) {
      loadDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthorized]);

  const loadDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const [dashRes, teamRes, approvalsRes, notifRes] = await Promise.allSettled([
        managerService.getDashboard(),
        managerService.getTeam(),
        managerService.getPendingApprovals(),
        notificationService.getNotifications({ limit: 5 }),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value || {});
      }

      if (teamRes.status === 'fulfilled') {
        const t = teamRes.value;
        setDirectReports(t.items || t.data || (Array.isArray(t) ? t : []));
      }

      if (approvalsRes.status === 'fulfilled') {
        const a = approvalsRes.value || {};
        setPendingApprovals({
          leaves: a.leaves || [],
          appraisals: a.appraisals || [],
        });
      }

      if (notifRes.status === 'fulfilled') {
        const n = notifRes.value;
        setNotifications(n.items || n.notifications || (Array.isArray(n) ? n : []));
      }
    } catch (err) {
      toast.error('Failed to load manager dashboard data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification marked as read.');
    } catch {
      toast.error('Failed to update notification.');
    }
  };

  // Role Gate: Non-manager employees see an access restricted state
  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 ring-8 ring-amber-50/50">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Manager Access Required</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          The Manager Dashboard is restricted to team leads, supervisors, and administrative personnel. Please return to your employee portal.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Go to Main Dashboard
          </Button>
          <Button variant="primary" onClick={() => navigate('/leaves')}>
            View My Leaves
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner fullPage message="Loading manager dashboard..." />;
  }

  const teamSummary = dashboardData?.teamSummary || {};
  const pendingSummary = dashboardData?.pendingApprovals || {};
  const quickStats = dashboardData?.quickStats || {};

  const totalMembers = teamSummary.totalMembers || directReports.length;
  const presentToday = teamSummary.presentToday || 0;
  const lateToday = teamSummary.lateToday || 0;
  const onLeaveToday = teamSummary.onLeaveToday || 0;
  const absentToday = teamSummary.absentToday || 0;
  const attendanceRate = quickStats.attendanceRate ?? (totalMembers > 0 ? Math.round(((presentToday + lateToday) / totalMembers) * 100) : 100);

  const pendingLeavesCount = pendingSummary.pendingLeaves ?? pendingApprovals.leaves.length;
  const pendingAppraisalsCount = pendingSummary.pendingAppraisals ?? pendingApprovals.appraisals.length;

  const kpiCards = [
    {
      title: 'Assigned Team',
      value: totalMembers,
      subtext: `${teamSummary.activeMembers ?? totalMembers} active direct reports`,
      icon: Users,
      gradient: 'from-blue-600 to-indigo-600',
      action: () => navigate('/team'),
    },
    {
      title: 'Today Presence',
      value: `${attendanceRate}%`,
      subtext: `${presentToday} present &bull; ${lateToday} late check-in`,
      icon: Clock,
      gradient: 'from-emerald-500 to-teal-600',
      action: () => navigate('/team?tab=attendance'),
    },
    {
      title: 'Pending Leaves',
      value: pendingLeavesCount,
      subtext: pendingLeavesCount > 0 ? 'Action required immediately' : 'All leave requests processed',
      icon: CalendarDays,
      gradient: 'from-amber-500 to-orange-600',
      action: () => navigate('/approvals'),
    },
    {
      title: 'Pending Reviews',
      value: pendingAppraisalsCount,
      subtext: pendingAppraisalsCount > 0 ? 'Appraisals awaiting evaluation' : 'No pending reviews',
      icon: Award,
      gradient: 'from-purple-500 to-pink-600',
      action: () => navigate('/performance'),
    },
  ];

  const reportColumns = [
    {
      header: 'Direct Report',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
            {(row.fullName || row.firstName || 'E').charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-xs">
              {row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Team Member'}
            </p>
            <p className="text-[11px] text-slate-400">{row.email || 'No email'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Designation / Department',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-slate-800">{row.designation?.name || row.jobTitle || 'Staff'}</p>
          <p className="text-[11px] text-slate-400">{row.department?.name || 'Assigned Department'}</p>
        </div>
      ),
    },
    {
      header: 'Employment Status',
      render: (row) => (
        <Badge variant={row.status === 'Active' || row.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
          {row.status || 'Active'}
        </Badge>
      ),
    },
    {
      header: 'Assigned HR Partner',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{row.hr?.fullName || row.hrName || 'General HR Pool'}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={Eye}
          onClick={() => setSelectedMember(row)}
        >
          View Profile
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">
              {user?.roleName || 'Manager'} Workspace
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manager Cockpit & Team Operations
          </h1>
          <p className="text-sm text-slate-500">
            Supervise team presence, review direct report evaluations, and execute pending workflow actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={loadDashboardData}
          >
            Refresh
          </Button>
          <NavLink to="/approvals">
            <Button variant="primary" icon={CheckCircle2}>
              Approvals Queue ({pendingLeavesCount + pendingAppraisalsCount})
            </Button>
          </NavLink>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={card.action}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
                  {card.title}
                </span>
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-sm`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {card.value}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">{card.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2-Column: Team Attendance Summary & Important Manager Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Breakdown Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Today's Team Attendance Breakdown</h3>
                <p className="text-xs text-slate-500">Live attendance check-ins and absences across your team</p>
              </div>
              <NavLink to="/team" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Full logs <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>

            {/* Visual Attendance Progress Bar */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Check-in Completion: {attendanceRate}%</span>
                <span>{presentToday + lateToday} of {totalMembers} Staff Active</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  style={{ width: `${totalMembers > 0 ? (presentToday / totalMembers) * 100 : 0}%` }}
                  className="bg-emerald-500 h-full"
                  title={`Present: ${presentToday}`}
                />
                <div
                  style={{ width: `${totalMembers > 0 ? (lateToday / totalMembers) * 100 : 0}%` }}
                  className="bg-amber-400 h-full"
                  title={`Late: ${lateToday}`}
                />
                <div
                  style={{ width: `${totalMembers > 0 ? (onLeaveToday / totalMembers) * 100 : 0}%` }}
                  className="bg-sky-400 h-full"
                  title={`On Leave: ${onLeaveToday}`}
                />
                <div
                  style={{ width: `${totalMembers > 0 ? (absentToday / totalMembers) * 100 : 0}%` }}
                  className="bg-rose-400 h-full"
                  title={`Absent: ${absentToday}`}
                />
              </div>
            </div>

            {/* Attendance Mini Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">On Time</span>
                <span className="text-lg font-bold text-emerald-900">{presentToday}</span>
              </div>
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Late Check-in</span>
                <span className="text-lg font-bold text-amber-900">{lateToday}</span>
              </div>
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-sky-700 block">Approved Leave</span>
                <span className="text-lg font-bold text-sky-900">{onLeaveToday}</span>
              </div>
              <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">Not Checked-In</span>
                <span className="text-lg font-bold text-rose-900">{absentToday}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Shift window: {dashboardData?.manager?.shiftTiming || 'Standard Day Shift'}</span>
            <span className="font-mono text-[11px] text-slate-400">Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Manager Quick Actions Panel */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-5 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-base font-bold">Important Manager Actions</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Direct access to supervisor actions requiring your review and authorization.
            </p>

            <div className="space-y-2">
              <NavLink
                to="/leaves?tab=team"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-semibold group"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Review Pending Leaves</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {pendingLeavesCount > 0 && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[10px]">
                      {pendingLeavesCount} pending
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </NavLink>

              <NavLink
                to="/performance"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-semibold group"
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-purple-400" />
                  <span>Evaluate Team Appraisals</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {pendingAppraisalsCount > 0 && (
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded text-[10px]">
                      {pendingAppraisalsCount} review
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </NavLink>

              <NavLink
                to="/team"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-semibold group"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Manage Direct Reports</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </NavLink>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Enterprise HRMS</span>
            <span className="text-brand-400 font-medium">Phase 6 Verified</span>
          </div>
        </div>
      </div>

      {/* 2-Column: Actionable Pending Approvals & Relevant Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Leave Requests Feed */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">Pending Leave Approvals</h3>
              <Badge variant="warning" size="sm">
                {pendingApprovals.leaves.length}
              </Badge>
            </div>
            <NavLink to="/leaves?tab=team" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View queue &rarr;
            </NavLink>
          </div>

          <div className="space-y-3 flex-1">
            {pendingApprovals.leaves.length > 0 ? (
              pendingApprovals.leaves.slice(0, 4).map((l) => (
                <div
                  key={l.id}
                  className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl space-y-2 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-slate-900">
                        {l.firstName} {l.lastName}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        ({l.leaveTypeName || 'Leave'})
                      </span>
                    </div>
                    <Badge variant="warning" size="sm">
                      {l.daysCount || 1} day(s)
                    </Badge>
                  </div>

                  <div className="text-xs text-slate-600">
                    <span>{l.startDate} &rarr; {l.endDate}</span>
                    {l.reason && <p className="italic text-slate-500 text-[11px] mt-0.5">"{l.reason}"</p>}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50">
                    <Button
                      size="sm"
                      variant="success"
                      icon={CheckCircle2}
                      onClick={() => setApprovalAction({ isOpen: true, item: l, type: 'APPROVE' })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={XCircle}
                      onClick={() => setApprovalAction({ isOpen: true, item: l, type: 'REJECT' })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="No pending leaves"
                description="All leave requests from your team members have been approved or processed."
              />
            )}
          </div>
        </div>

        {/* Pending Performance Reviews & Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Pending Performance Evaluations</h3>
              <Badge variant="brand" size="sm">
                {pendingApprovals.appraisals.length}
              </Badge>
            </div>
            <NavLink to="/performance" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              All evaluations &rarr;
            </NavLink>
          </div>

          <div className="space-y-3 flex-1">
            {pendingApprovals.appraisals.length > 0 ? (
              pendingApprovals.appraisals.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Cycle: {p.reviewPeriod || 'Current'} &bull; {p.departmentName || 'Department'}
                    </span>
                    {p.selfComments && (
                      <p className="italic text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                        "{p.selfComments}"
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Award}
                    onClick={() => setReviewingRecord(p)}
                  >
                    Evaluate
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="Evaluations up to date"
                description="No employee appraisals are awaiting your review at this time."
              />
            )}
          </div>

          {/* Notifications Accordion / Sub-panel */}
          {notifications.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-brand-600" />
                  Recent Alerts ({notifications.length})
                </span>
                <NavLink to="/notifications" className="text-[11px] text-slate-500 hover:text-brand-600">
                  View all
                </NavLink>
              </div>

              <div className="space-y-1.5">
                {notifications.slice(0, 2).map((n) => (
                  <div
                    key={n.id}
                    className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <p className="font-medium text-slate-800 truncate">{n.title || n.message}</p>
                      <span className="text-[10px] text-slate-400">
                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMarkNotificationRead(n.id)}
                      className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Direct Reports Team Overview Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">Assigned Direct Reports Roster</h3>
            <span className="text-xs font-medium text-slate-500">
              ({directReports.length} team members)
            </span>
          </div>
          <NavLink to="/team" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            Open Team Console <ArrowRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <DataTable
          columns={reportColumns}
          data={directReports}
          isLoading={isLoading}
          emptyTitle="No direct reports assigned"
          emptyDescription="There are currently no staff members reporting to your manager account."
        />
      </div>

      {/* Modals */}
      <TeamMemberDetailModal
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
      />

      <ApprovalActionModal
        isOpen={approvalAction.isOpen}
        onClose={() => setApprovalAction({ isOpen: false, item: null, type: 'APPROVE' })}
        onSuccess={loadDashboardData}
        item={approvalAction.item}
        actionType={approvalAction.type}
        currentUser={user}
      />

      <ManagerReviewModal
        isOpen={Boolean(reviewingRecord)}
        onClose={() => setReviewingRecord(null)}
        onSuccess={loadDashboardData}
        record={reviewingRecord}
        currentUser={user}
      />
    </div>
  );
};
