import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Calendar, AlertTriangle, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const HRExitApprovalModal = ({ isOpen, onClose, onSuccess, record }) => {
  const toast = useToast();

  const [mode, setMode] = useState('APPROVE'); // 'APPROVE' | 'REJECT'
  const [approvedLwd, setApprovedLwd] = useState(
    record?.approvedLastWorkingDay || record?.requestedLastWorkingDay || new Date().toISOString().split('T')[0]
  );
  const [noticePeriodDays, setNoticePeriodDays] = useState(record?.noticePeriodDays || 30);
  const [hrComments, setHrComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!record) return null;

  const empName =
    record.employee?.fullName ||
    `${record.employee?.firstName || ''} ${record.employee?.lastName || ''}`.trim() ||
    record.employeeName ||
    'Employee';

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === 'APPROVE') {
        if (!approvedLwd) {
          setError('Approved last working day is required.');
          setIsSubmitting(false);
          return;
        }

        const res = await exitService.hrApprove(record.id, {
          approvedLastWorkingDay: approvedLwd,
          noticePeriodDays: parseInt(noticePeriodDays, 10) || 30,
          hrComments: hrComments.trim(),
        });
        toast.success(`Resignation for ${empName} approved. Departmental clearances initialized!`);
        onSuccess?.(res);
      } else {
        if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
          setError('Rejection reason must be at least 5 characters long.');
          setIsSubmitting(false);
          return;
        }

        const res = await exitService.hrReject(record.id, {
          rejectionReason: rejectionReason.trim(),
        });
        toast.success(`Resignation for ${empName} rejected.`);
        onSuccess?.(res);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete HR exit action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`HR Resignation Action — ${empName}`}
      subtitle="Formalize last working date and initiate departmental offboarding clearances"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Mode Selector */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('APPROVE')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'APPROVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Approve & Initiate Clearances
          </button>
          <button
            type="button"
            onClick={() => setMode('REJECT')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'REJECT' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            Decline / Reject Resignation
          </button>
        </div>

        {mode === 'APPROVE' ? (
          <>
            {!record.managerFeedback && (record.status === 'SUBMITTED' || record.currentStage === 'MANAGER_REVIEW') && (
              <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-3 text-xs text-sky-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold text-sky-900">Executive Fast-Track:</span> Direct HR/Admin approval will complete manager review routing and activate notice period clearances immediately.
                </p>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Employee Requested LWD:</span>
                <span className="font-semibold text-slate-800">{record.requestedLastWorkingDay || 'N/A'}</span>
              </div>
              {record.managerFeedback && (
                <div>
                  <span className="font-medium text-slate-700">Manager Recommendation:</span>
                  <p className="italic text-slate-700 mt-0.5">"{record.managerFeedback}"</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Approved Last Working Day"
                type="date"
                value={approvedLwd}
                onChange={(e) => setApprovedLwd(e.target.value)}
                required
              />

              <Input
                label="Effective Notice Period (Days)"
                type="number"
                min="0"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                HR Exit Remarks / Policy Directives (Optional)
              </label>
              <textarea
                rows="2"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                placeholder="Notice period buy-out arrangements, exit interview instructions..."
                value={hrComments}
                onChange={(e) => setHrComments(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3 flex gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Rejecting this resignation keeps the employee active. Clearances will not be initiated.
              </span>
            </div>

            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              placeholder="Provide reason for rejecting the resignation..."
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (error) setError(null);
              }}
              required
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === 'APPROVE' ? 'primary' : 'danger'}
            icon={mode === 'APPROVE' ? ShieldCheck : XCircle}
            isLoading={isSubmitting}
          >
            {mode === 'APPROVE' ? 'Approve & Start Clearances' : 'Reject Resignation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
