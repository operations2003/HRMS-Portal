import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Kanban,
  Table as TableIcon,
  Plus,
  ArrowUpRight,
  Calendar,
  Building2,
  Briefcase,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { AtsHandoffModal } from '../../components/onboarding/AtsHandoffModal.jsx';

export const OnboardingDashboardPage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [isAtsModalOpen, setIsAtsModalOpen] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [joiningDateFilter, setJoiningDateFilter] = useState('');

  const canWrite = hasPermission('onboarding:write');

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (joiningDateFilter) params.joiningDate = joiningDateFilter;
      if (departmentFilter !== 'ALL') params.department = departmentFilter;
      if (searchTerm) params.search = searchTerm;

      const result = await onboardingService.getNewHires(params);
      setCandidates(result.items || []);
    } catch (err) {
      showError(err.message || 'Failed to load onboarding candidates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [statusFilter, departmentFilter, joiningDateFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCandidates();
  };

  // Unique departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const set = new Set();
    candidates.forEach((c) => {
      if (c.department?.name) set.add(c.department.name);
    });
    return Array.from(set);
  }, [candidates]);

  // Metric computations
  const metrics = useMemo(() => {
    const total = candidates.length;
    const inProgress = candidates.filter(
      (c) => c.onboardingStatus === 'IN_PROGRESS' || c.lifecycleState === 'ONBOARDING'
    ).length;
    const readyForDayOne = candidates.filter(
      (c) => c.onboardingStatus === 'READY_FOR_JOINING'
    ).length;
    const converted = candidates.filter(
      (c) => c.lifecycleState === 'CONVERTED_TO_EMPLOYEE' || c.onboardingStatus === 'COMPLETED'
    ).length;
    return { total, inProgress, readyForDayOne, converted };
  }, [candidates]);

  // Kanban Columns Mapping
  const kanbanColumns = [
    {
      id: 'NOT_STARTED',
      title: 'Incoming / Handoff',
      description: 'Offer accepted, awaiting documentation',
      color: 'border-blue-500 bg-blue-50/20 text-blue-700',
      filter: (c) =>
        c.onboardingStatus === 'NOT_STARTED' && c.lifecycleState !== 'CONVERTED_TO_EMPLOYEE',
    },
    {
      id: 'IN_PROGRESS',
      title: 'In Progress',
      description: 'Checklist, BGV & IT setup underway',
      color: 'border-indigo-500 bg-indigo-50/20 text-indigo-700',
      filter: (c) =>
        (c.onboardingStatus === 'IN_PROGRESS' ||
          c.onboardingStatus === 'DOCUMENTATION_PENDING' ||
          c.onboardingStatus === 'VERIFICATION_PENDING') &&
        c.lifecycleState !== 'CONVERTED_TO_EMPLOYEE',
    },
    {
      id: 'READY_FOR_JOINING',
      title: 'Ready for Day-1',
      description: '100% prepared for employee conversion',
      color: 'border-emerald-500 bg-emerald-50/20 text-emerald-700',
      filter: (c) =>
        c.onboardingStatus === 'READY_FOR_JOINING' &&
        c.lifecycleState !== 'CONVERTED_TO_EMPLOYEE',
    },
    {
      id: 'CONVERTED',
      title: 'Active Employees',
      description: 'Linked to Employee Master',
      color: 'border-purple-500 bg-purple-50/20 text-purple-700',
      filter: (c) =>
        c.lifecycleState === 'CONVERTED_TO_EMPLOYEE' || c.onboardingStatus === 'COMPLETED',
    },
  ];

  const getStatusBadge = (candidate) => {
    if (candidate.lifecycleState === 'CONVERTED_TO_EMPLOYEE') {
      return <Badge variant="success">Converted to Employee</Badge>;
    }
    switch (candidate.onboardingStatus) {
      case 'READY_FOR_JOINING':
        return <Badge variant="success">Ready for Day-1</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="info">In Progress</Badge>;
      default:
        return <Badge variant="warning">Not Started</Badge>;
    }
  };

  // Table Columns
  const tableColumns = [
    {
      header: 'New Hire Candidate',
      accessor: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            {row.firstName?.[0]}
            {row.lastName?.[0]}
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white block hover:text-indigo-600 transition-colors">
              {row.fullName}
            </span>
            <span className="text-xs text-slate-400 font-mono">{row.atsCandidateId}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Department & Role',
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {row.department?.name || 'Department Unassigned'}
          </p>
          <p className="text-xs text-slate-500">{row.designation?.title || 'Role Unassigned'}</p>
        </div>
      ),
    },
    {
      header: 'Joining Date',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.dateOfJoining || 'TBD'}</span>
        </div>
      ),
    },
    {
      header: 'Reporting Manager',
      accessor: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {row.manager?.name || 'Self / Unassigned'}
        </span>
      ),
    },
    {
      header: 'Checklist Progress',
      accessor: (row) => {
        const pct = row.readinessTracker?.completionPercentage || 0;
        return (
          <div className="w-36">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">{pct}%</span>
              <span className="text-[10px] text-slate-400">Ready</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  pct === 100
                    ? 'bg-emerald-500'
                    : pct >= 50
                    ? 'bg-indigo-600'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: (row) => getStatusBadge(row),
    },
    {
      header: 'Action',
      accessor: (row) => (
        <Button
          variant="secondary"
          size="xs"
          icon={ChevronRight}
          onClick={() => navigate(`/onboarding/${row.id}`)}
        >
          View Workspace
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-indigo-600" />
            Phase 3: Onboarding & Candidate Intake
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage incoming ATS hires, readiness checklist stages, document vaults, and Day-1
            employee conversions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-4 h-4" />
              Kanban
            </button>
          </div>

          {canWrite && (
            <Button
              variant="primary"
              icon={Sparkles}
              onClick={() => setIsAtsModalOpen(true)}
            >
              Simulate ATS Handoff
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Ingested Hires
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {metrics.total}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Onboarding In Progress
            </p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {metrics.inProgress}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ready for Day-1
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.readyForDayOne}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Converted Employees
            </p>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {metrics.converted}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search candidate by name, email, or ATS ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Status Filter */}
          <div className="w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="READY_FOR_JOINING">Ready for Day-1</option>
              <option value="CONVERTED_TO_EMPLOYEE">Converted to Employee</option>
            </select>
          </div>

          {/* Department Filter */}
          {departmentOptions.length > 0 && (
            <div className="w-44">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Joining Date Filter */}
          <div className="w-40">
            <input
              type="date"
              value={joiningDateFilter}
              onChange={(e) => setJoiningDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Filter by joining date"
            />
          </div>

          <Button type="submit" variant="secondary" size="sm" icon={Filter}>
            Apply
          </Button>

          {(searchTerm || statusFilter !== 'ALL' || departmentFilter !== 'ALL' || joiningDateFilter) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setDepartmentFilter('ALL');
                setJoiningDateFilter('');
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 flex justify-center">
          <LoadingSpinner message="Loading candidate profiles & onboarding progress..." />
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title="No onboarding candidates found"
          message="No candidates match your current filter criteria or none have been handed off from ATS yet."
          actionText={canWrite ? 'Simulate ATS Handoff' : undefined}
          onAction={canWrite ? () => setIsAtsModalOpen(true) : undefined}
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <DataTable columns={tableColumns} data={candidates} />
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {kanbanColumns.map((col) => {
            const colCandidates = candidates.filter(col.filter);
            return (
              <div
                key={col.id}
                className="rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 flex flex-col h-full min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.color.split(' ')[0].replace('border-', 'bg-')}`} />
                      {col.title}
                    </h3>
                    <p className="text-[11px] text-slate-400">{col.description}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {colCandidates.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {colCandidates.length === 0 ? (
                    <div className="h-32 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400">
                      No candidates in this stage
                    </div>
                  ) : (
                    colCandidates.map((candidate) => {
                      const pct = candidate.readinessTracker?.completionPercentage || 0;
                      return (
                        <div
                          key={candidate.id}
                          onClick={() => navigate(`/onboarding/${candidate.id}`)}
                          className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors">
                                {candidate.fullName}
                              </h4>
                              <p className="text-xs text-slate-500">{candidate.email}</p>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                              {candidate.atsCandidateId}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {candidate.department?.name || 'Engineering'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Joining: {candidate.dateOfJoining || 'TBD'}</span>
                            </div>
                          </div>

                          {/* Progress */}
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-500">Readiness</span>
                              <span className="font-bold text-indigo-600">{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct === 100
                                    ? 'bg-emerald-500'
                                    : pct >= 50
                                    ? 'bg-indigo-600'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ATS Simulator Modal */}
      {isAtsModalOpen && (
        <AtsHandoffModal
          isOpen={true}
          onClose={() => setIsAtsModalOpen(false)}
          onHandoffSuccess={() => {
            fetchCandidates();
          }}
        />
      )}
    </div>
  );
};

export default OnboardingDashboardPage;
