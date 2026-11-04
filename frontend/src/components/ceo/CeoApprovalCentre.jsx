import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
  UserMinus,
  BookOpen,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';

export const CeoApprovalCentre = ({ approvals = [], onDecision }) => {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    item: null,
    action: 'APPROVE', // 'APPROVE' | 'REJECT'
    comment: '',
  });

  const categories = [
    { id: 'ALL', label: 'All Executive Approvals' },
    { id: 'SALARY_CHANGE', label: 'Salary & Compensation' },
    { id: 'DISCIPLINARY', label: 'Disciplinary Inquiries' },
    { id: 'TERMINATION', label: 'Terminations & Exits' },
    { id: 'POLICY_CHANGE', label: 'Company Policy Changes' },
  ];

  const filteredApprovals = approvals.filter((a) => {
    if (activeCategory === 'ALL') return true;
    return a.category === activeCategory;
  });

  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!decisionModal.item) return;
    await onDecision(decisionModal.item.id, decisionModal.action, decisionModal.comment);
    setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', comment: '' });
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'SALARY_CHANGE':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'DISCIPLINARY':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'TERMINATION':
        return <UserMinus className="w-4 h-4 text-amber-500" />;
      case 'POLICY_CHANGE':
        return <BookOpen className="w-4 h-4 text-brand-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-brand flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-brand-300">
            <ShieldAlert className="w-3.5 h-3.5 text-brand-400" />
            Executive Governance & Authority
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">CEO Approval Centre</h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
            Authorize or reject high-impact operational decisions: Disciplinary actions, compensation modifications, employee offboarding, and governance policy changes.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center shrink-0 w-36">
          <span className="block text-2xl font-black text-white">{approvals.length}</span>
          <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Awaiting Decision</span>
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-3 py-2 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
              activeCategory === c.id
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Approvals Cards List */}
      <div className="space-y-4">
        {filteredApprovals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">Executive Queue Clear</h4>
            <p className="text-xs text-slate-500 mt-1">
              There are no pending approvals requiring CEO intervention in this category.
            </p>
          </div>
        ) : (
          filteredApprovals.map((appr) => (
            <div
              key={appr.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-brand-300 dark:hover:border-brand-800 transition-all"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    {getCategoryIcon(appr.category)}
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {appr.category.replace(/_/g, ' ')}
                  </span>
                  <Badge variant={appr.priority === 'URGENT' ? 'danger' : 'warning'}>
                    {appr.priority || 'HIGH'}
                  </Badge>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Submitted: {appr.date}</span>
                </div>
              </div>

              {/* Title & Subject */}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{appr.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span>
                    Subject: <strong>{appr.subjectEmployee}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Dept: <strong>{appr.department}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Submitted By: <strong>{appr.submittedBy}</strong>
                  </span>
                </div>
              </div>

              {/* Justification Box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Formal Rationale & Findings:</span>
                <p className="leading-relaxed">{appr.reason}</p>
              </div>

              {/* Supporting Details & Metadata */}
              {appr.details && Object.keys(appr.details).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 text-xs">
                  {Object.entries(appr.details).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        {k.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Decision Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDecisionModal({
                      isOpen: true,
                      item: appr,
                      action: 'REJECT',
                      comment: '',
                    })
                  }
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1.5"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> Reject Request
                </Button>

                <Button
                  variant="primary"
                  onClick={() =>
                    setDecisionModal({
                      isOpen: true,
                      item: appr,
                      action: 'APPROVE',
                      comment: '',
                    })
                  }
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Authorize & Approve Decision
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Decision Comment Modal */}
      <Modal
        isOpen={decisionModal.isOpen}
        onClose={() => setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', comment: '' })}
        title={decisionModal.action === 'APPROVE' ? 'Executive Approval Confirmation' : 'Executive Rejection'}
        subtitle={`Action for: ${decisionModal.item?.title || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmDecision} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {decisionModal.action === 'APPROVE' ? 'Executive Approval Notes / Caveats' : 'Mandatory Rejection Feedback *'}
            </label>
            <textarea
              required={decisionModal.action === 'REJECT'}
              rows="3"
              value={decisionModal.comment}
              onChange={(e) => setDecisionModal({ ...decisionModal, comment: e.target.value })}
              placeholder={
                decisionModal.action === 'APPROVE'
                  ? 'Add executive notes or implementation instructions...'
                  : 'Specify why this sensitive decision is returned or denied...'
              }
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', comment: '' })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decisionModal.action === 'APPROVE' ? 'primary' : 'danger'}
              className={decisionModal.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {decisionModal.action === 'APPROVE' ? 'Confirm Authorization' : 'Confirm Rejection'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

