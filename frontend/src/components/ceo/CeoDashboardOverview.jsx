import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Building2,
  Users,
  ArrowUpRight,
  ChevronRight,
  Flame,
  Activity,
  Layers,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';

export const CeoDashboardOverview = ({
  metrics = {},
  departmentPerformance = [],
  employeeProgress = [],
  aiSummary = {},
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Executive KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-card hover:shadow-brand transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tasks</span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.totalTasks ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span className="text-brand-600 dark:text-brand-400 font-semibold">100%</span> org footprint
          </p>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-card hover:shadow-brand transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.completedTasks ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span className="text-emerald-600 font-bold">{metrics.completionRate ?? 0}%</span> velocity rate
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-card hover:shadow-brand transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <PlayCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {metrics.inProgressTasks ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Actively executing</p>
        </div>

        {/* Pending / Blocked */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-card hover:shadow-brand transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.pendingTasks ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Awaiting action / inputs</p>
        </div>

        {/* Overdue (Critical) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 shadow-card hover:shadow-brand transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Overdue</span>
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {metrics.overdueTasks ?? 0}
          </div>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold flex items-center gap-1">
            <Flame className="w-3 h-3" /> Requires intervention
          </p>
        </div>

        {/* Awaiting CEO Approval */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('approvals')}
          className="bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-xl p-4 shadow-brand hover:shadow-brand-lg transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-brand-100 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">CEO Approval</span>
            <div className="p-1 rounded bg-white/20 text-white">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold flex items-center justify-between">
            <span>{metrics.awaitingCeoApprovalCount ?? 4}</span>
            <ArrowUpRight className="w-4 h-4 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <p className="text-[11px] text-brand-100 mt-1 font-medium">Pending decisions</p>
        </div>
      </div>

      {/* AI-Generated Pending Task Summary Card */}
      <div className="rounded-2xl p-5 border border-brand-200/80 dark:border-brand-900/50 bg-gradient-to-r from-brand-50/70 via-indigo-50/50 to-purple-50/40 dark:from-brand-950/40 dark:via-slate-900 dark:to-slate-900 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-5 items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-600 text-white shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                AI Executive Intelligence Briefing
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Generated {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {aiSummary.summaryText ||
                'Organisational velocity is stable at 78%. However, critical tasks in Technical Hiring and Infrastructure are encountering inter-departmental latency. Recommend approving 3 AI task allocations to balance sprint load.'}
            </p>

            {/* Key Risk Areas */}
            {aiSummary.keyRiskAreas && aiSummary.keyRiskAreas.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Critical Bottlenecks Detected:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {aiSummary.keyRiskAreas.map((risk, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200/60 dark:border-rose-900/40"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Decision Action Links */}
          <div className="w-full lg:w-72 bg-white/90 dark:bg-slate-800/90 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shrink-0 shadow-xs">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Recommended Actions</span>
              <Activity className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('ai-allocation')}
                className="w-full text-left px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-300 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>Review AI Task Allocations</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('pending')}
                className="w-full text-left px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 dark:hover:text-amber-300 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>Inspect Daily Pending Report</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('approvals')}
                className="w-full text-left px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>Clear Sensitive Executive Approvals</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Department Performance + Employee Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department-Wise Task Performance */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Department-Wise Performance
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Real-time completion index</span>
          </div>

          <div className="space-y-4">
            {departmentPerformance.map((dept) => {
              const rate = dept.completionRate || Math.round((dept.completed / (dept.totalTasks || 1)) * 100);
              return (
                <div key={dept.deptId || dept.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{dept.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">
                        {dept.completed}/{dept.totalTasks} Done
                      </span>
                      {dept.overdue > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded text-[10px]">
                          {dept.overdue} overdue
                        </span>
                      )}
                      <span className="font-bold text-slate-900 dark:text-white w-9 text-right">{rate}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rate >= 75
                          ? 'bg-emerald-500'
                          : rate >= 40
                          ? 'bg-brand-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employee-Wise Task Progress & Workload Capacity */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Employee Workload & Delivery
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Top active performers</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {employeeProgress.slice(0, 5).map((emp) => (
              <div key={emp.employeeId || emp.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={emp.name} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {emp.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {emp.designation || emp.department}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <div className="text-right">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {emp.activeTasks} Active
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {emp.onTimeRate}% on-time
                    </div>
                  </div>

                  <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        emp.workloadIndex > 85 ? 'bg-rose-500' : emp.workloadIndex > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${emp.workloadIndex}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

