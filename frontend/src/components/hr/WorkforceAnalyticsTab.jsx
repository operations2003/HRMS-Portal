import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  TrendingUp,
  CalendarCheck,
  GraduationCap,
  LifeBuoy,
  Briefcase,
  AlertCircle,
  Building2,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export const WorkforceAnalyticsTab = () => {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await analyticsService.getWorkforceAnalytics();
      setData(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load workforce analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Aggregating workforce intelligence metrics..." />;
  }

  const wf = data?.workforce || {};
  const att = data?.attendance || {};
  const depts = data?.departments || [];
  const leaves = data?.leaveUtilization || [];
  const training = data?.trainingMetrics || {};
  const helpdesk = data?.helpdeskMetrics || {};

  return (
    <div className="space-y-6">
      {/* Tab Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Workforce Intelligence & Trend Analytics
          </h3>
          <p className="text-xs text-slate-500">
            Real-time metrics across organization headcount, daily attendance, leave consumption, and operational SLAs.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          loading={refreshing}
          onClick={() => fetchAnalytics(true)}
        >
          Refresh Analytics
        </Button>
      </div>

      {/* Top Level Workforce Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Total Headcount</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">{wf.totalHeadcount || 0}</h3>
          <span className="text-[10px] text-slate-400">All registered profiles</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-emerald-600">Active Staff</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">{wf.activeEmployees || 0}</h3>
          <span className="text-[10px] text-slate-400">Currently employed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-amber-600">In Probation</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">{wf.inProbation || 0}</h3>
          <span className="text-[10px] text-slate-400">Under evaluation</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-blue-600">Attendance Today</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">{att.attendanceRate || 0}%</h3>
          <span className="text-[10px] text-slate-400">{att.presentToday || 0} checked in</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-purple-600">Joined This Month</p>
          <h3 className="text-2xl font-bold text-purple-600 mt-1">{wf.joinedThisMonth || 0}</h3>
          <span className="text-[10px] text-slate-400">New hires onboarded</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-rose-600">Annual Attrition</p>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">{wf.attritionRatePercentage || 0}%</h3>
          <span className="text-[10px] text-slate-400">{wf.exitedEmployees || 0} total exits</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Department Headcount Distribution
            </h3>
            <span className="text-xs text-slate-400">{depts.length} departments</span>
          </div>

          <div className="space-y-3">
            {depts.map((d) => {
              const count = parseInt(d.employee_count || 0, 10);
              const maxCount = Math.max(...depts.map((item) => parseInt(item.employee_count || 1, 10)), 1);
              const pct = Math.round((count / maxCount) * 100);

              return (
                <div key={d.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{d.name}</span>
                    <span className="font-bold text-slate-800">{count} staff</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {depts.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No departmental records.</p>
            )}
          </div>
        </div>

        {/* Leave Utilization by Type */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              Leave Consumption & Utilization
            </h3>
            <span className="text-xs text-slate-400">Approved leaves</span>
          </div>

          <div className="space-y-3">
            {leaves.map((l, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <div>
                  <h4 className="font-bold text-slate-700">{l.leave_type}</h4>
                  <span className="text-[11px] text-slate-400">
                    {l.approved_requests_count} approved request(s)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-slate-800">
                    {parseFloat(l.total_days_taken || 0)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">days taken</span>
                </div>
              </div>
            ))}

            {leaves.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No leave consumption recorded.</p>
            )}
          </div>
        </div>

        {/* Learning & Skill Matrix KPIs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              Learning & Development Progress
            </h3>
            <span className="text-xs text-slate-400">Training Metrics</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl">
              <span className="text-[11px] font-semibold text-purple-700">Course Catalogue</span>
              <p className="text-xl font-bold text-purple-900 mt-1">{training.activeCourses || 0} active</p>
            </div>

            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <span className="text-[11px] font-semibold text-indigo-700">Enrollments</span>
              <p className="text-xl font-bold text-indigo-900 mt-1">{training.totalEnrollments || 0} total</p>
            </div>

            <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-700">Completed Trainings</span>
              <p className="text-xl font-bold text-emerald-900 mt-1">{training.completedEnrollments || 0}</p>
            </div>

            <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl">
              <span className="text-[11px] font-semibold text-amber-700">Average Completion</span>
              <p className="text-xl font-bold text-amber-900 mt-1">{training.averageProgress || 0}%</p>
            </div>
          </div>
        </div>

        {/* Support & Helpdesk SLA Adherence */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-cyan-600" />
              Helpdesk & Employee Services
            </h3>
            <span className="text-xs text-slate-400">Support Operations</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500">Total Tickets</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{helpdesk.totalTickets || 0}</p>
            </div>

            <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl">
              <span className="text-[11px] font-semibold text-amber-700">Open Tickets</span>
              <p className="text-xl font-bold text-amber-900 mt-1">{helpdesk.openTickets || 0}</p>
            </div>

            <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-700">Resolved Tickets</span>
              <p className="text-xl font-bold text-emerald-900 mt-1">{helpdesk.resolvedTickets || 0}</p>
            </div>

            <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl">
              <span className="text-[11px] font-semibold text-rose-700">Urgent Priority</span>
              <p className="text-xl font-bold text-rose-900 mt-1">{helpdesk.urgentTickets || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
