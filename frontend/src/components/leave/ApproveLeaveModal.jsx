import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  CalendarDays,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { leaveService } from '../../services/leaveService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ApproveLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveRecord,
  currentUser,
}) => {
  const toast = useToast();
  const [comments, setComments] = useState('');
  const [dateDecisions, setDateDecisions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize date decisions whenever modal opens with leaveRecord
  useEffect(() => {
    if (isOpen && leaveRecord) {
      setComments('');
      setIsSubmitting(false);

      if (Array.isArray(leaveRecord.dateDecisions) && leaveRecord.dateDecisions.length > 0) {
        setDateDecisions(
          leaveRecord.dateDecisions.map((d) => ({
            date: d.date,
            status: d.status === 'REJECTED' ? 'REJECTED' : 'APPROVED', // Default to APPROVED for review
            dayFraction: parseFloat(d.dayFraction) || (leaveRecord.isHalfDay ? 0.5 : 1.0),
            reason: d.reason || '',
          }))
        );
      } else {
        // Fallback: build dates from startDate to endDate
        const dates = [];
        if (leaveRecord.startDate && leaveRecord.endDate) {
          const s = new Date(leaveRecord.startDate + 'T00:00:00');
          const e = new Date(leaveRecord.endDate + 'T00:00:00');
          const cur = new Date(s);
          while (cur <= e) {
            if (cur.getDay() !== 0) { // skip Sunday
              const y = cur.getFullYear();
              const m = String(cur.getMonth() + 1).padStart(2, '0');
              const d = String(cur.getDate()).padStart(2, '0');
              dates.push({
                date: `${y}-${m}-${d}`,
                status: 'APPROVED',
                dayFraction: leaveRecord.isHalfDay ? 0.5 : 1.0,
                reason: '',
              });
            }
            cur.setDate(cur.getDate() + 1);
          }
        }
        if (dates.length === 0 && leaveRecord.startDate) {
          dates.push({
            date: leaveRecord.startDate,
            status: 'APPROVED',
            dayFraction: leaveRecord.isHalfDay ? 0.5 : (parseFloat(leaveRecord.totalDays) || 1.0),
            reason: '',
          });
        }
        setDateDecisions(dates);
      }
    }
  }, [isOpen, leaveRecord]);

  if (!leaveRecord) return null;

  const isSelf =
    (currentUser?.email && leaveRecord.employee?.email === currentUser.email) ||
    (currentUser?.employeeId && leaveRecord.employeeId === currentUser.employeeId) ||
    (currentUser?.id && leaveRecord.employee?.userId === currentUser.id);

  const handleToggleDateStatus = (dateStr, nextStatus) => {
    setDateDecisions((prev) =>
      prev.map((d) => (d.date === dateStr ? { ...d, status: nextStatus } : d))
    );
  };

  const handleDateReasonChange = (dateStr, reason) => {
    setDateDecisions((prev) =>
      prev.map((d) => (d.date === dateStr ? { ...d, reason } : d))
    );
  };

  const handleApproveAll = () => {
    setDateDecisions((prev) => prev.map((d) => ({ ...d, status: 'APPROVED' })));
  };

  const handleRejectAll = () => {
    setDateDecisions((prev) => prev.map((d) => ({ ...d, status: 'REJECTED' })));
  };

  const approvedCount = dateDecisions.filter((d) => d.status === 'APPROVED').length;
  const rejectedCount = dateDecisions.filter((d) => d.status === 'REJECTED').length;
  const approvedDays = dateDecisions
    .filter((d) => d.status === 'APPROVED')
    .reduce((sum, d) => sum + (parseFloat(d.dayFraction) || 1.0), 0);
  const totalDays = dateDecisions
    .reduce((sum, d) => sum + (parseFloat(d.dayFraction) || 1.0), 0);

  const handleApprove = async () => {
    const userRole = (
      currentUser?.roleName ||
      currentUser?.role?.name ||
      (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
      ''
    ).toLowerCase();
    const rolesList = Array.isArray(currentUser?.roles)
      ? currentUser.roles.map((r) => (typeof r === 'string' ? r.toLowerCase() : ''))
      : [userRole];
    const isAuthorizedApprover =
      ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'manager', 'lead', 'teamlead', 'supervisor'].some(
        (role) => rolesList.some((r) => r.includes(role)) || userRole.includes(role)
      );

    if (!isAuthorizedApprover) {
      toast.error('Access denied: Only Admin, HR, and Manager roles have authority to approve leaves.');
      return;
    }

    if (isSelf) {
      toast.error('Self-approval violation: You cannot approve your own leave request.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await leaveService.approveLeave(leaveRecord.id, {
        dateDecisions,
        comments: comments.trim() || undefined,
      });

      const empName = leaveRecord.employee?.firstName || 'Employee';
      if (approvedCount === 0) {
        toast.success(`Leave request for ${empName} was rejected (all dates declined).`);
      } else if (rejectedCount > 0) {
        toast.success(`Leave request for ${empName} partially approved: ${approvedDays} of ${totalDays} days.`);
      } else {
        toast.success(`Leave request for ${empName} approved successfully (${approvedDays} days)!`);
      }

      setComments('');
      onSuccess?.(res);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to process leave decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review & Approve Leave Request"
      subtitle="Review individual dates to approve or reject date-wise"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Self approval violation warning */}
        {isSelf && (
          <Alert
            variant="warning"
            title="Self-Approval Restriction"
            message="Company policy prevents approving your own leave request. A higher-level manager or HR must approve this request."
          />
        )}

        {/* Employee Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <Avatar
            src={leaveRecord.employee?.avatarUrl}
            firstName={leaveRecord.employee?.firstName}
            lastName={leaveRecord.employee?.lastName}
            size="md"
            className="ring-1 ring-brand-200 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {leaveRecord.employee?.firstName} {leaveRecord.employee?.lastName}
            </h4>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="font-medium text-slate-600">{leaveRecord.employee?.employeeCode}</span>
              {leaveRecord.employee?.departmentName && (
                <>
                  <span>•</span>
                  <span>{leaveRecord.employee.departmentName}</span>
                </>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {leaveRecord.leaveType?.name || 'Leave'}
          </span>
        </div>

        {/* Date-wise Review Section */}
        <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
            <div>
              <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-brand-600" />
                <span>Date-Wise Review ({dateDecisions.length} {dateDecisions.length === 1 ? 'Date' : 'Dates'})</span>
              </h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Approve or reject each selected date separately.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={isSelf || isSubmitting}
                className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 transition-colors"
              >
                Approve All
              </button>
              <button
                type="button"
                onClick={handleRejectAll}
                disabled={isSelf || isSubmitting}
                className="text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md border border-rose-200 transition-colors"
              >
                Reject All
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {dateDecisions.map((item) => {
              const isApp = item.status === 'APPROVED';
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
                  className={`p-2.5 rounded-lg border transition-all ${
                    isApp
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isApp ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-800">
                        {formattedDate}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        ({item.dayFraction === 0.5 ? '0.5 day (Half)' : '1.0 day'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleToggleDateStatus(item.date, 'APPROVED')}
                        disabled={isSelf || isSubmitting}
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded flex items-center gap-1 transition-all ${
                          isApp
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleDateStatus(item.date, 'REJECTED')}
                        disabled={isSelf || isSubmitting}
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded flex items-center gap-1 transition-all ${
                          !isApp
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <X className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {!isApp && (
                    <div className="mt-2 pt-2 border-t border-rose-100">
                      <input
                        type="text"
                        placeholder="Reason for rejecting this date (optional)"
                        value={item.reason || ''}
                        onChange={(e) => handleDateReasonChange(item.date, e.target.value)}
                        disabled={isSelf || isSubmitting}
                        className="w-full text-xs rounded border border-rose-200 px-2 py-1 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Decision Summary Bar */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                Requested: <strong className="text-slate-800">{totalDays} days</strong>
              </span>
              <span className="text-emerald-700 font-semibold">
                Approved: <strong>{approvedDays} days</strong>
              </span>
              {rejectedCount > 0 && (
                <span className="text-rose-600 font-semibold">
                  Rejected: <strong>{totalDays - approvedDays} days</strong>
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Deducted from balance: <strong className="text-brand-700">{approvedDays} days</strong>
            </div>
          </div>
        </div>

        {/* Reason Box */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Reason for Leave
          </label>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-20 overflow-y-auto">
            {leaveRecord.reason || 'No reason provided.'}
          </div>
        </div>

        {/* Optional Comments / Notes */}
        <div>
          <label
            htmlFor="approval-comments"
            className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between"
          >
            <span>Overall Approver Notes (Optional)</span>
            <span className="text-[11px] text-slate-400 font-normal">Sent to employee with decision</span>
          </label>
          <textarea
            id="approval-comments"
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={isSelf || isSubmitting}
            placeholder="e.g. Approved 5th and 12th Oct. 8th Oct rejected due to client project demo."
            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant={approvedCount === 0 ? 'danger' : rejectedCount > 0 ? 'primary' : 'success'}
            size="md"
            icon={approvedCount === 0 ? XCircle : CheckCircle2}
            onClick={handleApprove}
            isLoading={isSubmitting}
            disabled={isSelf || isSubmitting}
          >
            {approvedCount === 0
              ? 'Confirm Rejection (All Rejected)'
              : rejectedCount > 0
              ? `Confirm Decision (Approve ${approvedDays} Days)`
              : `Approve All (${approvedDays} Days)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
