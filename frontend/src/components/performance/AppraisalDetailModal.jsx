import React, { useState, useEffect } from 'react';
import {
  Star,
  Award,
  CheckCircle2,
  Calendar,
  User,
  Target,
  FileText,
  Clock,
  Send,
  MessageSquare,
  ShieldCheck,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Alert } from '../common/Alert.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { WorkflowAuditTimeline } from './WorkflowAuditTimeline.jsx';
import { performanceService } from '../../services/performanceService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export const AppraisalDetailModal = ({
  isOpen,
  onClose,
  recordId,
  onUpdate,
  onOpenReviewModal,
}) => {
  const toast = useToast();
  const { user, hasRole } = useAuth();
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmHrApprove, setShowConfirmHrApprove] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'audit'
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && recordId) {
      loadDetails();
      setActiveTab('details');
      setError(null);
      setShowConfirmSubmit(false);
      setShowConfirmHrApprove(false);
    }
  }, [isOpen, recordId]);

  const loadDetails = async () => {
    try {
      setIsLoading(true);
      const data = await performanceService.getRecordById(recordId);
      const rec = data.data || data;
      setRecord(rec);

      try {
        const hist = await performanceService.getRecordHistory(recordId);
        setHistory(hist.items || hist.data || (Array.isArray(hist) ? hist : []));
      } catch (e) {
        // Fallback: use record.history if present
        setHistory(rec.history || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load appraisal details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHrApprove = async () => {
    try {
      setIsActing(true);
      await performanceService.hrApprove(recordId, {
        comments: 'HR sign-off completed and appraisal finalized.',
      });
      toast.success('Appraisal approved and completed successfully by HR!');
      setShowConfirmHrApprove(false);
      onUpdate?.();
      loadDetails();
    } catch (err) {
      toast.error(err.message || 'Failed to complete HR approval.');
    } finally {
      setIsActing(false);
    }
  };

  const handleSubmitSelfReview = async () => {
    try {
      setIsActing(true);
      await performanceService.submitRecord(recordId, {
        comments: 'Appraisal submitted for manager review.',
      });
      toast.success('Appraisal submitted for manager evaluation!');
      setShowConfirmSubmit(false);
      onUpdate?.();
      loadDetails();
    } catch (err) {
      toast.error(err.message || 'Failed to submit appraisal.');
    } finally {
      setIsActing(false);
    }
  };

  if (!isOpen) return null;

  const isHrOrAdmin = hasRole('HR') || hasRole('HRManager') || hasRole('Admin') || hasRole('SuperAdmin');
  const empName =
    record?.employee?.fullName ||
    `${record?.employee?.firstName || ''} ${record?.employee?.lastName || ''}`.trim() ||
    'Employee';

  const isEmployeeOwner =
    (user?.employeeId && record?.employeeId === user.employeeId) ||
    (user?.id && record?.employee?.userId === user.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Performance Review: ${record ? empName : 'Details'}`}
      subtitle={record ? `Cycle: ${record.reviewPeriod || record.period?.name || 'Cycle'} &bull; Status: ${record.status}` : ''}
      maxWidth="max-w-3xl"
    >
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Loading appraisal records and audit trail...
        </div>
      ) : error ? (
        <Alert variant="error" message={error} />
      ) : !record ? (
        <div className="py-8 text-center text-slate-500">Appraisal record not found.</div>
      ) : (
        <div className="space-y-5 text-sm">
          {/* Header Summary Card */}
          <div className="bg-gradient-to-r from-slate-50 to-brand-50/30 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={record.employee?.avatarUrl}
                name={empName}
                size="md"
                className="border border-brand-200"
              />
              <div>
                <h4 className="font-semibold text-slate-900">{empName}</h4>
                <p className="text-xs text-slate-500">
                  {record.employee?.designation?.name || 'Staff Member'} &bull; {record.employee?.department?.name || 'Department'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Final Rating</span>
                <span className="text-sm font-bold text-slate-800">
                  {record.rating ? `${Number(record.rating).toFixed(1)} / 5.0` : 'Pending Review'}
                </span>
              </div>
              <Badge variant={record.status === 'APPROVED' ? 'success' : record.status === 'REJECTED' ? 'danger' : 'warning'}>
                {record.status}
              </Badge>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Evaluation Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`pb-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              Audit Trail ({history.length})
            </button>
          </div>

          {/* Tab 1: Details */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Returned Alert Banner */}
              {record.status === 'RETURNED' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Appraisal Returned for Revision:</span>
                    <p className="mt-0.5">{record.rejectionReason || 'Please review your goals or self-ratings and resubmit for evaluation.'}</p>
                  </div>
                </div>
              )}

              {/* Rejected Alert Banner */}
              {record.status === 'REJECTED' && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Appraisal Rejected:</span>
                    <p className="mt-0.5">{record.rejectionReason || 'This performance appraisal submission was rejected.'}</p>
                  </div>
                </div>
              )}

              {/* Employee Self-Review */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-600" />
                    Self-Evaluation
                  </h5>
                  <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Self Rating: {record.selfRating || record.self_rating ? `${Number(record.selfRating || record.self_rating).toFixed(1)} / 5.0` : 'N/A'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line">
                  {record.selfComments || record.selfSummary || record.selfReview?.summary || 'No summary provided.'}
                </p>
                {(record.selfReview?.achievements || record.selfReview?.challenges) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                    {record.selfReview?.achievements && (
                      <div>
                        <span className="font-semibold text-slate-700 block">Accomplishments:</span>
                        <p className="text-slate-600">{record.selfReview.achievements}</p>
                      </div>
                    )}
                    {record.selfReview?.challenges && (
                      <div>
                        <span className="font-semibold text-slate-700 block">Challenges:</span>
                        <p className="text-slate-600">{record.selfReview.challenges}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Goals list */}
              {record.goals && record.goals.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-brand-600" />
                    Key Objectives & Goals ({record.goals.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-2">
                    {record.goals.map((g, idx) => (
                      <div key={g.id || idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-800">{g.title}</p>
                            {g.description && <p className="text-slate-500 mt-0.5">{g.description}</p>}
                          </div>
                          <Badge variant={g.status === 'COMPLETED' ? 'success' : 'neutral'} size="sm">
                            {g.status || 'IN_PROGRESS'}
                          </Badge>
                        </div>
                        {(g.metricTarget || g.weightage) && (
                          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">
                            {g.weightage > 0 && (
                              <span>Weightage: <strong>{g.weightage}%</strong></span>
                            )}
                            {g.metricTarget && (
                              <span>Target: <strong>{g.metricTarget}</strong></span>
                            )}
                            {g.metricAchieved && (
                              <span>Achieved: <strong>{g.metricAchieved}</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manager Review */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-brand-600" />
                    Manager Evaluation
                  </h5>
                  <div className="flex items-center gap-2">
                    {record.rating && (
                      <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        Rating: {Number(record.rating).toFixed(1)} / 5.0
                      </span>
                    )}
                    {record.score !== undefined && record.score !== null && (
                      <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Score: {record.score}%
                      </span>
                    )}
                  </div>
                </div>
                {record.reviewerComments ? (
                  <p className="text-xs text-slate-700 whitespace-pre-line">{record.reviewerComments}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Manager evaluation pending.</p>
                )}
                {record.feedback && (
                  <div className="pt-2 border-t border-slate-200/60 text-xs">
                    <span className="font-semibold text-slate-700 block">Growth Feedback:</span>
                    <p className="text-slate-600">{record.feedback}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Audit Trail */}
          {activeTab === 'audit' && (
            <div className="pt-2">
              <WorkflowAuditTimeline history={history} />
            </div>
          )}

          {/* Contextual Action Footers */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <div className="flex items-center gap-2">
              {/* If employee and in Draft or Returned state */}
              {isEmployeeOwner && ['DRAFT', 'RETURNED'].includes(record.status) && (
                <Button
                  variant="primary"
                  icon={Send}
                  isLoading={isActing}
                  onClick={() => setShowConfirmSubmit(true)}
                >
                  Submit for Manager Review
                </Button>
              )}

              {/* If manager/HR and record is awaiting evaluation */}
              {onOpenReviewModal && !isEmployeeOwner && ['SUBMITTED', 'PENDING'].includes(record.status) && (
                <Button
                  variant="primary"
                  icon={Award}
                  onClick={() => {
                    onClose();
                    onOpenReviewModal(record);
                  }}
                >
                  Evaluate Direct Report
                </Button>
              )}

              {/* If HR/Admin and in UNDER_REVIEW state */}
              {isHrOrAdmin && record.status === 'UNDER_REVIEW' && (
                <Button
                  variant="success"
                  icon={ShieldCheck}
                  isLoading={isActing}
                  onClick={() => setShowConfirmHrApprove(true)}
                >
                  Authorize & Finalize HR Approval
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
        onConfirm={handleSubmitSelfReview}
        title="Submit Appraisal for Review"
        message="Are you sure you want to submit your appraisal to your manager for evaluation? You will not be able to modify self-ratings or goals while under review."
        confirmText="Submit for Review"
        cancelText="Cancel"
        variant="primary"
        isLoading={isActing}
      />

      <ConfirmDialog
        isOpen={showConfirmHrApprove}
        onClose={() => setShowConfirmHrApprove(false)}
        onConfirm={handleHrApprove}
        title="Authorize HR Approval"
        message={`Confirm granting final HR sign-off for ${empName}'s performance review? This will mark the appraisal as APPROVED and complete the review cycle.`}
        confirmText="Authorize & Finalize"
        cancelText="Cancel"
        variant="primary"
        isLoading={isActing}
      />
    </Modal>
  );
};
