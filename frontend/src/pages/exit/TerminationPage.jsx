import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserX,
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
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  ClipboardList,
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
import { InitiateTerminationModal } from '../../components/exit/InitiateTerminationModal.jsx';
import { ExitDossierDetailModal } from '../../components/exit/ExitDossierDetailModal.jsx';
import { AccessDeprovisionModal } from '../../components/exit/AccessDeprovisionModal.jsx';
import { FnFSettlementModal } from '../../components/exit/FnFSettlementModal.jsx';

export const TerminationPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  // Overall state
  const [terminations, setTerminations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [viewingExitId, setViewingExitId] = useState(null);
  const [deprovisionExit, setDeprovisionExit] = useState(null);
  const [fnfExit, setFnfExit] = useState(null);

  useEffect(() => {
    fetchTerminations();
  }, []);

  const fetchTerminations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fetch involuntary, mutual, or contract end exits
      const res = await exitService.getAllExits({ limit: 200, isTermination: true });
      const raw = res?.items || res?.data || (Array.isArray(res) ? res : []);
      
      // Filter out voluntary resignations in case the backend returns all
      const involuntaryList = raw.filter((item) => {
        const type = (item.exitType || '').toUpperCase();
        return type !== 'VOLUNTARY';
      });

      setTerminations(involuntaryList);
    } catch (err) {
      console.error('Failed to fetch terminations:', err);
      setError(err.message || 'Failed to load termination records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTerminations();
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = terminations.length;
    const immediate = terminations.filter((t) => (t.noticePeriodDays === 0 || t.status === 'EXIT_PROCESSING') && t.status !== 'COMPLETED').length;
    const noticePeriod = terminations.filter((t) => t.status === 'NOTICE_PERIOD' || (t.status === 'APPROVED' && t.noticePeriodDays > 0)).length;
    const completed = terminations.filter((t) => t.status === 'COMPLETED').length;

    return { total, immediate, noticePeriod, completed };
  }, [terminations]);

  // Filtered dataset
  const filteredTerminations = useMemo(() => {
    return terminations.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const empName = (item.employeeName || item.employee?.fullName || '').toLowerCase();
        const empCode = (item.employeeCode || item.employee?.empCode || '').toLowerCase();
        const dept = (item.department || item.employee?.department?.name || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        if (!empName.includes(q) && !empCode.includes(q) && !dept.includes(q) && !reason.includes(q)) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'ALL') {
        if ((item.exitType || '').toUpperCase() !== typeFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if ((item.status || '').toUpperCase() !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [terminations, searchQuery, typeFilter, statusFilter]);

  const getExitTypeBadge = (exitType) => {
    const t = (exitType || '').toUpperCase();
    if (t === 'INVOLUNTARY') {
      return <Badge variant="danger">Involuntary Separation</Badge>;
    }
    if (t === 'MUTUAL') {
      return <Badge variant="purple">Mutual Agreement</Badge>;
    }
    if (t === 'CONTRACT_END') {
      return <Badge variant="info">Contract End</Badge>;
    }
    return <Badge variant="neutral">{exitType || 'Terminated'}</Badge>;
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'EXIT_PROCESSING':
        return <Badge variant="warning">Exit Processing</Badge>;
      case 'NOTICE_PERIOD':
        return <Badge variant="info">Notice Period</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Clearance In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="neutral">Separation Finalized</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const tableColumns = [
    {
      key: 'employee',
      label: 'Exiting Employee',
      render: (_, row) => {
        const name = row.employeeName || row.employee?.fullName || 'Staff Member';
        const code = row.employeeCode || row.employee?.empCode || '—';
        const dept = row.department || row.employee?.department?.name || 'General';
        const desig = row.designation || row.employee?.designation?.title || 'Employee';

        return (
          <div className="flex items-center gap-3">
            <Avatar name={name} src={row.avatarUrl || row.employee?.avatarUrl} size="md" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{name}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">({code})</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dept} • {desig}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      label: 'Separation Type & Grounds',
      render: (_, row) => {
        return (
          <div className="space-y-1 max-w-xs">
            <div>{getExitTypeBadge(row.exitType)}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2" title={row.reason}>
              {row.reason || 'Company initiated termination.'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'timeline',
      label: 'Timeline & Effective Date',
      render: (_, row) => {
        const isImmediate = row.noticePeriodDays === 0;
        const lwd = row.approvedLastWorkingDay || row.requestedLastWorkingDay || 'Immediate';
        return (
          <div className="text-xs space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>LWD: {lwd}</span>
            </div>
            <div className="text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{isImmediate ? 'Immediate Departure (0d notice)' : `${row.noticePeriodDays} Days Notice`}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status & Phase',
      render: (_, row) => {
        return (
          <div className="space-y-1">
            <div>{getStatusBadge(row.status)}</div>
            <div className="text-[11px] text-slate-400">
              Stage: {row.currentStage?.replace(/_/g, ' ') || 'Clearance'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => {
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setViewingExitId(row.id)}
              title="View Complete Separation Dossier"
              className="flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Dossier</span>
            </Button>

            <Button
              size="xs"
              variant="outline"
              onClick={() => navigate('/offboarding')}
              title="Go to Offboarding Clearances"
              className="flex items-center gap-1 text-slate-700 dark:text-slate-300"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Clearances</span>
            </Button>

            {row.status !== 'COMPLETED' && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setDeprovisionExit(row)}
                title="Revoke / Deprovision System Access"
                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Revoke</span>
              </Button>
            )}

            <Button
              size="xs"
              variant="outline"
              onClick={() => setFnfExit(row)}
              title="Process Full & Final Settlement"
              className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Settlement</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shadow-sm shadow-red-500/20">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Employee Termination
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Company-directed involuntary separations, notice configuration, clearance tracking, and settlements
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isHrOrAdmin && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsInitiateModalOpen(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Employee Termination</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" title="Error Loading Termination Records">
          {error}
        </Alert>
      )}

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Terminations */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Involuntary</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</div>
            <div className="text-xs text-slate-500">Company separations recorded</div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
            <UserX className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Immediate Separations */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Immediate Exits</span>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.immediate}</div>
            <div className="text-xs text-slate-500">0 days notice / immediate</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Notice Period Active */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notice Transition</span>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.noticePeriod}</div>
            <div className="text-xs text-slate-500">Active notice / clearance period</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Finalized */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finalized Exits</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.completed}</div>
            <div className="text-xs text-slate-500">FnF settled & completed</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee name, code, department, grounds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Separation Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">All Separation Types</option>
              <option value="INVOLUNTARY">Involuntary</option>
              <option value="MUTUAL">Mutual Agreement</option>
              <option value="CONTRACT_END">Contract End</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="EXIT_PROCESSING">Exit Processing</option>
              <option value="NOTICE_PERIOD">Notice Period</option>
              <option value="APPROVED">Clearance Active</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {(searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* 4. Terminations DataTable */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner message="Loading employee terminations..." />
          </div>
        ) : filteredTerminations.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No Employee Terminations Found"
            description={
              searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No termination records match your selected search or filter criteria.'
                : 'There are currently no company-initiated terminations on record.'
            }
            action={
              isHrOrAdmin && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsInitiateModalOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Initiate Termination
                </Button>
              )
            }
          />
        ) : (
          <DataTable
            data={filteredTerminations}
            columns={tableColumns}
            keyField="id"
          />
        )}
      </div>

      {/* 5. Modals */}
      {/* Initiate Termination Modal */}
      {isInitiateModalOpen && (
        <InitiateTerminationModal
          isOpen={isInitiateModalOpen}
          onClose={() => setIsInitiateModalOpen(false)}
          onSuccess={() => {
            fetchTerminations();
          }}
        />
      )}

      {/* Exit Dossier Detail Modal */}
      {viewingExitId && (
        <ExitDossierDetailModal
          isOpen={!!viewingExitId}
          onClose={() => setViewingExitId(null)}
          exitRequestId={viewingExitId}
          onUpdated={() => fetchTerminations()}
        />
      )}

      {/* Access Deprovision Modal */}
      {deprovisionExit && (
        <AccessDeprovisionModal
          isOpen={!!deprovisionExit}
          onClose={() => setDeprovisionExit(null)}
          onSuccess={() => {
            fetchTerminations();
          }}
          record={deprovisionExit}
        />
      )}

      {/* Full & Final Settlement Modal */}
      {fnfExit && (
        <FnFSettlementModal
          isOpen={!!fnfExit}
          onClose={() => setFnfExit(null)}
          onSuccess={() => {
            fetchTerminations();
          }}
          record={fnfExit}
        />
      )}
    </div>
  );
};

export default TerminationPage;
