import React from 'react';
import {
  Calendar,
  Clock,
  User,
  Building2,
  FileText,
  CheckCircle2,
  XCircle,
  Ban,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';

export const LeaveDetailModal = ({
  isOpen,
  onClose,
  leaveRecord,
  canApprove = false,
  onApproveClick,
  onRejectClick,
  onCancelClick,
  currentUser,
}) => {
  if (!leaveRecord) return null;

  const isPending = (leaveRecord.status || '').toUpperCase() === 'PENDING';
  const isApproved = (leaveRecord.status || '').toUpperCase() === 'APPROVED';
  const isRejected = (leaveRecord.status || '').toUpperCase() === 'REJECTED';
  const isCancelled = (leaveRecord.status || '').toUpperCase() === 'CANCELLED';

  const isOwn =
    (currentUser?.email && leaveRecord.employee?.email === currentUser.email) ||
    (currentUser?.employeeId && leaveRecord.employeeId === currentUser.employeeId) ||
    (currentUser?.id && leaveRecord.employee?.userId === currentUser.id);

  const startDateStr = leaveRecord.startDate
    ? new Date(leaveRecord.startDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const endDateStr = leaveRecord.endDate
    ? new Date(leaveRecord.endDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const appliedAtStr = leaveRecord.createdAt || leaveRecord.appliedAt
    ? new Date(leaveRecord.createdAt || leaveRecord.appliedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave Request Details"
      subtitle={`Reference ID: ${leaveRecord.id?.slice(0, 8) || '—'}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              {leaveRecord.employee?.firstName?.[0] || 'E'}
              {leaveRecord.employee?.lastName?.[0] || ''}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {leaveRecord.employee?.firstName} {leaveRecord.employee?.lastName}
              </h4>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-slate-700">{leaveRecord.employee?.employeeCode}</span>
                {leaveRecord.employee?.departmentName && (
                  <>
                    <span>•</span>
                    <span>{leaveRecord.employee.departmentName}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {isPending && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              PENDING
            </span>
          )}
          {isApproved && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              APPROVED
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              REJECTED
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              <Ban className="w-3.5 h-3.5 text-slate-500" />
              CANCELLED
            </span>
          )}
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Leave Type</span>
            <span className="text-xs font-bold text-slate-900 mt-1 block">
              {leaveRecord.leaveType?.name || 'Leave'}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Code: {leaveRecord.leaveType?.code || '—'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Duration</span>
            <span className="text-xs font-bold text-brand-600 mt-1 block">
              {leaveRecord.totalDays} {leaveRecord.totalDays === 1 ? 'day' : 'days'}
            </span>
            {leaveRecord.isHalfDay && (
              <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">
                {leaveRecord.halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Start Date</span>
            <span className="text-xs font-semibold text-slate-800 mt-1 block">
              {startDateStr}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">End Date</span>
            <span className="text-xs font-semibold text-slate-800 mt-1 block">
              {endDateStr}
            </span>
          </div>
        </div>

        {/* Reason Section */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Reason for Request
          </label>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            {leaveRecord.reason || 'No reason provided.'}
          </div>
        </div>

        {/* Rejection / Cancellation / Approval Details */}
        {isRejected && leaveRecord.rejectionReason && (
          <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 mb-1">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Rejection Feedback</span>
            </div>
            <p className="text-rose-900 leading-relaxed">
              "{leaveRecord.rejectionReason}"
            </p>
          </div>
        )}

        {isCancelled && leaveRecord.cancellationReason && (
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
              <Ban className="w-4 h-4 text-slate-500" />
              <span>Cancellation Reason</span>
            </div>
            <p className="text-slate-800 leading-relaxed">
              "{leaveRecord.cancellationReason}"
            </p>
          </div>
        )}

        {isApproved && (
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs flex items-center gap-2 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>This leave request was authorized by department management.</span>
          </div>
        )}

        {/* Meta Timestamps */}
        <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
          <span>Submitted: {appliedAtStr}</span>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {/* If pending and user is employee -> Cancel */}
            {isPending && isOwn && onCancelClick && (
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  onClose();
                  onCancelClick(leaveRecord);
                }}
              >
                Cancel Request
              </Button>
            )}

            {/* If pending and user has approve permission and not self -> Approve & Reject */}
            {isPending && canApprove && !isOwn && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  className="text-rose-600 hover:bg-rose-50"
                  icon={XCircle}
                  onClick={() => {
                    onClose();
                    onRejectClick?.(leaveRecord);
                  }}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  size="md"
                  icon={CheckCircle2}
                  onClick={() => {
                    onClose();
                    onApproveClick?.(leaveRecord);
                  }}
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
