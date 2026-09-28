import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  Users,
  RefreshCw,
  PieChart,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  User,
  ShieldCheck,
  Building,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import { leaveService } from '../../services/leaveService.js';
import { employeeService } from '../../services/employeeService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { ApplyLeaveModal } from './ApplyLeaveModal.jsx';

export const EmployeeLeaveBalancesViewer = ({ onAssignLeave }) => {
  const toast = useToast();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Local fallback assign modal state
  const [localAssignEmpId, setLocalAssignEmpId] = useState(null);
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);

  const handleTriggerAssign = (empId) => {
    if (onAssignLeave) {
      onAssignLeave(empId);
    } else {
      setLocalAssignEmpId(empId);
      setIsLocalModalOpen(true);
    }
  };

  // Single employee balances
  const [employeeBalances, setEmployeeBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState(null);

  // All employees balances overview
  const [allBalances, setAllBalances] = useState([]);
  const [loadingAllBalances, setLoadingAllBalances] = useState(false);
  const [allTableSearch, setAllTableSearch] = useState('');

  // 1. Fetch employee list
  const fetchEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const res = await employeeService.listEmployees({ limit: 150 });
      const list = Array.isArray(res?.employees)
        ? res.employees
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];
      setEmployees(list);
      if (list.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load employees for leave balance viewer:', err);
      toast.showError?.(err.message || 'Failed to load employee list.');
    } finally {
      setLoadingEmployees(false);
    }
  }, [selectedEmployeeId, toast]);

  // 2. Fetch selected employee's balances
  const fetchEmployeeBalances = useCallback(async (empId, year) => {
    if (!empId) return;
    try {
      setLoadingBalances(true);
      setBalancesError(null);
      const balances = await leaveService.getEmployeeBalances(empId, year);
      setEmployeeBalances(Array.isArray(balances) ? balances : []);
    } catch (err) {
      console.error('Failed to fetch employee leave balances:', err);
      setBalancesError(err.message || 'Failed to fetch employee leave balances.');
      setEmployeeBalances([]);
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  // 3. Fetch all employees balances overview
  const fetchAllBalances = useCallback(async (year) => {
    try {
      setLoadingAllBalances(true);
      const res = await leaveService.getAllEmployeeBalances(year);
      setAllBalances(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load all employees leave balances overview:', err);
      setAllBalances([]);
    } finally {
      setLoadingAllBalances(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchAllBalances(selectedYear);
  }, [fetchEmployees, fetchAllBalances, selectedYear]);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeBalances(selectedEmployeeId, selectedYear);
    }
  }, [selectedEmployeeId, selectedYear, fetchEmployeeBalances]);

  // Filtered employees for dropdown/search
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const q = searchTerm.toLowerCase();
    return employees.filter((emp) => {
      const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const code = (emp.employeeCode || emp.employeeNumber || '').toLowerCase();
      const dept = (emp.departmentName || emp.department?.name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [employees, searchTerm]);

  // Currently selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filtered all balances table
  const filteredAllBalances = useMemo(() => {
    if (!allTableSearch.trim()) return allBalances;
    const q = allTableSearch.toLowerCase();
    return allBalances.filter((item) => {
      const name = `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase();
      const code = (item.employee_code || '').toLowerCase();
      const dept = (item.department_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [allBalances, allTableSearch]);

  // Compute total remaining days for selected employee
  const totalRemaining = useMemo(() => {
    return employeeBalances.reduce((sum, b) => sum + (parseFloat(b.remainingDays) || 0), 0);
  }, [employeeBalances]);

  const totalAllocated = useMemo(() => {
    return employeeBalances.reduce((sum, b) => sum + (parseFloat(b.allocatedDays) || 0), 0);
  }, [employeeBalances]);

  const totalUsed = useMemo(() => {
    return employeeBalances.reduce((sum, b) => sum + (parseFloat(b.usedDays) || 0), 0);
  }, [employeeBalances]);

  const totalPending = useMemo(() => {
    return employeeBalances.reduce((sum, b) => sum + (parseFloat(b.pendingDays) || 0), 0);
  }, [employeeBalances]);

  const getCategoryColor = (code) => {
    const c = (code || '').toUpperCase();
    if (c === 'PL' || c === 'AL') {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-400',
        bar: 'bg-emerald-500',
      };
    }
    if (c === 'CL') {
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-400',
        bar: 'bg-blue-500',
      };
    }
    if (c === 'SL') {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-400',
        bar: 'bg-amber-500',
      };
    }
    if (c === 'ML' || c === 'PTL') {
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        border: 'border-purple-200 dark:border-purple-800',
        text: 'text-purple-700 dark:text-purple-400',
        bar: 'bg-purple-500',
      };
    }
    return {
      bg: 'bg-slate-50 dark:bg-slate-800/60',
      border: 'border-slate-200 dark:border-slate-700',
      text: 'text-slate-700 dark:text-slate-300',
      bar: 'bg-brand-500',
    };
  };

  const selectEmployeeAndScroll = (empId) => {
    setSelectedEmployeeId(empId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-80 h-80 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-200 text-xs font-semibold backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-300" />
              Admin & HR Executive Oversight
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Employee Leave Balances & Remaining Buckets
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
              Select any employee across the organization to view their real-time remaining leave balances, category-wise entitlement buckets, and utilization.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
              <Calendar className="w-3.5 h-3.5 text-indigo-200" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                {[currentYear, currentYear - 1, currentYear + 1].map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    Year {y}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                if (selectedEmployeeId) fetchEmployeeBalances(selectedEmployeeId, selectedYear);
                fetchAllBalances(selectedYear);
              }}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Employee Selection Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Select Employee
              </h3>
              <p className="text-xs text-slate-500">
                Choose an employee from the directory to inspect their leave buckets.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee by name/code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>

            {/* Employee Dropdown */}
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer max-w-xs"
            >
              {filteredEmployees.length === 0 ? (
                <option value="">No matching employees</option>
              ) : (
                filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode || emp.employeeNumber || emp.id})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Selected Employee Summary Card */}
        {selectedEmployee && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-3.5">
              <Avatar
                src={selectedEmployee.avatarUrl}
                firstName={selectedEmployee.firstName}
                lastName={selectedEmployee.lastName}
                name={`${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`}
                size="md"
                className="ring-2 ring-brand-300"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {selectedEmployee.employeeCode || selectedEmployee.employeeNumber || selectedEmployee.id}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>{selectedEmployee.designationTitle || selectedEmployee.designation?.title || 'Team Member'}</span>
                  <span>•</span>
                  <span>{selectedEmployee.departmentName || selectedEmployee.department?.name || 'Operations'}</span>
                </div>
              </div>
            </div>

            {/* Total Balance Pill & Assign Leave Action */}
            <div className="flex items-center gap-4 self-start md:self-center flex-wrap">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Remaining Leave
                </span>
                <span className="text-xl font-black text-brand-600 dark:text-brand-400">
                  {totalRemaining.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-500">Days</span>
                </span>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <div className="text-right hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Entitlement
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {totalAllocated.toFixed(1)} Days
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={CalendarDays}
                onClick={() => handleTriggerAssign(selectedEmployee.id)}
                className="shadow-sm font-bold"
              >
                Assign Leave
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Category-Wise Leave Buckets Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Category-Wise Remaining Leave Buckets ({selectedYear})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {employeeBalances.length} leave categor{employeeBalances.length === 1 ? 'y' : 'ies'} allocated
          </span>
        </div>

        {loadingBalances ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <LoadingSpinner message="Loading category-wise leave balances..." />
          </div>
        ) : balancesError ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900 p-6 text-center text-rose-600 text-xs">
            {balancesError}
          </div>
        ) : employeeBalances.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 text-xs">
            No leave entitlement allocations recorded for this employee for {selectedYear}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {employeeBalances.map((bal) => {
              const theme = getCategoryColor(bal.leaveTypeCode);
              const allocated = parseFloat(bal.allocatedDays) || 0;
              const used = parseFloat(bal.usedDays) || 0;
              const pending = parseFloat(bal.pendingDays) || 0;
              const remaining = parseFloat(bal.remainingDays) || 0;
              const usedPercent = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;

              return (
                <div
                  key={bal.id || bal.leaveTypeId}
                  className={`rounded-2xl border p-4 shadow-2xs space-y-3 bg-white dark:bg-slate-900 ${theme.border} transition hover:shadow-md`}
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Category
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={bal.leaveTypeName}>
                        {bal.leaveTypeName}
                      </h4>
                    </div>
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${theme.bg} ${theme.text} border ${theme.border}`}>
                      {bal.leaveTypeCode || 'LEAVE'}
                    </span>
                  </div>

                  {/* Main Remaining Bucket Highlight */}
                  <div className={`p-3 rounded-xl ${theme.bg} border ${theme.border} text-center`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Remaining Balance
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {remaining.toFixed(1)}{' '}
                      <span className="text-xs font-semibold text-slate-500">Days</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${theme.bar} transition-all duration-300`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{usedPercent}% consumed</span>
                      <span>{allocated.toFixed(1)} total</span>
                    </div>
                  </div>

                  {/* Breakdown footer */}
                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-[10px]">
                    <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-400 block font-medium">Allocated</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{allocated.toFixed(1)}</span>
                    </div>
                    <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-400 block font-medium">Used</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{used.toFixed(1)}</span>
                    </div>
                    <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-400 block font-medium">Pending</span>
                      <span className="font-bold text-amber-600">{pending.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. All Employees Leave Balances Summary Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              All Employees Leave Balances Directory ({selectedYear})
            </h3>
            <p className="text-xs text-slate-500">
              Overview of remaining balances across all organizational employees. Click "Inspect Buckets" on any employee to view their detailed breakdown.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search table by name/dept..."
              value={allTableSearch}
              onChange={(e) => setAllTableSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {loadingAllBalances ? (
          <div className="py-12 text-center">
            <LoadingSpinner message="Loading all employees leave balances..." />
          </div>
        ) : filteredAllBalances.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            No employee leave balance records found for the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3 text-center">Annual (PL)</th>
                  <th className="p-3 text-center">Casual (CL)</th>
                  <th className="p-3 text-center">Sick (SL)</th>
                  <th className="p-3 text-center">Total Remaining</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAllBalances.map((item) => {
                  const bList = Array.isArray(item.balances) ? item.balances : [];
                  const pl = bList.find((b) => (b.leaveTypeCode || '').toUpperCase() === 'PL');
                  const cl = bList.find((b) => (b.leaveTypeCode || '').toUpperCase() === 'CL');
                  const sl = bList.find((b) => (b.leaveTypeCode || '').toUpperCase() === 'SL');
                  const totalRem = bList.reduce((acc, b) => acc + (parseFloat(b.remainingDays) || 0), 0);
                  const isSelected = item.id === selectedEmployeeId;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => selectEmployeeAndScroll(item.id)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition ${
                        isSelected ? 'bg-brand-50/50 dark:bg-brand-950/30 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={item.avatar_url}
                            firstName={item.first_name}
                            lastName={item.last_name}
                            name={`${item.first_name || ''} ${item.last_name || ''}`}
                            size="sm"
                          />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {item.first_name} {item.last_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              {item.employee_code || item.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.department_name || 'General'}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.designation_title || 'Staff'}
                      </td>

                      {/* PL */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-xs">
                          {pl ? parseFloat(pl.remainingDays).toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* CL */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-xs">
                          {cl ? parseFloat(cl.remainingDays).toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* SL */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-xs">
                          {sl ? parseFloat(sl.remainingDays).toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* Total Remaining */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="font-black text-brand-600 dark:text-brand-400 text-xs">
                          {totalRem.toFixed(1)} Days
                        </span>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerAssign(item.id);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 rounded-lg transition cursor-pointer"
                          >
                            Assign Leave
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectEmployeeAndScroll(item.id);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900 rounded-lg transition cursor-pointer"
                          >
                            Inspect Buckets ➔
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fallback Local ApplyLeaveModal if used standalone */}
      {!onAssignLeave && isLocalModalOpen && (
        <ApplyLeaveModal
          isOpen={isLocalModalOpen}
          onClose={() => {
            setIsLocalModalOpen(false);
            setLocalAssignEmpId(null);
          }}
          onSuccess={() => {
            if (selectedEmployeeId) fetchEmployeeBalances(selectedEmployeeId, selectedYear);
            fetchAllBalances(selectedYear);
          }}
          initialEmployeeId={localAssignEmpId}
        />
      )}
    </div>
  );
};
