import React, { useState } from 'react';
import { CheckCircle2, User, Calendar, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!leaveRecord) return null;

  const isSelf =
    (currentUser?.email && leaveRecord.employee?.email === currentUser.email) ||
    (currentUser?.employeeId && leaveRecord.employeeId === currentUser.employeeId) ||
    (currentUser?.id && leaveRecord.employee?.userId === currentUser.id);

  const handleApprove = async () => {
    const userRole = (currentUser?.roleName || currentUser?.role || '').toLowerCase();
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
        comments: comments.trim() || undefined,
      });
      toast.success(
        `Leave request for ${leaveRecord.employee?.firstName || 'employee'} approved successfully!`
      );
      setComments('');
      onSuccess?.(res);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to approve leave request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startDateFormatted = leaveRecord.startDate
    ? new Date(leaveRecord.startDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const endDateFormatted = leaveRecord.endDate
    ? new Date(leaveRecord.endDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve Leave Request"
      subtitle="Review and authorize team member leave request"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        {/* Self approval violation warning */}
        {isSelf && (
          <Alert
            variant="warning"
            title="Self-Approval Restriction"
            message="Company policy prevents approving your own leave request. A higher-level manager or HR must approve this request."
          />
        )}

        {/* Employee Card */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
            {leaveRecord.employee?.firstName?.[0] || 'E'}
            {leaveRecord.employee?.lastName?.[0] || ''}
          </div>
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

        {/* Leave Request Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Duration</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">
              {leaveRecord.totalDays} {leaveRecord.totalDays === 1 ? 'day' : 'days'}
            </span>
            {leaveRecord.isHalfDay && (
              <span className="text-[11px] font-semibold text-amber-600">
                {leaveRecord.halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Dates</span>
            <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
              {startDateFormatted}
            </span>
            {!leaveRecord.isHalfDay && startDateFormatted !== endDateFormatted && (
              <span className="text-[11px] text-slate-500 block truncate">
                to {endDateFormatted}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Current Status</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3 h-3 text-amber-600" />
              {leaveRecord.status || 'PENDING'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 font-medium block">Submitted Date</span>
            <span className="text-xs font-semibold text-slate-700 mt-1 block">
              {leaveRecord.appliedDate || leaveRecord.createdAt
                ? new Date(leaveRecord.appliedDate || leaveRecord.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent'}
            </span>
          </div>
        </div>

        {/* Reason Box */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Reason for Leave
          </label>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-24 overflow-y-auto">
            {leaveRecord.reason || 'No reason provided.'}
          </div>
        </div>

        {/* Optional Comments / Notes */}
        <div>
          <label
            htmlFor="approval-comments"
            className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between"
          >
            <span>Approval Comments (Optional)</span>
            <span className="text-[11px] text-slate-400 font-normal">Visible in audit record</span>
          </label>
          <textarea
            id="approval-comments"
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={isSelf || isSubmitting}
            placeholder="e.g. Approved. Project deliverables handed over."
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
            variant="success"
            size="md"
            icon={CheckCircle2}
            onClick={handleApprove}
            isLoading={isSubmitting}
            disabled={isSelf || isSubmitting}
          >
            Approve Request
          </Button>
        </div>
      </div>
    </Modal>
  );
};
