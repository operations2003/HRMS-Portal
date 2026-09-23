import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Building2,
  CreditCard,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  Info,
  Lock,
  Calendar,
  CheckCircle2,
  Users,
  Search,
  Eye,
  Edit3,
  Crown,
  ChevronRight,
  Layers,
  Calculator,
  ChevronDown,
  Sparkles,
  Briefcase,
  Send,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { payrollService } from '../../services/payrollService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Input } from '../../components/common/Input.jsx';

export const PayrollPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Role detection
  const normRole = (user?.roleName || '').toLowerCase();
  const isCeoOrAdmin = ['admin', 'superadmin', 'orgadmin'].some((r) => normRole.includes(r)) || user?.email === 'sheetalbedi@tasknera.com';
  const isHr = ['hr', 'hrmanager'].some((r) => normRole.includes(r));
  const canAccessOrgPayroll = isCeoOrAdmin || isHr;

  // Tabs: 'org' (Organization Payroll) vs 'structure' (Detailed Salary Structure)
  const [activeTab, setActiveTab] = useState(canAccessOrgPayroll ? 'org' : 'structure');

  // Personal/Selected employee payroll data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Organization-wide payroll data (Admin/CEO and HR only)
  const [orgPayroll, setOrgPayroll] = useState(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Selected employee for structure view
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  // Salary Edit Modal (Admin/CEO deciding salaries, and HR)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [salaryForm, setSalaryForm] = useState({
    annualCtc: '',
    monthlyGross: '',
    netTakeHome: '',
    totalDeductions: '',
    basic: '',
    hra: '',
    special: '',
    conveyance: '',
    medical: '',
    epf: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    uanNumber: '',
    pfNumber: '',
    esiNumber: '',
    panNumber: '',
  });
  const [showBankStatutory, setShowBankStatutory] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // Payout tracking & confirmation modals (Admin paying salaries to all others)
  const [payoutStatusMap, setPayoutStatusMap] = useState({});
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingEmployee, setPayingEmployee] = useState(null);
  const [payProcessing, setPayProcessing] = useState(false);
  const [disburseAllModalOpen, setDisburseAllModalOpen] = useState(false);
  const [disburseAllProcessing, setDisburseAllProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Fetch individual payroll breakdown
  const fetchPayroll = async (empId = null, isBackground = false) => {
    try {
      if (isBackground) setRefreshing(true);
      else setLoading(true);
      setError(null);

      let res;
      if (empId && canAccessOrgPayroll) {
        res = await payrollService.getEmployeePayroll(empId);
      } else {
        res = await payrollService.getMyPayroll();
      }
      setData(res);
    } catch (err) {
      console.error('Failed to load payroll details:', err);
      setError(err.message || 'Unable to load payroll and compensation details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch organization payroll
  const fetchOrgPayroll = async () => {
    if (!canAccessOrgPayroll) return;
    try {
      setOrgLoading(true);
      const res = await payrollService.getOrganizationPayroll();
      setOrgPayroll(res);
    } catch (err) {
      console.error('Failed to load organization payroll:', err);
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll(selectedEmpId);
    if (canAccessOrgPayroll) {
      fetchOrgPayroll();
    }
  }, [selectedEmpId]);

  // Handle viewing specific employee structure from org list
  const handleViewEmployeeStructure = (emp) => {
    setSelectedEmpId(emp.id);
    setActiveTab('structure');
  };

  // Helper to initialize salary form from employee data
  const initSalaryForm = (emp) => {
    const s = emp?.salaryStructure || {};
    const rawSalary = parseFloat(emp?.salary) || parseFloat(emp?.rawSalary) || 0;
    const annualCtc = s.annualCtc ?? emp?.annualCtc ?? (rawSalary > 150000 ? rawSalary : rawSalary * 12) ?? 1200000;
    const monthlyGross = s.monthlyGross ?? emp?.monthlyGross ?? Math.round(annualCtc / 12);

    const basic = s.basic ?? Math.round(monthlyGross * 0.5);
    const hra = s.hra ?? Math.round(monthlyGross * 0.25);
    const conveyance = s.conveyance ?? 1600;
    const medical = s.medical ?? 1250;
    const special = s.special ?? Math.max(0, monthlyGross - basic - hra - conveyance - medical);

    const epf = s.epf ?? Math.round(Math.min(basic, 15000) * 0.12);
    const professionalTax = s.professionalTax ?? 200;
    const tds = s.tds ?? Math.round(monthlyGross > 50000 ? monthlyGross * 0.05 : 0);
    const otherDeductions = s.otherDeductions ?? 0;

    const totalDeductions = s.totalDeductions ?? emp?.totalDeductions ?? (epf + professionalTax + tds + otherDeductions);
    const netTakeHome = s.netTakeHome ?? emp?.netTakeHome ?? (monthlyGross - totalDeductions);

    return {
      annualCtc,
      monthlyGross,
      netTakeHome,
      totalDeductions,
      basic,
      hra,
      special,
      conveyance,
      medical,
      epf,
      professionalTax,
      tds,
      otherDeductions,
      bankName: s.bankName || emp?.bankName || 'HDFC Bank Ltd.',
      bankAccountNumber: s.bankAccountNumber || emp?.bankAccountNumber || '',
      bankIfsc: s.bankIfsc || emp?.bankIfsc || 'HDFC0001234',
      bankBranch: s.bankBranch || emp?.bankBranch || 'Corporate Branch',
      uanNumber: s.uanNumber || emp?.uanNumber || '101294820194',
      pfNumber: s.pfNumber || 'KN/BLR/1029384',
      esiNumber: s.esiNumber || 'Exempted (Above statutory limit)',
      panNumber: s.panNumber || '',
    };
  };

  const handleSalaryFieldChange = (field, value) => {
    setSalaryForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Auto-calculate breakdown based on Annual CTC
  const handleAutoCalculateFromCtc = () => {
    const ctc = parseFloat(salaryForm.annualCtc) || 0;
    const gross = Math.round(ctc / 12);
    const basic = Math.round(gross * 0.5);
    const hra = Math.round(gross * 0.25);
    const conveyance = 1600;
    const medical = 1250;
    const special = Math.max(0, gross - basic - hra - conveyance - medical);
    const epf = Math.round(Math.min(basic, 15000) * 0.12);
    const pt = 200;
    const tds = Math.round(gross > 50000 ? gross * 0.05 : 0);
    const totalDed = epf + pt + tds + (parseFloat(salaryForm.otherDeductions) || 0);
    const net = Math.max(0, gross - totalDed);

    setSalaryForm((prev) => ({
      ...prev,
      monthlyGross: gross,
      basic,
      hra,
      special,
      conveyance,
      medical,
      epf,
      professionalTax: pt,
      tds,
      totalDeductions: totalDed,
      netTakeHome: net,
    }));
  };

  // Re-sum deductions and net take home
  const handleSumDeductionsAndNet = () => {
    const epf = parseFloat(salaryForm.epf) || 0;
    const pt = parseFloat(salaryForm.professionalTax) || 0;
    const tds = parseFloat(salaryForm.tds) || 0;
    const other = parseFloat(salaryForm.otherDeductions) || 0;
    const totalDed = epf + pt + tds + other;
    const gross = parseFloat(salaryForm.monthlyGross) || 0;
    const net = Math.max(0, gross - totalDed);

    setSalaryForm((prev) => ({
      ...prev,
      totalDeductions: totalDed,
      netTakeHome: net,
    }));
  };

  // Open salary decision modal
  const handleOpenEditSalary = (emp) => {
    setEditingEmployee(emp);
    setSalaryForm(initSalaryForm(emp));
    setShowBankStatutory(false);
    setSaveSuccessMsg(null);
    setEditModalOpen(true);
  };

  // Submit salary change
  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      setSalarySaving(true);
      setError(null);
      await payrollService.updateEmployeeSalary(editingEmployee.id, salaryForm);
      setSaveSuccessMsg(`Salary structure successfully saved for ${editingEmployee.fullName || editingEmployee.name || 'employee'}.`);

      // Refresh data
      await fetchOrgPayroll();
      if (selectedEmpId === editingEmployee.id || (!selectedEmpId && editingEmployee.id === user?.employeeId)) {
        await fetchPayroll(editingEmployee.id, true);
      }

      setTimeout(() => {
        setEditModalOpen(false);
        setEditingEmployee(null);
        setSaveSuccessMsg(null);
      }, 1200);
    } catch (err) {
      console.error('Failed to update salary:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to update employee salary.');
    } finally {
      setSalarySaving(false);
    }
  };

  // Open individual pay modal
  const handleOpenPayModal = (emp) => {
    setPayingEmployee(emp);
    setPayModalOpen(true);
  };

  // Submit individual payout
  const handleConfirmPay = async () => {
    if (!payingEmployee) return;
    try {
      setPayProcessing(true);
      const res = await payrollService.payEmployee(payingEmployee.id);
      setPayoutStatusMap((prev) => ({
        ...prev,
        [payingEmployee.id]: {
          status: 'PAID',
          amount: res.data?.amount || payingEmployee.netTakeHome,
          period: res.data?.period || 'Current Period',
          txId: res.data?.transactionId || `TXN-${Date.now()}`,
          date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
        },
      }));
      setActionFeedback({
        type: 'success',
        message: `Salary of ₹${(payingEmployee.netTakeHome || 0).toLocaleString('en-IN')} successfully disbursed to ${payingEmployee.fullName || payingEmployee.name} via Direct Bank Transfer.`,
      });
      setPayModalOpen(false);
      setPayingEmployee(null);
    } catch (err) {
      console.error('Failed to disburse salary:', err);
      setActionFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to process salary payment.',
      });
    } finally {
      setPayProcessing(false);
    }
  };

  // Submit batch organization payout
  const handleConfirmDisburseAll = async () => {
    try {
      setDisburseAllProcessing(true);
      const res = await payrollService.disburseAll();
      const updatedMap = { ...payoutStatusMap };
      const nowStr = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      (orgPayroll?.employees || []).forEach((emp) => {
        updatedMap[emp.id] = {
          status: 'PAID',
          amount: emp.netTakeHome,
          period: res.data?.period || 'Current Period',
          txId: res.data?.batchId || `BATCH-${Date.now()}`,
          date: nowStr,
        };
      });
      setPayoutStatusMap(updatedMap);
      setActionFeedback({
        type: 'success',
        message: `Organization-wide payroll successfully disbursed to ${orgPayroll?.employees?.length || 0} employees! Total ₹${(orgPayroll?.summary?.totalMonthlyInHand || 0).toLocaleString('en-IN')} transferred via Direct Bank Transfer.`,
      });
      setDisburseAllModalOpen(false);
    } catch (err) {
      console.error('Failed to disburse all:', err);
      setActionFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to process organization payroll disbursement.',
      });
    } finally {
      setDisburseAllProcessing(false);
    }
  };

  const { employee, ctcBreakdown, bankDetails, statutoryDetails, payHistory } = data || {};

  // Filtered employees in org view
  const filteredEmployees = useMemo(() => {
    const list = orgPayroll?.employees || [];
    return list.filter((emp) => {
      const matchesSearch =
        !searchTerm ||
        emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = !selectedDept || emp.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [orgPayroll, searchTerm, selectedDept]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const list = orgPayroll?.employees || [];
    const set = new Set(list.map((e) => e.department).filter(Boolean));
    return Array.from(set);
  }, [orgPayroll]);

  const historyColumns = [
    {
      header: 'Pay Period',
      key: 'period',
      accessor: (row) => (
        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-500" />
          {row.period}
        </span>
      ),
    },
    {
      header: 'Gross Earnings',
      key: 'grossEarnings',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          ₹{row.grossEarnings?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Total Deductions',
      key: 'totalDeductions',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
          - ₹{row.totalDeductions?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Net Take-Home',
      key: 'netPay',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ₹{row.netPay?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Payment Status',
      key: 'status',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {row.status}
        </span>
      ),
    },
    {
      header: 'Payment Mode',
      key: 'paymentMethod',
      accessor: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.paymentMethod}
        </span>
      ),
    },
  ];

  // Columns for Organization Payroll Table (Admin/CEO and HR)
  const orgColumns = [
    {
      header: 'Employee',
      key: 'fullName',
      accessor: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
            {row.firstName?.[0]}
            {row.lastName?.[0]}
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{row.fullName}</span>
              {row.role?.toLowerCase().includes('admin') && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Crown className="w-2.5 h-2.5 text-amber-600" /> Admin/CEO
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span className="font-mono font-medium text-brand-600">{row.employeeCode}</span>
              <span>•</span>
              <span>{row.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Role & Dept',
      key: 'role',
      accessor: (row) => (
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {row.role}
          </span>
          <div className="text-[11px] text-slate-500 mt-0.5">{row.department}</div>
        </div>
      ),
    },
    {
      header: 'Annual CTC',
      key: 'annualCtc',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
          ₹{row.annualCtc?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Monthly Gross',
      key: 'monthlyGross',
      accessor: (row) => (
        <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-300">
          ₹{row.monthlyGross?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Net In-Hand',
      key: 'netTakeHome',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ₹{row.netTakeHome?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Monthly Deductions',
      key: 'totalDeductions',
      accessor: (row) => (
        <span className="font-mono text-xs text-rose-500 font-medium">
          - ₹{row.totalDeductions?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Disbursement Status',
      key: 'payoutStatus',
      accessor: (row) => {
        const payout = payoutStatusMap[row.id];
        if (payout?.status === 'PAID') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Paid ({payout.date || 'Disbursed'})
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <Calendar className="w-3 h-3 text-blue-500" />
            Ready for Payout
          </span>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      accessor: (row) => {
        const isPaid = payoutStatusMap[row.id]?.status === 'PAID';
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              icon={Eye}
              onClick={() => handleViewEmployeeStructure(row)}
              title="View complete salary breakdown"
            >
              Structure
            </Button>
            {(isCeoOrAdmin || isHr) && (
              <Button
                size="xs"
                variant="secondary"
                icon={Edit3}
                onClick={() => handleOpenEditSalary(row)}
                title="Assign or update employee salary"
              >
                Assign Salary
              </Button>
            )}
            {isCeoOrAdmin && (
              <Button
                size="xs"
                variant={isPaid ? 'outline' : 'primary'}
                icon={isPaid ? CheckCircle2 : Send}
                onClick={() => handleOpenPayModal(row)}
                disabled={isPaid}
                title={isPaid ? 'Salary already disbursed' : 'Pay salary to this employee'}
              >
                {isPaid ? 'Paid' : 'Pay Salary'}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading && !orgPayroll && !data) {
    return <LoadingSpinner fullPage message="Loading compensation and payroll breakdown..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Payroll & Compensation
              </h1>
              {isCeoOrAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                  <Crown className="w-3.5 h-3.5 text-amber-600" /> Admin / CEO (Org Head)
                </span>
              )}
              {isHr && !isCeoOrAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" /> HR (People Operations)
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isCeoOrAdmin
                ? 'Organization-wide salary visibility, compensation decisions, and executive payroll governance.'
                : isHr
                ? 'Manage and review organization-wide employee compensation structures and disbursements.'
                : 'Review your comprehensive salary structure, statutory registrations, and disbursement history.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing || orgLoading}
            onClick={() => {
              fetchPayroll(selectedEmpId, true);
              if (canAccessOrgPayroll) fetchOrgPayroll();
            }}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={HelpCircle}
            onClick={() => navigate('/helpdesk?tab=requests')}
          >
            Request Payroll Clarification
          </Button>
        </div>
      </div>

      {/* Role Navigation Tabs for Admin / CEO & HR */}
      {canAccessOrgPayroll && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('org')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'org'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Organization Payroll</span>
            {orgPayroll?.employees && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'org' ? 'bg-brand-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}>
                {orgPayroll.employees.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'structure'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Detailed Salary Structure</span>
            {selectedEmpId && selectedEmpId !== user?.employeeId && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold">
                Viewing Staff
              </span>
            )}
          </button>
        </div>
      )}

      {actionFeedback && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <Alert
          variant="danger"
          title="Payroll Notice"
          message={error}
          action={
            <Button size="sm" variant="outline" onClick={() => fetchPayroll(selectedEmpId)}>
              Try Again
            </Button>
          }
        />
      )}

      {/* TAB 1: Organization Payroll (Admin/CEO & HR Only) */}
      {canAccessOrgPayroll && activeTab === 'org' && (
        <div className="space-y-6">
          {/* Org Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-gradient-to-br from-brand-600 to-indigo-700 text-white rounded-2xl shadow-sm space-y-1">
              <div className="flex items-center justify-between text-brand-100 text-xs font-semibold uppercase tracking-wider">
                <span>Total Annual CTC</span>
                <TrendingUp className="w-4 h-4 text-brand-200" />
              </div>
              <div className="text-2xl lg:text-3xl font-black font-mono">
                ₹{orgPayroll?.summary?.totalAnnualCtc?.toLocaleString('en-IN') || 0}
              </div>
              <div className="text-xs text-brand-100">
                Monthly Payroll: ₹{orgPayroll?.summary?.totalMonthlyGross?.toLocaleString('en-IN') || 0}
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <span>Total In-Hand Disbursed</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl lg:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                ₹{orgPayroll?.summary?.totalMonthlyInHand?.toLocaleString('en-IN') || 0}
              </div>
              <div className="text-xs text-slate-400">
                Net employee take-home monthly
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <span>Monthly Deductions</span>
                <span className="text-xs font-bold text-rose-500">EPF & Taxes</span>
              </div>
              <div className="text-2xl lg:text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
                ₹{orgPayroll?.summary?.totalMonthlyDeductions?.toLocaleString('en-IN') || 0}
              </div>
              <div className="text-xs text-slate-400">
                Total statutory & tax withholdings
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <span>Salaried Workforce</span>
                <Users className="w-4 h-4 text-brand-600" />
              </div>
              <div className="text-2xl lg:text-3xl font-black font-mono text-slate-900 dark:text-white">
                {orgPayroll?.summary?.totalEmployees || 0}
              </div>
              <div className="text-xs text-slate-400">
                Avg In-Hand: ₹{orgPayroll?.summary?.avgMonthlyInHand?.toLocaleString('en-IN') || 0} / mo
              </div>
            </div>
          </div>

          {/* Table Toolbar: Search & Dept Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff, code, or role..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                aria-label="Filter by department"
                className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {isCeoOrAdmin && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Send}
                  onClick={() => setDisburseAllModalOpen(true)}
                  className="shrink-0"
                  title="Run organization payroll and disburse salaries to all active employees"
                >
                  Disburse Org Payroll
                </Button>
              )}

              <span className="text-xs font-medium text-slate-500 shrink-0">
                Showing {filteredEmployees.length} of {orgPayroll?.employees?.length || 0}
              </span>
            </div>
          </div>

          {/* Org Payroll DataTable */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <DataTable
              columns={orgColumns}
              data={filteredEmployees}
              loading={orgLoading}
              emptyTitle="No employee compensation records found"
              emptyDescription="No employees matching the current search criteria."
            />
          </div>
        </div>
      )}

      {/* TAB 2: Detailed Salary Structure (Accessible to all for own salary, or Admin/HR for selected employee) */}
      {(activeTab === 'structure' || !canAccessOrgPayroll) && (
        <div className="space-y-6">
          {/* Employee Selector for Admin / CEO and HR */}
          {canAccessOrgPayroll && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Inspecting Employee Compensation Profile
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isCeoOrAdmin && !selectedEmpId
                      ? 'Executive Payroll Management (No Personal Employee Salary)'
                      : `Currently viewing: ${employee?.fullName || 'Staff'} (${employee?.employeeCode || ''}) — ${employee?.role || ''}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedEmpId || ''}
                  onChange={(e) => setSelectedEmpId(e.target.value || null)}
                  aria-label="Select employee to inspect"
                  className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">
                    {isCeoOrAdmin ? '-- Select Staff to Inspect --' : 'My Own Salary Profile'}
                  </option>
                  {orgPayroll?.employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      [{emp.employeeCode}] {emp.fullName} ({emp.role})
                    </option>
                  ))}
                </select>

                {(isCeoOrAdmin || isHr) && employee && selectedEmpId && (
                  <Button
                    size="xs"
                    variant="primary"
                    icon={Edit3}
                    onClick={() => handleOpenEditSalary(employee)}
                  >
                    Assign Salary
                  </Button>
                )}

                {isCeoOrAdmin && employee && selectedEmpId && (
                  <Button
                    size="xs"
                    variant={payoutStatusMap[employee.id]?.status === 'PAID' ? 'outline' : 'primary'}
                    icon={payoutStatusMap[employee.id]?.status === 'PAID' ? CheckCircle2 : Send}
                    onClick={() => handleOpenPayModal(employee)}
                    disabled={payoutStatusMap[employee.id]?.status === 'PAID'}
                  >
                    {payoutStatusMap[employee.id]?.status === 'PAID' ? 'Paid' : 'Pay Salary'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Executive Founder & Admin Notice (No personal employee salary for Admin) */}
          {isCeoOrAdmin && !selectedEmpId ? (
            <div className="p-8 bg-gradient-to-br from-amber-500/10 via-brand-500/5 to-indigo-500/10 border-2 border-amber-500/30 rounded-3xl space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
                    <Crown className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">
                        Executive Administration & Payroll Authority
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        Admin / CEO
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Sheetal Bedi (Chief Executive Officer / Administrator)
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl pt-1">
                      As Company Administrator and Organization Head, you manage payroll operations, decide and assign compensation packages to all staff, and disburse monthly employee salaries. Company executives and administrators do not draw an employee salary.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Users}
                    onClick={() => setActiveTab('org')}
                  >
                    View Organization Payroll
                  </Button>
                </div>
              </div>

              {/* Quick Staff Roster Selector */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-600" />
                    Select an Employee to Inspect or Assign Salary
                  </h3>
                  <span className="text-xs text-slate-400">
                    {orgPayroll?.employees?.length || 0} Salaried Staff Members
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {orgPayroll?.employees?.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => handleViewEmployeeStructure(emp)}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500/50 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-brand-600">
                            {emp.fullName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {emp.role} • {emp.department}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Payslip Download Policy Notice */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Notice on Payslip Downloads:</strong> As per updated company policy, PDF payslip downloads are deactivated. Need employment verification or proof of compensation? You can generate or request a verified certificate.
                  </span>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigate('/helpdesk?tab=requests')}
                  className="shrink-0"
                >
                  Submit Service Request
                </Button>
              </div>

              {/* Top 3 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-br from-brand-600 to-indigo-700 text-white rounded-2xl shadow-sm space-y-2">
              <div className="flex items-center justify-between text-brand-100 text-xs font-semibold uppercase tracking-wider">
                <span>Annual CTC</span>
                <TrendingUp className="w-4 h-4 text-brand-200" />
              </div>
              <div className="text-3xl font-black font-mono">
                ₹{ctcBreakdown?.annualCtc?.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-brand-100">
                Monthly Gross: ₹{ctcBreakdown?.monthlyGross?.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <span>Net Monthly In-Hand</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                ₹{ctcBreakdown?.netTakeHome?.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-slate-400">
                After EPF, PT, and tax withholdings
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <span>Total Monthly Deductions</span>
                <span className="text-xs font-bold text-rose-500">Fixed & Tax</span>
              </div>
              <div className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
                ₹{ctcBreakdown?.totalDeductions?.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-slate-400">
                PF Contribution: ₹{ctcBreakdown?.deductions?.find((d) => d.component.includes('Provident'))?.monthly || 1800} / mo
              </div>
            </div>
          </div>

          {/* Two Column Grid: Bank Details & Statutory UAN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank Details Card (View-Only, Masked) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-600" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Direct Deposit Bank Account
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  <Lock className="w-3 h-3 text-slate-400" />
                  View-Only
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Bank Name</span>
                  <span className="text-slate-900 dark:text-white font-bold">{bankDetails?.bankName || 'HDFC Bank'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Account Number</span>
                  <span className="text-slate-900 dark:text-white font-mono font-bold tracking-wider">{bankDetails?.accountNumberMasked}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">IFSC Code</span>
                  <span className="text-slate-900 dark:text-white font-mono font-bold">{bankDetails?.ifscCode || 'HDFC0001234'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Branch</span>
                  <span className="text-slate-900 dark:text-white font-medium">{bankDetails?.branch || 'Corporate Branch'}</span>
                </div>
              </div>

              {/* Change Workflow Notice */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between gap-2">
                <div className="text-[11px] text-amber-800 dark:text-amber-300">
                  Direct edits are disabled for banking security.
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigate('/helpdesk?tab=requests')}
                  className="border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  Request Bank Update
                </Button>
              </div>
            </div>

            {/* Statutory Details Card (UAN & PF) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Statutory Registrations (UAN / PF)
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  <Lock className="w-3 h-3 text-slate-400" />
                  View-Only
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">UAN Number</span>
                  <span className="text-slate-900 dark:text-white font-mono font-black text-sm tracking-wide text-brand-700 dark:text-brand-400">
                    {statutoryDetails?.uanNumber || '101294820194'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Provident Fund (PF) No.</span>
                  <span className="text-slate-900 dark:text-white font-mono font-bold">
                    {statutoryDetails?.pfNumber || 'KN/BLR/1029384'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">ESI Scheme</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {statutoryDetails?.esiNumber || 'Exempted (Above statutory limit)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">PAN Verification</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Active
                  </span>
                </div>
              </div>

              {/* UAN Update Policy Notice */}
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-center justify-between gap-2">
                <div className="text-[11px] text-blue-800 dark:text-blue-300">
                  To link or correct your UAN, submit a Service Request with your EPF member passbook.
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigate('/helpdesk?tab=requests')}
                  className="border-blue-300 text-blue-900 hover:bg-blue-100"
                >
                  Request UAN Update
                </Button>
              </div>
            </div>
          </div>

          {/* Salary Breakdown Tables: Earnings & Deductions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Earnings Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Monthly Earnings Structure
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {ctcBreakdown?.earnings?.map((item, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{item.component}</p>
                      <p className="text-[10px] text-slate-400">{item.description}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-slate-900 dark:text-white">₹{item.monthly?.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400">₹{item.annual?.toLocaleString('en-IN')}/yr</p>
                    </div>
                  </div>
                ))}
                <div className="pt-3 flex items-center justify-between font-bold">
                  <span className="text-slate-900 dark:text-white">Total Gross Earnings</span>
                  <span className="font-mono text-sm text-brand-600">₹{ctcBreakdown?.monthlyGross?.toLocaleString('en-IN')} / mo</span>
                </div>
              </div>
            </div>

            {/* Monthly Deductions Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Monthly Deductions Structure
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {ctcBreakdown?.deductions?.map((item, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{item.component}</p>
                      <p className="text-[10px] text-slate-400">{item.description}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-rose-600 dark:text-rose-400">- ₹{item.monthly?.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400">₹{item.annual?.toLocaleString('en-IN')}/yr</p>
                    </div>
                  </div>
                ))}
                <div className="pt-3 flex items-center justify-between font-bold">
                  <span className="text-slate-900 dark:text-white">Total Monthly Deductions</span>
                  <span className="font-mono text-sm text-rose-600">- ₹{ctcBreakdown?.totalDeductions?.toLocaleString('en-IN')} / mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pay History Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Disbursement & Salary History
                </h2>
                <p className="text-xs text-slate-400">
                  Record of monthly compensation transfers to designated bank account
                </p>
              </div>
            </div>

            <DataTable
              columns={historyColumns}
              data={payHistory || []}
              emptyTitle="No pay history available"
              emptyDescription="Salary disbursements will appear here once processed."
            />
          </div>
        </>
      )}
    </div>
  )}

      {/* Decide / Edit Salary Modal (Admin/CEO & HR) */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        maxWidth="max-w-3xl"
        title={isCeoOrAdmin ? 'Decide & Configure Employee Salary' : 'Update Employee Salary & Structure'}
        subtitle={
          editingEmployee
            ? `Manually edit and configure every salary field for ${editingEmployee.fullName || editingEmployee.name} (${editingEmployee.employeeCode})`
            : ''
        }
      >
        <form onSubmit={handleSaveSalary} className="space-y-5">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {saveSuccessMsg}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {error}
            </div>
          )}

          {/* Employee Information Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {editingEmployee?.fullName || editingEmployee?.name}
              </span>
              <span className="text-slate-500 ml-1.5 font-mono text-[11px]">
                ({editingEmployee?.employeeCode})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Role / Dept</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {editingEmployee?.role || 'Staff'} • {editingEmployee?.department || 'General'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Authority Access</span>
              <span className="inline-flex items-center gap-1 font-bold text-brand-600 dark:text-brand-400">
                <Crown className="w-3 h-3 text-amber-500" />
                {isCeoOrAdmin ? 'Admin / CEO (Decide)' : 'HR Authority (Update)'}
              </span>
            </div>
          </div>

          {/* SECTION 1: 4 Core Numbers (Matching the 4 Columns in Payroll Table) */}
          <div className="p-4 bg-brand-50/40 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/40 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-100/60 dark:border-brand-900/30 pb-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900 dark:text-brand-200 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-brand-600" />
                  Core Compensation Numbers (Table Columns)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Every number can be edited manually. You can also use the auto-calculation helpers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  icon={Calculator}
                  onClick={handleAutoCalculateFromCtc}
                  title="Auto-fill standard 50% Basic, 25% HRA, standard deductions from Annual CTC"
                >
                  Auto-fill from CTC
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  icon={Sparkles}
                  onClick={handleSumDeductionsAndNet}
                  title="Re-calculate Net In-Hand from Monthly Gross minus Deductions"
                >
                  Recalculate Net
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Annual CTC (₹) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 1800000"
                  value={salaryForm.annualCtc}
                  onChange={(e) => handleSalaryFieldChange('annualCtc', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Monthly Gross (₹) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 150000"
                  value={salaryForm.monthlyGross}
                  onChange={(e) => handleSalaryFieldChange('monthlyGross', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                  Net In-Hand (₹) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 140500"
                  value={salaryForm.netTakeHome}
                  onChange={(e) => handleSalaryFieldChange('netTakeHome', e.target.value)}
                  className="font-bold text-emerald-600 dark:text-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
                  Monthly Deductions (₹) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 9500"
                  value={salaryForm.totalDeductions}
                  onChange={(e) => handleSalaryFieldChange('totalDeductions', e.target.value)}
                  className="font-semibold text-rose-600 dark:text-rose-400"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Monthly Earnings Breakdown */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
                Monthly Earnings Breakdown (₹)
              </h4>
              <p className="text-[11px] text-slate-400">
                Manually edit individual allowance numbers for the Detailed Salary Structure view.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Basic Salary (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 75000"
                  value={salaryForm.basic}
                  onChange={(e) => handleSalaryFieldChange('basic', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  House Rent Allowance (HRA) (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 37500"
                  value={salaryForm.hra}
                  onChange={(e) => handleSalaryFieldChange('hra', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Special Allowance (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 34650"
                  value={salaryForm.special}
                  onChange={(e) => handleSalaryFieldChange('special', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Conveyance Allowance (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 1600"
                  value={salaryForm.conveyance}
                  onChange={(e) => handleSalaryFieldChange('conveyance', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Medical Allowance (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 1250"
                  value={salaryForm.medical}
                  onChange={(e) => handleSalaryFieldChange('medical', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Monthly Deductions Breakdown */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                Monthly Deductions Breakdown (₹)
              </h4>
              <p className="text-[11px] text-slate-400">
                Manually edit individual statutory and withholding deduction numbers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  EPF / Provident Fund (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 1800"
                  value={salaryForm.epf}
                  onChange={(e) => handleSalaryFieldChange('epf', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Professional Tax (PT) (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 200"
                  value={salaryForm.professionalTax}
                  onChange={(e) => handleSalaryFieldChange('professionalTax', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Income Tax / TDS (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 7500"
                  value={salaryForm.tds}
                  onChange={(e) => handleSalaryFieldChange('tds', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Other Deductions (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 0"
                  value={salaryForm.otherDeductions}
                  onChange={(e) => handleSalaryFieldChange('otherDeductions', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Direct Deposit Bank & Statutory Registrations (Collapsible) */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBankStatutory(!showBankStatutory)}
              className="w-full p-4 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bank Account & Statutory Registrations (Optional)
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  showBankStatutory ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showBankStatutory && (
              <div className="p-4 space-y-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Bank Name
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. HDFC Bank"
                      value={salaryForm.bankName}
                      onChange={(e) => handleSalaryFieldChange('bankName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Bank Account Number
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. 501002348572"
                      value={salaryForm.bankAccountNumber}
                      onChange={(e) => handleSalaryFieldChange('bankAccountNumber', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      IFSC Code
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      value={salaryForm.bankIfsc}
                      onChange={(e) => handleSalaryFieldChange('bankIfsc', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Branch
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Cyber City Branch"
                      value={salaryForm.bankBranch}
                      onChange={(e) => handleSalaryFieldChange('bankBranch', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      UAN Number
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. 101294820194"
                      value={salaryForm.uanNumber}
                      onChange={(e) => handleSalaryFieldChange('uanNumber', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      PF Number
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. KN/BLR/1029384"
                      value={salaryForm.pfNumber}
                      onChange={(e) => handleSalaryFieldChange('pfNumber', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      ESI Scheme
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Exempted"
                      value={salaryForm.esiNumber}
                      onChange={(e) => handleSalaryFieldChange('esiNumber', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      PAN Number
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. ABCDE1234F"
                      value={salaryForm.panNumber}
                      onChange={(e) => handleSalaryFieldChange('panNumber', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
              disabled={salarySaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={salarySaving}
              icon={CheckCircle2}
            >
              {isCeoOrAdmin ? 'Decide & Save Salary' : 'Save Salary Structure'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Individual Employee Pay / Disbursement Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        maxWidth="max-w-md"
        title="Disburse Monthly Salary"
        subtitle={payingEmployee ? `Process salary payment for ${payingEmployee.fullName} (${payingEmployee.employeeCode})` : ''}
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2 text-center">
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              Net In-Hand Disbursement
            </p>
            <p className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              ₹{payingEmployee?.netTakeHome?.toLocaleString('en-IN') || 0}
            </p>
            <p className="text-xs text-slate-500">
              Monthly Gross: ₹{payingEmployee?.monthlyGross?.toLocaleString('en-IN') || 0} • Deductions: ₹{payingEmployee?.totalDeductions?.toLocaleString('en-IN') || 0}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2 text-xs border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Recipient:</span>
              <span className="font-bold text-slate-900 dark:text-white">{payingEmployee?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Role & Dept:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{payingEmployee?.role} ({payingEmployee?.department})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Mode:</span>
              <span className="font-bold text-slate-900 dark:text-white">Direct Bank Transfer</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bank Account:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {payingEmployee?.bankAccountNumber ? `•••• ${payingEmployee.bankAccountNumber.slice(-4)}` : '•••• 5678 (Direct Deposit)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPayModalOpen(false)}
              disabled={payProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={payProcessing}
              icon={CheckCircle2}
              onClick={handleConfirmPay}
            >
              Confirm & Disburse Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Organization Payroll Disbursement Modal */}
      <Modal
        isOpen={disburseAllModalOpen}
        onClose={() => setDisburseAllModalOpen(false)}
        maxWidth="max-w-md"
        title="Run Organization-Wide Payroll"
        subtitle="Disburse monthly compensation to all salaried employees"
      >
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-br from-brand-600 to-indigo-700 text-white rounded-2xl space-y-2 text-center">
            <p className="text-xs text-brand-100 font-semibold uppercase tracking-wider">
              Total Payroll Disbursement
            </p>
            <p className="text-3xl font-black font-mono">
              ₹{orgPayroll?.summary?.totalMonthlyInHand?.toLocaleString('en-IN') || 0}
            </p>
            <p className="text-xs text-brand-100">
              For {orgPayroll?.employees?.length || 0} Salaried Staff Members
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2 text-xs border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Annual CTC Managed:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                ₹{orgPayroll?.summary?.totalAnnualCtc?.toLocaleString('en-IN') || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Statutory Deductions:</span>
              <span className="font-bold text-rose-600 font-mono">
                ₹{orgPayroll?.summary?.totalMonthlyDeductions?.toLocaleString('en-IN') || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Disbursement Method:</span>
              <span className="font-bold text-slate-900 dark:text-white">Direct Bank Wire / NEFT Batch</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisburseAllModalOpen(false)}
              disabled={disburseAllProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={disburseAllProcessing}
              icon={CheckCircle2}
              onClick={handleConfirmDisburseAll}
            >
              Execute Batch Disbursement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PayrollPage;
