import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { leaveService } from '../../services/leaveService.js';
import { ApplyLeaveModal } from '../../components/leave/ApplyLeaveModal.jsx';
import { LeaveBalanceCards } from '../../components/leave/LeaveBalanceCards.jsx';
import { ApproveLeaveModal } from '../../components/leave/ApproveLeaveModal.jsx';
import { RejectLeaveModal } from '../../components/leave/RejectLeaveModal.jsx';
import { LeaveDetailModal } from '../../components/leave/LeaveDetailModal.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Alert } from '../../components/common/Alert.jsx';

export const LeaveManagementPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();

  const canApply = hasPermission('leave:write');
  const canApprove = hasPermission('leave:approve');
  const canViewTeam = hasRole(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);

  // Active Tab: 'my' | 'team'
  const [activeTab, setActiveTab] = useState('my');

  // Leave data
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balanceError, setBalanceError] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);
  const [approvingRecord, setApprovingRecord] = useState(null);
  const [rejectingRecord, setRejectingRecord] = useState(null);

  // Cancellation Modal state
  const [cancellingRecord, setCancellingRecord] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

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
  }, [fetchMetadata]);

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  // Handle successful application
  const handleApplySuccess = () => {
    toast.success('Leave application submitted successfully! Status: PENDING.');
    fetchMetadata();
    fetchRecords(1);
  };

  // Handle successful approve/reject
  const handleActionSuccess = () => {
    fetchMetadata();
    fetchRecords(pagination?.page || 1);
  };

  // Handle Cancel Leave
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

  // Columns definition
  const columns = [
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
    ...(activeTab !== 'my'
      ? [
          {
            header: 'Employee',
            key: 'employee',
            render: (row) => {
              const isSelfRow =
                (user?.email && row.employee?.email === user.email) ||
                (user?.employeeId && row.employeeId === user.employeeId) ||
                (user?.id && row.employee?.userId === user.id);

              return (
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>
                      {row.employee?.firstName} {row.employee?.lastName}
                    </span>
                    {isSelfRow && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 font-normal">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <span>{row.employee?.employeeCode}</span>
                    {row.employee?.departmentName && (
                      <>
                        <span>•</span>
                        <span>{row.employee.departmentName}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            },
          },
        ]
      : []),
    {
      header: 'Duration & Dates',
      key: 'dates',
      render: (row) => {
        const startStr = row.startDate
          ? new Date(row.startDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '';
        const endStr = row.endDate
          ? new Date(row.endDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '';

        return (
          <div>
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>{startStr}</span>
              {!row.isHalfDay && startStr !== endStr && <span>→ {endStr}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              <span className="font-bold text-brand-600">
                {row.totalDays} {row.totalDays === 1 ? 'day' : 'days'}
              </span>
              {row.isHalfDay && (
                <span className="ml-1 text-amber-600 font-medium">
                  ({row.halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'})
                </span>
              )}
            </div>
          </div>
        );
      },
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
      header: 'Status',
      key: 'status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Actions',
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
            {/* View Details Button */}
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => setSelectedDetailRecord(row)}
              title="View full request details"
            />

            {/* Employee cancel own pending */}
            {activeTab === 'my' && isPending && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setCancellingRecord(row)}
                title="Cancel Leave Request"
              >
                Cancel
              </Button>
            )}

            {/* Manager/HR Approve & Reject on Team / Org tabs */}
            {activeTab !== 'my' && canApprove && isPending && (
              <>
                {isSelfRow ? (
                  <span
                    className="text-[11px] text-slate-400 italic px-2 py-1"
                    title="Self-approval violation: You cannot approve your own leave request."
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
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      icon={XCircle}
                      onClick={() => setRejectingRecord(row)}
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

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending' },
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
            {activeTab === 'team'
              ? 'Team Leave Approvals'
              : 'Leave Applications'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            {activeTab === 'team'
              ? 'Review, approve, or reject authorized team leave applications with real-time balance checks.'
              : 'Apply for annual, sick, or casual leaves, track status, and view available entitlement balances.'}
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
            }}
          >
            Refresh
          </Button>

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

      {/* Leave Balances Display (Prompt 5: Using ONLY data provided by backend) */}
      <LeaveBalanceCards
        balances={leaveBalances}
        isLoading={loadingBalances}
        error={balanceError}
        onApplyClick={() => setIsApplyModalOpen(true)}
        canApply={canApply}
      />

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
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
              onClick={() => setActiveTab('team')}
              className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'border-brand-500 text-brand-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Requests</span>
            </button>
          )}
        </nav>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>
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
          Showing {records.length} {records.length === 1 ? 'record' : 'records'}
          {pagination?.total ? ` of ${pagination.total}` : ''}
        </div>
      </div>

      {/* Main Leave Table */}
      <DataTable
        columns={columns}
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
            ? 'There are no pending or historic leave requests from your authorized team members.'
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
    </div>
  );
};
