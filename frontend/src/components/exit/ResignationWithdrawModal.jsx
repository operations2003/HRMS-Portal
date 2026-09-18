import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ResignationWithdrawModal = ({ isOpen, onClose, onSuccess, exitRequestId }) => {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide a withdrawal rationale of at least 5 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await exitService.withdrawResignation(exitRequestId, reason.trim());
      toast.success('Resignation successfully withdrawn. Your active employment is preserved.');
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to withdraw resignation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Withdraw Resignation Request"
      subtitle="Cancel your pending exit and maintain uninterrupted employment status"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleWithdraw} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <p className="text-xs text-slate-600 leading-relaxed">
          Withdrawing your resignation cancels the pending approval workflow and voids any notice period
          counter. Your manager and HR will be notified of your decision to remain with TaskNera.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Reason for Withdrawal <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows="3"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder="e.g., Situation resolved, internal role realignment accepted, reconsidered..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Keep Resignation
          </Button>
          <Button type="submit" variant="primary" icon={RotateCcw} isLoading={isSubmitting}>
            Confirm Withdrawal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
