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
  Search,
  PieChart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { leaveService } from '../../services/leaveService.js';
import { managerService } from '../../services/managerService.js';
import { ApplyLeaveModal } from '../../components/leave/ApplyLeaveModal.jsx';
import { LeaveBalanceCards } from '../../components/leave/LeaveBalanceCards.jsx';
import { ApproveLeaveModal } from '../../components/leave/ApproveLeaveModal.jsx';
import { RejectLeaveModal } from '../../components/leave/RejectLeaveModal.jsx';
import { Avatar } from '../../components/common/Avatar.jsx';
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

  const normRole = (user?.roleName || '').toLowerCase();
  const isAdminOrCeo = ['admin', 'superadmin', 'orgadmin'].some(r => normRole.includes(r)) || user?.email === 'sheetalbedi@tasknera.com';

  const canApply = hasPermission('leave:write') && !isAdminOrCeo;
  const canApprove = hasPermission('leave:approve') || hasRole(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);
  const canViewTeam = hasRole(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']);
  const canManageTypes = hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);
  const canViewAllBalances = hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']) || isAdminOrCeo;

  // Active Tab: 'my' | 'team' | 'balances' (synced with ?tab= query param)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'balances' && canViewAllBalances
      ? 'balances'
      : isAdminOrCeo
      ? 'team'
      : ((tabParam === 'team' || tabParam === 'approvals') && canViewTeam ? 'team' : 'my')
  );

  // Admin & HR: Employee Leave Balances Viewing
  const [allEmployeesBalances, setAllEmployeesBalances] = useState([]);
  const [loadingAllBalances, setLoadingAllBalances] = useState(false);
  const [balanceSearchTerm, setBalanceSearchTerm] = useState('');
  const [selectedBalanceEmpId, setSelectedBalanceEmpId] = useState('');
  const [selectedEmpBalances, setSelectedEmpBalances] = useState([]);
  const [loadingSelectedEmpBalances, setLoadingSelectedEmpBalances] = useState(false);

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
    searchParams.get('status') || ''
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
    if (isAdminOrCeo && newTab === 'my') return;
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
    setStatusFilter('');
  };

  // Fetch Leave Types and Balances directly from backend API
  const fetchMetadata = useCallback(async () => {
    try {
      setLoadingBalances(true);
      setBalanceError(null);

      if (isAdminOrCeo) {
        const types = await leaveService.getLeaveTypes();
        setLeaveTypes(types || []);
        setLeaveBalances([]);
        setLoadingBalances(false);
        return;
      }

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
  }, [isAdminOrCeo]);

  // Fetch Team KPI stats directly matching leave requests scope
  const fetchTeamStats = useCallback(async () => {
    if (!canViewTeam) return;
    try {
      const stats = await leaveService.getTeamLeaveStats();
      if (stats) {
        setTeamStats({
          pending: stats.pending || 0,
          approved: stats.approved || 0,
          rejected: stats.rejected || 0,
          cancelled: stats.cancelled || 0,
          total: stats.total || 0,
          onLeaveToday: stats.onLeaveToday || 0,
        });
      }
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

  // Fetch all employees' balances for Admin & HR
  const fetchAllEmployeesBalances = useCallback(async () => {
    if (!canViewAllBalances) return;
    try {
      setLoadingAllBalances(true);
      const data = await leaveService.getAllEmployeeBalances();
      const list = Array.isArray(data) ? data : [];
      setAllEmployeesBalances(list);
      if (list.length > 0 && !selectedBalanceEmpId) {
        setSelectedBalanceEmpId(list[0].employeeId || list[0].id);
      }
    } catch (err) {
      console.error('Failed to load all employees balances:', err);
    } finally {
      setLoadingAllBalances(false);
    }
  }, [canViewAllBalances, selectedBalanceEmpId]);

  // Fetch balances for specifically selected employee
  const fetchSelectedEmpBalances = useCallback(async (empId) => {
    if (!empId) return;
    try {
      setLoadingSelectedEmpBalances(true);
      const balances = await leaveService.getEmployeeBalances(empId);
      setSelectedEmpBalances(Array.isArray(balances) ? balances : []);
    } catch (err) {
      console.error('Failed to load selected employee balances:', err);
      const found = allEmployeesBalances.find((e) => (e.employeeId || e.id) === empId);
      setSelectedEmpBalances(found?.balances || []);
    } finally {
      setLoadingSelectedEmpBalances(false);
    }
  }, [allEmployeesBalances]);

  useEffect(() => {
    fetchMetadata();
    if (canViewTeam) {
      fetchTeamStats();
    }
    if (canViewAllBalances) {
      fetchAllEmployeesBalances();
    }
  }, [fetchMetadata, fetchTeamStats, fetchAllEmployeesBalances, canViewTeam, canViewAllBalances]);

  useEffect(() => {
    if (selectedBalanceEmpId) {
      fetchSelectedEmpBalances(selectedBalanceEmpId);
    }
  }, [selectedBalanceEmpId, fetchSelectedEmpBalances]);

  useEffect(() => {
    if (activeTab === 'my' || activeTab === 'team') {
      fetchRecords(1);
    }
  }, [fetchRecords, activeTab]);

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
            <Avatar
              src={row.employee?.avatarUrl || row.avatarUrl}
              firstName={row.employee?.firstName}
              lastName={row.employee?.lastName}
              name={row.employeeName}
              size="md"
              className="ring-1 ring-slate-200"
            />
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

  const filteredEmployeesForBalances = (allEmployeesBalances || []).filter((emp) => {
    const q = balanceSearchTerm.toLowerCase();
    const name = (emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase();
    const code = (emp.employeeCode || '').toLowerCase();
    const dept = (emp.departmentName || '').toLowerCase();
    return name.includes(q) || code.includes(q) || dept.includes(q);
  });

  const selectedBalanceEmpObj = (allEmployeesBalances || []).find(
    (e) => (e.employeeId || e.id) === selectedBalanceEmpId
  );

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
            {activeTab === 'balances'
              ? 'Employee Leave Balances & Buckets'
              : isAdminOrCeo
              ? 'Organization Leave Management & Approvals'
              : activeTab === 'team'
              ? 'Manager Leave Approvals'
              : 'Leave Applications'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            {activeTab === 'balances'
              ? 'View category-wise remaining leave balances and quota allocations for all employees across the organization.'
              : isAdminOrCeo
              ? 'Executive oversight and approval authority for all organizational employee leave requests.'
              : activeTab === 'team'
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
              if (activeTab === 'balances') {
                fetchAllEmployeesBalances();
                if (selectedBalanceEmpId) fetchSelectedEmpBalances(selectedBalanceEmpId);
              } else {
                fetchRecords(pagination?.page || 1);
                if (canViewTeam) fetchTeamStats();
              }
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

          {canViewTeam && !isAdminOrCeo && (
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

      {/* Navigation Tabs (Employee sees only 'My Leaves'; Manager/HR sees both; Admin/CEO sees 'Organization Leave Approvals') */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          {!isAdminOrCeo && (
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
          )}

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
              <span>{isAdminOrCeo ? 'Organization Leave Approvals' : 'Team Leave Approvals'}</span>
              {teamStats.pending > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  {teamStats.pending} pending
                </span>
              )}
            </button>
          )}

          {canViewAllBalances && (
            <button
              type="button"
              onClick={() => handleTabChange('balances')}
              className={`pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'balances'
                  ? 'border-brand-500 text-brand-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Employee Leave Balances</span>
              {allEmployeesBalances.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {allEmployeesBalances.length}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* When on My Tab: Show Personal Leave Balances Display */}
      {activeTab === 'my' && !isAdminOrCeo && (
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
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-sm'
                : 'bg-white border-slate-200/80 hover:border-amber-200 hover:bg-amber-50/30'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Pending Reviews
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.pending}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? '' : 'APPROVED')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-white border-slate-200/80 hover:border-emerald-200 hover:bg-emerald-50/30'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Approved Leaves
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.approved}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? '' : 'REJECTED')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-sm'
                : 'bg-white border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/30'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Rejected Requests
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.rejected}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'ON_LEAVE_TODAY' ? '' : 'ON_LEAVE_TODAY')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              statusFilter === 'ON_LEAVE_TODAY'
                ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-500/20 shadow-sm'
                : 'bg-white border-slate-200/80 hover:border-sky-200 hover:bg-sky-50/30'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                On Leave Today
              </span>
              <span className="text-xl font-black text-slate-900">{teamStats.onLeaveToday}</span>
            </div>
          </button>
        </div>
      )}

      {/* When on Balances Tab: Employee Selection, Detailed Category Cards & Overview Table */}
      {activeTab === 'balances' && canViewAllBalances ? (
        <div className="space-y-6">
          {/* Employee Selector Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-brand-100">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    Select Employee
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose an employee to view their category-wise remaining leave balances.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search employee list..."
                    value={balanceSearchTerm}
                    onChange={(e) => setBalanceSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                </div>

                <select
                  value={selectedBalanceEmpId}
                  onChange={(e) => setSelectedBalanceEmpId(e.target.value)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer max-w-xs sm:max-w-md truncate"
                >
                  {filteredEmployeesForBalances.map((emp) => (
                    <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                      {emp.fullName || `${emp.firstName} ${emp.lastName}`} {emp.employeeCode ? `(${emp.employeeCode})` : ''} {emp.departmentName ? `• ${emp.departmentName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Employee Info Banner */}
            {selectedBalanceEmpObj && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={selectedBalanceEmpObj.avatarUrl}
                    firstName={selectedBalanceEmpObj.firstName}
                    lastName={selectedBalanceEmpObj.lastName}
                    size="sm"
                    className="ring-1 ring-brand-200"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {selectedBalanceEmpObj.fullName || `${selectedBalanceEmpObj.firstName} ${selectedBalanceEmpObj.lastName}`}
                      <span className="text-slate-400 font-mono font-normal ml-1.5">
                        {selectedBalanceEmpObj.employeeCode}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {selectedBalanceEmpObj.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {selectedBalanceEmpObj.departmentName && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      {selectedBalanceEmpObj.departmentName}
                    </span>
                  )}
                  {selectedBalanceEmpObj.designationTitle && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                      {selectedBalanceEmpObj.designationTitle}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Total Remaining: {selectedEmpBalances.reduce((sum, b) => sum + (parseFloat(b.remainingDays) || 0), 0)} days
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Category-wise Leave Balance Cards for Selected Employee */}
          <LeaveBalanceCards
            balances={selectedEmpBalances}
            isLoading={loadingSelectedEmpBalances}
            title={
              selectedBalanceEmpObj
                ? `${selectedBalanceEmpObj.fullName || selectedBalanceEmpObj.firstName}'s Leave Entitlements & Balances`
                : 'Leave Entitlements & Balances'
            }
            showAll={true}
            canApply={false}
          />

          {/* All Employees Leave Balances Summary Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  All Employees Remaining Leave Buckets
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overview of remaining balances across all leave categories for organization staff.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {filteredEmployeesForBalances.length} employees
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50/80 font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5">Remaining Buckets</th>
                    <th className="px-6 py-3.5 text-center">Total Remaining</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loadingAllBalances ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <LoadingSpinner size="md" message="Loading employee balances..." />
                      </td>
                    </tr>
                  ) : filteredEmployeesForBalances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No employees found matching the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployeesForBalances.map((emp) => {
                      const isSelected = (emp.employeeId || emp.id) === selectedBalanceEmpId;
                      const totalRem = (emp.balances || []).reduce(
                        (sum, b) => sum + (parseFloat(b.remainingDays) || 0),
                        0
                      );

                      return (
                        <tr
                          key={emp.employeeId || emp.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-brand-50/30' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={emp.avatarUrl}
                                firstName={emp.firstName}
                                lastName={emp.lastName}
                                size="sm"
                              />
                              <div>
                                <div className="font-bold text-slate-900">
                                  {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {emp.employeeCode || emp.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-slate-700">
                              {emp.departmentName || '—'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {emp.designationTitle || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(emp.balances || []).length > 0 ? (
                                emp.balances.map((b) => (
                                  <span
                                    key={b.id || b.leaveTypeId}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                      b.remainingDays > 0
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}
                                    title={`${b.leaveTypeName}: ${b.remainingDays} remaining out of ${b.allocatedDays} allocated`}
                                  >
                                    <span className="font-mono">{b.leaveTypeCode}:</span>
                                    <span className="font-bold">{b.remainingDays}</span>
                                    <span className="text-slate-400 text-[10px]">/{b.allocatedDays}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">
                                  Balances not initialized
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="font-mono font-extrabold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {totalRem} d
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              variant={isSelected ? 'primary' : 'outline'}
                              size="xs"
                              onClick={() => {
                                setSelectedBalanceEmpId(emp.employeeId || emp.id);
                                window.scrollTo({ top: 200, behavior: 'smooth' });
                              }}
                            >
                              {isSelected ? 'Viewing' : 'View Details'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar & Quick Status Pills */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-2.5">
              {activeTab === 'team' ? (
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      statusFilter === ''
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All Team Requests ({teamStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('PENDING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      statusFilter === 'PENDING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Pending Approvals ({teamStats.pending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('APPROVED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      statusFilter === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Approved ({teamStats.approved})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('REJECTED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      statusFilter === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Rejected ({teamStats.rejected})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ON_LEAVE_TODAY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      statusFilter === 'ON_LEAVE_TODAY'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    On Leave Today ({teamStats.onLeaveToday})
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
              {statusFilter ? ` (${statusFilter === 'ON_LEAVE_TODAY' ? 'On Leave Today' : statusFilter})` : ''}
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
                ? statusFilter === 'PENDING'
                  ? 'No Pending Leave Reviews'
                  : statusFilter === 'APPROVED'
                  ? 'No Approved Leave Requests'
                  : statusFilter === 'REJECTED'
                  ? 'No Rejected Leave Requests'
                  : statusFilter === 'ON_LEAVE_TODAY'
                  ? (isAdminOrCeo ? 'No Employees On Leave Today' : 'No Team Members On Leave Today')
                  : (isAdminOrCeo ? 'No Organization Leave Requests Found' : 'No Team Requests Found')
                : 'No Leave Requests Found'
            }
            emptyDescription={
              activeTab === 'team'
                ? statusFilter === 'PENDING'
                  ? (isAdminOrCeo ? 'All employee leave requests across the organization have been reviewed.' : 'All leave requests from your reporting team have been reviewed and actioned.')
                  : statusFilter === 'ON_LEAVE_TODAY'
                  ? (isAdminOrCeo ? 'No employees across the organization have active approved leave scheduled for today.' : 'No team members have active approved leave scheduled for today.')
                  : (isAdminOrCeo ? 'There are no leave requests matching this filter across the organization.' : 'There are no leave requests matching this filter from your authorized team members.')
                : 'You have not submitted any leave requests matching the current filter.'
            }
            pagination={pagination}
            onPageChange={(p) => fetchRecords(p)}
          />
        </>
      )}

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
