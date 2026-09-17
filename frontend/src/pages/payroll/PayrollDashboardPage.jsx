import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  AlertCircle,
  FileText,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  Eye,
  Download,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { payrollService } from '../../services/payrollService.js';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { PayrollStatsCard, formatMoney } from '../../components/payroll/PayrollStatsCard.jsx';
import { LatestPayrollCard } from '../../components/payroll/LatestPayrollCard.jsx';
import { PayrollRecordDetailModal } from '../../components/payroll/PayrollRecordDetailModal.jsx';
import { PayslipViewModal } from '../../components/payroll/PayslipViewModal.jsx';

export const PayrollDashboardPage = () => {
  const { user, hasRole, hasPermission, isAuthenticated } = useAuth();
  const toast = useToast();

  // Role checks
  const canManagePayroll =
    hasPermission('payroll:read') ||
    hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);
  const isAuthorized =
    isAuthenticated &&
    (canManagePayroll ||
      hasPermission('payslip:read') ||
      hasRole(['Employee', 'Manager']));

  // Active Tab for HR/Admin: 'overview' | 'records' | 'payslips' | 'my'
  const [activeTab, setActiveTab] = useState(canManagePayroll ? 'overview' : 'my');

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [orgSummary, setOrgSummary] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [records, setRecords] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [myPayslips, setMyPayslips] = useState([]);

  // Filter states
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedRecordInitial, setSelectedRecordInitial] = useState(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [selectedPayslipRecord, setSelectedPayslipRecord] = useState(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);

  /**
   * Fetch all required data based on user role and permissions
   */
  const loadData = useCallback(async () => {
    try {
      setError(null);

      if (canManagePayroll) {
        // Fetch Admin / HR organization datasets in parallel
        const [summaryData, periodsData, recordsData, payslipsData, myRecordsData, myPayslipsData] =
          await Promise.all([
            payrollService.getOrganizationSummary().catch((e) => {
              console.warn('Could not fetch org summary:', e);
              return null;
            }),
            payrollService.getPeriods().catch(() => []),
            payrollService.getRecords().catch(() => []),
            payrollService.getPayslips().catch(() => []),
            payrollService.getMyRecords().catch(() => []),
            payrollService.getMyPayslips().catch(() => []),
          ]);

        setOrgSummary(summaryData);
        setPeriods(periodsData || []);
        setRecords(recordsData || []);
        setPayslips(payslipsData || []);
        setMyRecords(myRecordsData || []);
        setMyPayslips(myPayslipsData || []);
      } else {
        // Employee self-service
        const [myRecordsData, myPayslipsData] = await Promise.all([
          payrollService.getMyRecords(),
          payrollService.getMyPayslips().catch(() => []),
        ]);
        setMyRecords(myRecordsData || []);
        setMyPayslips(myPayslipsData || []);
      }
    } catch (err) {
      console.error('Failed to load payroll data:', err);
      setError(err.message || 'Unable to retrieve payroll records from the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManagePayroll]);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAuthorized, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    toast?.success?.('Payroll data refreshed.');
  };

  // Open Record Details
  const handleOpenRecordDetail = (record) => {
    setSelectedRecordId(record.id);
    setSelectedRecordInitial(record);
    setIsRecordModalOpen(true);
  };

  // Open Payslip View
  const handleOpenPayslip = (recordOrPayslip) => {
    // If it's a payslip row
    if (recordOrPayslip.payslipNumber || recordOrPayslip.payslip_number) {
      setSelectedPayslip(recordOrPayslip);
      setSelectedPayslipRecord(recordOrPayslip.record || null);
    } else {
      // It's a payroll record, check matching payslip
      const matchingPs =
        myPayslips.find((p) => p.payrollRecordId === recordOrPayslip.id || p.payroll_record_id === recordOrPayslip.id) ||
        payslips.find((p) => p.payrollRecordId === recordOrPayslip.id || p.payroll_record_id === recordOrPayslip.id);
      setSelectedPayslip(matchingPs || null);
      setSelectedPayslipRecord(recordOrPayslip);
    }
    setIsPayslipModalOpen(true);
  };

  // =========================================================================
  // 1. UNAUTHORIZED STATE
  // =========================================================================
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 my-8">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          You do not have permission to view payroll statements or access the payroll management module. Please contact your organization administrator or HR representative.
        </p>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // =========================================================================
  // 2. LOADING STATE
  // =========================================================================
  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner fullPage={false} message="Loading payroll records & financial statements..." />
      </div>
    );
  }

  // Latest employee payroll record
  const latestMyRecord = myRecords.length > 0 ? myRecords[0] : null;
  const latestMyPayslip = myPayslips.length > 0 ? myPayslips[0] : null;

  // Filtered records for HR/Admin
  const filteredRecords = records.filter((rec) => {
    if (periodFilter && rec.periodId !== periodFilter) return false;
    if (statusFilter && rec.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const empName = rec.employee?.fullName?.toLowerCase() || '';
      const empCode = rec.employee?.employeeCode?.toLowerCase() || '';
      const empDept = rec.employee?.department?.toLowerCase() || '';
      if (!empName.includes(q) && !empCode.includes(q) && !empDept.includes(q)) return false;
    }
    return true;
  });

  // Filtered payslips for HR/Admin
  const filteredPayslips = payslips.filter((ps) => {
    if (periodFilter && ps.period_id !== periodFilter && ps.periodId !== periodFilter) return false;
    if (statusFilter && ps.status !== statusFilter && ps.payslip_status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const num = (ps.payslip_number || ps.payslipNumber || '').toLowerCase();
      const emp = (ps.employee_name || ps.employee?.fullName || '').toLowerCase();
      if (!num.includes(q) && !emp.includes(q)) return false;
    }
    return true;
  });

  // =========================================================================
  // 3. TABLE COLUMNS DEFINITIONS
  // =========================================================================

  // Employee's My Records Columns
  const myRecordColumns = [
    {
      header: 'Payroll Period',
      accessor: (r) => r.period?.periodName || 'Period',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.period?.periodName || 'Payroll Period'}</div>
          <div className="text-xs text-slate-500 font-mono">
            {r.period?.periodCode || ''}
            {r.period?.startDate && ` • ${r.period.startDate} to ${r.period.endDate}`}
          </div>
        </div>
      ),
    },
    {
      header: 'Gross Earnings',
      accessor: 'grossEarnings',
      render: (r) => (
        <span className="font-semibold text-slate-800">{formatMoney(r.grossEarnings, r.currency)}</span>
      ),
    },
    {
      header: 'Deductions',
      accessor: 'totalDeductions',
      render: (r) => (
        <span className="font-semibold text-rose-600">-{formatMoney(r.totalDeductions, r.currency)}</span>
      ),
    },
    {
      header: 'Net Payable',
      accessor: 'netPayable',
      render: (r) => (
        <span className="font-black text-slate-900">{formatMoney(r.netPayable, r.currency)}</span>
      ),
    },
    {
      header: 'Paid Days',
      accessor: (r) => `${r.paidDays || 0} / ${r.workingDays || 0}`,
      render: (r) => (
        <span className="text-xs font-semibold text-slate-700">
          {r.paidDays || 0} / {r.workingDays || 0} days
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <Badge
          variant={
            r.status === 'PAID'
              ? 'success'
              : r.status === 'PROCESSED'
              ? 'info'
              : r.status === 'PROCESSING'
              ? 'warning'
              : 'neutral'
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={() => handleOpenRecordDetail(r)}
          >
            Breakdown
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={FileText}
            onClick={() => handleOpenPayslip(r)}
          >
            Payslip
          </Button>
        </div>
      ),
    },
  ];

  // HR / Admin: Payroll Periods Columns
  const periodColumns = [
    {
      header: 'Period Name & Code',
      accessor: 'periodName',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900">{p.periodName}</div>
          <div className="text-xs font-mono text-slate-500">{p.periodCode}</div>
        </div>
      ),
    },
    {
      header: 'Period Dates',
      accessor: 'startDate',
      render: (p) => (
        <div className="text-xs text-slate-600">
          {p.startDate || '—'} to {p.endDate || '—'}
        </div>
      ),
    },
    {
      header: 'Payment Date',
      accessor: 'paymentDate',
      render: (p) => <span className="text-xs text-slate-600">{p.paymentDate || '—'}</span>,
    },
    {
      header: 'Employees',
      accessor: 'totalEmployees',
      render: (p) => <span className="font-semibold text-slate-800">{p.totalEmployees ?? 0}</span>,
    },
    {
      header: 'Total Gross',
      accessor: 'totalGrossAmount',
      render: (p) => (
        <span className="font-semibold text-slate-800">{formatMoney(p.totalGrossAmount)}</span>
      ),
    },
    {
      header: 'Total Net Payout',
      accessor: 'totalNetAmount',
      render: (p) => (
        <span className="font-bold text-slate-900">{formatMoney(p.totalNetAmount)}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (p) => (
        <Badge
          variant={
            p.status === 'PAID'
              ? 'success'
              : p.status === 'PROCESSED'
              ? 'info'
              : p.status === 'PROCESSING'
              ? 'warning'
              : 'neutral'
          }
        >
          {p.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      render: (p) => (
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowUpRight}
          onClick={() => {
            setPeriodFilter(p.id);
            setActiveTab('records');
          }}
        >
          View Records
        </Button>
      ),
    },
  ];

  // HR / Admin: All Records Columns
  const allRecordColumns = [
    {
      header: 'Employee',
      accessor: (r) => r.employee?.fullName,
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900">
            {r.employee?.fullName || `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() || '—'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {r.employee?.employeeCode} {r.employee?.department && `• ${r.employee.department}`}
          </div>
        </div>
      ),
    },
    {
      header: 'Period',
      accessor: (r) => r.period?.periodCode,
      render: (r) => (
        <div>
          <span className="font-medium text-slate-800">{r.period?.periodName || '—'}</span>
          <span className="block font-mono text-[11px] text-slate-400">{r.period?.periodCode}</span>
        </div>
      ),
    },
    {
      header: 'Gross Salary',
      accessor: 'grossEarnings',
      render: (r) => <span className="font-semibold text-slate-800">{formatMoney(r.grossEarnings, r.currency)}</span>,
    },
    {
      header: 'Deductions',
      accessor: 'totalDeductions',
      render: (r) => <span className="font-semibold text-rose-600">-{formatMoney(r.totalDeductions, r.currency)}</span>,
    },
    {
      header: 'Net Payable',
      accessor: 'netPayable',
      render: (r) => <span className="font-black text-slate-900">{formatMoney(r.netPayable, r.currency)}</span>,
    },
    {
      header: 'Paid Days',
      accessor: 'paidDays',
      render: (r) => (
        <span className="text-xs font-semibold text-slate-700">
          {r.paidDays ?? '—'} / {r.workingDays ?? '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <Badge
          variant={
            r.status === 'PAID'
              ? 'success'
              : r.status === 'PROCESSED'
              ? 'info'
              : r.status === 'PROCESSING'
              ? 'warning'
              : 'neutral'
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={() => handleOpenRecordDetail(r)}
          >
            Breakdown
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={FileText}
            onClick={() => handleOpenPayslip(r)}
          >
            Payslip
          </Button>
        </div>
      ),
    },
  ];

  // HR / Admin: Payslips Table Columns
  const payslipColumns = [
    {
      header: 'Payslip Number',
      accessor: (p) => p.payslip_number || p.payslipNumber,
      render: (p) => (
        <span className="font-mono font-bold text-brand-600">
          {p.payslip_number || p.payslipNumber}
        </span>
      ),
    },
    {
      header: 'Employee',
      accessor: (p) => p.employee_name || p.employee?.fullName,
      render: (p) => (
        <div>
          <div className="font-semibold text-slate-900">
            {p.employee_name || p.employee?.fullName || '—'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {p.employee_code || p.employee?.employeeCode || ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Period',
      accessor: (p) => p.period_name || p.period?.periodName,
      render: (p) => (
        <span className="text-slate-700 font-medium">{p.period_name || p.period?.periodName || '—'}</span>
      ),
    },
    {
      header: 'Issue Date',
      accessor: (p) => p.issue_date || p.issueDate,
      render: (p) => (
        <span className="text-xs text-slate-600">
          {p.issue_date || p.issueDate ? new Date(p.issue_date || p.issueDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: 'Downloads',
      accessor: (p) => p.download_count ?? p.downloadCount ?? 0,
      render: (p) => (
        <span className="text-xs font-semibold text-slate-700">
          {p.download_count ?? p.downloadCount ?? 0} times
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (p) => p.payslip_status || p.status,
      render: (p) => (
        <Badge variant={p.payslip_status === 'PUBLISHED' || p.status === 'PUBLISHED' ? 'success' : 'neutral'}>
          {p.payslip_status || p.status || 'PUBLISHED'}
        </Badge>
      ),
    },
    {
      header: 'Action',
      render: (p) => (
        <Button
          variant="secondary"
          size="sm"
          icon={FileText}
          onClick={() => handleOpenPayslip(p)}
        >
          View Payslip
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payroll Dashboard</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {canManagePayroll
                  ? 'Manage organizational payroll periods, employee disbursements, and payslip distribution.'
                  : 'View your salary statements, earnings and deductions breakdown, and official payslips.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            isLoading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <Alert
          type="error"
          title="Payroll Data Warning"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Navigation Tabs for HR / Admin */}
      {canManagePayroll && (
        <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Executive Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'records'
                ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employee Records ({records.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payslips')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'payslips'
                ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Payslips Directory ({payslips.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'my'
                ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>My Personal Payroll</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HR / ADMIN VIEW — EXECUTIVE OVERVIEW & PERIODS */}
      {/* ========================================================================= */}
      {canManagePayroll && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive Stats Cards Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PayrollStatsCard
              title="Employees on Payroll"
              value={orgSummary?.metrics?.employeesOnPayroll ?? periods.reduce((acc, p) => acc + (p.totalEmployees || 0), 0)}
              subtext="Active staff in payroll cycles"
              icon={Users}
              color="text-brand-600"
              bgLight="bg-brand-50"
              border="border-brand-200/70"
            />
            <PayrollStatsCard
              title="Total Paid (YTD)"
              value={formatMoney(orgSummary?.metrics?.totalPaidYtd ?? 0)}
              subtext="Net payouts finalized and settled"
              icon={CheckCircle2}
              color="text-emerald-600"
              bgLight="bg-emerald-50"
              border="border-emerald-200/70"
            />
            <PayrollStatsCard
              title="Pending Payouts"
              value={formatMoney(orgSummary?.metrics?.pendingPayoutAmount ?? 0)}
              subtext="Draft / In-processing cycles"
              icon={Clock}
              color="text-amber-600"
              bgLight="bg-amber-50"
              border="border-amber-200/70"
            />
            <PayrollStatsCard
              title="Average Net Salary"
              value={formatMoney(orgSummary?.metrics?.averageNetSalary ?? 0)}
              subtext="Per employee compensation benchmark"
              icon={IndianRupee}
              color="text-sky-600"
              bgLight="bg-sky-50"
              border="border-sky-200/70"
            />
          </div>

          {/* Status Breakdown Pills */}
          {orgSummary?.statusBreakdown && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Cycle Status Distribution
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {Object.entries(orgSummary.statusBreakdown).map(([statusKey, st]) => (
                  <div
                    key={statusKey}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50"
                  >
                    <span className="font-bold text-slate-700">{statusKey}:</span>
                    <span className="font-semibold text-slate-900">{st.count} records</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-600">{formatMoney(st.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payroll Periods Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payroll Periods</h3>
                <p className="text-xs text-slate-500">Monthly payroll cycles and processing states</p>
              </div>
            </div>

            <DataTable
              columns={periodColumns}
              data={periods}
              emptyTitle="No Payroll Periods Configured"
              emptyDescription="There are no active or historical payroll periods found in your organization."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HR / ADMIN VIEW — EMPLOYEE RECORDS TAB */}
      {/* ========================================================================= */}
      {canManagePayroll && activeTab === 'records' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by employee name, code, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                />
              </div>

              {/* Period Filter */}
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Periods</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.periodName} ({p.periodCode})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PROCESSING">Processing</option>
                <option value="PROCESSED">Processed</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {(periodFilter || statusFilter || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPeriodFilter('');
                  setStatusFilter('');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>

          {/* Employee Records DataTable */}
          <DataTable
            columns={allRecordColumns}
            data={filteredRecords}
            emptyTitle="No Employee Records Found"
            emptyDescription="No payroll records matched the specified filter criteria."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. HR / ADMIN VIEW — PAYSLIPS DIRECTORY TAB */}
      {/* ========================================================================= */}
      {canManagePayroll && activeTab === 'payslips' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by payslip number or employee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Periods</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.periodName} ({p.periodCode})
                  </option>
                ))}
              </select>
            </div>

            {(periodFilter || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPeriodFilter('');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>

          <DataTable
            columns={payslipColumns}
            data={filteredPayslips}
            emptyTitle="No Payslips Published"
            emptyDescription="There are no payslips generated or published yet for this organization."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. EMPLOYEE VIEW (AND "MY PERSONAL PAYROLL" TAB FOR ADMIN/HR) */}
      {/* ========================================================================= */}
      {(!canManagePayroll || activeTab === 'my') && (
        <div className="space-y-6">
          {/* Hero Card: Latest / Current Payroll Statement */}
          <LatestPayrollCard
            record={latestMyRecord}
            onViewDetails={handleOpenRecordDetail}
            onViewPayslip={handleOpenPayslip}
            hasPayslip={!!latestMyPayslip}
          />

          {/* Employee Financial Stats Cards */}
          {latestMyRecord && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <PayrollStatsCard
                title="Latest Net Pay"
                value={formatMoney(latestMyRecord.netPayable, latestMyRecord.currency)}
                subtext="Current take-home amount"
                icon={CheckCircle2}
                color="text-emerald-600"
                bgLight="bg-emerald-50"
                border="border-emerald-200/70"
              />
              <PayrollStatsCard
                title="Gross Earnings"
                value={formatMoney(latestMyRecord.grossEarnings, latestMyRecord.currency)}
                subtext="Pre-deduction earnings"
                icon={TrendingUp}
                color="text-brand-600"
                bgLight="bg-brand-50"
                border="border-brand-200/70"
              />
              <PayrollStatsCard
                title="Total Deductions"
                value={formatMoney(latestMyRecord.totalDeductions, latestMyRecord.currency)}
                subtext="Taxes, PF & adjustments"
                icon={TrendingDown}
                color="text-rose-600"
                bgLight="bg-rose-50"
                border="border-rose-200/70"
              />
              <PayrollStatsCard
                title="Attendance & Days"
                value={`${latestMyRecord.paidDays || 0} / ${latestMyRecord.workingDays || 0}`}
                subtext={
                  Number(latestMyRecord.lossOfPayDays) > 0
                    ? `${latestMyRecord.lossOfPayDays} days marked LOP`
                    : 'Full cycle attendance'
                }
                icon={CalendarDays}
                color="text-sky-600"
                bgLight="bg-sky-50"
                border="border-sky-200/70"
              />
            </div>
          )}

          {/* Available Payslips Quick Section */}
          {myPayslips.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Available Salary Payslips</h3>
                  <p className="text-xs text-slate-500">Official monthly payslip documents published by HR</p>
                </div>
                <Link to="/payslips">
                  <Button variant="secondary" size="sm" icon={ArrowUpRight}>
                    Full Payslips Portal
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myPayslips.map((ps) => {
                  const id = ps.payslip_id || ps.id;
                  const periodName = ps.period_name || ps.periodName || 'Payroll Cycle';
                  const psNum = ps.payslip_number || ps.payslipNumber || '—';
                  const net = ps.net_payable !== undefined ? ps.net_payable : ps.netPayable;
                  const curr = ps.currency || 'INR';
                  const issueDate = ps.issue_date || ps.issueDate;

                  return (
                    <div
                      key={id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-200 hover:shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-brand-600 truncate">{psNum}</span>
                          <Badge variant="success">PUBLISHED</Badge>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1.5">{periodName}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Issued: {issueDate ? new Date(issueDate).toLocaleDateString() : '—'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Net Pay</span>
                          <span className="text-sm font-black text-slate-900">{formatMoney(net, curr)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenPayslip(ps)}
                          >
                            View
                          </Button>
                          <Link to={`/payslips?id=${id}`}>
                            <Button variant="ghost" size="sm" icon={ArrowUpRight}>
                              Open
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historical Payroll Statements Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payroll Statement History</h3>
                <p className="text-xs text-slate-500">Record of your historical monthly salary statements</p>
              </div>
            </div>

            <DataTable
              columns={myRecordColumns}
              data={myRecords}
              emptyTitle="No Payroll Statements Found"
              emptyDescription="No historical payroll records have been posted to your employee profile yet."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODALS: RECORD BREAKDOWN & OFFICIAL PAYSLIP */}
      {/* ========================================================================= */}
      <PayrollRecordDetailModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setSelectedRecordId(null);
          setSelectedRecordInitial(null);
        }}
        recordId={selectedRecordId}
        initialRecord={selectedRecordInitial}
        isEmployeeSelfService={!canManagePayroll || activeTab === 'my'}
        onViewPayslip={(rec) => {
          handleOpenPayslip(rec);
        }}
      />

      <PayslipViewModal
        isOpen={isPayslipModalOpen}
        onClose={() => {
          setIsPayslipModalOpen(false);
          setSelectedPayslip(null);
          setSelectedPayslipRecord(null);
        }}
        payslip={selectedPayslip}
        record={selectedPayslipRecord}
      />
    </div>
  );
};
