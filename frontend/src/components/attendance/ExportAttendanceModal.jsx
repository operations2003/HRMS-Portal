import React, { useState } from 'react';
import {
  Download,
  Calendar,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Select } from '../common/Select.jsx';

/**
 * Generate month options for the selector
 * E.g. October 2026, September 2026, August 2026, etc.
 */
const getAvailableMonths = () => {
  const options = [
    { value: 'all', label: 'All Months' },
  ];
  // Center around September & October 2026
  const anchorDate = new Date(); // e.g. 2026-10-03
  const anchorYear = anchorDate.getFullYear();
  const anchorMonth = anchorDate.getMonth(); // 0-indexed, Oct is 9

  // Generate 6 recent months
  for (let i = 0; i < 6; i++) {
    const d = new Date(anchorYear, anchorMonth - i, 1);
    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${monthNum}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }

  // Ensure 2026-09 is present and prominent
  if (!options.some((o) => o.value === '2026-09')) {
    options.splice(2, 0, { value: '2026-09', label: 'September 2026' });
  }

  return options;
};

export const ExportAttendanceModal = ({
  isOpen,
  onClose,
  onExport,
  isExporting = false,
  departments = [],
  currentDeptId = '',
}) => {
  const monthOptions = getAvailableMonths();
  // Default to September 2026 as preferred by user
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [selectedDeptId, setSelectedDeptId] = useState(currentDeptId || '');

  const isAllMonths = selectedMonth === 'all';
  const selectedMonthObj = monthOptions.find((m) => m.value === selectedMonth) || monthOptions[0];
  let daysInMonth = 30;
  if (!isAllMonths && selectedMonth.includes('-')) {
    const [yearStr, monthStr] = selectedMonth.split('-');
    daysInMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
  }

  const handleConfirm = () => {
    if (onExport) {
      onExport({
        month: selectedMonth,
        monthLabel: selectedMonthObj.label,
        deptId: selectedDeptId,
      });
    }
  };

  const deptOptions = [
    { value: '', label: '🏢 All Departments (Entire Organization)' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.name || d.title,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Attendance Report"
      subtitle={
        isAllMonths
          ? "Generate comprehensive attendance report with individual timesheets and logs across all recorded months."
          : "Generate a strictly single-month attendance report with daily punches and total monthly hours."
      }
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        {/* Month Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Select Report Month</span>
          </label>
          <Select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={monthOptions}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            {isAllMonths
              ? 'Reports will include all recorded months with individual timesheet tabs per month.'
              : `Reports are generated strictly for this calendar month (Day 1 to Day ${daysInMonth}). No months will be merged.`}
          </p>
        </div>

        {/* Department Selector (for Admin & HR) */}
        {departments && departments.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span>Department Scope (Optional)</span>
            </label>
            <Select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              options={deptOptions}
            />
          </div>
        )}

        {/* Format Overview Card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Report Contents for {selectedMonthObj.label}</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {isAllMonths ? 'All Months Timesheets' : `${daysInMonth} Days Matrix`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-800 dark:text-slate-200 font-semibold">
                  Day & Date Columns
                </strong>
                <span className="text-[11px]">
                  {isAllMonths ? (
                    <>Dedicated timesheet sheets with calendar dates for each month.</>
                  ) : (
                    <>
                      Header Row: Date (`01 {selectedMonthObj.label.slice(0, 3)}` to `{daysInMonth} {selectedMonthObj.label.slice(0, 3)}`)
                      <br />
                      Subheader: Day (`Mon`, `Tue`...)
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <Clock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-800 dark:text-slate-200 font-semibold">
                  In/Out Punch Window
                </strong>
                <span className="text-[11px]">
                  Logged in to logged out times & daily working hours per employee.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 sm:col-span-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-800 dark:text-slate-200 font-semibold">
                  Total Monthly Working Hours
                </strong>
                <span className="text-[11px]">
                  {isAllMonths
                    ? 'Accurate working hours and overtime calculated across all recorded months.'
                    : `Accurate monthly total hours per employee strictly for ${selectedMonthObj.label}.`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" size="md" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Download}
            loading={isExporting}
            onClick={handleConfirm}
            className="!bg-brand-600 hover:!bg-brand-700 text-white font-bold shadow-sm"
          >
            {isExporting
              ? 'Generating Excel...'
              : isAllMonths
              ? 'Download All Months Report'
              : `Download ${selectedMonthObj.label} Report`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
