import React, { useState, useEffect } from 'react';
import {
  Award,
  Star,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  TrendingUp,
  Target,
  Send,
  RotateCcw,
  Search,
  Filter,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { performanceService } from '../../services/performanceService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { CreateAppraisalModal } from '../../components/performance/CreateAppraisalModal.jsx';
import { ManagerReviewModal } from '../../components/performance/ManagerReviewModal.jsx';
import { CreatePeriodModal } from '../../components/performance/CreatePeriodModal.jsx';
import { AppraisalDetailModal } from '../../components/performance/AppraisalDetailModal.jsx';

export const PerformancePage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const isManager = hasRole('Manager') || hasRole('Admin') || hasRole('SuperAdmin') || hasRole('OrgAdmin');
  const isHrOrAdmin = hasRole('HR') || hasRole('HRManager') || hasRole('Admin') || hasRole('SuperAdmin') || hasRole('OrgAdmin');
  const canGiveAppraisal = isManager || isHrOrAdmin;

  // Active Tab: 'my' | 'team' | 'cycles'
  const [activeTab, setActiveTab] = useState('my');
  const [myRecords, setMyRecords] = useState([]);
  const [teamRecords, setTeamRecords] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [orgRecords, setOrgRecords] = useState([]);

  // Filters
  const [teamStatusFilter, setTeamStatusFilter] = useState('ALL');
  const [orgStatusFilter, setOrgStatusFilter] = useState('ALL');
  const [orgSearch, setOrgSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isCreateAppraisalOpen, setIsCreateAppraisalOpen] = useState(false);
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  // Quick Action Confirmations
  const [recordToSubmit, setRecordToSubmit] = useState(null);
  const [recordToHrApprove, setRecordToHrApprove] = useState(null);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!isManager && !isHrOrAdmin && activeTab !== 'my') {
      setActiveTab('my');
    }
  }, [isManager, isHrOrAdmin, activeTab]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setIsRefreshing(true);
      if (activeTab === 'my') {
        const res = await performanceService.getMyPerformance();
        setMyRecords(res.items || res.data || (Array.isArray(res) ? res : []));
      } else if (activeTab === 'team') {
        const res = await performanceService.getTeamPerformance();
        setTeamRecords(res.items || res.data || (Array.isArray(res) ? res : []));
      } else if (activeTab === 'cycles') {
        const [pRes, rRes] = await Promise.allSettled([
          performanceService.getPeriods(),
          performanceService.getOrganizationRecords(),
        ]);
        if (pRes.status === 'fulfilled') {
          const p = pRes.value;
          setPeriods(p.items || p.data || (Array.isArray(p) ? p : []));
        }
        if (rRes.status === 'fulfilled') {
          const r = rRes.value;
          setOrgRecords(r.items || r.data || (Array.isArray(r) ? r : []));
        }
      }
    } catch (err) {
      toast.error('Failed to load performance data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleQuickSubmitRecord = async () => {
    if (!recordToSubmit) return;
    try {
      setIsActing(true);
      await performanceService.submitRecord(recordToSubmit.id, {
        comments: 'Appraisal submitted for manager review.',
      });
      toast.success('Appraisal submitted for manager evaluation!');
      setRecordToSubmit(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit appraisal.');
    } finally {
      setIsActing(false);
    }
  };

  const handleQuickHrApprove = async () => {
    if (!recordToHrApprove) return;
    try {
      setIsActing(true);
      await performanceService.hrApprove(recordToHrApprove.id, {
        comments: 'HR final sign-off authorized.',
      });
      toast.success('Appraisal approved successfully by HR!');
      setRecordToHrApprove(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to authorize HR approval.');
    } finally {
      setIsActing(false);
    }
  };

  // Helper badge variant for performance states
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'RETURNED':
        return 'warning';
      case 'UNDER_REVIEW':
        return 'info';
      case 'SUBMITTED':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  // 1. Employee Columns
  const myColumns = [
    {
      header: 'Review Period',
      render: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block">
            {row.reviewPeriod || row.period?.name || 'Performance Cycle'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {row.recordNumber || row.id}
          </span>
        </div>
      ),
    },
    {
      header: 'Self Rating',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {row.selfRating || row.self_rating ? `${Number(row.selfRating || row.self_rating).toFixed(1)} / 5.0` : '--'}
        </span>
      ),
    },
    {
      header: 'Manager / Final Rating',
      render: (row) => (
        <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {row.rating ? `${Number(row.rating).toFixed(1)} / 5.0` : 'Pending'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => {
        const s = row.status || 'DRAFT';
        return (
          <Badge variant={getStatusBadgeVariant(s)} size="sm">
            {s}
          </Badge>
        );
      },
    },
    {
      header: 'Review Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.reviewDate || (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'N/A')}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {['DRAFT', 'RETURNED'].includes(row.status) && (
            <Button
              size="sm"
              variant="primary"
              icon={Send}
              onClick={() => setRecordToSubmit(row)}
            >
              Submit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => setSelectedRecordId(row.id)}
          >
            Details
          </Button>
        </div>
      ),
    },
  ];

  // 2. Team Columns
  const filteredTeamRecords = teamRecords.filter((rec) => {
    if (teamStatusFilter === 'ALL') return true;
    return rec.status === teamStatusFilter;
  });

  const teamColumns = [
    {
      header: 'Employee',
      render: (row) => {
        const empName = row.employee?.fullName || row.employeeName || 'Team Member';
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
              {empName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-xs">{empName}</p>
              <p className="text-[11px] text-slate-400">
                {row.employee?.designation?.name || row.employee?.department?.name || 'Direct Report'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Period',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.reviewPeriod || row.period?.name || 'Cycle'}
        </span>
      ),
    },
    {
      header: 'Self Rating',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {row.selfRating || row.self_rating ? `${Number(row.selfRating || row.self_rating).toFixed(1)} / 5.0` : 'Not rated'}
        </span>
      ),
    },
    {
      header: 'Manager Rating',
      render: (row) => (
        <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {row.rating ? `${Number(row.rating).toFixed(1)} / 5.0` : 'Pending'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={getStatusBadgeVariant(row.status)} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {['SUBMITTED', 'PENDING'].includes(row.status) && (
            <Button
              size="sm"
              variant="primary"
              icon={Award}
              onClick={() => setReviewingRecord(row)}
            >
              Evaluate
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => setSelectedRecordId(row.id)}
          >
            Review
          </Button>
        </div>
      ),
    },
  ];

  // 3. Cycle Columns
  const cycleColumns = [
    {
      header: 'Cycle Name',
      render: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block">{row.name}</span>
          <span className="font-mono text-[10px] text-slate-400">{row.code}</span>
        </div>
      ),
    },
    {
      header: 'Period Horizon',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.startDate} &rarr; {row.endDate}
        </span>
      ),
    },
    {
      header: 'Type',
      render: (row) => (
        <span className="text-xs font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
          {row.periodType || 'ANNUAL'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
          {row.status}
        </Badge>
      ),
    },
  ];

  // 4. Org Records Columns for HR
  const filteredOrgRecords = orgRecords.filter((rec) => {
    if (orgStatusFilter !== 'ALL' && rec.status !== orgStatusFilter) return false;
    if (orgSearch.trim()) {
      const q = orgSearch.toLowerCase();
      const empName = (rec.employee?.fullName || rec.employeeName || '').toLowerCase();
      const period = (rec.reviewPeriod || '').toLowerCase();
      return empName.includes(q) || period.includes(q);
    }
    return true;
  });

  const orgColumns = [
    {
      header: 'Employee',
      render: (row) => {
        const empName = row.employee?.fullName || row.employeeName || 'Staff Member';
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
              {empName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-xs">{empName}</p>
              <p className="text-[11px] text-slate-400">
                {row.employee?.designation?.name || row.employee?.department?.name || 'Employee'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Period',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.reviewPeriod || row.period?.name || 'Cycle'}
        </span>
      ),
    },
    {
      header: 'Ratings (Self / Final)',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="text-slate-600">{row.selfRating ? `${Number(row.selfRating).toFixed(1)}` : '--'}</span>
          <span className="text-slate-300">/</span>
          <span className="text-brand-600">{row.rating ? `${Number(row.rating).toFixed(1)}` : 'Pending'}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={getStatusBadgeVariant(row.status)} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'UNDER_REVIEW' && (
            <Button
              size="sm"
              variant="success"
              icon={ShieldCheck}
              onClick={() => setRecordToHrApprove(row)}
            >
              Authorize
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => setSelectedRecordId(row.id)}
          >
            Details
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Appraisals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conduct evaluations, track quarterly objectives, and oversee organizational appraisal cycles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={loadData}
          >
            Refresh
          </Button>
          {canGiveAppraisal && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsCreateAppraisalOpen(true)}
            >
              Give Appraisal
            </Button>
          )}
          {isHrOrAdmin && (
            <Button
              variant="secondary"
              icon={Calendar}
              onClick={() => setIsCreatePeriodOpen(true)}
            >
              New Cycle
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'my'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          My Appraisals ({myRecords.length})
        </button>

        {isManager && (
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === 'team'
                ? 'text-brand-600 border-b-2 border-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Star className="w-4 h-4" />
            Team Evaluations ({teamRecords.filter((r) => r.status === 'SUBMITTED').length} Pending)
          </button>
        )}

        {isHrOrAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('cycles')}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === 'cycles'
                ? 'text-brand-600 border-b-2 border-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Appraisal Cycles & Org Records
          </button>
        )}
      </div>

      {/* Tab 1: My Appraisals */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Employee KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Total Appraisals</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">{myRecords.length}</span>
                <Award className="w-6 h-6 text-brand-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Active / In Review</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-amber-600">
                  {myRecords.filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)).length}
                </span>
                <Clock className="w-6 h-6 text-amber-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Approved Reviews</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {myRecords.filter((r) => r.status === 'APPROVED').length}
                </span>
                <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Returned for Revision</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-rose-600">
                  {myRecords.filter((r) => r.status === 'RETURNED').length}
                </span>
                <RotateCcw className="w-6 h-6 text-rose-500 opacity-80" />
              </div>
            </div>
          </div>

          <DataTable
            columns={myColumns}
            data={myRecords}
            isLoading={isLoading}
            emptyTitle="No appraisal records found"
            emptyDescription="You have not received any performance appraisals yet. Your manager or HR will conduct your review during the active appraisal cycle."
          />
        </div>
      )}

      {/* Tab 2: Team Appraisals */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Manager KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Direct Reports Reviews</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">{teamRecords.length}</span>
                <Users className="w-6 h-6 text-brand-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Pending Evaluation</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-brand-600">
                  {teamRecords.filter((r) => ['SUBMITTED', 'PENDING'].includes(r.status)).length}
                </span>
                <Award className="w-6 h-6 text-brand-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Forwarded to HR</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-sky-600">
                  {teamRecords.filter((r) => r.status === 'UNDER_REVIEW').length}
                </span>
                <ShieldCheck className="w-6 h-6 text-sky-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Completed / Approved</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {teamRecords.filter((r) => r.status === 'APPROVED').length}
                </span>
                <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-80" />
              </div>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1 mr-2">
              <Filter className="w-3.5 h-3.5" />
              Filter by Status:
            </span>
            {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'RETURNED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setTeamStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  teamStatusFilter === st
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {st === 'ALL' ? 'All Reviews' : st}
                {st === 'SUBMITTED' && ` (${teamRecords.filter((r) => r.status === 'SUBMITTED').length})`}
              </button>
            ))}
          </div>

          <DataTable
            columns={teamColumns}
            data={filteredTeamRecords}
            isLoading={isLoading}
            emptyTitle="No team appraisals found"
            emptyDescription="No direct report appraisals currently match this filter criteria."
          />
        </div>
      )}

      {/* Tab 3: Cycles & Org Appraisals */}
      {activeTab === 'cycles' && (
        <div className="space-y-6">
          {/* HR KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Active Review Cycles</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  {periods.filter((p) => p.status === 'ACTIVE').length}
                </span>
                <Calendar className="w-6 h-6 text-brand-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Total Org Records</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900">{orgRecords.length}</span>
                <Award className="w-6 h-6 text-slate-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Awaiting HR Sign-Off</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-amber-600">
                  {orgRecords.filter((r) => r.status === 'UNDER_REVIEW').length}
                </span>
                <ShieldCheck className="w-6 h-6 text-amber-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Finalized & Approved</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {orgRecords.filter((r) => r.status === 'APPROVED').length}
                </span>
                <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-80" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Appraisal Review Cycles ({periods.length})
            </h3>
            <DataTable
              columns={cycleColumns}
              data={periods}
              isLoading={isLoading}
              emptyTitle="No review periods configured"
              emptyDescription="Establish a new review period to start organization-wide appraisals."
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Organization Appraisal Records ({filteredOrgRecords.length})
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employee or period..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  />
                </div>
                <select
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="RETURNED">RETURNED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>

            <DataTable
              columns={orgColumns}
              data={filteredOrgRecords}
              isLoading={isLoading}
              emptyTitle="No organization appraisals"
              emptyDescription="No records matching organization scope or search filter."
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateAppraisalModal
        isOpen={isCreateAppraisalOpen}
        onClose={() => setIsCreateAppraisalOpen(false)}
        onSuccess={loadData}
      />

      <CreatePeriodModal
        isOpen={isCreatePeriodOpen}
        onClose={() => setIsCreatePeriodOpen(false)}
        onSuccess={loadData}
      />

      <ManagerReviewModal
        isOpen={Boolean(reviewingRecord)}
        onClose={() => setReviewingRecord(null)}
        onSuccess={loadData}
        record={reviewingRecord}
        currentUser={user}
      />

      <AppraisalDetailModal
        isOpen={Boolean(selectedRecordId)}
        onClose={() => setSelectedRecordId(null)}
        recordId={selectedRecordId}
        onUpdate={loadData}
        onOpenReviewModal={(rec) => setReviewingRecord(rec)}
      />

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={Boolean(recordToSubmit)}
        onClose={() => setRecordToSubmit(null)}
        onConfirm={handleQuickSubmitRecord}
        title="Submit Self-Appraisal for Review"
        message={`Are you sure you want to submit your appraisal for "${recordToSubmit?.reviewPeriod || 'Review Cycle'}" to your manager? Once submitted, it cannot be modified until reviewed or returned.`}
        confirmText="Submit for Review"
        cancelText="Cancel"
        variant="primary"
        isLoading={isActing}
      />

      <ConfirmDialog
        isOpen={Boolean(recordToHrApprove)}
        onClose={() => setRecordToHrApprove(null)}
        onConfirm={handleQuickHrApprove}
        title="Authorize HR Approval"
        message={`Authorize final HR approval for ${recordToHrApprove?.employee?.fullName || recordToHrApprove?.employeeName || 'employee'}'s appraisal for ${recordToHrApprove?.reviewPeriod || 'period'}? This completes the evaluation.`}
        confirmText="Authorize & Complete"
        cancelText="Cancel"
        variant="primary"
        isLoading={isActing}
      />
    </div>
  );
};
