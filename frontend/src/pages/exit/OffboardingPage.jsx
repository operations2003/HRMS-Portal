import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  Building2,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Eye,
  ShieldCheck,
  UserX,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowRight,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exitService } from '../../services/exitService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ExitStatusTimeline } from '../../components/exit/ExitStatusTimeline.jsx';
import { ExitDossierDetailModal } from '../../components/exit/ExitDossierDetailModal.jsx';
import { HRExitApprovalModal } from '../../components/exit/HRExitApprovalModal.jsx';
import { FnFSettlementModal } from '../../components/exit/FnFSettlementModal.jsx';
import { AccessDeprovisionModal } from '../../components/exit/AccessDeprovisionModal.jsx';
import { AddClearanceTaskModal } from '../../components/exit/AddClearanceTaskModal.jsx';

export const OffboardingPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  const isManager = hasRole('Manager') || isHrOrAdmin;

  // View Mode: 'all' | 'my'
  const [viewMode, setViewMode] = useState(isHrOrAdmin || isManager ? 'all' : 'my');

  // Overall States
  const [stats, setStats] = useState({});
  const [exits, setExits] = useState([]);
  const [myExit, setMyExit] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters (for HR/Admin/Manager table)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [viewingExitId, setViewingExitId] = useState(null);
  const [actionExit, setActionExit] = useState(null);
  const [fnfExit, setFnfExit] = useState(null);
  const [deprovisionExit, setDeprovisionExit] = useState(null);
  const [addClearanceExitId, setAddClearanceExitId] = useState(null);

  const fetchStats = async () => {
    if (!isHrOrAdmin) return;
    try {
      const data = await exitService.getAdminStats();
      setStats(data || {});
    } catch {
      // Fallback
    }
  };

  const fetchExits = async (page = 1) => {
    try {
      setIsRefreshing(true);
      setError(null);

      if (isHrOrAdmin) {
        // HR/Admin: Organization-wide exits
        const params = {
          page,
          limit: 20,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
        };
        const res = await exitService.getAllExits(params);
        const items = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setExits(items);
        setPagination(res.pagination || { page: 1, limit: 20, total: items.length, totalPages: 1 });
      } else if (isManager) {
        // Manager: Team exits
        const res = await exitService.getTeamExits({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
        });
        const items = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setExits(items);
        setPagination({ page: 1, limit: 20, total: items.length, totalPages: 1 });
      }

      // Always fetch employee's own exit if relevant
      try {
        const myData = await exitService.getMyExit();
        setMyExit(myData);
      } catch {
        setMyExit(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load offboarding directory.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchExits(1);
  }, [statusFilter, isHrOrAdmin, isManager]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchExits(1);
  };

  // Helper to compute overall lifecycle progress stage
  const getLifecycleStage = (record) => {
    const s = (record.status || '').toUpperCase();
    const c = (record.currentStage || '').toUpperCase();
    const accessRevoked = record.offboarding?.accessRemovalStatus === 'DEPROVISIONED';
    const fnfSettled = record.fnf?.paymentStatus === 'DISBURSED';

    if (s === 'COMPLETED' || c === 'COMPLETED') return { stage: 8, label: 'Completed', percent: 100 };
    if (fnfSettled || s === 'EXIT_PROCESSING') return { stage: 7, label: 'Full & Final', percent: 87 };
    if (accessRevoked) return { stage: 6, label: 'Access Removal', percent: 75 };
    if (c === 'CLEARANCE_IN_PROGRESS') return { stage: 5, label: 'Clearance', percent: 62 };
    if (s === 'APPROVED' || s === 'NOTICE_PERIOD') return { stage: 3, label: 'Notice Period', percent: 37 };
    if (s === 'UNDER_REVIEW' || c === 'HR_REVIEW') return { stage: 2, label: 'Review', percent: 25 };
    return { stage: 1, label: 'Resignation', percent: 12 };
  };

  const columns = [
    {
      header: 'Employee',
      render: (row) => {
        const emp = row.employee;
        const name =
          emp?.fullName || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || row.employeeName || 'Staff';
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
              {name.charAt(0)}
            </div>
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
      header: 'Last Working Day',
      render: (row) => {
        const approved = row.approvedLastWorkingDay;
        const proposed = row.requestedLastWorkingDay;
        return (
          <div className="text-xs">
            <p className="font-semibold text-slate-900">{approved || proposed || '—'}</p>
            <p className="text-[10px] text-slate-400">
              {approved ? 'Approved by HR' : 'Proposed by Employee'}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Exit Status',
      render: (row) => (
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
              : row.status === 'REJECTED'
              ? 'danger'
              : 'neutral'
          }
          size="sm"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Checklist Progress',
      render: (row) => {
        const clearances = row.clearances || [];
        const total = clearances.length;
        const cleared = clearances.filter((c) =>
          ['CLEARED', 'COMPLETED', 'WAIVED'].includes((c.status || '').toUpperCase())
        ).length;

        if (total === 0) {
          return <span className="text-xs text-slate-400">Not initialized</span>;
        }

        return (
          <div className="text-xs">
            <span className="font-semibold text-slate-800">
              {cleared} / {total} Cleared
            </span>
            <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${cleared === total ? 'bg-emerald-600' : 'bg-brand-600'}`}
                style={{ width: `${Math.round((cleared / total) * 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Clearance Status',
      render: (row) => {
        const clearances = row.clearances || [];
        const hasPending = clearances.some((c) => !['CLEARED', 'COMPLETED', 'WAIVED'].includes(c.status));
        const allCleared = clearances.length > 0 && !hasPending;

        return (
          <Badge variant={allCleared ? 'success' : clearances.length > 0 ? 'warning' : 'neutral'} size="sm">
            {allCleared ? 'CLEARED' : clearances.length > 0 ? 'IN_PROGRESS' : 'PENDING'}
          </Badge>
        );
      },
    },
    {
      header: 'Access Removal',
      render: (row) => {
        const deprovisioned =
          row.offboarding?.accessRemovalStatus === 'DEPROVISIONED' ||
          row.status === 'COMPLETED' ||
          row.employee?.status === 'Exited';

        return (
          <Badge variant={deprovisioned ? 'neutral' : 'warning'} size="sm">
            {deprovisioned ? 'REVOKED' : 'ACTIVE'}
          </Badge>
        );
      },
    },
    {
      header: 'Full & Final',
      render: (row) => {
        const fnf = row.fnf;
        const status = fnf?.paymentStatus || (fnf?.approvalStatus ? 'CALCULATED' : 'PENDING');

        return (
          <Badge
            variant={status === 'DISBURSED' ? 'success' : status === 'CALCULATED' ? 'info' : 'neutral'}
            size="sm"
          >
            {status}
          </Badge>
        );
      },
    },
    {
      header: 'Overall Exit Progress',
      render: (row) => {
        const progress = getLifecycleStage(row);
        return (
          <div className="text-xs">
            <span className="font-semibold text-slate-800">
              Stage {progress.stage}/8: {progress.label}
            </span>
            <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${
                  progress.stage === 8 ? 'bg-emerald-600' : progress.stage >= 5 ? 'bg-brand-600' : 'bg-amber-500'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={() => setViewingExitId(row.id)}
            title="Inspect Lifecycle & Dossier"
          >
            Dossier
          </Button>

          {isHrOrAdmin && ['SUBMITTED', 'UNDER_REVIEW'].includes(row.status) && (
            <Button
              variant="primary"
              size="sm"
              icon={ShieldCheck}
              onClick={() => setActionExit(row)}
            >
              HR Action
            </Button>
          )}

          {isHrOrAdmin &&
            ['APPROVED', 'NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS', 'EXIT_PROCESSING', 'COMPLETED'].includes(
              row.status
            ) && (
              <Button
                variant="secondary"
                size="sm"
                icon={Wallet}
                onClick={() => setFnfExit(row)}
              >
                FnF
              </Button>
            )}

          {isHrOrAdmin && row.status !== 'COMPLETED' && row.status !== 'REJECTED' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              icon={UserX}
              onClick={() => setDeprovisionExit(row)}
              title="Revoke Access & Deprovision"
            >
              Deprovision
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Offboarding Operations Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete employee offboarding governance: Resignation → Review → Notice Period → Checklist → Clearance → Access Removal → Full & Final → Completed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={() => {
              fetchStats();
              fetchExits(pagination.page);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Role View Toggle if Employee has active exit and is also HR/Manager */}
      {(isHrOrAdmin || isManager) && myExit && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              viewMode === 'all'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {isHrOrAdmin ? 'Organization Operational View' : 'Manager Team View'} ({exits.length})
          </button>
          <button
            onClick={() => setViewMode('my')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              viewMode === 'my'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            My Offboarding Dossier
          </button>
        </div>
      )}

      {/* VIEW 1: Operational View (HR & Manager) */}
      {viewMode === 'all' && (isHrOrAdmin || isManager) && (
        <div className="space-y-6">
          {/* Executive KPI Metrics (HR View) */}
          {isHrOrAdmin && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Exits</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalExits || exits.length}</p>
                <span className="text-[10px] text-slate-400">Lifetime Org Exits</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-amber-600">Pending Review</p>
                <p className="text-2xl font-black text-amber-700 mt-1">{stats.pendingManagerReview || 0}</p>
                <span className="text-[10px] text-amber-600">Under Evaluation</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-sky-200/80 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-sky-600">Notice Period</p>
                <p className="text-2xl font-black text-sky-700 mt-1">{stats.pendingHrAction || 0}</p>
                <span className="text-[10px] text-sky-600">Approved Notice Active</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-indigo-600">In Clearance</p>
                <p className="text-2xl font-black text-indigo-700 mt-1">{stats.inClearance || 0}</p>
                <span className="text-[10px] text-indigo-600">Tasks Executing</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-emerald-600">Completed</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{stats.completedExits || 0}</p>
                <span className="text-[10px] text-emerald-600">FnF & Closed</span>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search offboarding records by employee name, code, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </form>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700"
            >
              <option value="ALL">All Lifecycle Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="APPROVED">APPROVED</option>
              <option value="NOTICE_PERIOD">NOTICE_PERIOD</option>
              <option value="CLEARANCE_IN_PROGRESS">CLEARANCE_IN_PROGRESS</option>
              <option value="EXIT_PROCESSING">EXIT_PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="WITHDRAWN">WITHDRAWN</option>
            </select>
          </div>

          {/* Operational DataTable */}
          <DataTable
            columns={columns}
            data={exits}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={(p) => fetchExits(p)}
            emptyTitle="No Offboarding Records Found"
            emptyDescription="No separation dossiers match the current authorized scope and filter criteria."
          />
        </div>
      )}

      {/* VIEW 2: Employee Authorized Personal Dossier */}
      {viewMode === 'my' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
              <LoadingSpinner message="Loading your offboarding lifecycle record..." />
            </div>
          ) : myExit ? (
            <>
              {/* Lifecycle Progression */}
              <ExitStatusTimeline
                status={myExit.status}
                currentStage={myExit.currentStage}
                offboarding={myExit.offboarding}
              />

              {/* Status Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Exit Status</span>
                  <p className="text-lg font-bold text-slate-900 mt-1">{myExit.status}</p>
                  <span className="text-[10px] text-slate-500">Stage: {myExit.currentStage || 'IN_PROGRESS'}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Working Day</span>
                  <p className="text-lg font-bold text-emerald-700 mt-1">
                    {myExit.approvedLastWorkingDay || myExit.requestedLastWorkingDay || '—'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {myExit.approvedLastWorkingDay ? 'Approved by HR' : 'Proposed'}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Access Removal</span>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {myExit.offboarding?.accessRemovalStatus === 'DEPROVISIONED' ? 'Revoked' : 'Active'}
                  </p>
                  <span className="text-[10px] text-slate-500">Scheduled on LWD</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Full & Final</span>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {myExit.fnf?.paymentStatus || 'Pending'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    Net: ${parseFloat(myExit.fnf?.netSettlementAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Dossier Detail Inspection */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Your Offboarding Milestones & Clearances</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Eye}
                    onClick={() => setViewingExitId(myExit.id)}
                  >
                    Open Comprehensive Dossier
                  </Button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Your offboarding process is governed by corporate compliance policies. Ensure all departmental
                  clearance tasks (asset returns, knowledge transfer sign-offs, and expense claims) are settled before
                  your last working day to ensure timely Full & Final disbursement.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center max-w-xl mx-auto shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">No Offboarding Record</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  You do not have an active exit or offboarding process underway. Your employment is active in good
                  standing.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewingExitId && (
        <ExitDossierDetailModal
          isOpen={!!viewingExitId}
          onClose={() => setViewingExitId(null)}
          exitId={viewingExitId}
          canManage={isHrOrAdmin}
          onOpenFnF={(record) => setFnfExit(record)}
          onOpenDeprovision={(record) => setDeprovisionExit(record)}
        />
      )}

      {actionExit && (
        <HRExitApprovalModal
          isOpen={!!actionExit}
          onClose={() => setActionExit(null)}
          onSuccess={() => {
            fetchStats();
            fetchExits(pagination.page);
          }}
          record={actionExit}
        />
      )}

      {fnfExit && (
        <FnFSettlementModal
          isOpen={!!fnfExit}
          onClose={() => setFnfExit(null)}
          exitRequestId={fnfExit.id}
          record={fnfExit}
          canManage={isHrOrAdmin}
          onSuccess={() => {
            fetchStats();
            fetchExits(pagination.page);
          }}
        />
      )}

      {deprovisionExit && (
        <AccessDeprovisionModal
          isOpen={!!deprovisionExit}
          onClose={() => setDeprovisionExit(null)}
          onSuccess={() => {
            fetchStats();
            fetchExits(pagination.page);
          }}
          record={deprovisionExit}
        />
      )}
    </div>
  );
};
