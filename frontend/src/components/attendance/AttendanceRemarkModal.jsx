import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Flame,
  Zap,
  Clock,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  ShieldCheck,
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
  const [remarkType, setRemarkType] = useState('EMERGENCY');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize or reset form state when modal opens or record changes
  useEffect(() => {
    if (record) {
      // Check if existing remark already exists in regularizationReason or notes
      const isEmergency =
        record.regularizationReason?.includes('[EMERGENCY]') ||
        record.notes?.includes('[POST_SHIFT_REMARK: EMERGENCY]');
      const isOT =
        record.regularizationReason?.includes('[OT]') ||
        record.notes?.includes('[POST_SHIFT_REMARK: OT]');

      if (isEmergency) {
        setRemarkType('EMERGENCY');
      } else if (isOT) {
        setRemarkType('OT');
      } else {
        setRemarkType('EMERGENCY');
      }

      // Extract previous comment if available
      if (record.regularizationReason) {
        const cleaned = record.regularizationReason
          .replace(/^\[(EMERGENCY|OT)\]\s*/i, '')
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
      setError('Please provide justification remarks or explanation for this work.');
      return;
    }
    if (comments.trim().length < 3) {
      setError('Remarks must be at least 3 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await attendanceService.addShiftRemark(record.id, {
        remarkType,
        comments: comments.trim(),
      });

      toast.success(
        `Recorded remark as ${remarkType === 'EMERGENCY' ? 'Emergency Work' : 'Approved OT'} successfully!`
      );
      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err) {
      const msg = err.message || 'Failed to submit remark. Please try again.';
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
      title="Post-Shift Review & Remark"
      subtitle="Admin, Manager & HR classification for sessions exceeding 10 hours post-shift"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950 block">
              10-Hour Post-Shift Policy Review Required
            </span>
            <p className="text-amber-800 leading-relaxed">
              This employee session extended 10 hours past scheduled shift completion. Authorized management must classify this duration as <strong>Emergency Work</strong> or <strong>Approved OT</strong>.
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
              <span className="text-slate-400 block text-[10px]">Total Hours</span>
              <span className="font-bold text-slate-800 font-mono">
                {record.totalHours !== undefined ? `${Number(record.totalHours).toFixed(2)} hrs` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Overtime Accrued</span>
              <span className="font-bold text-purple-700 font-mono">
                +{otHours.toFixed(2)} hrs
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
            Work Classification Remark <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Emergency Option */}
            <button
              type="button"
              onClick={() => setRemarkType('EMERGENCY')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                remarkType === 'EMERGENCY'
                  ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
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
                  <span className="text-sm font-bold text-slate-900">
                    Emergency Work
                  </span>
                </div>
                {remarkType === 'EMERGENCY' && (
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Critical production outage, server emergency, or urgent unscheduled incident response.
              </p>
            </button>

            {/* 2. Overtime (OT) Option */}
            <button
              type="button"
              onClick={() => setRemarkType('OT')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                remarkType === 'OT'
                  ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/20 shadow-xs'
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
                  <span className="text-sm font-bold text-slate-900">
                    Approved Overtime (OT)
                  </span>
                </div>
                {remarkType === 'OT' && (
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Authorized extra hours for project deadlines, deployments, or scheduled deliverables.
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
            Reviewer Remarks / Justification <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="remark-comments"
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={
              remarkType === 'EMERGENCY'
                ? 'e.g. Approved critical server migration and emergency incident triage...'
                : 'e.g. Authorized sprint release testing and overtime for client go-live...'
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
          >
            {isSubmitting ? 'Recording...' : 'Submit Remark'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
