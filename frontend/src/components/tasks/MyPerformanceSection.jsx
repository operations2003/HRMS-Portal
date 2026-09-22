import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  Star,
  FileCheck,
  Calendar,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Award,
  Layers,
} from 'lucide-react';
import { taskService } from '../../services/taskService.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

const TIMEFRAME_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
];

export const MyPerformanceSection = ({ initialData = null }) => {
  const [timeframe, setTimeframe] = useState('this_month');
  const [metrics, setMetrics] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  const fetchPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await taskService.getMyPerformance({ timeframe });
      if (res?.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.warn('Failed to load personal task performance metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const m = metrics || {
    performanceScore: 0,
    performanceStatus: 'Needs Improvement',
    totalTasks: 0,
    completedTasks: 0,
    createdTasks: 0,
    completionRate: 0,
    onTimeDelivery: 0,
    averageRating: 0,
    ratingCount: 0,
    firstTimeCompletion: 0,
    tasksReopened: 0,
    reopenRate: 0,
    overdueTasks: 0,
    priority: { high: 0, medium: 0, low: 0 },
    last30DaysTrend: [],
  };

  const trend = m.last30DaysTrend || [];
  const maxCompleted = Math.max(...trend.map((t) => t.completed || 0), 5);

  return (
    <div className="space-y-6">
      {/* Top Header & Timeframe Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Performance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time individual task completion, velocity, and quality analytics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative inline-block text-left">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none text-xs font-semibold bg-white border border-slate-200/90 hover:border-slate-300 text-slate-800 rounded-xl px-3.5 py-2 pr-8 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all"
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={fetchPerformance}
            title="Refresh Metrics"
            className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. Large Hero Performance Score Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/15">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-6 flex-wrap">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-blue-100 tracking-wide uppercase">
              Performance Score
            </span>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
              {m.performanceScore}/100
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 text-white backdrop-blur-xs border border-white/20">
                <Sparkles className="w-3 h-3 text-amber-300" />
                {m.performanceStatus}
              </span>
              <span className="text-xs text-blue-100/80 hidden sm:inline">
                Based on delivery speed, on-time rate & task quality
              </span>
            </div>
          </div>

          {/* Glowing Graphic Illustration on Right */}
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center p-3 shadow-inner">
              <svg viewBox="0 0 100 60" className="w-full h-full stroke-white fill-none stroke-[4] drop-shadow-md">
                <path
                  d="M5,45 Q30,40 50,25 T95,10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="78,10 95,10 95,27"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Eight Stat Cards in 2 Rows of 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Tasks */}
        <div className="bg-blue-50/80 border border-blue-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-950">Total Tasks</span>
            <div className="w-6 h-6 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 font-mono">
              {m.totalTasks}
            </span>
          </div>
          <div className="text-[11px] font-medium text-blue-700/80">
            {m.completedTasks} completed
          </div>
        </div>

        {/* Card 2: Created Tasks */}
        <div className="bg-purple-50/80 border border-purple-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-950">Created Tasks</span>
            <div className="w-6 h-6 rounded-lg bg-purple-100/70 text-purple-600 flex items-center justify-center">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-600 font-mono">
              {m.createdTasks}
            </span>
          </div>
          <div className="text-[11px] font-medium text-purple-700/80">
            Tasks you created
          </div>
        </div>

        {/* Card 3: Completion Rate */}
        <div className="bg-emerald-50/80 border border-emerald-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950">Completion Rate</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
              {m.completionRate}%
            </span>
          </div>
          <div className="w-full bg-emerald-200/60 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, m.completionRate)}%` }}
            />
          </div>
        </div>

        {/* Card 4: On-Time Delivery */}
        <div className="bg-amber-50/80 border border-amber-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950">On-Time Delivery</span>
            <div className="w-6 h-6 rounded-lg bg-amber-100/70 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 font-mono">
              {m.onTimeDelivery}%
            </span>
          </div>
          <div className="w-full bg-amber-200/60 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, m.onTimeDelivery)}%` }}
            />
          </div>
        </div>

        {/* Card 5: Average Rating */}
        <div className="bg-fuchsia-50/80 border border-fuchsia-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fuchsia-950">Average Rating</span>
            <div className="w-6 h-6 rounded-lg bg-fuchsia-100/70 text-fuchsia-600 flex items-center justify-center">
              <Star className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-fuchsia-600 font-mono">
              {m.averageRating}/5
            </span>
          </div>
          <div className="text-[11px] font-medium text-fuchsia-700/80">
            {m.ratingCount} ratings
          </div>
        </div>

        {/* Card 6: First-Time Completion */}
        <div className="bg-emerald-50/80 border border-emerald-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950">First-Time Completion</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
              {m.firstTimeCompletion}%
            </span>
          </div>
          <div className="text-[11px] font-medium text-emerald-700/80">
            Completed without rework
          </div>
        </div>

        {/* Card 7: Tasks Reopened */}
        <div className="bg-orange-50/80 border border-orange-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-950">Tasks Reopened</span>
            <div className="w-6 h-6 rounded-lg bg-orange-100/70 text-orange-600 flex items-center justify-center">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-orange-600 font-mono">
              {m.tasksReopened}
            </span>
          </div>
          <div className="text-[11px] font-medium text-orange-700/80">
            {m.reopenRate}% reopen rate
          </div>
        </div>

        {/* Card 8: Overdue Tasks */}
        <div className="bg-rose-50/80 border border-rose-100/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-950">Overdue Tasks</span>
            <div className="w-6 h-6 rounded-lg bg-rose-100/70 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
              {m.overdueTasks}
            </span>
          </div>
          <div className="text-[11px] font-medium text-rose-700/80">
            {m.overdueTasks > 0 ? 'Urgent attention required' : 'All tasks on schedule'}
          </div>
        </div>
      </div>

      {/* 3. Tasks by Priority Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Tasks by Priority
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* High Priority */}
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 text-center transition hover:bg-rose-50">
            <div className="text-3xl font-black text-rose-600 font-mono">
              {m.priority?.high || 0}
            </div>
            <div className="text-xs font-semibold text-rose-700 mt-1">
              High Priority
            </div>
          </div>

          {/* Medium Priority */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 text-center transition hover:bg-amber-50">
            <div className="text-3xl font-black text-amber-600 font-mono">
              {m.priority?.medium || 0}
            </div>
            <div className="text-xs font-semibold text-amber-700 mt-1">
              Medium Priority
            </div>
          </div>

          {/* Low Priority */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-center transition hover:bg-blue-50">
            <div className="text-3xl font-black text-blue-600 font-mono">
              {m.priority?.low || 0}
            </div>
            <div className="text-xs font-semibold text-blue-700 mt-1">
              Low Priority
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tasks Completed (Last 30 Days) Chart Section */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Tasks Completed (Last 30 Days)
            </h3>
            <p className="text-[11px] text-slate-400">
              Daily task completion velocity over the last month
            </p>
          </div>
          <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
            Total: {trend.reduce((sum, item) => sum + (item.completed || 0), 0)} completed
          </div>
        </div>

        {/* Bar Distribution Chart */}
        <div className="relative pt-4 pb-2">
          <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-36 px-1 border-b border-slate-100">
            {trend.map((item, idx) => {
              const heightPercent = maxCompleted > 0 ? (item.completed / maxCompleted) * 100 : 0;
              const isHovered = hoveredBarIndex === idx;

              return (
                <div
                  key={item.date || idx}
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute -top-10 z-20 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md whitespace-nowrap pointer-events-none">
                      {item.label}: {item.completed} task{item.completed === 1 ? '' : 's'}
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full max-w-[14px] rounded-t-md transition-all duration-300 ${
                      item.completed > 0
                        ? isHovered
                          ? 'bg-indigo-600 shadow-sm'
                          : 'bg-indigo-500'
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                    style={{
                      height: `${Math.max(heightPercent, 6)}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis date labels */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 px-1">
            <span>{trend[0]?.label || '30 days ago'}</span>
            <span>{trend[14]?.label || '15 days ago'}</span>
            <span>{trend[trend.length - 1]?.label || 'Today'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
