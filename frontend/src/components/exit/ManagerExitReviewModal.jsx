import React, { useState } from 'react';
import { UserCheck, CheckCircle2, XCircle, Star, Calendar } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ManagerExitReviewModal = ({ isOpen, onClose, onSuccess, record }) => {
  const toast = useToast();

  const [decision, setDecision] = useState('APPROVE');
  const [managerFeedback, setManagerFeedback] = useState('');
  const [managerRating, setManagerRating] = useState('4.0');
  const [recommendedLwd, setRecommendedLwd] = useState(
    record?.requestedLastWorkingDay || record?.approvedLastWorkingDay || ''
  );
  const [rehireEligible, setRehireEligible] = useState('YES');
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
    if (!managerFeedback.trim() || managerFeedback.trim().length < 5) {
      setError('Evaluation feedback of at least 5 characters is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await exitService.managerReview(record.id, {
        decision,
        managerFeedback: managerFeedback.trim(),
        reviewerComments: managerFeedback.trim(),
        comments: managerFeedback.trim(),
        managerRating: parseFloat(managerRating) || 4.0,
        recommendedLastWorkingDay: recommendedLwd || undefined,
        managerRehireEligible: rehireEligible === 'YES',
      });
      toast.success(
        decision === 'APPROVE'
          ? `Resignation review for ${empName} submitted and forwarded to HR.`
          : `Resignation for ${empName} rejected.`
      );
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit manager review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manager Exit Review — ${empName}`}
      subtitle={`Review resignation details submitted for ${record.requestedLastWorkingDay || 'N/A'}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Resignation Summary Card */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 space-y-1.5">
          <div className="flex justify-between">
            <span className="font-medium text-slate-500">Employee:</span>
            <span className="font-semibold text-slate-900">{empName} ({record.employee?.empCode || 'EMP'})</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-slate-500">Requested Last Day:</span>
            <span className="font-semibold text-slate-900">{record.requestedLastWorkingDay || 'Not specified'}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500">Employee's Stated Reason:</span>
            <p className="mt-0.5 text-slate-800 italic bg-white p-2 rounded-lg border border-slate-100">
              "{record.reason || 'No statement provided.'}"
            </p>
          </div>
        </div>

        {/* Action Decision */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Recommendation Decision</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDecision('APPROVE')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                decision === 'APPROVE'
                  ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <CheckCircle2 className={`w-5 h-5 ${decision === 'APPROVE' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div>
                <p className="text-xs font-semibold">Accept & Forward</p>
                <p className="text-[10px] text-slate-500">Recommend to HR for approval</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDecision('REJECT')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                decision === 'REJECT'
                  ? 'border-rose-500 bg-rose-50/70 text-rose-900 ring-2 ring-rose-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <XCircle className={`w-5 h-5 ${decision === 'REJECT' ? 'text-rose-600' : 'text-slate-400'}`} />
              <div>
                <p className="text-xs font-semibold">Decline / Reject</p>
                <p className="text-[10px] text-slate-500">Decline resignation request</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recommended LWD & Performance Score */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Recommended Last Working Day"
            type="date"
            value={recommendedLwd}
            onChange={(e) => setRecommendedLwd(e.target.value)}
          />

          <Select
            label="Manager Exit Performance Rating"
            value={managerRating}
            onChange={(e) => setManagerRating(e.target.value)}
            options={[
              { value: '5.0', label: '5.0 - Exceptional Contributor' },
              { value: '4.5', label: '4.5 - Exceeded Expectations' },
              { value: '4.0', label: '4.0 - Met Expectations' },
              { value: '3.0', label: '3.0 - Adequate / Needs Attention' },
              { value: '2.0', label: '2.0 - Below Expectations' },
              { value: '1.0', label: '1.0 - Unsatisfactory' },
            ]}
          />
        </div>

        <Select
          label="Eligible for Future Rehire?"
          value={rehireEligible}
          onChange={(e) => setRehireEligible(e.target.value)}
          options={[
            { value: 'YES', label: 'Yes - Eligible for Rehire' },
            { value: 'NO', label: 'No - Ineligible for Rehire' },
          ]}
        />

        {/* Manager Feedback */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Manager Evaluation & Handover Notes <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows="3"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder="Document handover status, project transition, knowledge transfer readiness, and reason for recommendation..."
            value={managerFeedback}
            onChange={(e) => {
              setManagerFeedback(e.target.value);
              if (error) setError(null);
            }}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={decision === 'APPROVE' ? 'primary' : 'danger'}
            icon={UserCheck}
            isLoading={isSubmitting}
          >
            Submit Manager Evaluation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
