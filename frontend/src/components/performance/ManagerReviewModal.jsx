import React, { useState, useEffect } from 'react';
import { Star, Award, CheckCircle2, RotateCcw, XCircle, MessageSquare, AlertTriangle, User, Calendar } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { Badge } from '../common/Badge.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { performanceService } from '../../services/performanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ManagerReviewModal = ({
  isOpen,
  onClose,
  onSuccess,
  record,
  currentUser,
}) => {
  const toast = useToast();
  const [rating, setRating] = useState(4.0);
  const [score, setScore] = useState(80);
  const [reviewerComments, setReviewerComments] = useState('');
  const [feedback, setFeedback] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode] = useState('review'); // 'review' | 'return' | 'reject'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmEvaluate, setShowConfirmEvaluate] = useState(false);
  const [showConfirmReturn, setShowConfirmReturn] = useState(false);
  const [showConfirmReject, setShowConfirmReject] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && record) {
      setRating(record.rating ? parseFloat(record.rating) : 4.0);
      setScore(record.score ? parseFloat(record.score) : 80);
      setReviewerComments(record.reviewerComments || '');
      setFeedback(record.feedback || '');
      setReturnReason('');
      setRejectReason('');
      setMode('review');
      setShowConfirmEvaluate(false);
      setShowConfirmReturn(false);
      setShowConfirmReject(false);
      setError(null);
    }
  }, [isOpen, record]);

  if (!record) return null;

  const empName =
    record.employee?.fullName ||
    `${record.employee?.firstName || ''} ${record.employee?.lastName || ''}`.trim() ||
    'Employee';

  const isSelf =
    (currentUser?.employeeId && record.employeeId === currentUser.employeeId) ||
    (currentUser?.id && record.employee?.userId === currentUser.id);

  const validateReview = () => {
    if (isSelf) {
      setError('Self-review violation: You cannot review your own appraisal.');
      return false;
    }
    if (rating < 1.0 || rating > 5.0) {
      setError('Manager rating must be between 1.00 and 5.00.');
      return false;
    }
    if (!reviewerComments.trim()) {
      setError('Reviewer comments / evaluation notes are required.');
      return false;
    }
    return true;
  };

  const handleReviewSubmit = async () => {
    if (!validateReview()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await performanceService.managerReview(record.id, {
        rating: parseFloat(rating),
        score: parseFloat(score),
        reviewerComments: reviewerComments.trim(),
        feedback: feedback.trim(),
        comments: reviewerComments.trim() || 'Manager review completed.',
      });
      toast.success(`Evaluation for ${empName} submitted and forwarded to HR!`);
      setShowConfirmEvaluate(false);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit manager evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!returnReason.trim() || returnReason.trim().length < 5) {
      setError('A return reason of at least 5 characters is mandatory.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await performanceService.returnRecord(record.id, {
        reason: returnReason.trim(),
      });
      toast.success(`Appraisal returned to ${empName} for revision.`);
      setShowConfirmReturn(false);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to return appraisal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setError('A rejection reason of at least 5 characters is mandatory.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await performanceService.rejectRecord(record.id, {
        reason: rejectReason.trim(),
      });
      toast.success(`Appraisal for ${empName} rejected.`);
      setShowConfirmReject(false);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reject appraisal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manager Evaluation: ${empName}`}
      subtitle={`Review cycle: ${record.reviewPeriod || record.period?.name || 'Current'} &bull; Status: ${record.status}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-sm">
        {error && <Alert variant="error" message={error} />}

        {isSelf && (
          <Alert
            variant="warning"
            message="Self-evaluation restriction: You cannot approve or review your own performance record."
          />
        )}

        {/* Employee Summary Card */}
        <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <User className="w-4 h-4 text-slate-500" />
              <span>{empName}</span>
              <span className="text-xs text-slate-500 font-normal">
                ({record.employee?.designation?.name || record.employee?.department?.name || 'Direct Report'})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Employee Self-Rating:</span>
              <span className="text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {record.selfRating || record.self_rating ? `${Number(record.selfRating || record.self_rating).toFixed(1)} / 5.0` : 'Not rated'}
              </span>
            </div>
          </div>

          {(record.selfSummary || record.selfReview?.summary) && (
            <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800 block mb-1">Employee Self-Assessment:</span>
              <p className="whitespace-pre-line">{record.selfSummary || record.selfReview?.summary}</p>
            </div>
          )}
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('review')}
            className={`pb-2 transition-colors flex items-center gap-1.5 ${
              mode === 'review'
                ? 'text-brand-600 border-b-2 border-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Evaluate & Forward
          </button>
          <button
            type="button"
            onClick={() => setMode('return')}
            className={`pb-2 transition-colors flex items-center gap-1.5 ${
              mode === 'return'
                ? 'text-amber-600 border-b-2 border-amber-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Return for Revision
          </button>
          <button
            type="button"
            onClick={() => setMode('reject')}
            className={`pb-2 transition-colors flex items-center gap-1.5 ${
              mode === 'reject'
                ? 'text-rose-600 border-b-2 border-rose-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>

        {/* Mode 1: Evaluate & Forward */}
        {mode === 'review' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Manager Rating (1.00 - 5.00) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-24 px-3 py-1.5 font-bold text-center border border-slate-300 rounded-lg text-brand-600 bg-white"
                  />
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="flex-1 accent-brand-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Performance Score (0 - 100)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-24 px-3 py-1.5 font-bold text-center border border-slate-300 rounded-lg text-slate-800 bg-white"
                  />
                  <span className="text-xs text-slate-500">Points (%)</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reviewer Evaluation & Feedback
              </label>
              <textarea
                rows={3}
                value={reviewerComments}
                onChange={(e) => setReviewerComments(e.target.value)}
                placeholder="Detail the employee's quarterly achievements, target fulfillment, and quality of work..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Actionable Growth Goals & Recommendations
              </label>
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Recommended skills training, upcoming milestone expectations..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={CheckCircle2}
                isLoading={isSubmitting}
                disabled={isSelf}
                onClick={() => {
                  if (validateReview()) {
                    setShowConfirmEvaluate(true);
                  }
                }}
              >
                Forward to HR Sign-Off
              </Button>
            </div>
          </div>
        )}

        {/* Mode 2: Return for Revision */}
        {mode === 'return' && (
          <div className="space-y-4">
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Returning this appraisal changes status to <strong>RETURNED</strong> and sends it back to the employee's draft inbox so they can revise goals or self-ratings.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for Revision <span className="text-rose-500">* (min 5 chars)</span>
              </label>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Please explain what details the employee needs to clarify or update..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                icon={RotateCcw}
                isLoading={isSubmitting}
                disabled={isSelf || returnReason.trim().length < 5}
                onClick={() => {
                  if (returnReason.trim().length >= 5) {
                    setShowConfirmReturn(true);
                  } else {
                    setError('A return reason of at least 5 characters is mandatory.');
                  }
                }}
              >
                Return to Employee
              </Button>
            </div>
          </div>
        )}

        {/* Mode 3: Reject */}
        {mode === 'reject' && (
          <div className="space-y-4">
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p>
                Rejecting this appraisal terminates this review submission. A clear reason is required for compliance audit trails.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">* (min 5 chars)</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="State the formal reason for rejecting this appraisal..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={XCircle}
                isLoading={isSubmitting}
                disabled={isSelf || rejectReason.trim().length < 5}
                onClick={() => {
                  if (rejectReason.trim().length >= 5) {
                    setShowConfirmReject(true);
                  } else {
                    setError('A rejection reason of at least 5 characters is mandatory.');
                  }
                }}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showConfirmEvaluate}
        onClose={() => setShowConfirmEvaluate(false)}
        onConfirm={handleReviewSubmit}
        title="Forward Evaluation to HR"
        message={`Confirm submitting manager evaluation with rating ${parseFloat(rating).toFixed(1)}/5.0 for ${empName}? This will advance the record to the UNDER_REVIEW stage for HR approval.`}
        confirmText="Confirm & Forward"
        cancelText="Cancel"
        variant="primary"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={showConfirmReturn}
        onClose={() => setShowConfirmReturn(false)}
        onConfirm={handleReturnSubmit}
        title="Return Appraisal to Employee"
        message={`Are you sure you want to return ${empName}'s appraisal for revision? They will be notified to revise and resubmit.`}
        confirmText="Return for Revision"
        cancelText="Cancel"
        variant="warning"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={showConfirmReject}
        onClose={() => setShowConfirmReject(false)}
        onConfirm={handleRejectSubmit}
        title="Reject Performance Appraisal"
        message={`Are you sure you want to reject ${empName}'s performance appraisal? This will mark the appraisal as REJECTED and conclude the cycle.`}
        confirmText="Reject Appraisal"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSubmitting}
      />
    </Modal>
  );
};
