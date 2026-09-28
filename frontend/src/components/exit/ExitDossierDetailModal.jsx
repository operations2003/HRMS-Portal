import React, { useState, useEffect } from 'react';
import {
  FileText,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wallet,
  Building2,
  Layers,
  Award,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { ExitStatusTimeline } from './ExitStatusTimeline.jsx';
import { ClearanceChecklistTable } from './ClearanceChecklistTable.jsx';
import { FnFStatementDocument } from './FnFStatementDocument.jsx';
import { ClearNoticePeriodModal } from './ClearNoticePeriodModal.jsx';
import { AccessDeprovisionModal } from './AccessDeprovisionModal.jsx';
import { exitService } from '../../services/exitService.js';

export const ExitDossierDetailModal = ({
  isOpen,
  onClose,
  exitId,
  canManage = false,
  onOpenFnF,
  onOpenDeprovision,
  onSuccess,
}) => {
  const [dossier, setDossier] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'clearances' | 'fnf' | 'audit'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showClearNoticeModal, setShowClearNoticeModal] = useState(false);
  const [showDeprovisionModal, setShowDeprovisionModal] = useState(false);

  const fetchDossier = async () => {
    if (!exitId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await exitService.getExitById(exitId);
      setDossier(data);
    } catch (err) {
      setError(err.message || 'Failed to load exit dossier details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && exitId) {
      fetchDossier();
      setActiveTab('overview');
    }
  }, [isOpen, exitId]);

  if (!isOpen) return null;

  const emp = dossier?.employee;
  const empName =
    emp?.fullName || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || dossier?.employeeName || 'Employee';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Exit Dossier — ${empName}`}
      subtitle={`Employee Code: ${emp?.empCode || 'N/A'} | Status: ${dossier?.status || 'Active'}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Dossier Tabs */}
        <div className="flex border-b border-slate-200">
          {[
            { id: 'overview', label: 'Overview & Lifecycle' },
            { id: 'clearances', label: `Clearances (${dossier?.clearances?.length || 0})` },
            { id: 'fnf', label: 'Full & Final (FnF)' },
            { id: 'audit', label: 'Audit Trail' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <ExitStatusTimeline
              status={dossier?.status}
              currentStage={dossier?.currentStage}
              offboarding={dossier?.offboarding}
              clearances={dossier?.clearances}
            />

            {/* Active Notice Period Banner & Action */}
            {canManage && ['APPROVED', 'NOTICE_PERIOD'].includes(dossier?.status) && (
              <div className="p-4 bg-gradient-to-r from-brand-50/90 via-indigo-50/80 to-purple-50/70 border border-brand-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-brand-600/30">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Phase 3: Active Notice Period
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                        {dossier?.noticePeriodDays ?? 30} Days
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      The employee is currently serving notice. Clear or waive the notice period to unlock and advance to the Checklist & Clearances phase.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle2}
                  className="shrink-0 font-semibold"
                  onClick={() => setShowClearNoticeModal(true)}
                >
                  Clear Notice Period
                </Button>
              </div>
            )}

            {/* Employee & Resignation Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2">
                <h5 className="font-bold text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <User className="w-3.5 h-3.5 text-brand-600" /> Employee Profile
                </h5>
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-semibold text-slate-900">{empName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-semibold text-slate-900">{emp?.department?.name || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Designation:</span>
                  <span className="font-semibold text-slate-900">{emp?.designation?.name || emp?.designation || 'Staff'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reporting Manager:</span>
                  <span className="font-semibold text-slate-900">
                    {dossier?.manager?.fullName || dossier?.managerName || 'Direct to Org'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2">
                <h5 className="font-bold text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" /> Dates & Policy Milestones
                </h5>
                <div className="flex justify-between">
                  <span className="text-slate-500">Resignation Submitted:</span>
                  <span className="font-semibold text-slate-900">{dossier?.resignationDate || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Last Working Day:</span>
                  <span className="font-semibold text-slate-900">{dossier?.requestedLastWorkingDay || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Approved Last Working Day:</span>
                  <span className="font-semibold text-emerald-700">{dossier?.approvedLastWorkingDay || 'Pending HR'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Notice Period Days:</span>
                  <span className="font-semibold text-slate-900">{dossier?.noticePeriodDays ?? 30} Days</span>
                </div>
              </div>
            </div>

            {/* Resignation Statement & Manager Evaluation */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 text-xs space-y-3">
              <div>
                <span className="font-semibold text-slate-700">Reason for Resignation:</span>
                <p className="mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-800 italic">
                  "{dossier?.reason || 'No statement submitted.'}"
                </p>
              </div>

              {dossier?.managerFeedback && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Manager Evaluation & Feedback:</span>
                    {dossier?.managerRating && (
                      <Badge variant="brand" size="sm">
                        Rating: {dossier.managerRating} / 5.0
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-800">
                    "{dossier.managerFeedback}"
                  </p>
                </div>
              )}

              {dossier?.hrComments && (
                <div>
                  <span className="font-semibold text-slate-700">HR Operational Directives:</span>
                  <p className="mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-800">
                    "{dossier.hrComments}"
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions for HR/Admin */}
            {canManage && (
              <div className="flex items-center justify-end gap-2 pt-2">
                {['APPROVED', 'NOTICE_PERIOD'].includes(dossier?.status) && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={CheckCircle2}
                    onClick={() => setShowClearNoticeModal(true)}
                  >
                    Clear Notice Period
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Wallet}
                  onClick={() => {
                    onClose();
                    onOpenFnF?.(dossier);
                  }}
                >
                  Manage FnF Settlement
                </Button>
                {dossier?.status !== 'COMPLETED' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeprovisionModal(true)}
                  >
                    Revoke Access & Deprovision
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Clearances */}
        {activeTab === 'clearances' && (
          <ClearanceChecklistTable
            clearances={dossier?.clearances || []}
            summary={{
              totalTasks: dossier?.clearances?.length || 0,
              clearedTasks: dossier?.clearances?.filter((c) =>
                ['CLEARED', 'COMPLETED', 'WAIVED'].includes((c.status || '').toUpperCase())
              ).length || 0,
              pendingTasks: dossier?.clearances?.filter((c) =>
                ['PENDING', 'IN_PROGRESS'].includes((c.status || '').toUpperCase())
              ).length || 0,
              totalRecoveryAmount: dossier?.clearances?.reduce(
                (sum, c) => sum + (parseFloat(c.recoveryAmount) || 0),
                0
              ) || 0,
            }}
            canManage={canManage}
            onTaskUpdated={fetchDossier}
          />
        )}

        {/* Tab 3: FnF Settlement Statement */}
        {activeTab === 'fnf' && (
          <div className="space-y-3">
            <FnFStatementDocument
              fnf={dossier?.fnf}
              exitRecord={dossier}
              canManage={canManage}
              onCalculate={() => {
                onClose();
                onOpenFnF?.(dossier);
              }}
              onApprove={() => {
                onClose();
                onOpenFnF?.(dossier);
              }}
              onDisburse={() => {
                onClose();
                onOpenFnF?.(dossier);
              }}
            />
          </div>
        )}

        {/* Tab 4: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="space-y-2">
            {(dossier?.workflowAudit || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No workflow actions logged yet.</p>
            ) : (
              (dossier.workflowAudit || []).map((log, index) => (
                <div key={index} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between">
                  <div>
                    <span className="font-semibold text-slate-900">{log.action || log.toStatus}</span>
                    <span className="text-slate-500 ml-2">by {log.actorRole || 'System'}</span>
                    {log.comments && <p className="text-slate-600 mt-1 italic">"{log.comments}"</p>}
                  </div>
                  <span className="text-slate-400 shrink-0">{log.createdAt?.split('T')[0] || 'Recently'}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Clear Notice Period Modal */}
      {showClearNoticeModal && (
        <ClearNoticePeriodModal
          isOpen={showClearNoticeModal}
          onClose={() => setShowClearNoticeModal(false)}
          onSuccess={() => {
            fetchDossier();
            onSuccess?.();
          }}
          record={dossier}
        />
      )}

      {/* Revoke Access & Delete Credentials Modal */}
      {showDeprovisionModal && (
        <AccessDeprovisionModal
          isOpen={showDeprovisionModal}
          onClose={() => setShowDeprovisionModal(false)}
          onSuccess={() => {
            fetchDossier();
            onSuccess?.();
          }}
          record={dossier}
        />
      )}
    </Modal>
  );
};
