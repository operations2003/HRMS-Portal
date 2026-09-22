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
  CheckSquare,
  ShieldCheck,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { taskService } from '../../services/taskService.js';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
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
  const maxCompleted = Math.max(...trend.map((t) => t.completed || 0), 4);
  const totalTrendCompleted = trend.reduce((sum, item) => sum + (item.completed || 0), 0);

  // Determine performance badge variant
  const getStatusVariant = (score) => {
    if (score >= 90) return 'success';
    if (score >= 75) return 'info';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  const scoreVariant = getStatusVariant(m.performanceScore);

  // SVG Radial meter calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, m.performanceScore)) / 100) * circumference;

  const totalPriorityCount = (m.priority?.high || 0) + (m.priority?.medium || 0) + (m.priority?.low || 0);

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Timeframe Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              My Performance Analytics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Real-time individual task completion velocity, delivery reliability, and quality metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative inline-block text-left">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2 pr-8 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 cursor-pointer transition-all"
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            isLoading={loading}
            onClick={fetchPerformance}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Executive Performance Index Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 lg:p-7 shadow-xs transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Radial Score & Status */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-6 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 pb-6 lg:pb-0 lg:pr-6">
            {/* Radial Gauge */}
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className={`${
                    m.performanceScore >= 90
                      ? 'stroke-emerald-500'
                      : m.performanceScore >= 75
                      ? 'stroke-brand-500'
                      : m.performanceScore >= 60
                      ? 'stroke-amber-500'
                      : 'stroke-rose-500'
                  } transition-all duration-1000 ease-out`}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-display tracking-tight">
                  {m.performanceScore}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  out of 100
                </span>
              </div>
            </div>

            {/* Score Meta Details */}
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Overall Performance Index
              </span>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
                  {m.performanceStatus}
                </span>
                <Badge variant={scoreVariant} size="sm">
                  {m.performanceScore >= 90 ? 'Top Tier' : m.performanceScore >= 75 ? 'Target Met' : 'In Progress'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                Calculated from your on-time completion rate, quality review scores, and task turnaround velocity.
              </p>
            </div>
          </div>

          {/* Right Column: 3 Core Key Performance Indicators */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Pillar 1: On-Time Delivery */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">On-Time Rate</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-display">
                  {m.onTimeDelivery}%
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, m.onTimeDelivery)}%` }}
                  />
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                {m.completedTasks} of {m.totalTasks} completed
              </span>
            </div>

            {/* Pillar 2: Review & Quality Score */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Quality Rating</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Star className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-display">
                  {m.averageRating ? Number(m.averageRating).toFixed(1) : '5.0'}
                  <span className="text-sm text-slate-400 font-normal"> / 5.0</span>
                </div>
                {/* 5-star preview */}
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= Math.round(Number(m.averageRating) || 5)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                {m.ratingCount || 0} reviews received
              </span>
            </div>

            {/* Pillar 3: First-Time Pass Rate */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">First-Time Pass</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-display">
                  {m.firstTimeCompletion}%
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, m.firstTimeCompletion)}%` }}
                  />
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                {m.tasksReopened || 0} tasks reopened
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Standard Eight Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tasks */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
              Total Assigned Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.totalTasks}
          </div>
          <p className="text-xs text-slate-400 mt-1">{m.completedTasks} completed</p>
        </div>

        {/* Card 2: Created Tasks */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
              Self-Created Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.createdTasks}
          </div>
          <p className="text-xs text-slate-400 mt-1">Initiated by you</p>
        </div>

        {/* Card 3: Completion Rate */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.completionRate}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, m.completionRate)}%` }}
            />
          </div>
        </div>

        {/* Card 4: On-Time Delivery */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              On-Time Delivery
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.onTimeDelivery}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, m.onTimeDelivery)}%` }}
            />
          </div>
        </div>

        {/* Card 5: Average Rating */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Average Rating
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.averageRating ? `${m.averageRating}/5` : '5/5'}
          </div>
          <p className="text-xs text-slate-400 mt-1">{m.ratingCount} reviews recorded</p>
        </div>

        {/* Card 6: First-Time Completion */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
              First-Time Pass
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.firstTimeCompletion}%
          </div>
          <p className="text-xs text-slate-400 mt-1">Delivered without rework</p>
        </div>

        {/* Card 7: Tasks Reopened */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              Tasks Reopened
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.tasksReopened}
          </div>
          <p className="text-xs text-slate-400 mt-1">{m.reopenRate}% revision rate</p>
        </div>

        {/* Card 8: Overdue Tasks */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Overdue Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {m.overdueTasks}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {m.overdueTasks > 0 ? 'Urgent attention required' : 'All tasks on schedule'}
          </p>
        </div>
      </div>

      {/* 4. Dual Grid: Tasks by Priority Breakdown & 30-Day Completion Velocity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tasks by Priority Breakdown */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display uppercase tracking-wider">
                Tasks by Priority
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {totalPriorityCount} total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Urgency distribution of your active and delivered tasks.
            </p>
          </div>

          <div className="space-y-3 my-auto">
            {/* High / Urgent Priority */}
            <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-xs font-bold text-rose-900 dark:text-rose-300">
                  High Priority
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-rose-700 dark:text-rose-400 font-mono">
                  {m.priority?.high || 0}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({totalPriorityCount > 0 ? Math.round(((m.priority?.high || 0) / totalPriorityCount) * 100) : 0}%)
                </span>
              </div>
            </div>

            {/* Medium Priority */}
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  Medium Priority
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">
                  {m.priority?.medium || 0}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({totalPriorityCount > 0 ? Math.round(((m.priority?.medium || 0) / totalPriorityCount) * 100) : 0}%)
                </span>
              </div>
            </div>

            {/* Low Priority */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                  Low Priority
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-blue-700 dark:text-blue-400 font-mono">
                  {m.priority?.low || 0}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({totalPriorityCount > 0 ? Math.round(((m.priority?.low || 0) / totalPriorityCount) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Prioritized workload allocation</span>
            <span className="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-0.5">
              Live Sync <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Right Column: 30-Day Completion Velocity Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display uppercase tracking-wider">
                Completion Velocity (Last 30 Days)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily task completion throughput and cadence over the past month.
              </p>
            </div>
            <span className="text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200/60 dark:border-brand-800/60 px-3 py-1 rounded-xl">
              Total: {totalTrendCompleted} completed
            </span>
          </div>

          {/* Interactive Bar Chart Visualization */}
          <div className="relative pt-6 pb-2">
            <div className="flex items-end justify-between gap-1 sm:gap-2 h-40 px-1 border-b border-slate-100 dark:border-slate-800">
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
                      <div className="absolute -top-10 z-30 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in duration-200">
                        {item.label}: {item.completed} task{item.completed === 1 ? '' : 's'}
                      </div>
                    )}

                    {/* Bar element */}
                    <div
                      className={`w-full max-w-[16px] rounded-t-md transition-all duration-300 ${
                        item.completed > 0
                          ? isHovered
                            ? 'bg-brand-600 dark:bg-brand-500 shadow-md shadow-brand-500/30'
                            : 'bg-brand-500 dark:bg-brand-600 hover:bg-brand-600'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      style={{
                        height: `${Math.max(heightPercent, 8)}%`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 pt-3 px-1">
              <span>{trend[0]?.label || '30 days ago'}</span>
              <span>{trend[Math.floor(trend.length / 2)]?.label || '15 days ago'}</span>
              <span className="font-bold text-brand-600 dark:text-brand-400">{trend[trend.length - 1]?.label || 'Today'}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Steady workflow pacing</span>
            <span>Average: {trend.length > 0 ? (totalTrendCompleted / trend.length).toFixed(1) : '0.0'} tasks/day</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPerformanceSection;
