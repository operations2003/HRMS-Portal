import React, { useState, useEffect } from 'react';
import { XCircle, AlertTriangle, User, Calendar } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { leaveService } from '../../services/leaveService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const RejectLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveRecord,
  currentUser,
}) => {
  const toast = useToast();
  const [rejectionReason, setRejectionReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRejectionReason('');
      setTouched(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!leaveRecord) return null;

  const isSelf =
    (currentUser?.email && leaveRecord.employee?.email === currentUser.email) ||
    (currentUser?.employeeId && leaveRecord.employeeId === currentUser.employeeId) ||
    (currentUser?.id && leaveRecord.employee?.userId === currentUser.id);

  const trimmedReason = rejectionReason.trim();
  const isValidLength = trimmedReason.length >= 3 && trimmedReason.length <= 500;
  const showValidationError = touched && trimmedReason.length < 3;

  const handleReject = async () => {
    setTouched(true);
    if (isSelf) {
      toast.error('Self-action violation: You cannot reject your own leave request.');
      return;
    }

    if (!isValidLength) {
      toast.error('Please enter a rejection reason (minimum 3 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await leaveService.rejectLeave(leaveRecord.id, {
        rejectionReason: trimmedReason,
      });
      toast.success(
        `Leave request for ${leaveRecord.employee?.firstName || 'employee'} has been rejected.`
      );
      onSuccess?.(res);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to reject leave request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startDateFormatted = leaveRecord.startDate
    ? new Date(leaveRecord.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const endDateFormatted = leaveRecord.endDate
    ? new Date(leaveRecord.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Leave Request"
      subtitle="Provide mandatory feedback explaining why this request is declined"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Self rejection warning */}
        {isSelf && (
          <Alert
            variant="warning"
            title="Self-Action Restriction"
            message="You cannot reject your own leave request. Use the Cancel action from your requests tab instead."
          />
        )}

        {/* Target Request Summary */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {leaveRecord.employee?.firstName} {leaveRecord.employee?.lastName}
                <span className="ml-1 text-slate-500 font-normal">
                  ({leaveRecord.employee?.employeeCode || 'Employee'}{leaveRecord.employee?.departmentName ? ` • ${leaveRecord.employee.departmentName}` : ''})
                </span>
              </span>
              <span className="text-[11px] text-slate-500">
                {leaveRecord.leaveType?.name} ({leaveRecord.leaveType?.code || 'LEAVE'})
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              {leaveRecord.status || 'PENDING'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/60">
            <div>
              <span className="text-slate-400 block">Schedule</span>
              <span className="font-semibold text-slate-800">
                {startDateFormatted} {startDateFormatted !== endDateFormatted ? `→ ${endDateFormatted}` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Duration</span>
              <span className="font-semibold text-slate-800">
                {leaveRecord.totalDays} {leaveRecord.totalDays === 1 ? 'day' : 'days'}
                {leaveRecord.isHalfDay && (
                  <span className="text-amber-600 font-normal ml-1">
                    ({leaveRecord.halfDayPeriod === 'FIRST_HALF' ? 'Morning' : 'Afternoon'})
                  </span>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Submitted On</span>
              <span className="font-semibold text-slate-700">
                {leaveRecord.appliedDate || leaveRecord.createdAt
                  ? new Date(leaveRecord.appliedDate || leaveRecord.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Recent'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Decision</span>
              <span className="font-bold text-rose-600">Rejection</span>
            </div>
          </div>

          {leaveRecord.reason && (
            <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
              <span className="text-slate-400 font-semibold block mb-0.5 text-[10px] uppercase tracking-wider">
                Employee Reason:
              </span>
              "{leaveRecord.reason}"
            </div>
          )}
        </div>

        {/* Mandatory Rejection Reason Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="rejection-reason"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <span>Rejection Reason</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <span
              className={`text-[11px] font-medium ${
                rejectionReason.length > 500
                  ? 'text-rose-600'
                  : rejectionReason.length >= 3
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              {rejectionReason.length}/500 chars (min 3)
            </span>
          </div>

          <textarea
            id="rejection-reason"
            rows={3}
            required
            value={rejectionReason}
            onChange={(e) => {
              setRejectionReason(e.target.value);
              if (!touched) setTouched(true);
            }}
            disabled={isSelf || isSubmitting}
            placeholder="e.g. Critical release sprint deadline during these dates; insufficient team coverage."
            className={`w-full text-xs rounded-xl border p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 transition-colors ${
              showValidationError
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20'
                : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
            } disabled:bg-slate-50 disabled:text-slate-400`}
          />

          {showValidationError && (
            <p className="mt-1 text-xs text-rose-600 font-medium">
              Please enter at least 3 characters explaining the rejection reason.
            </p>
          )}
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
            variant="danger"
            size="md"
            icon={XCircle}
            onClick={handleReject}
            isLoading={isSubmitting}
            disabled={isSelf || !isValidLength || isSubmitting}
          >
            Confirm Rejection
          </Button>
        </div>
      </div>
    </Modal>
  );
};
