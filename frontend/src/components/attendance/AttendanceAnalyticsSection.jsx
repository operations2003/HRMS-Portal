import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Timer,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService.js';

export const AttendanceAnalyticsSection = ({
  selectedDeptId = '',
  onDeptChange,
  availableDepartments = [],
}) => {
  const [view, setView] = useState('weekly'); // 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [shift, setShift] = useState('');
  const [deptId, setDeptId] = useState(selectedDeptId || '');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    if (selectedDeptId !== undefined) {
      setDeptId(selectedDeptId);
    }
  }, [selectedDeptId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getOrgAnalytics({
        view,
        shift,
        deptId,
      });
      setAnalytics(data);
    } catch (err) {
      console.warn('Failed to load attendance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [view, shift, deptId]);

  const shifts = analytics?.availableShifts || [];
  const departments = analytics?.availableDepartments || availableDepartments || [];

  // Trend Data calculations
  const trendData = analytics?.trend?.data || [];
  const maxTrendVal = useMemo(() => {
    if (!trendData || trendData.length === 0) return 16;
    const maxVal = Math.max(
      ...trendData.map((d) => Math.max(d.present || 0, d.late || 0, d.absent || 0, 0)),
      12
    );
    // Round up to multiple of 4
    return Math.ceil(maxVal / 4) * 4;
  }, [trendData]);

  // SVG Coordinates for Trend Graph
  const svgWidth = 640;
  const svgHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;
  const graphWidth = svgWidth - paddingLeft - paddingRight;
  const graphHeight = svgHeight - paddingTop - paddingBottom;

  const pointsPresent = useMemo(() => {
    if (!trendData.length) return [];
    return trendData.map((d, i) => {
      const x = paddingLeft + (i / Math.max(1, trendData.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - ((d.present || 0) / maxTrendVal) * graphHeight;
      return { x, y, ...d };
    });
  }, [trendData, maxTrendVal, graphWidth, graphHeight]);

  const pointsLate = useMemo(() => {
    if (!trendData.length) return [];
    return trendData.map((d, i) => {
      const x = paddingLeft + (i / Math.max(1, trendData.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - ((d.late || 0) / maxTrendVal) * graphHeight;
      return { x, y, ...d };
    });
  }, [trendData, maxTrendVal, graphWidth, graphHeight]);

  // Generate smooth cubic bezier curve
  const createCurvedPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePresentPath = useMemo(() => createCurvedPath(pointsPresent), [pointsPresent]);
  const areaPresentPath = useMemo(() => {
    if (!pointsPresent.length) return '';
    const bottomY = paddingTop + graphHeight;
    const firstX = pointsPresent[0].x;
    const lastX = pointsPresent[pointsPresent.length - 1].x;
    return `${linePresentPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [linePresentPath, pointsPresent, paddingTop, graphHeight]);

  const lineLatePath = useMemo(() => createCurvedPath(pointsLate), [pointsLate]);

  // Status Distribution Donut calculations
  const distribution = analytics?.distribution || {
    onTime: 15,
    late: 1,
    notAttended: 2,
    total: 18,
  };

  const distTotal = Math.max(1, (distribution.onTime || 0) + (distribution.late || 0) + (distribution.notAttended || 0));
  const r = 42;
  const c = 2 * Math.PI * r; // ~263.89

  const pctOnTime = (distribution.onTime || 0) / distTotal;
  const pctLate = (distribution.late || 0) / distTotal;
  const pctNotAttended = (distribution.notAttended || 0) / distTotal;

  const lenOnTime = pctOnTime * c;
  const lenLate = pctLate * c;
  const lenNotAttended = pctNotAttended * c;

  const offsetOnTime = 0;
  const offsetLate = -lenOnTime;
  const offsetNotAttended = -(lenOnTime + lenLate);

  // Key Metrics
  const metrics = analytics?.metrics || {
    attendanceRate: { value: 88.9, change: '+2.8%', isPositive: true },
    employeesPresent: { present: 16, total: 18 },
    totalHoursLogged: { value: '356:29:24', change: '-0.5%', isPositive: false },
    performance: { value: 49.5 },
  };

  return (
    <div className="space-y-6">
      {/* 1. Filter Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Left: View Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
            View:
          </span>
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {['daily', 'weekly', 'monthly', 'yearly'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all duration-200 ${
                  view === v
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Shift & Department Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Shift Filter Dropdown */}
          <div className="relative">
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl pl-3 pr-8 py-1.5 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="">All Shifts</option>
              {shifts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Department Filter Dropdown */}
          <div className="relative">
            <select
              value={deptId}
              onChange={(e) => {
                setDeptId(e.target.value);
                onDeptChange?.(e.target.value);
              }}
              className="appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl pl-3 pr-8 py-1.5 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 2. Visual Graphs Row: Attendance Trend + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Attendance Trend Area Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Attendance Trend
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {analytics?.trend?.subtitle || 'This week attendance overview'}
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" />
                Present
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs" />
                Late
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-xs" />
                Absent
              </span>
            </div>
          </div>

          {/* SVG Smooth Area Chart */}
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-56 select-none"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                  <stop offset="70%" stopColor="#10B981" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = paddingTop + graphHeight * (1 - ratio);
                const val = Math.round(maxTrendVal * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                      className="dark:stroke-slate-800"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono font-medium"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Smooth Area Fill */}
              {areaPresentPath && (
                <path d={areaPresentPath} fill="url(#trendGradient)" />
              )}

              {/* Smooth Trend Lines */}
              {linePresentPath && (
                <path
                  d={linePresentPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {lineLatePath && (
                <path
                  d={lineLatePath}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover Indicator Crosshair */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={hoveredPoint.x}
                    y1={paddingTop}
                    x2={hoveredPoint.x}
                    y2={paddingTop + graphHeight}
                    stroke="#94A3B8"
                    strokeDasharray="2 2"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="5"
                    fill="#10B981"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="shadow-md"
                  />
                </g>
              )}

              {/* Data points & Interactive Hover Targets */}
              {pointsPresent.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    className="fill-emerald-500 dark:fill-emerald-400 hover:r-5 transition-all"
                  />
                  {/* Invisible wide hover bar */}
                  <rect
                    x={p.x - 20}
                    y={paddingTop}
                    width={40}
                    height={graphHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* X-axis Day/Time Labels */}
                  <text
                    x={p.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="text-[11px] fill-slate-500 dark:fill-slate-400 font-semibold"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>

            {/* Floating Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute bg-slate-900/90 text-white text-[11px] py-1.5 px-3 rounded-xl shadow-xl pointer-events-none backdrop-blur-sm border border-slate-700/60 z-20 transition-all transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                  top: `${(hoveredPoint.y / svgHeight) * 100}%`,
                }}
              >
                <p className="font-bold text-slate-200">{hoveredPoint.label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-400 font-semibold">
                    Present: {hoveredPoint.present || 0}
                  </span>
                  <span className="text-amber-400 font-semibold">
                    Late: {hoveredPoint.late || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Status Distribution Donut Card */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Status Distribution
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {analytics?.distribution?.subtitle || "Today's breakdown"}
            </p>
          </div>

          {/* Donut Graphic */}
          <div className="relative flex items-center justify-center my-6">
            <svg viewBox="0 0 120 120" className="w-36 h-36 transform -rotate-90">
              {/* Background Ring */}
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth="14"
                className="dark:stroke-slate-800"
              />

              {/* On-Time Segment (Emerald) */}
              {lenOnTime > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="14"
                  strokeDasharray={`${lenOnTime} ${c}`}
                  strokeDashoffset={offsetOnTime}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Late Segment (Amber) */}
              {lenLate > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="14"
                  strokeDasharray={`${lenLate} ${c}`}
                  strokeDashoffset={offsetLate}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Not Attended Segment (Rose) */}
              {lenNotAttended > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="14"
                  strokeDasharray={`${lenNotAttended} ${c}`}
                  strokeDashoffset={offsetNotAttended}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              )}
            </svg>

            {/* Inner Ring Center Information */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                {distTotal}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                Staff
              </span>
            </div>
          </div>

          {/* Bottom Breakdown Counter Badges */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <div>
              <div className="text-xl font-bold text-emerald-600">
                {distribution.onTime ?? 15}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">On-Time</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-500">
                {distribution.late ?? 1}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Late</div>
            </div>
            <div>
              <div className="text-xl font-bold text-rose-500">
                {distribution.notAttended ?? 2}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Not Attended</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Four Key Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Attendance Rate */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {metrics.attendanceRate?.value ?? 88.9}%
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Attendance Rate
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full">
            <TrendingUp className="w-3 h-3" />
            {metrics.attendanceRate?.change || '+2.8%'}
          </span>
        </div>

        {/* Card 2: Employees Present */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                <span className="text-slate-900 dark:text-white">
                  {metrics.employeesPresent?.present ?? 16}
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  {' '}/ {metrics.employeesPresent?.total ?? 18}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Employees Present
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Hours Logged */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-tight font-mono">
                {metrics.totalHoursLogged?.value || '356:29:24'}
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Total Hours Logged
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-0.5 rounded-full">
            <TrendingDown className="w-3 h-3" />
            {metrics.totalHoursLogged?.change || '-0.5%'}
          </span>
        </div>

        {/* Card 4: Performance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {metrics.performance?.value ?? 49.5}%
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Performance
              </div>
            </div>
          </div>

          {/* Mini Circular Gauge */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-8 h-8 transform -rotate-90">
              <path
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray={`${metrics.performance?.value || 49.5}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
