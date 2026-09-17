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
  Edit,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { performanceService } from '../../services/performanceService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { CreateAppraisalModal } from '../../components/performance/CreateAppraisalModal.jsx';
import { ManagerReviewModal } from '../../components/performance/ManagerReviewModal.jsx';
import { CreatePeriodModal } from '../../components/performance/CreatePeriodModal.jsx';
import { AppraisalDetailModal } from '../../components/performance/AppraisalDetailModal.jsx';

export const PerformancePage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const isManager = hasRole('Manager') || hasRole('Admin') || hasRole('SuperAdmin') || hasRole('OrgAdmin');
  const isHrOrAdmin = hasRole('HR') || hasRole('HRManager') || hasRole('Admin') || hasRole('SuperAdmin') || hasRole('OrgAdmin');

  // Active Tab: 'my' | 'team' | 'cycles'
  const [activeTab, setActiveTab] = useState('my');
  const [myRecords, setMyRecords] = useState([]);
  const [teamRecords, setTeamRecords] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [orgRecords, setOrgRecords] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isCreateAppraisalOpen, setIsCreateAppraisalOpen] = useState(false);
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);

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
      toast.error(`Failed to load performance data.`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const myColumns = [
    {
      header: 'Review Period',
      render: (row) => (
        <span className="font-semibold text-xs text-slate-800">
          {row.reviewPeriod || row.period?.name || 'Performance Cycle'}
        </span>
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
      header: 'Final Rating',
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
          <Badge
            variant={
              s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : s === 'UNDER_REVIEW' ? 'info' : 'warning'
            }
            size="sm"
          >
            {s}
          </Badge>
        );
      },
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={Eye}
          onClick={() => setSelectedRecordId(row.id)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const teamColumns = [
    {
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center text-xs">
            {(row.employee?.fullName || row.employeeName || 'E').charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-xs">
              {row.employee?.fullName || row.employeeName || 'Team Member'}
            </p>
            <p className="text-[11px] text-slate-400">{row.employee?.designation?.name || 'Staff'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Period',
      render: (row) => (
        <span className="text-xs text-slate-700">
          {row.reviewPeriod || row.period?.name || 'Cycle'}
        </span>
      ),
    },
    {
      header: 'Self Rating',
      render: (row) => (
        <span className="text-xs font-medium text-slate-600">
          {row.selfRating || row.self_rating ? `${Number(row.selfRating || row.self_rating).toFixed(1)}/5.0` : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'APPROVED' ? 'success' : row.status === 'UNDER_REVIEW' ? 'info' : 'warning'
          }
          size="sm"
        >
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

  const cycleColumns = [
    {
      header: 'Cycle Name',
      render: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-800 block">{row.name}</span>
          <span className="font-mono text-[10px] text-slate-400">{row.code}</span>
        </div>
      ),
    },
    {
      header: 'Time Horizon',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.startDate} &rarr; {row.endDate}
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Performance & Appraisals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conduct 360 evaluations, manage performance cycles, and track quarterly objectives.
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
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setIsCreateAppraisalOpen(true)}
          >
            Submit Self-Appraisal
          </Button>
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
        <div className="space-y-4">
          <DataTable
            columns={myColumns}
            data={myRecords}
            isLoading={isLoading}
            emptyTitle="No appraisal records found"
            emptyDescription="You have not submitted any self-appraisal evaluations yet. Click 'Submit Self-Appraisal' to get started."
          />
        </div>
      )}

      {/* Tab 2: Team Appraisals */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <DataTable
            columns={teamColumns}
            data={teamRecords}
            isLoading={isLoading}
            emptyTitle="No team reviews awaiting evaluation"
            emptyDescription="All direct reports' appraisal submissions are currently reviewed or up-to-date."
          />
        </div>
      )}

      {/* Tab 3: Cycles & Org Appraisals */}
      {activeTab === 'cycles' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Active & Scheduled Review Cycles ({periods.length})
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
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Organization Appraisal Records ({orgRecords.length})
            </h3>
            <DataTable
              columns={teamColumns}
              data={orgRecords}
              isLoading={isLoading}
              emptyTitle="No organization appraisals"
              emptyDescription="No records matching organization scope."
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
      />
    </div>
  );
};
