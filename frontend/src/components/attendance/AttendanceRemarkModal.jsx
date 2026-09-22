import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Flame,
  Zap,
  RotateCcw,
  Clock,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const AttendanceRemarkModal = ({
  isOpen,
  onClose,
  record = null,
  onSuccess,
}) => {
  const toast = useToast();
  const [remarkType, setRemarkType] = useState('OT');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize or reset form state when modal opens or record changes
  useEffect(() => {
    if (record) {
      // Check if existing remark already exists in regularizationReason or notes
      const isMistake =
        record.regularizationReason?.includes('[MISTAKE]') ||
        record.notes?.includes('[POST_SHIFT_REMARK: MISTAKE]');
      const isOT =
        record.regularizationReason?.includes('[OT]') ||
        record.notes?.includes('[POST_SHIFT_REMARK: OT]');
      const isEmergency =
        record.regularizationReason?.includes('[EMERGENCY]') ||
        record.notes?.includes('[POST_SHIFT_REMARK: EMERGENCY]');

      if (isMistake) {
        setRemarkType('MISTAKE');
      } else if (isOT) {
        setRemarkType('OT');
      } else if (isEmergency) {
        setRemarkType('EMERGENCY');
      } else {
        // Default to OT (or Mistake if large duration)
        setRemarkType('OT');
      }

      // Extract previous comment if available
      if (record.regularizationReason) {
        const cleaned = record.regularizationReason
          .replace(/^\[(EMERGENCY|OT|MISTAKE)\]\s*/i, '')
          .trim();
        setComments(cleaned);
      } else {
        setComments('');
      }

      setError(null);
    }
  }, [record, isOpen]);

  if (!record) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!comments.trim()) {
      setError('Please provide a brief reason or explanation for this classification.');
      return;
    }
    if (comments.trim().length < 3) {
      setError('Comments must be at least 3 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await attendanceService.addShiftRemark(record.id, {
        remarkType,
        comments: comments.trim(),
      });

      if (remarkType === 'MISTAKE') {
        toast.success('Tagged as Mistake: Overtime has been reset to 0 and shift duration normalized.');
      } else if (remarkType === 'OT') {
        toast.success('Tagged as Approved Overtime (OT) successfully!');
      } else {
        toast.success('Tagged as Emergency Work successfully!');
      }

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err) {
      const msg = err.message || 'Failed to submit tag. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const d = record.attendanceDate ? new Date(record.attendanceDate) : null;
  const dateFormatted = d
    ? d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A';

  const employeeName = record.employee
    ? `${record.employee.firstName || ''} ${record.employee.lastName || ''}`.trim()
    : record.fullName || record.employeeName || 'Employee';

  const otHours = Number(record.overtimeHours || record.overtime_hours || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tag Attendance Record"
      subtitle="Classify this session as Approved Overtime (OT), Mistake (Forgot Logout), or Emergency"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950 block">
              Classification & Overtime Tagging
            </span>
            <p className="text-amber-800 leading-relaxed">
              Select <strong>OT</strong> if extra hours were genuine overtime, or <strong>Mistake</strong> if the employee forgot to log out (which automatically voids overtime and resets duration).
            </p>
          </div>
        </div>

        {/* Employee & Record Brief */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                {employeeName.charAt(0)}
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">
                  {employeeName}
                </span>
                <span className="text-slate-400">
                  {record.employee?.employeeCode || 'Emp'} • {record.employee?.departmentName || 'General'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="font-semibold text-slate-700 block">
                {dateFormatted}
              </span>
              <span className="text-[11px] text-slate-400">
                Shift: {record.employee?.shiftTiming || '11:00 AM - 07:00 PM'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Total Recorded Hours</span>
              <span className="font-bold text-slate-800 font-mono">
                {record.totalHours !== undefined ? `${Number(record.totalHours).toFixed(2)} hrs` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Overtime</span>
              <span className="font-bold text-amber-600 font-mono">
                {otHours > 0 ? `+${otHours.toFixed(2)} hrs` : '0.00 hrs'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Current Status</span>
              <span className="font-semibold text-slate-700">
                {record.status || 'PRESENT'}
              </span>
            </div>
          </div>
        </div>

        {/* Classification Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Select Classification Tag <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1. Overtime (OT) Option */}
            <button
              type="button"
              onClick={() => setRemarkType('OT')}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                remarkType === 'OT'
                  ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-400/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    remarkType === 'OT'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    OT (Overtime)
                  </span>
                </div>
                {remarkType === 'OT' && (
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Legitimate extra hours worked. Keeps overtime duration intact.
              </p>
            </button>

            {/* 2. Mistake Option */}
            <button
              type="button"
              onClick={() => setRemarkType('MISTAKE')}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                remarkType === 'MISTAKE'
                  ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    remarkType === 'MISTAKE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    Mistake
                  </span>
                </div>
                {remarkType === 'MISTAKE' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Forgot to log out. Resets overtime to 0 hrs and normalizes total duration.
              </p>
            </button>

            {/* 3. Emergency Option */}
            <button
              type="button"
              onClick={() => setRemarkType('EMERGENCY')}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                remarkType === 'EMERGENCY'
                  ? 'bg-rose-50/90 border-rose-500 ring-2 ring-rose-400/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    remarkType === 'EMERGENCY'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    Emergency
                  </span>
                </div>
                {remarkType === 'EMERGENCY' && (
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Critical production outage or urgent incident triage response.
              </p>
            </button>
          </div>
        </div>

        {/* Justification & Comments */}
        <div className="space-y-1.5">
          <label
            htmlFor="remark-comments"
            className="text-xs font-bold text-slate-700 uppercase tracking-wider block"
          >
            Remarks / Explanation <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="remark-comments"
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={
              remarkType === 'MISTAKE'
                ? 'e.g. Forgot to log out upon leaving the office at regular shift end...'
                : remarkType === 'OT'
                ? 'e.g. Authorized project overtime for release deployment and sprint deliverables...'
                : 'e.g. Approved critical server incident triage and emergency fix...'
            }
            className="w-full text-xs rounded-xl border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 p-3 outline-none transition-all placeholder:text-slate-400 resize-none"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Minimum 3 characters</span>
            <span>{comments.length} / 1000</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting || !comments.trim()}
            icon={ShieldCheck}
            className={
              remarkType === 'MISTAKE'
                ? '!bg-amber-600 hover:!bg-amber-700 text-white'
                : remarkType === 'OT'
                ? '!bg-purple-600 hover:!bg-purple-700 text-white'
                : '!bg-rose-600 hover:!bg-rose-700 text-white'
            }
          >
            {isSubmitting
              ? 'Saving...'
              : remarkType === 'MISTAKE'
              ? 'Tag as Mistake'
              : remarkType === 'OT'
              ? 'Tag as OT'
              : 'Tag as Emergency'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
