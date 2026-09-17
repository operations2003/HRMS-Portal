import React from 'react';
import {
  Calendar,
  Clock,
  Eye,
  Search,
  Filter,
  RotateCcw,
  Sparkles,
  Inbox,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Timer,
  Coffee,
  Laptop,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { EmptyState } from '../common/EmptyState.jsx';

export const AttendanceHistoryTable = ({
  records = [],
  pagination = null,
  isLoading = false,
  error = null,
  onPageChange,
  onViewDetails,
  onRegularize,
  canRegularize = false,
  showEmployeeCol = false,
  filters = {},
  onFilterChange,
  onResetFilters,
  showSearch = false,
  onRetry,
}) => {
  const getStatusBadge = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'PRESENT':
        return <Badge variant="success">Present</Badge>;
      case 'LATE':
        return <Badge variant="warning">Late Arrival</Badge>;
      case 'HALF_DAY':
        return <Badge variant="info">Half Day</Badge>;
      case 'ABSENT':
        return <Badge variant="danger">Absent</Badge>;
      case 'ON_LEAVE':
        return <Badge variant="warning">On Leave</Badge>;
      case 'HOLIDAY':
        return <Badge variant="brand">Holiday</Badge>;
      case 'WEEKEND':
        return <Badge variant="neutral">Weekend</Badge>;
      case 'REGULARIZED':
        return <Badge variant="brand">Regularized</Badge>;
      default:
        return <Badge variant="neutral">{status || '—'}</Badge>;
    }
  };

  const statusFilterOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'PRESENT', label: 'Present' },
    { value: 'LATE', label: 'Late Arrival' },
    { value: 'HALF_DAY', label: 'Half Day' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'REGULARIZED', label: 'Regularized' },
  ];

  // Quick Date Range Presets
  const applyPreset = (preset) => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const todayStr = toYMD(today);
      if (onFilterChange) {
        onFilterChange('startDate', todayStr);
        onFilterChange('endDate', todayStr);
      }
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      if (onFilterChange) {
        onFilterChange('startDate', toYMD(firstDay));
        onFilterChange('endDate', toYMD(today));
      }
    } else if (preset === 'week') {
      const last7 = new Date();
      last7.setDate(today.getDate() - 7);
      if (onFilterChange) {
        onFilterChange('startDate', toYMD(last7));
        onFilterChange('endDate', toYMD(today));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {showSearch && (
              <div className="w-full sm:w-60">
                <Input
                  type="text"
                  placeholder="Search employee..."
                  value={filters.search || ''}
                  onChange={(e) => onFilterChange && onFilterChange('search', e.target.value)}
                  icon={Search}
                />
              </div>
            )}

            <div className="w-full sm:w-40">
              <Input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => onFilterChange && onFilterChange('startDate', e.target.value)}
                placeholder="Start Date"
              />
            </div>

            <div className="w-full sm:w-40">
              <Input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => onFilterChange && onFilterChange('endDate', e.target.value)}
                placeholder="End Date"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select
                value={filters.status || ''}
                onChange={(e) => onFilterChange && onFilterChange('status', e.target.value)}
                options={statusFilterOptions}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={RotateCcw}
              onClick={onResetFilters}
              title="Reset Filters"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            Quick Ranges:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 font-medium transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset('week')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 font-medium transition-colors"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 font-medium transition-colors"
          >
            This Month
          </button>
        </div>
      </div>

      {/* 1. Loading State */}
      {isLoading && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center">
          <LoadingSpinner message="Loading attendance records from server..." />
        </div>
      )}

      {/* 2. Error State */}
      {!isLoading && error && (
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Failed to Load Attendance History</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {typeof error === 'string' ? error : error.message || 'An unexpected error occurred while fetching records.'}
            </p>
          </div>
          {onRetry && (
            <Button variant="primary" size="sm" onClick={onRetry}>
              Retry Query
            </Button>
          )}
        </div>
      )}

      {/* 3. Empty State */}
      {!isLoading && !error && (!records || records.length === 0) && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8">
          <EmptyState
            icon={Inbox}
            title="No Attendance Records Found"
            description="No attendance punches match your current filters or date range. Check your search criteria or reset filters."
            action={
              <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onResetFilters}>
                Reset Filter Parameters
              </Button>
            }
          />
        </div>
      )}

      {/* 4. Responsive Table / Card Layout */}
      {!isLoading && !error && records && records.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Mobile Card Layout (Visible on Small Screens) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {records.map((row, idx) => {
              const d = row.attendanceDate ? new Date(row.attendanceDate) : null;
              const ot = Number(row.overtimeHours || 0);

              return (
                <div key={row.id || idx} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-500" />
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {d
                            ? d.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(row.status)}
                      {row.isRegularized && (
                        <span
                          title="Record regularized"
                          className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold"
                        >
                          REG
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Employee Info for Team/Org Views */}
                  {showEmployeeCol && (row.employee || row.fullName || row.employeeName) && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-800">
                        {row.employee
                          ? `${row.employee.firstName || ''} ${row.employee.lastName || ''}`.trim()
                          : (row.fullName || row.employeeName)}
                      </span>{' '}
                      <span className="text-slate-400">({row.employee?.employeeCode || row.employeeCode || '—'})</span>
                      {(row.employee?.departmentName || row.employee?.department?.name || row.department) && (
                        <span className="text-slate-500 block text-[11px] mt-0.5">
                          {row.employee?.departmentName || row.employee?.department?.name || row.department}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Timestamps & Duration Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Login</span>
                      <span className="font-bold text-slate-800">
                        {row.checkIn
                          ? new Date(row.checkIn).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Logout</span>
                      <span className="font-bold text-slate-800">
                        {row.checkOut
                          ? new Date(row.checkOut).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Net Duration</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {row.totalHours !== undefined ? `${Number(row.totalHours).toFixed(2)} hrs` : '0.00 hrs'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Overtime</span>
                      <span className="font-bold text-amber-600 font-mono">
                        {ot > 0 ? `+${ot.toFixed(2)} hrs` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => onViewDetails && onViewDetails(row)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout (Visible on md and Larger Screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Date
                  </th>
                  {showEmployeeCol && (
                    <th scope="col" className="px-6 py-4 whitespace-nowrap">
                      Employee
                    </th>
                  )}
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Login Time
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Logout Time
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Working Duration
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Overtime
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {records.map((row, index) => {
                  const d = row.attendanceDate ? new Date(row.attendanceDate) : null;
                  const ot = Number(row.overtimeHours || 0);

                  return (
                    <tr
                      key={row.id || index}
                      className="hover:bg-slate-50/70 transition-colors duration-100"
                    >
                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800">
                              {d
                                ? d.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Employee (for Team/Org) */}
                      {showEmployeeCol && (
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          <div>
                            <div className="font-bold text-slate-900">
                              {row.employee
                                ? `${row.employee.firstName || ''} ${row.employee.lastName || ''}`.trim()
                                : (row.fullName || row.employeeName || '—')}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                              <span>{row.employee?.employeeCode || row.employeeCode || '—'}</span>
                              {(row.employee?.departmentName || row.employee?.department?.name || row.department) && (
                                <>
                                  <span>•</span>
                                  <span>{row.employee?.departmentName || row.employee?.department?.name || row.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(row.status)}
                          {row.isRegularized && (
                            <span
                              title="Record regularized"
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold"
                            >
                              R
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Check In */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {row.checkIn ? (
                          <span className="font-medium text-slate-800">
                            {new Date(row.checkIn).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Check Out */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {row.checkOut ? (
                          <span className="font-medium text-slate-800">
                            {new Date(row.checkOut).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Working Duration */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {row.totalHours !== undefined
                            ? `${Number(row.totalHours).toFixed(2)} hrs`
                            : '0.00 hrs'}
                        </span>
                        {row.breakDurationMinutes > 0 && (
                          <span className="text-[11px] text-slate-400 block">
                            Break: {row.breakDurationMinutes}m
                          </span>
                        )}
                      </td>

                      {/* Overtime */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {ot > 0 ? (
                          <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            +{ot.toFixed(2)} hrs
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => onViewDetails && onViewDetails(row)}
                            title="View Record Telemetry"
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. Pagination Bar (Supported by Backend API) */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Showing page <span className="font-semibold text-slate-700">{pagination.page}</span> of{' '}
                <span className="font-semibold text-slate-700">{pagination.totalPages}</span> (
                <span className="font-semibold text-slate-700">{pagination.total}</span> total records)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronLeft}
                  disabled={pagination.page <= 1}
                  onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                >
                  Previous
                </Button>
                <div className="text-xs font-bold text-slate-700 px-2">
                  {pagination.page} / {pagination.totalPages}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronRight}
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
