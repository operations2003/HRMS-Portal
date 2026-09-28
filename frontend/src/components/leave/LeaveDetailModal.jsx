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
  CalendarDays,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';

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

  const datesList = Array.isArray(leaveRecord.dateDecisions) && leaveRecord.dateDecisions.length > 0
    ? leaveRecord.dateDecisions
    : (() => {
        const list = [];
        if (leaveRecord.startDate && leaveRecord.endDate) {
          const s = new Date(leaveRecord.startDate + 'T00:00:00');
          const e = new Date(leaveRecord.endDate + 'T00:00:00');
          const cur = new Date(s);
          while (cur <= e) {
            if (cur.getDay() !== 0) {
              const y = cur.getFullYear();
              const m = String(cur.getMonth() + 1).padStart(2, '0');
              const d = String(cur.getDate()).padStart(2, '0');
              list.push({
                date: `${y}-${m}-${d}`,
                status: leaveRecord.status || 'PENDING',
                dayFraction: leaveRecord.isHalfDay ? 0.5 : 1.0,
                reason: '',
              });
            }
            cur.setDate(cur.getDate() + 1);
          }
        }
        return list.length > 0 ? list : [{
          date: leaveRecord.startDate,
          status: leaveRecord.status || 'PENDING',
          dayFraction: leaveRecord.isHalfDay ? 0.5 : (leaveRecord.totalDays || 1.0),
          reason: '',
        }];
      })();

  const approvedDays = datesList
    .filter((d) => d.status === 'APPROVED')
    .reduce((sum, d) => sum + (parseFloat(d.dayFraction) || 1.0), 0);
  const totalRequestedDays = datesList
    .reduce((sum, d) => sum + (parseFloat(d.dayFraction) || 1.0), 0);
  const hasMixedDecisions = datesList.some(d => d.status === 'APPROVED') && datesList.some(d => d.status === 'REJECTED');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave Request Details"
      subtitle={`Reference ID: ${leaveRecord.id?.slice(0, 8) || '—'}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Top Header Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              src={leaveRecord.employee?.avatarUrl}
              firstName={leaveRecord.employee?.firstName}
              lastName={leaveRecord.employee?.lastName}
              size="md"
              shape="rounded"
              className="shadow-sm ring-1 ring-brand-200 shrink-0"
            />
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
          {hasMixedDecisions ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              Partially Approved ({approvedDays}/{totalRequestedDays}d)
            </span>
          ) : isPending ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              PENDING
            </span>
          ) : isApproved ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              APPROVED
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              REJECTED
            </span>
          ) : isCancelled ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              <Ban className="w-3.5 h-3.5 text-slate-500" />
              CANCELLED
            </span>
          ) : null}
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Leave Type</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5 block">
              {leaveRecord.leaveType?.name || 'Leave'}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Code: {leaveRecord.leaveType?.code || '—'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">
              {isApproved || hasMixedDecisions ? 'Approved Days' : 'Total Days'}
            </span>
            <span className="text-xs font-bold text-brand-600 mt-0.5 block">
              {isApproved || hasMixedDecisions ? approvedDays : leaveRecord.totalDays}{' '}
              {(isApproved || hasMixedDecisions ? approvedDays : leaveRecord.totalDays) === 1 ? 'day' : 'days'}
            </span>
            {leaveRecord.isHalfDay && (
              <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">
                {leaveRecord.halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'}
              </span>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Start Date</span>
            <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
              {startDateStr}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">End Date</span>
            <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
              {endDateStr}
            </span>
          </div>
        </div>

        {/* Date-Wise Status Breakdown */}
        {datesList.length > 0 && (
          <div className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-brand-600" />
                <span>Date-Wise Decision Breakdown ({datesList.length})</span>
              </h5>
              <span className="text-[11px] font-semibold text-slate-500">
                Approved: <strong className="text-emerald-700">{approvedDays}d</strong> / {totalRequestedDays}d
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {datesList.map((item) => {
                const isItemApproved = item.status === 'APPROVED';
                const isItemRejected = item.status === 'REJECTED';
                const isItemPending = item.status === 'PENDING';
                const dateObj = new Date(item.date + 'T00:00:00');
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={item.date}
                    className={`p-2 rounded-lg text-xs border transition-colors ${
                      isItemApproved
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : isItemRejected
                        ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formattedDate}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          ({item.dayFraction === 0.5 ? '0.5 day' : '1.0 day'})
                        </span>
                      </div>

                      <div>
                        {isItemApproved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        )}
                        {isItemRejected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                        {isItemPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {item.reason && (
                      <div className="mt-1 text-[11px] text-rose-700 italic bg-white/70 px-2 py-0.5 rounded border border-rose-100">
                        Note: {item.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Balance deducted: <strong className="text-emerald-700 font-bold">{approvedDays} days</strong></span>
              {datesList.some(d => d.status === 'REJECTED') && (
                <span>Quota released: <strong className="text-rose-600 font-bold">{totalRequestedDays - approvedDays} days</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Reason Section */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Reason for Request
          </label>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-20 overflow-y-auto">
            {leaveRecord.reason || 'No reason provided.'}
          </div>
        </div>

        {/* Rejection / Cancellation / Approval Details */}
        {isRejected && leaveRecord.rejectionReason && (
          <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 mb-0.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Rejection Feedback</span>
            </div>
            <p className="text-rose-900 leading-relaxed">
              "{leaveRecord.rejectionReason}"
            </p>
          </div>
        )}

        {isCancelled && leaveRecord.cancellationReason && (
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-0.5">
              <Ban className="w-4 h-4 text-slate-500" />
              <span>Cancellation Reason</span>
            </div>
            <p className="text-slate-800 leading-relaxed">
              "{leaveRecord.cancellationReason}"
            </p>
          </div>
        )}

        {isApproved && (
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs flex items-center gap-2 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Authorized by management. {approvedDays} days deducted from leave balance.</span>
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
                  Review & Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
