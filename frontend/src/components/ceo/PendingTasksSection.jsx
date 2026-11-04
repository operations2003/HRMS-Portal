import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Calendar,
  Flame,
  ArrowRight,
  TrendingDown,
  UserX,
  CheckCircle2,
  Filter,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export const PendingTasksSection = ({ report = {} }) => {
  const [activeSubTab, setActiveSubTab] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'CARRIED' | 'NO_UPDATE'

  const metrics = report.metrics || {
    totalDelayed: 5,
    previousDayIncomplete: 3,
    carriedForward: 4,
    missingUpdatesCount: 2,
  };

  const records = report.records || [];

  const filteredRecords = records.filter((r) => {
    if (activeSubTab === 'ALL') return true;
    if (activeSubTab === 'OVERDUE') return r.delayDays > 0;
    if (activeSubTab === 'CARRIED') return r.delayDays >= 2;
    if (activeSubTab === 'NO_UPDATE') return !r.hasRecentUpdate;
    return true;
  });

  const handleExportCSV = () => {
    if (!records.length) return;
    const headers = [
      'Task Title',
      'Employee Name',
      'Department',
      'Original Deadline',
      'Current Deadline',
      'Delay Duration',
      'Progress %',
      'Reason For Delay',
      'Escalation Status',
    ];
    const rows = records.map((r) => [
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.employeeName}"`,
      `"${r.department}"`,
      r.originalDeadline,
      r.currentDeadline,
      `"${r.delayDuration}"`,
      `${r.progressPercentage}%`,
      `"${(r.reasonForDelay || '').replace(/"/g, '""')}"`,
      r.escalationStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TaskNera_CEO_Daily_Pending_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-rose-200 dark:border-rose-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Total Delayed
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{metrics.totalDelayed}</div>
          <p className="text-[11px] text-slate-400 mt-1">Past designated deadlines</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-amber-200 dark:border-amber-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Carried Forward
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.carriedForward}</div>
          <p className="text-[11px] text-slate-400 mt-1">From previous sprint cycles</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Prior-Day Incomplete</span>
            <TrendingDown className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{metrics.previousDayIncomplete}</div>
          <p className="text-[11px] text-slate-400 mt-1">Rolled over to today</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-purple-200 dark:border-purple-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Missing Updates
            </span>
            <UserX className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{metrics.missingUpdatesCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">No log for &gt; 24-48 hours</p>
        </div>
      </div>

      {/* CEO-Facing Daily Pending Task Report Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Report Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                CEO Daily Pending Task Report
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                Live Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive operational log of pending deliverables, root causes, and escalation statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="text-xs inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="text-xs inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Sub-Tabs Filter */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto text-xs">
          {[
            { id: 'ALL', label: 'All Pending & Delayed' },
            { id: 'OVERDUE', label: 'Overdue Only' },
            { id: 'CARRIED', label: 'Carried Forward (2+ days)' },
            { id: 'NO_UPDATE', label: 'Missing Progress Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                activeSubTab === tab.id
                  ? 'bg-brand-600 text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Task & Original Date</th>
                <th className="py-3 px-3">Employee & Dept</th>
                <th className="py-3 px-3">Deadlines (Orig vs Cur)</th>
                <th className="py-3 px-3">Delay Duration</th>
                <th className="py-3 px-3">Progress</th>
                <th className="py-3 px-4">Root Cause / Reason</th>
                <th className="py-3 px-3 text-right">Escalation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 italic">
                    No pending tasks recorded under this filter category.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    {/* Task Title */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={r.title}>
                        {r.title}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" /> Created: {r.createdAt}
                      </div>
                    </td>

                    {/* Employee & Dept */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{r.employeeName}</div>
                      <div className="text-[10px] text-slate-400">{r.department}</div>
                    </td>

                    {/* Deadlines */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <div>Orig: <span className="font-mono">{r.originalDeadline}</span></div>
                      <div className="font-bold text-brand-600 dark:text-brand-400">
                        Cur: <span className="font-mono">{r.currentDeadline}</span>
                      </div>
                    </td>

                    {/* Delay Duration */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {r.delayDuration}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="w-20 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>{r.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.progressPercentage >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${r.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-4 max-w-sm">
                      <div
                        className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2"
                        title={r.reasonForDelay}
                      >
                        {r.reasonForDelay || 'No explicit impediment note recorded.'}
                      </div>
                      {!r.hasRecentUpdate && (
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block mt-0.5">
                          ⚠️ No daily update submitted in 48h
                        </span>
                      )}
                    </td>

                    {/* Escalation Badge */}
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <Badge variant={r.escalationStatus === 'ESCALATED' ? 'danger' : 'warning'}>
                        {r.escalationStatus}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

