import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { workflowService } from '../../services/workflowService.js';
import { leaveService } from '../../services/leaveService.js';
import { performanceService } from '../../services/performanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ApprovalActionModal = ({
  isOpen,
  onClose,
  onSuccess,
  item,
  actionType = 'APPROVE', // 'APPROVE' | 'REJECT'
  currentUser,
}) => {
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!item) return null;

  const isSelf =
    (currentUser?.employeeId && (item.employeeId === currentUser.employeeId || item.employee_id === currentUser.employeeId)) ||
    (currentUser?.id && (item.requesterUserId === currentUser.id || item.employee?.userId === currentUser.id));

  const actionTitle = actionType === 'APPROVE' ? 'Approve Request' : 'Reject Request';

  const actionSubtitle = `Entity: ${item.entityType || item.module || 'Workflow item'} &bull; Submitted by: ${
    item.employeeName || item.employee?.fullName || item.employee?.firstName || 'Requester'
  }`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isSelf && actionType === 'APPROVE') {
      setError('Self-approval violation: You cannot approve your own submission.');
      return;
    }

    if (actionType === 'REJECT' && (!comment.trim() || comment.trim().length < 5)) {
      setError('A rejection reason of at least 5 characters is mandatory.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Check if item has a workflow instance ID
      if (item.workflowId || item.workflow_id || item.entityType === 'WORKFLOW') {
        const wfId = item.workflowId || item.workflow_id || item.id;
        await workflowService.executeAction(wfId, {
          action: actionType,
          comment: comment.trim() || undefined,
        });
      } else if (item.entityType === 'LEAVE' || item.leaveTypeId || item.startDate) {
        // Fallback direct leave service action
        if (actionType === 'APPROVE') {
          await leaveService.approveLeave(item.id, { comments: comment.trim() || undefined });
        } else {
          await leaveService.rejectLeave(item.id, { reason: comment.trim() });
        }
      } else if (item.entityType === 'PERFORMANCE' || item.periodId || item.selfRating) {
        // Performance action
        if (actionType === 'APPROVE') {
          await performanceService.hrApprove(item.id, { comments: comment.trim() });
        } else {
          await performanceService.rejectAppraisal(item.id, { reason: comment.trim() });
        }
      } else {
        // Default workflow action
        await workflowService.executeAction(item.id, {
          action: actionType,
          comment: comment.trim() || undefined,
        });
      }

      toast.success(`${actionTitle} processed successfully!`);
      setComment('');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || `Failed to ${actionType.toLowerCase()} request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={actionTitle}
      subtitle={actionSubtitle}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {error && <Alert variant="error" message={error} />}

        {isSelf && (
          <Alert
            variant="warning"
            message="Self-approval violation: Platform policy strictly prohibits authorizing your own request."
          />
        )}

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Requester:</span>
            <span className="font-semibold text-slate-800">
              {item.employeeName || item.employee?.fullName || 'Requester'}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Type:</span>
            <span className="font-semibold text-slate-800">{item.entityType || item.type || 'Request'}</span>
          </div>
          {item.reason && (
            <div className="text-slate-600 pt-1 border-t border-slate-200/60">
              <span className="font-medium text-slate-700">Request Reason:</span>
              <p className="italic text-slate-600">{item.reason}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>{actionType === 'APPROVE' ? 'Approval Comments (Optional)' : 'Rejection Reason'}</span>
            {actionType === 'REJECT' && (
              <span className="text-rose-500 font-normal normal-case">Required &bull; min 5 chars</span>
            )}
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              actionType === 'APPROVE'
                ? 'Add any comments for the requester...'
                : 'Explain why this request is being rejected...'
            }
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={actionType === 'APPROVE' ? 'success' : 'danger'}
            icon={actionType === 'APPROVE' ? CheckCircle2 : XCircle}
            isLoading={isSubmitting}
            disabled={isSelf && actionType === 'APPROVE'}
          >
            Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
