import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  UserCheck,
  Users,
  Calendar,
  Filter,
  RotateCcw,
  Sparkles,
  Eye,
  AlertTriangle,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { leaveService } from '../../services/leaveService.js';
import { managerService } from '../../services/managerService.js';
import { ApplyLeaveModal } from '../../components/leave/ApplyLeaveModal.jsx';
import { LeaveBalanceCards } from '../../components/leave/LeaveBalanceCards.jsx';
import { ApproveLeaveModal } from '../../components/leave/ApproveLeaveModal.jsx';
import { RejectLeaveModal } from '../../components/leave/RejectLeaveModal.jsx';
import { LeaveDetailModal } from '../../components/leave/LeaveDetailModal.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Alert } from '../../components/common/Alert.jsx';

export const LeaveManagementPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canApply = hasPermission('leave:write');
  const canApprove = hasPermission('leave:approve') || hasRole(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);
  const canViewTeam = hasRole(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);
  const canManageTypes = hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  // Active Tab: 'my' | 'team' (synced with ?tab= query param)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    (tabParam === 'team' || tabParam === 'approvals') && canViewTeam ? 'team' : 'my'
  );

  // Leave data
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balanceError, setBalanceError] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Team summary metrics for managers
  const [teamStats, setTeamStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    onLeaveToday: 0,
  });

  // Status Filter
  const [statusFilter, setStatusFilter] = useState(
    (tabParam === 'team' || tabParam === 'approvals') ? 'PENDING' : ''
  );

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);
  const [approvingRecord, setApprovingRecord] = useState(null);
  const [rejectingRecord, setRejectingRecord] = useState(null);

  // Cancellation Modal state (for employee withdrawing own request)
  const [cancellingRecord, setCancellingRecord] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Add Leave Category Modal (Admin/HR)
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeDays, setNewTypeDays] = useState(0);
  const [newTypeGender, setNewTypeGender] = useState('ALL');
  const [newTypeLoading, setNewTypeLoading] = useState(false);
  const [newTypeError, setNewTypeError] = useState(null);

  const handleCreateLeaveType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      setNewTypeError('Leave category name is required.');
      return;
    }
    try {
      setNewTypeLoading(true);
      setNewTypeError(null);
      await leaveService.createLeaveType({
        name: newTypeName.trim(),
        code: (newTypeCode.trim() || newTypeName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 4)).toUpperCase(),
        description: newTypeDesc.trim(),
        daysPerYear: parseFloat(newTypeDays) || 0,
        genderEligibility: newTypeGender,
        isPaid: true,
        requiresApproval: true,
      });
      await fetchMetadata();
      setIsAddTypeModalOpen(false);
      setNewTypeName('');
      setNewTypeCode('');
      setNewTypeDesc('');
      setNewTypeDays(0);
      setNewTypeGender('ALL');
      toast?.success?.(`Leave category "${newTypeName.trim()}" added successfully!`);
    } catch (err) {
      setNewTypeError(err.message || 'Failed to create leave category.');
    } finally {
      setNewTypeLoading(false);
    }
  };

  // Synchronize tab changes with URL search params
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
    // Default team view to PENDING for fast approval actioning
    if (newTab === 'team') {
      setStatusFilter('PENDING');
    } else {
      setStatusFilter('');
    }
  };

  // Fetch Leave Types and Balances directly from backend API
  const fetchMetadata = useCallback(async () => {
    try {
      setLoadingBalances(true);
      setBalanceError(null);
      const [types, balances] = await Promise.all([
        leaveService.getLeaveTypes(),
        leaveService.getMyBalances(),
      ]);
      setLeaveTypes(types || []);
      setLeaveBalances(balances || []);
    } catch (err) {
      setBalanceError(err.message || 'Failed to load leave balances from backend.');
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  // Fetch Team KPI stats for manager
  const fetchTeamStats = useCallback(async () => {
    if (!canViewTeam) return;
    try {
      const [leavesRes, summaryRes] = await Promise.allSettled([
        managerService.getTeamLeaves(),
        managerService.getTeamSummary(),
      ]);

      const items = leavesRes.status === 'fulfilled'
        ? (leavesRes.value?.items || leavesRes.value?.data || (Array.isArray(leavesRes.value) ? leavesRes.value : []))
        : [];
      const summary = summaryRes.status === 'fulfilled'
        ? summaryRes.value || {}
        : {};

      const pending = items.filter((l) => (l.status || '').toUpperCase() === 'PENDING').length;
      const approved = items.filter((l) => (l.status || '').toUpperCase() === 'APPROVED').length;
      const rejected = items.filter((l) => (l.status || '').toUpperCase() === 'REJECTED').length;
      const onLeaveToday = summary.onLeaveToday || 0;

      setTeamStats({ pending, approved, rejected, onLeaveToday });
    } catch {
      // Non-blocking
    }
  }, [canViewTeam]);

  // Fetch Leave Records
  const fetchRecords = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === 'my') {
          const res = await leaveService.getMyLeaves({
            status: statusFilter,
            page,
            limit: 15,
          });
          setRecords(res.records || []);
          setPagination(res.pagination || null);
        } else if (activeTab === 'team') {
          const res = await leaveService.getTeamLeaves({
            status: statusFilter,
            page,
            limit: 15,
          });
          setRecords(res.records || []);
          setPagination(res.pagination || null);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch leave records.');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, statusFilter]
  );

  useEffect(() => {
    fetchMetadata();
    if (canViewTeam) {
      fetchTeamStats();
    }
  }, [fetchMetadata, fetchTeamStats, canViewTeam]);

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  // Handle successful application
  const handleApplySuccess = () => {
    toast.success('Leave application submitted successfully! Status: PENDING.');
    fetchMetadata();
    fetchRecords(1);
    fetchTeamStats();
  };

  // Handle successful approve/reject
  const handleActionSuccess = () => {
    fetchMetadata();
    fetchRecords(pagination?.page || 1);
    fetchTeamStats();
  };

  // Handle Cancel Leave (Employee own pending request)
  const handleConfirmCancel = async () => {
    if (!cancellingRecord) return;
    try {
      setIsSubmittingCancel(true);
      await leaveService.cancelLeave(cancellingRecord.id, {
        cancellationReason: cancelReason.trim() || undefined,
      });
      toast.success('Leave request cancelled successfully.');
      setCancellingRecord(null);
      setCancelReason('');
      fetchMetadata();
      fetchRecords(pagination?.page || 1);
      fetchTeamStats();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel leave request.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-600/10">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            PENDING
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-600/10">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            APPROVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-rose-600/10">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            REJECTED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3.5 h-3.5 text-slate-500" />
            CANCELLED
          </span>
        );
      default:
        return <Badge variant="neutral">{status || '—'}</Badge>;
    }
  };

  // =========================================================================
  // Columns for Team Leave Approvals (Manager Scope)
  // Displaying all 8 mandatory fields: Employee, Leave type, Start date,
  // End date, Duration, Reason, Current status, Submitted date
  // =========================================================================
  const teamColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (row) => {
        const isSelfRow =
          (user?.email && row.employee?.email === user.email) ||
          (user?.employeeId && row.employeeId === user.employeeId) ||
          (user?.id && row.employee?.userId === user.id);

        const initials = `${row.employee?.firstName?.[0] || 'E'}${row.employee?.lastName?.[0] || ''}`;

        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {initials}
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>
                  {row.employee?.firstName} {row.employee?.lastName}
                </span>
                {isSelfRow && (
                  <span
                    className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 font-semibold"
                    title="Self-approval forbidden: A supervisor or HR must approve your request"
                  >
                    You (Self)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="font-mono">{row.employee?.employeeCode || '—'}</span>
                {row.employee?.departmentName && (
                  <>
                    <span>•</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                      {row.employee.departmentName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Leave Type',
      key: 'leaveType',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">
            {row.leaveType?.name || 'Leave'}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
              {row.leaveType?.code || 'LEAVE'}
            </span>
            {row.leaveType?.isPaid !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  row.leaveType.isPaid
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-50 text-slate-500'
                }`}
              >
                {row.leaveType.isPaid ? 'Paid' : 'Unpaid'}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Start Date',
      key: 'startDate',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.startDate
            ? new Date(row.startDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      header: 'End Date',
      key: 'endDate',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.endDate
            ? new Date(row.endDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      header: 'Duration',
      key: 'duration',
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-brand-700">
            {row.totalDays} {row.totalDays === 1 ? 'day' : 'days'}
          </span>
          {row.isHalfDay && (
            <span className="block text-[10px] font-medium text-amber-600">
              {row.halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Reason',
      key: 'reason',
      render: (row) => (
        <div className="max-w-xs truncate text-xs text-slate-700" title={row.reason}>
          {row.reason || <span className="text-slate-400 italic">None provided</span>}
        </div>
      ),
    },
    {
      header: 'Current Status',
      key: 'status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Submitted Date',
      key: 'submittedDate',
      render: (row) => {
        const d = row.appliedDate || row.createdAt;
        return (
          <span className="text-xs text-slate-500 font-medium">
            {d
              ? new Date(d).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent'}
          </span>
        );
      },
    },
    {
      header: 'Manager Actions',
      key: 'actions',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => {
        const isPending = (row.status || '').toUpperCase() === 'PENDING';
        const isSelfRow =
          (user?.email && row.employee?.email === user.email) ||
          (user?.employeeId && row.employeeId === user.employeeId) ||
          (user?.id && row.employee?.userId === user.id);

        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* View Details Modal Trigger */}
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => setSelectedDetailRecord(row)}
              title="View complete leave details"
            />

            {/* Manager Approve / Reject Actions (Strictly gated to pending & non-self) */}
            {canApprove && isPending && (
              <>
                {isSelfRow ? (
                  <span
                    className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 italic"
                    title="Self-approval restriction: You cannot approve or reject your own leave request."
                  >
                    Self-request
                  </span>
                ) : (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      icon={CheckCircle2}
                      onClick={() => setApprovingRecord(row)}
                      title="Approve leave request"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      icon={XCircle}
                      onClick={() => setRejectingRecord(row)}
                      title="Reject leave request"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  // =========================================================================
  // Columns for Employee's Own Leave History
  // (Standard employee sees only own requests & cancellation, no manager actions)
  // =========================================================================
  const myColumns = [
    {
      header: 'Leave Type',
      key: 'leaveType',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900">{row.leaveType?.name || 'Leave'}</div>
          <div className="text-[11px] text-slate-400 font-semibold">{row.leaveType?.code}</div>
        </div>
      ),
    },
    {
      header: 'Start Date',
      key: 'startDate',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.startDate
            ? new Date(row.startDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      header: 'End Date',
      key: 'endDate',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.endDate
            ? new Date(row.endDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      header: 'Duration',
      key: 'duration',
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-brand-600">
            {row.totalDays} {row.totalDays === 1 ? 'day' : 'days'}
          </span>
          {row.isHalfDay && (
            <span className="block text-[10px] font-medium text-amber-600">
              {row.halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Reason',
      key: 'reason',
      render: (row) => (
        <div className="max-w-xs truncate text-xs text-slate-700" title={row.reason}>
          {row.reason || '—'}
        </div>
      ),
    },
    {
      header: 'Current Status',
      key: 'status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Submitted Date',
      key: 'submittedDate',
      render: (row) => {
        const d = row.appliedDate || row.createdAt;
        return (
          <span className="text-xs text-slate-500 font-medium">
            {d
              ? new Date(d).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent'}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => {
        const isPending = (row.status || '').toUpperCase() === 'PENDING';

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => setSelectedDetailRecord(row)}
              title="View request details"
            />

            {/* Employee can cancel own pending request */}
            {isPending && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setCancellingRecord(row)}
                title="Cancel Leave Request"
              >
                Cancel
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending Approvals' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Time Off & Leave Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {activeTab === 'team' ? 'Manager Leave Approvals' : 'Leave Applications'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            {activeTab === 'team'
              ? 'Review, approve, or reject authorized pending leave requests from your reporting team.'
              : 'Apply for annual, sick, or casual leaves, monitor request progress, and track entitlement balances.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={() => {
              fetchMetadata();
              fetchRecords(pagination?.page || 1);
              if (canViewTeam) fetchTeamStats();
            }}
          >
            Refresh
          </Button>

          {canManageTypes && (
            <Button
              variant="outline"
              size="md"
              icon={Plus}
              onClick={() => setIsAddTypeModalOpen(true)}
            >
              Add Leave Category
            </Button>
          )}

          {canViewTeam && (
            <Button
              variant="outline"
              size="md"
              icon={ShieldCheck}
              onClick={() => setIsApplyModalOpen(true)}
              className="border-brand-200 bg-brand-50/70 text-brand-700 hover:bg-brand-100"
            >
              Grant Team Leave
            </Button>
          )}

          {canApply && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsApplyModalOpen(true)}
              className="shadow-md shadow-brand-500/20"
            >
              Apply for Leave
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (Employee sees only 'My Leaves'; Manager/HR sees both) */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => handleTabChange('my')}
            className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'my'
                ? 'border-brand-500 text-brand-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>My Leave Requests</span>
          </button>

          {canViewTeam && (
            <button
              type="button"
              onClick={() => handleTabChange('team')}
              className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'border-brand-500 text-brand-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Leave Approvals</span>
              {teamStats.pending > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  {teamStats.pending} pending
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* When on My Tab: Show Personal Leave Balances Display */}
      {activeTab === 'my' && (
        <LeaveBalanceCards
          balances={leaveBalances}
          isLoading={loadingBalances}
          error={balanceError}
          onApplyClick={() => setIsApplyModalOpen(true)}
          canApply={canApply}
        />
      )}

      {/* When on Team Tab: Show Real-time Manager KPI Counters */}
      {activeTab === 'team' && canViewTeam && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Pending Reviews
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.pending}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Approved Leaves
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.approved}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Rejected Requests
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.rejected}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                On Leave Today
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.onLeaveToday}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar & Quick Status Pills */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2.5">
          {activeTab === 'team' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Pending Approvals ({teamStats.pending})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  statusFilter === ''
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Team Requests
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('APPROVED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  statusFilter === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  statusFilter === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Rejected
              </button>
            </div>
          ) : (
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={statusOptions}
              />
            </div>
          )}

          {statusFilter && (
            <Button
              variant="secondary"
              size="md"
              icon={RotateCcw}
              onClick={() => setStatusFilter('')}
            >
              Reset
            </Button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {records.length} {records.length === 1 ? 'request' : 'requests'}
          {pagination?.total ? ` of ${pagination.total}` : ''}
        </div>
      </div>

      {/* Main Leave Table (Team columns for managers, My columns for employees) */}
      <DataTable
        columns={activeTab === 'team' ? teamColumns : myColumns}
        data={records}
        isLoading={loading}
        error={error}
        emptyTitle={
          activeTab === 'team'
            ? 'No Team Requests Found'
            : 'No Leave Requests Found'
        }
        emptyDescription={
          activeTab === 'team'
            ? 'There are no pending or historic leave requests matching this filter from your authorized team members.'
            : 'You have not submitted any leave requests matching the current filter.'
        }
        pagination={pagination}
        onPageChange={(p) => fetchRecords(p)}
      />

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={handleApplySuccess}
        leaveTypes={leaveTypes}
        leaveBalances={leaveBalances}
      />

      {/* Manager Approve Leave Modal */}
      <ApproveLeaveModal
        isOpen={Boolean(approvingRecord)}
        onClose={() => setApprovingRecord(null)}
        onSuccess={handleActionSuccess}
        leaveRecord={approvingRecord}
        currentUser={user}
      />

      {/* Manager Reject Leave Modal (with mandatory rejection reason) */}
      <RejectLeaveModal
        isOpen={Boolean(rejectingRecord)}
        onClose={() => setRejectingRecord(null)}
        onSuccess={handleActionSuccess}
        leaveRecord={rejectingRecord}
        currentUser={user}
      />

      {/* Leave Detail Modal */}
      <LeaveDetailModal
        isOpen={Boolean(selectedDetailRecord)}
        onClose={() => setSelectedDetailRecord(null)}
        leaveRecord={selectedDetailRecord}
        canApprove={canApprove}
        onApproveClick={(rec) => setApprovingRecord(rec)}
        onRejectClick={(rec) => setRejectingRecord(rec)}
        onCancelClick={(rec) => setCancellingRecord(rec)}
        currentUser={user}
      />

      {/* Cancel Leave Confirmation Modal (for employees) */}
      <Modal
        isOpen={Boolean(cancellingRecord)}
        onClose={() => setCancellingRecord(null)}
        title="Cancel Leave Request"
        subtitle="Withdraw your pending time off request"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to cancel your pending leave request for{' '}
            <strong className="text-slate-900">
              {cancellingRecord?.leaveType?.name}
            </strong>{' '}
            ({cancellingRecord?.totalDays} {cancellingRecord?.totalDays === 1 ? 'day' : 'days'})?
            This will release the reserved balance back to your available entitlement.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Remarks (Optional)
            </label>
            <Input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Plans changed or rescheduled meeting"
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCancellingRecord(null)}
              disabled={isSubmittingCancel}
            >
              Keep Request
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isSubmittingCancel}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Leave Category Modal (Admin/HR) */}
      <Modal
        isOpen={isAddTypeModalOpen}
        onClose={() => setIsAddTypeModalOpen(false)}
        title="Add New Leave Category"
        subtitle="Define a new company leave type, default annual days, and approval policy."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateLeaveType} className="space-y-4">
          {newTypeError && (
            <Alert variant="danger" dismissible onDismiss={() => setNewTypeError(null)}>
              {newTypeError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Bereavement Leave"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category Code <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                placeholder="e.g. BL"
                value={newTypeCode}
                onChange={(e) => setNewTypeCode(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Days / Year <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                max="365"
                step="0.5"
                value={newTypeDays}
                onChange={(e) => setNewTypeDays(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Gender Eligibility
            </label>
            <select
              value={newTypeGender}
              onChange={(e) => setNewTypeGender(e.target.value)}
              className="block w-full rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Employees (Male & Female)</option>
              <option value="FEMALE">Female Employees Only (e.g. Maternity)</option>
              <option value="MALE">Male Employees Only (e.g. Paternity)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="Brief description of when this leave is applicable..."
              value={newTypeDesc}
              onChange={(e) => setNewTypeDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsAddTypeModalOpen(false)}
              disabled={newTypeLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={newTypeLoading}
              icon={Plus}
            >
              Add Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeaveManagementPage;
