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
  Briefcase,
  ChevronRight,
  Layers,
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
  const isCeoOrAdmin = ['admin', 'superadmin', 'orgadmin'].some((r) => normRole.includes(r));
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
  const [newSalary, setNewSalary] = useState('');
  const [salarySaving, setSalarySaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

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

  // Open salary decision modal
  const handleOpenEditSalary = (emp) => {
    setEditingEmployee(emp);
    setNewSalary(emp.salary || emp.rawSalary || '');
    setSaveSuccessMsg(null);
    setEditModalOpen(true);
  };

  // Submit salary change
  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!editingEmployee || !newSalary) return;
    try {
      setSalarySaving(true);
      setError(null);
      await payrollService.updateEmployeeSalary(editingEmployee.id, newSalary);
      setSaveSuccessMsg(`Salary successfully updated for ${editingEmployee.fullName || editingEmployee.name || 'employee'}.`);

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
      setError(err.message || 'Failed to update employee salary.');
    } finally {
      setSalarySaving(false);
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
      header: 'Actions',
      key: 'actions',
      accessor: (row) => (
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
              title="Decide or update employee salary"
            >
              {isCeoOrAdmin ? 'Decide Salary' : 'Update Salary'}
            </Button>
          )}
        </div>
      ),
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
                <span>Workforce Roster</span>
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
                    Currently viewing: <span className="font-bold text-slate-900 dark:text-white">{employee?.fullName}</span> ({employee?.employeeCode}) — {employee?.role}
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
                  <option value="">My Own Salary Profile</option>
                  {orgPayroll?.employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      [{emp.employeeCode}] {emp.fullName} ({emp.role})
                    </option>
                  ))}
                </select>

                {(isCeoOrAdmin || isHr) && employee && (
                  <Button
                    size="xs"
                    variant="primary"
                    icon={Edit3}
                    onClick={() => handleOpenEditSalary(employee)}
                  >
                    {isCeoOrAdmin ? 'Decide Salary' : 'Update Salary'}
                  </Button>
                )}
              </div>
            </div>
          )}

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
        </div>
      )}

      {/* Decide / Edit Salary Modal (Admin/CEO & HR) */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={isCeoOrAdmin ? 'Decide Employee Salary' : 'Update Employee Salary'}
        subtitle={
          editingEmployee
            ? `Set official compensation for ${editingEmployee.fullName || editingEmployee.name} (${editingEmployee.employeeCode})`
            : ''
        }
      >
        <form onSubmit={handleSaveSalary} className="p-6 space-y-4">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {saveSuccessMsg}
            </div>
          )}

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Employee:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{editingEmployee?.fullName}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Designation:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{editingEmployee?.designation}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Current Annual CTC:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                ₹{(editingEmployee?.annualCtc || editingEmployee?.salary || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isCeoOrAdmin ? 'Decided Base Salary / Annual CTC (₹)' : 'Updated Base Salary / Annual CTC (₹)'}
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="e.g. 1200000"
              value={newSalary}
              onChange={(e) => setNewSalary(e.target.value)}
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Enter annual CTC or gross amount. Standard statutory breakdown (Basic 50%, HRA 25%, EPF 12%, etc.) will be computed automatically.
            </p>
          </div>

          {/* Quick preview calculation */}
          {Number(newSalary) > 0 && (
            <div className="p-3 bg-brand-50/60 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30 rounded-xl grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Monthly Gross</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ₹{(Number(newSalary) > 150000 ? Math.round(Number(newSalary) / 12) : Number(newSalary)).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Annual CTC</span>
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                  ₹{(Number(newSalary) > 150000 ? Math.round(Number(newSalary) / 12) * 12 : Number(newSalary) * 12).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
              {isCeoOrAdmin ? 'Decide & Save Salary' : 'Save Salary'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PayrollPage;
