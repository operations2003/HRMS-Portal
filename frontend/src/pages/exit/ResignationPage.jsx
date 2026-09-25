import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  ShieldAlert,
  Wallet,
  Calendar,
  Eye,
  UserCheck,
  ShieldCheck,
  HelpCircle,
  Briefcase,
  AlertCircle,
  Building2,
  ExternalLink,
  Laptop,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exitService } from '../../services/exitService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Avatar } from '../../components/common/Avatar.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { ExitStatusTimeline } from '../../components/exit/ExitStatusTimeline.jsx';
import { ResignationSubmitModal } from '../../components/exit/ResignationSubmitModal.jsx';
import { ResignationWithdrawModal } from '../../components/exit/ResignationWithdrawModal.jsx';
import { ManagerExitReviewModal } from '../../components/exit/ManagerExitReviewModal.jsx';
import { HRExitApprovalModal } from '../../components/exit/HRExitApprovalModal.jsx';
import { ClearanceChecklistTable } from '../../components/exit/ClearanceChecklistTable.jsx';
import { FnFSettlementModal } from '../../components/exit/FnFSettlementModal.jsx';
import { ExitDossierDetailModal } from '../../components/exit/ExitDossierDetailModal.jsx';

export const ResignationPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const isManager =
    hasRole('Manager') ||
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  // Active Tab: 'my' | 'team' | 'org'
  const [activeTab, setActiveTab] = useState('my');

  // 1. My Exit State
  const [myExit, setMyExit] = useState(null);
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [myError, setMyError] = useState(null);

  // 2. Team Exits State (For Managers)
  const [teamExits, setTeamExits] = useState([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState(null);

  // 3. Organization Exits State (For HR / Admin)
  const [orgExits, setOrgExits] = useState([]);
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
  const [orgError, setOrgError] = useState(null);

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState(null);
  const [hrActingRecord, setHrActingRecord] = useState(null);
  const [isFnfModalOpen, setIsFnfModalOpen] = useState(false);
  const [inspectingDossierId, setInspectingDossierId] = useState(null);

  const fetchMyExit = async () => {
    try {
      setIsLoadingMy(true);
      setMyError(null);
      const data = await exitService.getMyExit();
      setMyExit(data);
    } catch (err) {
      if (err.status !== 404) {
        setMyError(err.message || 'Failed to load resignation dossier.');
      } else {
        setMyExit(null);
      }
    } finally {
      setIsLoadingMy(false);
    }
  };

  const fetchTeamExits = async () => {
    if (!isManager) return;
    try {
      setIsLoadingTeam(true);
      setTeamError(null);
      const res = await exitService.getTeamExits();
      setTeamExits(Array.isArray(res) ? res : res.items || []);
    } catch (err) {
      setTeamError(err.message || 'Failed to load team exits.');
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const fetchOrgExits = async () => {
    if (!isHrOrAdmin) return;
    try {
      setIsLoadingOrg(true);
      setOrgError(null);
      const res = await exitService.getAllExits({ limit: 50 });
      const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setOrgExits(items);
    } catch (err) {
      setOrgError(err.message || 'Failed to load organization exit requests.');
    } finally {
      setIsLoadingOrg(false);
    }
  };

  useEffect(() => {
    fetchMyExit();
    if (isManager) fetchTeamExits();
    if (isHrOrAdmin) fetchOrgExits();
  }, [isManager, isHrOrAdmin]);

  const hasActiveExit =
    myExit &&
    ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS', 'EXIT_PROCESSING'].includes(
      myExit.status
    );

  const canWithdraw = myExit && ['SUBMITTED', 'UNDER_REVIEW'].includes(myExit.status);

  // Calculate remaining days
  const getRemainingDays = () => {
    const targetDate = myExit?.approvedLastWorkingDay || myExit?.requestedLastWorkingDay;
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const teamColumns = [
    {
      header: 'Team Member',
      render: (row) => {
        const emp = row.employee;
        const name =
          emp?.fullName || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || row.employeeName || 'Staff';
        const avatarUrl = emp?.avatarUrl || emp?.avatar_url || row.avatarUrl || row.employeeAvatar;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar
              src={avatarUrl}
              alt={name}
              name={name}
              size="sm"
            />
            <div>
              <p className="font-semibold text-xs text-slate-900">{name}</p>
              <p className="text-[10px] text-slate-400 font-mono">{emp?.empCode || 'EMP'}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Notice Dates',
      render: (row) => (
        <div className="text-xs">
          <p className="text-slate-700">
            <span className="text-slate-400">Resigned:</span> {row.resignationDate || '—'}
          </p>
          <p className="font-medium text-slate-900">
            <span className="text-slate-400">Proposed LWD:</span> {row.requestedLastWorkingDay || '—'}
          </p>
        </div>
      ),
    },
    {
      header: 'Notice Period',
      render: (row) => <span className="text-xs text-slate-600 font-medium">{row.noticePeriodDays || 30} Days</span>,
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'SUBMITTED'
              ? 'warning'
              : row.status === 'UNDER_REVIEW'
              ? 'info'
              : row.status === 'APPROVED'
              ? 'success'
              : 'neutral'
          }
          size="sm"
        >
          {row.status || 'SUBMITTED'}
        </Badge>
      ),
    },
    {
      header: 'Stated Reason',
      render: (row) => (
        <span className="text-xs text-slate-600 max-w-xs truncate block" title={row.reason}>
          {row.reason || '—'}
        </span>
      ),
    },
    {
      header: 'Action',
      render: (row) => {
        const isSelf =
          (user?.employeeId && row.employeeId === user.employeeId) ||
          (user?.id && row.employee?.userId === user.id);

        if (isSelf) {
          return (
            <span className="text-[11px] text-slate-400 italic" title="Self-approval prohibited">
              Your Resignation
            </span>
          );
        }

        return (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant={row.status === 'SUBMITTED' ? 'primary' : 'secondary'}
              size="sm"
              icon={UserCheck}
              onClick={() => setReviewingRecord(row)}
            >
              {row.status === 'SUBMITTED' ? 'Manager Review' : 'View Evaluation'}
            </Button>
          </div>
        );
      },
    },
  ];

  const orgColumns = [
    {
      header: 'Employee',
      render: (row) => {
        const emp = row.employee;
        const name =
          emp?.fullName || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || row.employeeName || 'Staff';
        const avatarUrl = emp?.avatarUrl || emp?.avatar_url || row.avatarUrl || row.employeeAvatar;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar
              src={avatarUrl}
              alt={name}
              name={name}
              size="sm"
            />
            <div>
              <p className="font-semibold text-xs text-slate-900">{name}</p>
              <p className="text-[10px] text-slate-400 font-mono">
                {emp?.empCode || 'EMP'} • {emp?.department?.name || 'Dept'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Notice Dates',
      render: (row) => (
        <div className="text-xs">
          <p className="text-slate-600">
            <span className="text-slate-400">Proposed:</span> {row.requestedLastWorkingDay || '—'}
          </p>
          <p className="font-semibold text-emerald-700">
            <span className="text-slate-400">Approved:</span> {row.approvedLastWorkingDay || 'Pending HR'}
          </p>
        </div>
      ),
    },
    {
      header: 'Status & Stage',
      render: (row) => (
        <div>
          <Badge
            variant={
              row.status === 'COMPLETED'
                ? 'success'
                : row.status === 'APPROVED'
                ? 'brand'
                : row.status === 'UNDER_REVIEW'
                ? 'info'
                : row.status === 'SUBMITTED'
                ? 'warning'
                : 'neutral'
            }
            size="sm"
          >
            {row.status}
          </Badge>
          <p className="text-[10px] text-slate-400 mt-0.5">{row.currentStage || 'IN_PROGRESS'}</p>
        </div>
      ),
    },
    {
      header: 'Manager Review',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.reviewedBy || row.managerFeedback ? 'Reviewed' : 'Awaiting Review'}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => {
        const isSelf =
          (user?.employeeId && row.employeeId === user.employeeId) ||
          (user?.id && row.employee?.userId === user.id);

        return (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon={Eye}
              onClick={() => setInspectingDossierId(row.id)}
              title="Inspect Dossier"
            >
              Dossier
            </Button>

            {isSelf ? (
              <span className="text-[11px] text-slate-400 italic" title="Self-approval prohibited">
                Your Resignation
              </span>
            ) : (
              <>
                {row.status === 'SUBMITTED' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UserCheck}
                    onClick={() => setReviewingRecord(row)}
                    title="Review as supervisor"
                  >
                    Manager Review
                  </Button>
                )}

                {['SUBMITTED', 'UNDER_REVIEW'].includes(row.status) && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={ShieldCheck}
                    onClick={() => setHrActingRecord(row)}
                    title="HR Action & Clearances"
                  >
                    HR Action
                  </Button>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Resignation & Career Transition</h1>
          <p className="text-xs text-slate-500 mt-1">
            Formal resignation submission, notice period milestones, manager review routing, and exit protocols
          </p>
        </div>

        {!hasActiveExit && (
          <Button variant="danger" icon={LogOut} onClick={() => setIsSubmitModalOpen(true)}>
            Submit Resignation
          </Button>
        )}
      </div>

      {/* Role-based Tabs */}
      {(isManager || isHrOrAdmin) && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'my'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            My Resignation Status
          </button>

          {isManager && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'team'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team Resignations ({teamExits.length})
            </button>
          )}

          {isHrOrAdmin && (
            <button
              onClick={() => setActiveTab('org')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'org'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Organization Resignations Queue ({orgExits.length})
            </button>
          )}
        </div>
      )}

      {/* TAB 1: My Resignation & Exit Information */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {isLoadingMy ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
              <LoadingSpinner message="Checking resignation and exit dossier status..." />
            </div>
          ) : myError ? (
            <Alert variant="danger">{myError}</Alert>
          ) : hasActiveExit ? (
            <>
              {/* Lifecycle Progression Timeline */}
              <ExitStatusTimeline status={myExit.status} currentStage={myExit.currentStage} />

              {/* Countdown Banner if Notice Period Active */}
              {getRemainingDays() !== null && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                      Active Notice Period Counter
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">
                      {getRemainingDays()} Days Remaining Until Last Working Day
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Effective Date: {myExit.approvedLastWorkingDay || myExit.requestedLastWorkingDay} • Total Notice:{' '}
                      {myExit.noticePeriodDays || 30} Days
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canWithdraw && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={RotateCcw}
                        onClick={() => setIsWithdrawModalOpen(true)}
                      >
                        Withdraw Resignation
                      </Button>
                    )}
                    {myExit.fnf && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Wallet}
                        onClick={() => setIsFnfModalOpen(true)}
                      >
                        FnF Settlement Statement
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Dossier Information Grid */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                      Dossier Reference: {myExit.id}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">Resignation Details</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="brand" size="md">
                      Status: {myExit.status}
                    </Badge>
                    <Badge variant="neutral" size="md">
                      Stage: {myExit.currentStage || 'IN_PROGRESS'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400">Resignation Date</span>
                    <p className="font-bold text-slate-900 mt-1">{myExit.resignationDate || 'Recently'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400">Proposed Last Working Day</span>
                    <p className="font-bold text-slate-900 mt-1">{myExit.requestedLastWorkingDay || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400">Approved Last Working Day</span>
                    <p className="font-bold text-emerald-700 mt-1">
                      {myExit.approvedLastWorkingDay || 'Awaiting HR Confirmation'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400">Notice Period</span>
                    <p className="font-bold text-slate-900 mt-1">{myExit.noticePeriodDays || 30} Calendar Days</p>
                  </div>
                </div>

                {/* Stated Reason */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1">
                  <span className="font-semibold text-slate-700">Submitted Reason for Departure:</span>
                  <p className="text-slate-800 italic leading-relaxed">"{myExit.reason}"</p>
                </div>

                {/* Comments where provided */}
                {myExit.comments && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1">
                    <span className="font-semibold text-slate-700">Transition & Handover Notes:</span>
                    <p className="text-slate-800 leading-relaxed">{myExit.comments}</p>
                  </div>
                )}

                {/* Approval Status & Review Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-brand-600" /> Manager Evaluation
                      </span>
                      <Badge variant={myExit.managerReviewedAt ? 'success' : 'warning'} size="sm">
                        {myExit.managerReviewedAt ? 'Reviewed' : 'Pending Manager'}
                      </Badge>
                    </div>
                    {myExit.managerFeedback ? (
                      <div className="space-y-1">
                        <p className="text-slate-700 italic">"{myExit.managerFeedback}"</p>
                        {myExit.managerRating && (
                          <p className="text-slate-500 font-medium">Exit Performance Score: {myExit.managerRating}/5.0</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Evaluated on {new Date(myExit.managerReviewedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Awaiting manager review and handover evaluation.</p>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-brand-600" /> HR Verification
                      </span>
                      <Badge variant={myExit.hrReviewedAt ? 'success' : 'warning'} size="sm">
                        {myExit.hrReviewedAt ? 'Approved' : 'Pending HR'}
                      </Badge>
                    </div>
                    {myExit.hrComments ? (
                      <div className="space-y-1">
                        <p className="text-slate-700 italic">"{myExit.hrComments}"</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Verified on {new Date(myExit.hrReviewedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">HR will verify notice dates and initiate departmental sign-offs.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Departmental Clearances Checklist */}
              {myExit.clearances && myExit.clearances.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">Your Departmental Clearances Checklist</h4>
                  <ClearanceChecklistTable clearances={myExit.clearances} canManage={false} />
                </div>
              )}

              {/* Relevant Exit Information & Policy Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-brand-600" /> Relevant Exit Guidelines & Policy FAQs
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-brand-600" /> Notice Period & Buyout
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      Standard policy mandates 30 calendar days. Shortfall in notice period without formal HR waiver is
                      deducted from the Full & Final settlement statement at daily base rate.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-brand-600" /> Company Assets Return
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      All company-issued hardware, laptops, security access badges, and corporate credit cards must be
                      returned to IT/Admin on or prior to your approved last working day.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-brand-600" /> Full & Final (FnF) Payout
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      FnF settlement statements include earned salary, unutilized accrued leave encashment, and gratuity,
                      less any recovery amounts, disbursed within 30 days following exit.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State: No Resignation in Progress */
            <div className="bg-white rounded-2xl border border-slate-200/80 p-10 shadow-sm text-center max-w-xl mx-auto space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-900">Active Employment in Good Standing</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You currently have no active resignation or separation requests on record. Your employment status is
                  active, with all permissions and benefits configured.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-left text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">Considering a career transition?</p>
                <p>
                  Submitting a formal resignation will prompt for your proposed last working day, calculate the
                  statutory notice period, and initiate handover workflows with your manager and HR.
                </p>
              </div>

              <div className="pt-2">
                <Button variant="danger" icon={LogOut} onClick={() => setIsSubmitModalOpen(true)}>
                  Initiate Formal Resignation
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Team Resignations (Manager Review Cockpit) */}
      {activeTab === 'team' && isManager && (
        <div className="space-y-4">
          {teamError && <Alert variant="danger">{teamError}</Alert>}

          <DataTable
            columns={teamColumns}
            data={teamExits}
            isLoading={isLoadingTeam}
            emptyTitle="No Pending Team Resignations"
            emptyDescription="All team members reporting to you are active. No resignation reviews are pending."
          />
        </div>
      )}

      {/* TAB 3: Organization Resignations Queue (HR & Admin) */}
      {activeTab === 'org' && isHrOrAdmin && (
        <div className="space-y-4">
          {orgError && <Alert variant="danger">{orgError}</Alert>}

          <DataTable
            columns={orgColumns}
            data={orgExits}
            isLoading={isLoadingOrg}
            emptyTitle="No Organization Resignations"
            emptyDescription="There are currently no active resignation requests across the organization."
          />
        </div>
      )}

      {/* Modals & Dialogs */}
      <ResignationSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          fetchMyExit();
          if (isManager) fetchTeamExits();
          if (isHrOrAdmin) fetchOrgExits();
        }}
      />

      <ResignationWithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        onSuccess={() => {
          fetchMyExit();
          if (isManager) fetchTeamExits();
          if (isHrOrAdmin) fetchOrgExits();
        }}
        exitRequestId={myExit?.id}
      />

      {reviewingRecord && (
        <ManagerExitReviewModal
          isOpen={!!reviewingRecord}
          onClose={() => setReviewingRecord(null)}
          onSuccess={() => {
            fetchTeamExits();
            if (isHrOrAdmin) fetchOrgExits();
          }}
          record={reviewingRecord}
        />
      )}

      {hrActingRecord && (
        <HRExitApprovalModal
          isOpen={!!hrActingRecord}
          onClose={() => setHrActingRecord(null)}
          onSuccess={() => {
            fetchOrgExits();
            if (isManager) fetchTeamExits();
            fetchMyExit();
          }}
          record={hrActingRecord}
        />
      )}

      {isFnfModalOpen && myExit && (
        <FnFSettlementModal
          isOpen={isFnfModalOpen}
          onClose={() => setIsFnfModalOpen(false)}
          exitRequestId={myExit.id}
          record={myExit}
          canManage={false}
        />
      )}

      {inspectingDossierId && (
        <ExitDossierDetailModal
          isOpen={!!inspectingDossierId}
          onClose={() => setInspectingDossierId(null)}
          exitId={inspectingDossierId}
          canManage={isHrOrAdmin}
          onOpenFnF={(record) => {
            setInspectingDossierId(null);
            // Can be managed from offboarding
          }}
        />
      )}
    </div>
  );
};
