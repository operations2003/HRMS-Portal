import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { employeeService } from '../../services/employeeService.js';
import { designationService } from '../../services/designationService.js';
import { departmentService } from '../../services/departmentService.js';
import { leaveService } from '../../services/leaveService.js';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  IndianRupee,
  Lock,
  KeyRound,
  Clock,
  X,
  Landmark,
  ShieldCheck,
  UserCheck,
  Home,
  User as UserIcon,
  Wallet,
  Calculator,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { PasswordInput } from '../../components/common/PasswordInput.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Can } from '../../components/rbac/Can.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { EmployeeTimelineModal } from '../../components/employees/EmployeeTimelineModal.jsx';
import { AssignManagerModal } from '../../components/team/AssignManagerModal.jsx';
const getProbationEndDate = (startDate) => {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().split('T')[0];
};

export const EmployeeListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [metadata, setMetadata] = useState({ organizations: [], departments: [], designations: [], roles: [], managers: [], hrs: [] });
  const [error, setError] = useState(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [loadingViewProfile, setLoadingViewProfile] = useState(false);
  const [timelineEmployee, setTimelineEmployee] = useState(null);
  const [reassigningEmployee, setReassigningEmployee] = useState(null);

  // Leave Quotas & Entitlements State (Decided by Admin) - 11 Standard Company Categories
  const [leaveTypes, setLeaveTypes] = useState([
    { id: 'lt-pl', name: 'Planned Leave', code: 'PL', daysPerYear: 0, description: 'Pre-planned annual leave and scheduled vacations', genderEligibility: 'ALL' },
    { id: 'lt-upl', name: 'Unplanned Leave', code: 'UPL', daysPerYear: 0, description: 'Sudden urgent or emergency unplanned absence', genderEligibility: 'ALL' },
    { id: 'lt-cl', name: 'Casual Leave', code: 'CL', daysPerYear: 0, description: 'Casual leave for personal affairs and short breaks', genderEligibility: 'ALL' },
    { id: 'lt-sl', name: 'Sick Leave', code: 'SL', daysPerYear: 0, description: 'Medical leave for illness or health recovery', genderEligibility: 'ALL' },
    { id: 'lt-hl', name: 'Holiday', code: 'HL', daysPerYear: 0, description: 'Official public holiday or declared company day-off', genderEligibility: 'ALL' },
    { id: 'lt-hdl', name: 'Half Day', code: 'HDL', daysPerYear: 0, description: 'Half-day leave for morning or afternoon session (0.5 day)', genderEligibility: 'ALL' },
    { id: 'lt-awol', name: 'Absent Without Leave(AWOL)', code: 'AWOL', daysPerYear: 0, description: 'Unauthorized absence without prior notice or approved leave', genderEligibility: 'ALL' },
    { id: 'lt-lop', name: 'Leave without pay (LOP)', code: 'LOP', daysPerYear: 0, description: 'Loss of pay / unpaid leave of absence', genderEligibility: 'ALL' },
    { id: 'lt-ml', name: 'Maternity Leave', code: 'ML', daysPerYear: 0, description: 'Maternity leave for prenatal, postnatal, and childcare recovery', genderEligibility: 'FEMALE' },
    { id: 'lt-sbl', name: 'Sabbatical Leave', code: 'SBL', daysPerYear: 0, description: 'Extended leave for research, education, or personal enrichment', genderEligibility: 'ALL' },
    { id: 'lt-ptl', name: 'Paternity Leave', code: 'PTL', daysPerYear: 0, description: 'Paternity leave for new fathers upon birth or adoption', genderEligibility: 'MALE' },
  ]);
  const [leaveAllocations, setLeaveAllocations] = useState({
    'lt-pl': 0,
    'lt-upl': 0,
    'lt-cl': 0,
    'lt-sl': 0,
    'lt-hl': 0,
    'lt-hdl': 0,
    'lt-awol': 0,
    'lt-lop': 0,
    'lt-ml': 0,
    'lt-sbl': 0,
    'lt-ptl': 0,
  });
  const [loadingLeaveBalances, setLoadingLeaveBalances] = useState(false);
  const [viewingLeaveBalances, setViewingLeaveBalances] = useState([]);

  // Manual Shift Timing State (From & To with AM/PM)
  const [shiftFromTime, setShiftFromTime] = useState('11:00');
  const [shiftFromPeriod, setShiftFromPeriod] = useState('AM');
  const [shiftToTime, setShiftToTime] = useState('07:00');
  const [shiftToPeriod, setShiftToPeriod] = useState('PM');

  // Comprehensive Salary Structure State (Decided by Admin)
  const [salaryStructure, setSalaryStructure] = useState({
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
  });
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(true);
  const [showDeductionsBreakdown, setShowDeductionsBreakdown] = useState(true);

  // Auto-calculate full breakdown based on Annual CTC
  const handleAutoCalculateFromCtc = (customCtc) => {
    const ctc = parseFloat(customCtc !== undefined ? customCtc : salaryStructure.annualCtc) || 0;
    const gross = ctc > 0 ? Math.round(ctc / 12) : 0;
    const basic = Math.round(gross * 0.5);
    const hra = Math.round(gross * 0.25);
    const conveyance = gross >= 15000 ? 1600 : Math.round(gross * 0.10);
    const medical = gross >= 15000 ? 1250 : Math.round(gross * 0.05);
    const special = Math.max(0, gross - basic - hra - conveyance - medical);
    const epf = Math.round(Math.min(basic, 15000) * 0.12);
    const pt = gross >= 15000 ? 200 : 0;
    const tds = gross > 50000 ? Math.round(gross * 0.05) : 0;
    const other = parseFloat(salaryStructure.otherDeductions) || 0;
    const totalDed = epf + pt + tds + other;
    const net = Math.max(0, gross - totalDed);

    setSalaryStructure((prev) => ({
      ...prev,
      annualCtc: ctc > 0 ? ctc.toString() : '',
      monthlyGross: gross > 0 ? gross.toString() : '',
      basic: basic > 0 ? basic.toString() : '',
      hra: hra > 0 ? hra.toString() : '',
      special: special > 0 ? special.toString() : '',
      conveyance: conveyance > 0 ? conveyance.toString() : '',
      medical: medical > 0 ? medical.toString() : '',
      epf: epf > 0 ? epf.toString() : '',
      professionalTax: pt > 0 ? pt.toString() : '',
      tds: tds > 0 ? tds.toString() : '',
      totalDeductions: totalDed > 0 ? totalDed.toString() : '',
      netTakeHome: net > 0 ? net.toString() : '',
    }));
    setFormData((prev) => ({
      ...prev,
      salary: ctc > 0 ? ctc.toString() : '',
    }));
  };

  // Re-sum deductions and net take home
  const handleSumDeductionsAndNet = () => {
    const epf = parseFloat(salaryStructure.epf) || 0;
    const pt = parseFloat(salaryStructure.professionalTax) || 0;
    const tds = parseFloat(salaryStructure.tds) || 0;
    const other = parseFloat(salaryStructure.otherDeductions) || 0;
    const totalDed = epf + pt + tds + other;
    const gross = parseFloat(salaryStructure.monthlyGross) || 0;
    const net = Math.max(0, gross - totalDed);

    setSalaryStructure((prev) => ({
      ...prev,
      totalDeductions: totalDed > 0 ? totalDed.toString() : '0',
      netTakeHome: net > 0 ? net.toString() : '0',
    }));
  };

  const handleSalaryStructureFieldChange = (field, val) => {
    setSalaryStructure((prev) => {
      const updated = { ...prev, [field]: val };
      if (field === 'annualCtc') {
        setFormData((fd) => ({ ...fd, salary: val }));
      }
      return updated;
    });
  };

  const parseShiftTiming = (str) => {
    if (!str) return { fromTime: '11:00', fromPeriod: 'AM', toTime: '07:00', toPeriod: 'PM' };
    const match = str.match(/^(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i);
    if (match) {
      return {
        fromTime: match[1],
        fromPeriod: match[2].toUpperCase(),
        toTime: match[3],
        toPeriod: match[4].toUpperCase(),
      };
    }
    return { fromTime: '11:00', fromPeriod: 'AM', toTime: '07:00', toPeriod: 'PM' };
  };

  // Quick Add Department Modal
  const [isQuickAddDeptOpen, setIsQuickAddDeptOpen] = useState(false);
  const [quickDeptName, setQuickDeptName] = useState('');
  const [quickDeptCode, setQuickDeptCode] = useState('');
  const [quickDeptDescription, setQuickDeptDescription] = useState('');
  const [quickDeptLoading, setQuickDeptLoading] = useState(false);
  const [quickDeptError, setQuickDeptError] = useState(null);

  const handleQuickAddDepartment = async (e) => {
    e.preventDefault();
    if (!quickDeptName.trim()) {
      setQuickDeptError('Department name is required.');
      return;
    }
    try {
      setQuickDeptLoading(true);
      setQuickDeptError(null);
      const res = await departmentService.createDepartment({
        name: quickDeptName.trim(),
        code: quickDeptCode.trim().toUpperCase(),
        description: quickDeptDescription.trim(),
        orgId: formData.orgId || metadata.organizations?.[0]?.id || 'org-1',
      });
      const freshMeta = await employeeService.getMetadata();
      setMetadata(freshMeta);
      const newDeptId =
        res?.id ||
        res?.data?.id ||
        freshMeta.departments?.find(
          (d) => d.name.toLowerCase() === quickDeptName.trim().toLowerCase()
        )?.id;
      if (newDeptId) {
        setFormData((prev) => ({ ...prev, deptId: newDeptId }));
      }
      setIsQuickAddDeptOpen(false);
      setQuickDeptName('');
      setQuickDeptCode('');
      setQuickDeptDescription('');
      toast?.success?.(`Department "${quickDeptName.trim()}" added successfully!`);
    } catch (err) {
      setQuickDeptError(err.message || 'Failed to create department.');
    } finally {
      setQuickDeptLoading(false);
    }
  };

  // Quick Add Designation Modal
  const [isQuickAddDesigOpen, setIsQuickAddDesigOpen] = useState(false);
  const [quickDesigTitle, setQuickDesigTitle] = useState('');
  const [quickDesigCode, setQuickDesigCode] = useState('');
  const [quickDesigLoading, setQuickDesigLoading] = useState(false);
  const [quickDesigError, setQuickDesigError] = useState(null);

  const handleQuickAddDesignation = async (e) => {
    e.preventDefault();
    if (!quickDesigTitle.trim()) {
      setQuickDesigError('Designation title is required.');
      return;
    }
    try {
      setQuickDesigLoading(true);
      setQuickDesigError(null);
      const res = await designationService.createDesignation({
        title: quickDesigTitle.trim(),
        code: quickDesigCode.trim().toUpperCase(),
      });
      const freshMeta = await employeeService.getMetadata();
      setMetadata(freshMeta);
      if (res?.data?.id) {
        setFormData((prev) => ({ ...prev, desigId: res.data.id }));
      }
      setIsQuickAddDesigOpen(false);
      setQuickDesigTitle('');
      setQuickDesigCode('');
      toast?.success?.(`Designation "${quickDesigTitle.trim()}" added successfully!`);
    } catch (err) {
      setQuickDesigError(err.message || 'Failed to create designation.');
    } finally {
      setQuickDesigLoading(false);
    }
  };

  // Quick Add Leave Category Modal
  const [isQuickAddLeaveTypeOpen, setIsQuickAddLeaveTypeOpen] = useState(false);
  const [quickLTName, setQuickLTName] = useState('');
  const [quickLTCode, setQuickLTCode] = useState('');
  const [quickLTDesc, setQuickLTDesc] = useState('');
  const [quickLTDays, setQuickLTDays] = useState(0);
  const [quickLTGender, setQuickLTGender] = useState('ALL');
  const [quickLTLoading, setQuickLTLoading] = useState(false);
  const [quickLTError, setQuickLTError] = useState(null);

  const handleQuickAddLeaveType = async (e) => {
    e.preventDefault();
    if (!quickLTName.trim()) {
      setQuickLTError('Leave category name is required.');
      return;
    }
    try {
      setQuickLTLoading(true);
      setQuickLTError(null);
      const res = await leaveService.createLeaveType({
        name: quickLTName.trim(),
        code: (quickLTCode.trim() || quickLTName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 4)).toUpperCase(),
        description: quickLTDesc.trim(),
        daysPerYear: parseFloat(quickLTDays) || 0,
        genderEligibility: quickLTGender,
        isPaid: true,
        requiresApproval: true,
      });
      const freshTypes = await leaveService.getLeaveTypes({ all: true });
      if (freshTypes && freshTypes.length > 0) {
        setLeaveTypes(freshTypes);
        const newId = res?.id || freshTypes[freshTypes.length - 1]?.id;
        if (newId) {
          setLeaveAllocations((prev) => ({
            ...prev,
            [newId]: parseFloat(quickLTDays) || 0,
          }));
        }
      }
      setIsQuickAddLeaveTypeOpen(false);
      setQuickLTName('');
      setQuickLTCode('');
      setQuickLTDesc('');
      setQuickLTDays(0);
      setQuickLTGender('ALL');
      toast?.success?.(`Leave category "${quickLTName.trim()}" added successfully!`);
    } catch (err) {
      setQuickLTError(err.message || 'Failed to create leave category.');
    } finally {
      setQuickLTLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    orgId: '',
    deptId: '',
    desigId: '',
    roleId: '',
    password: '',
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'Male',
    dateOfJoining: '',
    employmentType: 'Full-Time',
    status: 'Active',
    salary: '',
    shiftTiming: '11:00 AM - 07:00 PM',
    managerId: '',
    hrId: '',
    fatherName: '',
    motherName: '',
    emergencyContact: '',
    address: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    uanNumber: '',
    probationStatus: 'IN_PROBATION',
    probationNotes: 'Standard 6-month probation period.',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formApiError, setFormApiError] = useState(null);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEmployees = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await employeeService.listEmployees({
        search,
        orgId: orgFilter,
        deptId: deptFilter,
        status: statusFilter,
        page,
        limit: 10,
      });
      setEmployees(res.employees);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const meta = await employeeService.getMetadata();
      setMetadata(meta);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }

    try {
      const types = await leaveService.getLeaveTypes({ all: true });
      if (Array.isArray(types) && types.length > 0) {
        const active = types.filter((t) => t.status === 'Active');
        if (active.length > 0) {
          setLeaveTypes(active);
        }
      }
    } catch (err) {
      console.warn('Using default leave types:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchEmployees(1);
  }, [search, orgFilter, deptFilter, statusFilter]);

  // Handle URL action (e.g. ?action=new)
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleOpenCreate();
      setSearchParams({});
    }
  }, [searchParams]);

  const handleOpenView = async (emp) => {
    setViewingEmployee(emp);
    setViewingLeaveBalances([]);
    leaveService.getEmployeeBalances(emp.id)
      .then((b) => setViewingLeaveBalances(b || []))
      .catch(() => {});
    try {
      setLoadingViewProfile(true);
      const full = await employeeService.getEmployeeById(emp.id);
      setViewingEmployee(full);
    } catch (err) {
      console.warn('Using cached employee row:', err);
    } finally {
      setLoadingViewProfile(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    const defaultRole =
      metadata.roles?.find((r) => r.name.toLowerCase() === 'employee')?.id ||
      metadata.roles?.[0]?.id ||
      'role-employee';
    setFormData({
      orgId: metadata.organizations[0]?.id || '',
      deptId: metadata.departments[0]?.id || '',
      desigId: metadata.designations[0]?.id || '',
      roleId: defaultRole,
      password: '',
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: 'Male',
      dateOfJoining: new Date().toISOString().split('T')[0],
      employmentType: 'Full-Time',
      status: 'Active',
      salary: '',
      shiftTiming: '11:00 AM - 07:00 PM',
      managerId: '',
      hrId: '',
      fatherName: '',
      motherName: '',
      emergencyContact: '',
      address: '',
      bankName: '',
      bankAccountNumber: '',
      bankIfsc: '',
      bankBranch: '',
      uanNumber: '',
      probationStatus: 'IN_PROBATION',
      probationNotes: 'Standard 6-month probation period.',
    });
    setShiftFromTime('11:00');
    setShiftFromPeriod('AM');
    setShiftToTime('07:00');
    setShiftToPeriod('PM');

    setSalaryStructure({
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
    });

    // Reset leave allocations to 0 (admin decides the exact numbers)
    const initialAlloc = {};
    leaveTypes.forEach((lt) => {
      initialAlloc[lt.id] = 0;
    });
    setLeaveAllocations(initialAlloc);

    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    const existingRoleId =
      emp.user?.roleId ||
      metadata.roles?.find((r) => r.name.toLowerCase() === 'employee')?.id ||
      'role-employee';
    setFormData({
      orgId: emp.orgId || '',
      deptId: emp.deptId || '',
      desigId: emp.desigId || '',
      roleId: existingRoleId,
      password: '',
      employeeCode: emp.employeeCode || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      gender: emp.gender || 'Male',
      dateOfJoining: emp.dateOfJoining || '',
      employmentType: emp.employmentType || 'Full-Time',
      status: emp.status || 'Active',
      salary: canViewSalary(emp) ? (emp.salary?.toString() || '') : '',
      shiftTiming: emp.shiftTiming || '11:00 AM - 07:00 PM',
      managerId: emp.managerId || emp.manager?.id || '',
      hrId: emp.hrId || emp.hr?.id || '',
      fatherName: emp.fatherName || '',
      motherName: emp.motherName || '',
      emergencyContact: emp.emergencyContact || '',
      address: emp.address || '',
      bankName: emp.bankName || '',
      bankAccountNumber: emp.bankAccountNumber || '',
      bankIfsc: emp.bankIfsc || '',
      bankBranch: emp.bankBranch || '',
      uanNumber: emp.uanNumber || '',
      probationStatus: emp.probationStatus || 'IN_PROBATION',
      probationStartDate: emp.probationStartDate || emp.dateOfJoining || '',
      probationEndDate: emp.probationEndDate || getProbationEndDate(emp.dateOfJoining) || '',
      probationNotes: emp.probationNotes || '',
    });
    const parsedShift = parseShiftTiming(emp.shiftTiming || '11:00 AM - 07:00 PM');
    setShiftFromTime(parsedShift.fromTime);
    setShiftFromPeriod(parsedShift.fromPeriod);
    setShiftToTime(parsedShift.toTime);
    setShiftToPeriod(parsedShift.toPeriod);

    // Prefill salary structure for existing employee
    const s = emp.salaryStructure || {};
    const rawSal = emp.salary ? String(emp.salary) : '';
    if (canViewSalary(emp)) {
      if (s.annualCtc || s.monthlyGross) {
        setSalaryStructure({
          annualCtc: s.annualCtc?.toString() || rawSal,
          monthlyGross: s.monthlyGross?.toString() || (rawSal ? String(Math.round(Number(rawSal) / 12)) : ''),
          netTakeHome: s.netTakeHome?.toString() || '',
          totalDeductions: s.totalDeductions?.toString() || '',
          basic: s.basic?.toString() || '',
          hra: s.hra?.toString() || '',
          special: s.special?.toString() || '',
          conveyance: s.conveyance?.toString() || '',
          medical: s.medical?.toString() || '',
          epf: s.epf?.toString() || '',
          professionalTax: s.professionalTax?.toString() || '',
          tds: s.tds?.toString() || '',
          otherDeductions: s.otherDeductions?.toString() || '',
        });
      } else if (rawSal && Number(rawSal) > 0) {
        handleAutoCalculateFromCtc(rawSal);
      } else {
        setSalaryStructure({
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
        });
      }
    } else {
      setSalaryStructure({
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
      });
    }

    // Prefill leave allocations for existing employee
    setLoadingLeaveBalances(true);
    leaveService.getEmployeeBalances(emp.id)
      .then((balances) => {
        const allocMap = {};
        (balances || []).forEach((b) => {
          allocMap[b.leaveTypeId] = parseFloat(b.allocatedDays ?? b.allocated_days ?? 0);
        });
        leaveTypes.forEach((lt) => {
          if (allocMap[lt.id] === undefined) {
            allocMap[lt.id] = 0;
          }
        });
        setLeaveAllocations(allocMap);
      })
      .catch((err) => {
        console.warn('Failed to load employee leave allocations:', err);
      })
      .finally(() => {
        setLoadingLeaveBalances(false);
      });

    setFormErrors({});
    setFormApiError(null);
    setIsFormOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.firstName.trim()) errs.firstName = 'First name is required.';
    if (!formData.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!formData.email.trim()) {
      errs.email = 'Work email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!formData.orgId) errs.orgId = 'Organization selection is required.';

    // Password validation: required when registering new employee, optional on edit
    if (!editingEmployee) {
      if (!formData.password) {
        errs.password = 'Login password is required for portal access.';
      } else if (formData.password.length < 6) {
        errs.password = 'Password must be at least 6 characters.';
      }
    } else {
      if (formData.password && formData.password.length < 6) {
        errs.password = 'New password must be at least 6 characters.';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormApiError(null);

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const computedShift = `${shiftFromTime.trim() || '11:00'} ${shiftFromPeriod} - ${shiftToTime.trim() || '07:00'} ${shiftToPeriod}`;
      
      const finalCtc = salaryStructure.annualCtc
        ? Number(salaryStructure.annualCtc)
        : (formData.salary ? Number(formData.salary) : 0);

      const payload = {
        ...formData,
        salary: finalCtc,
        salaryStructure: {
          annualCtc: finalCtc,
          monthlyGross: parseFloat(salaryStructure.monthlyGross) || 0,
          netTakeHome: parseFloat(salaryStructure.netTakeHome) || 0,
          totalDeductions: parseFloat(salaryStructure.totalDeductions) || 0,
          basic: parseFloat(salaryStructure.basic) || 0,
          hra: parseFloat(salaryStructure.hra) || 0,
          special: parseFloat(salaryStructure.special) || 0,
          conveyance: parseFloat(salaryStructure.conveyance) || 0,
          medical: parseFloat(salaryStructure.medical) || 0,
          epf: parseFloat(salaryStructure.epf) || 0,
          professionalTax: parseFloat(salaryStructure.professionalTax) || 0,
          tds: parseFloat(salaryStructure.tds) || 0,
          otherDeductions: parseFloat(salaryStructure.otherDeductions) || 0,
          bankName: formData.bankName || undefined,
          bankAccountNumber: formData.bankAccountNumber || undefined,
          bankIfsc: formData.bankIfsc || undefined,
          bankBranch: formData.bankBranch || undefined,
          uanNumber: formData.uanNumber || undefined,
        },
        managerId: formData.managerId || null,
        hrId: formData.hrId || null,
        shiftTiming: computedShift,
        leaveAllocations,
        probationStatus: formData.probationStatus || 'IN_PROBATION',
        probationStartDate: formData.probationStartDate || formData.dateOfJoining,
        probationEndDate: formData.probationStatus === 'CONFIRMED' ? null : (formData.probationEndDate || getProbationEndDate(formData.dateOfJoining)),
        probationNotes: formData.probationNotes || 'Standard 6-month probation period.',
      };

      if (editingEmployee && !canViewSalary(editingEmployee)) {
        delete payload.salary;
        delete payload.salaryStructure;
      }

      if (editingEmployee) {
        await employeeService.updateEmployee(editingEmployee.id, payload);
        toast.success(`Profile for '${formData.firstName} ${formData.lastName}' updated successfully.`);
      } else {
        await employeeService.createEmployee(payload);
        toast.success(`Employee '${formData.firstName} ${formData.lastName}' registered successfully with portal credentials.`);
      }
      setIsFormOpen(false);
      await fetchEmployees(pagination?.page || 1);
    } catch (err) {
      setFormApiError({
        message: err.message || 'Failed to save employee profile.',
        errors: err.errors || [],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await employeeService.deleteEmployee(deleteTarget.id);
      toast.success(`Employee record for '${deleteTarget.firstName} ${deleteTarget.lastName}' deactivated.`);
      setDeleteTarget(null);
      await fetchEmployees(pagination?.page || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to delete employee.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setOrgFilter('');
    setDeptFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = Boolean(search || orgFilter || deptFilter || statusFilter);

  // Determine if logged in user has salary view privilege (Admin/CEO, HR, or self only)
  const canViewSalary = (emp) => {
    if (!emp) return false;
    const allRoles = (Array.isArray(user?.roles) ? user.roles : [user?.roleName || user?.role || ''])
      .filter(Boolean)
      .map((r) => String(r).toLowerCase());
    const isHrOrAdmin =
      allRoles.some((r) => ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].some((adm) => r.includes(adm))) ||
      (user?.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';

    if (isHrOrAdmin) return true;

    // Strict self check: employees can only view their own salary
    const isSelf =
      (user?.email && emp.email && user.email.toLowerCase() === emp.email.toLowerCase()) ||
      (user?.id && emp.userId && user.id === emp.userId) ||
      (user?.employeeId && emp.id && user.employeeId === emp.id);

    return Boolean(isSelf);
  };

  const columns = [
    {
      header: 'Employee',
      accessor: 'firstName',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
            {row.firstName?.[0]}
            {row.lastName?.[0]}
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span>
                {row.firstName} {row.lastName}
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {row.employeeCode}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                row.gender === 'Female'
                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {row.gender || 'Male'}
              </span>
              {row.user?.roleName && (
                <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 flex items-center gap-1">
                  <KeyRound className="w-2.5 h-2.5" />
                  {row.user.roleName === 'Admin' ? 'CEO' : row.user.roleName}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Organization',
      accessor: (row) => row.organization?.name || '—',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.organization?.name || '—'}
        </span>
      ),
    },
    {
      header: 'Department',
      accessor: (row) =>
        (row.user?.roleName === 'Admin' || row.roleName === 'Admin' || row.designation?.title === 'CEO' || row.email === 'sheetalbedi@tasknera.com')
          ? (row.department?.name || 'Main')
          : (row.department?.name || 'Unassigned'),
      render: (row) => {
        const isAdminOrCeo =
          row.user?.roleName === 'Admin' ||
          row.roleName === 'Admin' ||
          row.designation?.title === 'CEO' ||
          row.email === 'sheetalbedi@tasknera.com';
        const deptTitle = isAdminOrCeo
          ? (row.department?.name && row.department?.name !== 'Unassigned' ? row.department.name : 'Main')
          : (row.department?.name || 'Unassigned');
        const desigTitle = isAdminOrCeo
          ? (row.designation?.title || 'CEO')
          : (row.designation?.title || 'Staff');
        return (
          <div>
            <div className="font-medium text-slate-800">{deptTitle}</div>
            <div className="text-xs text-slate-400">{desigTitle}</div>
          </div>
        );
      },
    },
    {
      header: 'Employment',
      accessor: 'employmentType',
      render: (row) => (
        <div>
          <div className="text-xs font-medium text-slate-700">{row.employmentType}</div>
          <div className="text-[11px] text-brand-700 flex items-center gap-1 mt-0.5 font-medium">
            <Clock className="w-3 h-3 text-brand-500" />
            {row.shiftTiming || '11:00 AM - 07:00 PM'}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            Joined {row.dateOfJoining || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Status & Probation',
      accessor: 'status',
      render: (row) => (
        <div className="space-y-1">
          <Badge>{row.status}</Badge>
          {row.probationStatus && (
            <div>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                row.probationStatus === 'CONFIRMED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : row.probationStatus === 'EXTENDED'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : row.probationStatus === 'REJECTED'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {row.probationStatus === 'IN_PROBATION' ? '6M Probation' : row.probationStatus}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Reporting & HR',
      key: 'hierarchy',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="font-medium truncate max-w-[130px]" title={row.manager?.fullName || 'No Manager'}>
              {row.manager?.fullName ? row.manager.fullName : <span className="text-slate-400 italic">No Manager</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium truncate max-w-[130px]" title={row.hr?.fullName || 'No HR'}>
              {row.hr?.fullName ? row.hr.fullName : <span className="text-slate-400 italic">No HR</span>}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Compensation',
      key: 'compensation',
      render: (row) => {
        if (canViewSalary(row)) {
          const sal = Number(row.salary);
          return (
            <div className="text-xs">
              <span className="font-semibold text-slate-800">
                {sal > 0 ? `₹${sal.toLocaleString('en-IN')}` : 'Not set'}
              </span>
              {sal > 0 && <span className="text-[10px] text-slate-400 block">/ yr</span>}
            </div>
          );
        }
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
            title="Confidential: Executive and HR access only"
          >
            <Lock className="w-3 h-3 text-slate-400" />
            Confidential
          </span>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={() => handleOpenView(row)}
            className="text-slate-600 hover:text-brand-600"
            title="View Details"
          >
            View
          </Button>
          <Can permission="employee:write">
            <Button
              variant="ghost"
              size="sm"
              icon={UserCheck}
              onClick={() => setReassigningEmployee(row)}
              className="text-slate-600 hover:text-brand-600"
              title="Assign / Reassign Reporting Manager & HR Partner"
            >
              Hierarchy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Edit2}
              onClick={() => handleOpenEdit(row)}
              className="text-slate-600 hover:text-brand-600"
              title="Edit Profile"
            >
              Edit
            </Button>
          </Can>
          <Can permission="employee:delete">
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => setDeleteTarget(row)}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              title="Deactivate/Delete"
            >
              Delete
            </Button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            Employees Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, manage, and maintain centralized employment and department records.
          </p>
        </div>

        <Can permission="employee:write">
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Add Employee
          </Button>
        </Can>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Input
              placeholder="Search by name, email, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <div>
            <Select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              placeholder="All Organizations"
              options={[
                { value: '', label: 'All Organizations' },
                ...metadata.organizations.map((o) => ({ value: o.id, label: o.name })),
              ]}
            />
          </div>
          <div>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              placeholder="All Departments"
              options={[
                { value: '', label: 'All Departments' },
                ...metadata.departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="All Statuses"
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filtered results active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium"
            >
              <X className="w-3.5 h-3.5" />
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Reusable Data Table */}
      <DataTable
        columns={columns}
        data={employees}
        isLoading={loading}
        error={error}
        pagination={pagination}
        onPageChange={(p) => fetchEmployees(p)}
        emptyTitle="No employees found"
        emptyDescription="Try adjusting your department or search filters."
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        maxWidth="max-w-2xl"
        title={editingEmployee ? `Edit ${editingEmployee.firstName} ${editingEmployee.lastName}` : 'Register New Employee'}
        subtitle={
          editingEmployee
            ? 'Update corporate employee parameters and departmental designations.'
            : 'Fill in the form to register an employee under an organization.'
        }
      >
        {formApiError && (
          <Alert
            type="error"
            title="Operation Failed"
            message={formApiError.message}
            errors={formApiError.errors}
            onClose={() => setFormApiError(null)}
            className="mb-5"
          />
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="First name"
              error={formErrors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Last name"
              error={formErrors.lastName}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Gender"
              value={formData.gender || 'Male'}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' },
              ]}
              required
              helperText="Determines Maternity / Paternity leave eligibility"
            />
            <Input
              label="Work Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@company.com"
              error={formErrors.email}
              required
            />
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {/* Portal Login Credentials Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {editingEmployee ? 'Portal Access & Credentials' : 'Login Credentials (Required for Portal Access)'}
                </h4>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                  editingEmployee
                    ? 'text-slate-600 bg-white border-slate-200'
                    : 'text-brand-700 bg-brand-50 border-brand-200 font-semibold'
                }`}
              >
                {editingEmployee ? 'Optional Reset' : 'Required'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {editingEmployee
                ? 'Leave password empty to preserve current credentials, or enter a new password to reset employee login access.'
                : 'Set the initial password for this employee. They and authorized administrators will log in using this work email and password.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <PasswordInput
                label={editingEmployee ? 'Reset Password' : 'Login Password'}
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingEmployee ? 'Leave empty to keep unchanged' : 'Min. 6 characters'}
                error={formErrors.password}
                required={!editingEmployee}
                helperText={!editingEmployee ? 'Minimum 6 characters' : undefined}
              />
              <Select
                label="System Role"
                value={formData.roleId || ''}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                options={
                  metadata.roles?.length
                    ? metadata.roles.map((r) => ({ value: r.id, label: r.name }))
                    : [
                        { value: 'role-employee', label: 'Employee' },
                        { value: 'role-manager', label: 'Manager' },
                        { value: 'role-hr', label: 'HR' },
                        { value: 'role-admin', label: 'Admin' },
                      ]
                }
                helperText="Determines permissions when logging into the HRMS portal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Organization"
              value={formData.orgId}
              onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
              error={formErrors.orgId}
              required
              options={metadata.organizations.map((o) => ({ value: o.id, label: o.name }))}
            />
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Department
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickDeptName('');
                    setQuickDeptCode('');
                    setQuickDeptDescription('');
                    setQuickDeptError(null);
                    setIsQuickAddDeptOpen(true);
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add More
                </button>
              </div>
              <select
                value={formData.deptId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setQuickDeptName('');
                    setQuickDeptCode('');
                    setQuickDeptDescription('');
                    setQuickDeptError(null);
                    setIsQuickAddDeptOpen(true);
                  } else {
                    setFormData({ ...formData, deptId: e.target.value });
                  }
                }}
                className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              >
                <option value="" disabled>
                  Select an option
                </option>
                {metadata.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="__add_new__" className="font-semibold text-brand-600 bg-brand-50">
                  + Add more department...
                </option>
              </select>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Designation
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickDesigTitle('');
                    setQuickDesigCode('');
                    setQuickDesigError(null);
                    setIsQuickAddDesigOpen(true);
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add More
                </button>
              </div>
              <select
                value={formData.desigId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setQuickDesigTitle('');
                    setQuickDesigCode('');
                    setQuickDesigError(null);
                    setIsQuickAddDesigOpen(true);
                  } else {
                    setFormData({ ...formData, desigId: e.target.value });
                  }
                }}
                className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              >
                <option value="" disabled>
                  Select an option
                </option>
                {metadata.designations.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.title}
                  </option>
                ))}
                <option value="__add_new__" className="font-semibold text-brand-600 bg-brand-50">
                  + Add more designation...
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Employee Code"
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
              placeholder="e.g. EMP-001"
            />
            <Select
              label="Employment Type"
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              options={[
                { value: 'Full-Time', label: 'Full-Time' },
                { value: 'Part-Time', label: 'Part-Time' },
                { value: 'Contract', label: 'Contract' },
                { value: 'Intern', label: 'Intern' },
              ]}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date of Joining"
              type="date"
              value={formData.dateOfJoining}
              onChange={(e) => {
                const newDoj = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  dateOfJoining: newDoj,
                  probationStartDate: newDoj,
                  probationEndDate: prev.probationStatus === 'IN_PROBATION' ? getProbationEndDate(newDoj) : prev.probationEndDate,
                }));
              }}
            />
          </div>

          {/* COMPENSATION & SALARY STRUCTURE SEGMENT (Decided by Admin) */}
          {(!editingEmployee || canViewSalary(editingEmployee)) ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-brand-50/40 border border-brand-200/90 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-brand-100 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-brand-600" />
                    Compensation & Salary Structure (Decided by Admin)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Every number can be edited manually. You can also use the auto-calculation helpers.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    icon={Calculator}
                    onClick={() => handleAutoCalculateFromCtc()}
                    className="bg-white hover:bg-brand-50 border-brand-300 text-brand-700 font-semibold"
                    title="Auto-fill standard 50% Basic, 25% HRA, standard deductions from Annual CTC"
                  >
                    CTC
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    icon={Sparkles}
                    onClick={handleSumDeductionsAndNet}
                    className="bg-white hover:bg-brand-50 border-brand-300 text-brand-700 font-semibold"
                    title="Re-calculate Net In-Hand from Monthly Gross minus Deductions"
                  >
                    Net
                  </Button>
                </div>
              </div>

              {/* Core 4 Numbers Grid (Matching Table Columns & Screenshot) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-brand-100/80 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Annual CTC (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 1200000"
                    value={salaryStructure.annualCtc}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleSalaryStructureFieldChange('annualCtc', val);
                    }}
                    required
                  />
                  {salaryStructure.annualCtc && Number(salaryStructure.annualCtc) > 0 && (
                    <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                      ~₹{Math.round(Number(salaryStructure.annualCtc) / 12).toLocaleString('en-IN')} / mo gross
                    </span>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-brand-100/80 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Monthly Gross (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 100000"
                    value={salaryStructure.monthlyGross}
                    onChange={(e) => handleSalaryStructureFieldChange('monthlyGross', e.target.value)}
                    required
                  />
                  {salaryStructure.monthlyGross && Number(salaryStructure.monthlyGross) > 0 && (
                    <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                      Annual: ₹{(Number(salaryStructure.monthlyGross) * 12).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                    Net In-Hand (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 94000"
                    value={salaryStructure.netTakeHome}
                    onChange={(e) => handleSalaryStructureFieldChange('netTakeHome', e.target.value)}
                    className="font-bold text-emerald-700"
                    required
                  />
                  <span className="text-[10px] text-emerald-600 mt-1 block font-medium">
                    Take-home pay
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-2xs">
                  <label className="block text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1.5">
                    Monthly Deductions (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 6000"
                    value={salaryStructure.totalDeductions}
                    onChange={(e) => handleSalaryStructureFieldChange('totalDeductions', e.target.value)}
                    className="font-semibold text-rose-600"
                    required
                  />
                  <span className="text-[10px] text-rose-500 mt-1 block font-medium">
                    EPF, PT, TDS & deductions
                  </span>
                </div>
              </div>

              {/* 1. Monthly Earnings Breakdown (Collapsible) */}
              <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
                  className="w-full px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors border-b border-slate-200/80 cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
                    1. Monthly Earnings Breakdown (₹)
                  </span>
                  <span className="text-slate-400">
                    {showEarningsBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {showEarningsBreakdown && (
                  <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Basic Salary (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 50000"
                        value={salaryStructure.basic}
                        onChange={(e) => handleSalaryStructureFieldChange('basic', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        House Rent Allowance (HRA) (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 25000"
                        value={salaryStructure.hra}
                        onChange={(e) => handleSalaryStructureFieldChange('hra', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Special Allowance (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 21150"
                        value={salaryStructure.special}
                        onChange={(e) => handleSalaryStructureFieldChange('special', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Conveyance Allowance (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 1600"
                        value={salaryStructure.conveyance}
                        onChange={(e) => handleSalaryStructureFieldChange('conveyance', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Medical Allowance (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 1250"
                        value={salaryStructure.medical}
                        onChange={(e) => handleSalaryStructureFieldChange('medical', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Statutory & Monthly Deductions (Collapsible) */}
              <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowDeductionsBreakdown(!showDeductionsBreakdown)}
                  className="w-full px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors border-b border-slate-200/80 cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    2. Statutory & Monthly Deductions (₹)
                  </span>
                  <span className="text-slate-400">
                    {showDeductionsBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {showDeductionsBreakdown && (
                  <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        EPF / Provident Fund (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 1800"
                        value={salaryStructure.epf}
                        onChange={(e) => handleSalaryStructureFieldChange('epf', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Professional Tax (PT) (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 200"
                        value={salaryStructure.professionalTax}
                        onChange={(e) => handleSalaryStructureFieldChange('professionalTax', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Income Tax / TDS (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 5000"
                        value={salaryStructure.tds}
                        onChange={(e) => handleSalaryStructureFieldChange('tds', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Other Deductions (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 0"
                        value={salaryStructure.otherDeductions}
                        onChange={(e) => handleSalaryStructureFieldChange('otherDeductions', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-xs tracking-wide">
                  Compensation & Salary Structure is Confidential (Executive & HR Access Only)
                </span>
              </div>
            </div>
          )}

          {/* Interactive Probation Period Assignment Section */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Probation Period Assignment
                </span>
              </div>
              <span className="text-[11px] text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                6 Months Policy
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Assign Probation Status"
                value={formData.probationStatus || 'IN_PROBATION'}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    probationStatus: newStatus,
                    probationEndDate: newStatus === 'IN_PROBATION'
                      ? (prev.probationEndDate || getProbationEndDate(prev.dateOfJoining || prev.probationStartDate))
                      : prev.probationEndDate,
                  }));
                }}
                options={[
                  { value: 'IN_PROBATION', label: 'Yes — In Probation (6 Months Standard)' },
                  { value: 'CONFIRMED', label: 'No — Confirmed (Exempt from / Passed Probation)' },
                  { value: 'EXTENDED', label: 'Extended Probation' },
                  { value: 'REJECTED', label: 'Discontinued / Rejected' },
                ]}
              />

              <Input
                label="Probation End Date"
                type="date"
                value={formData.probationStatus === 'CONFIRMED' ? '' : (formData.probationEndDate || getProbationEndDate(formData.dateOfJoining) || '')}
                onChange={(e) => setFormData({ ...formData, probationEndDate: e.target.value })}
                disabled={formData.probationStatus === 'CONFIRMED'}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              <strong>Company Rule:</strong> Every employee, manager, or HR member has a mandatory 6-month probation period by default upon joining. Select <em>'Yes — In Probation'</em> to apply the 6-month timeline, or <em>'No — Confirmed'</em> if exempt.
            </p>
          </div>

          {/* Work Shift & Time Slot Segment */}
          <div className="p-4 rounded-2xl bg-brand-50/40 border border-brand-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Assigned Work Shift & Time Slot
                </span>
              </div>
              <span className="text-[11px] text-brand-700 bg-brand-100/80 border border-brand-200/60 px-2.5 py-0.5 rounded-full font-bold">
                {shiftFromTime || '--:--'} {shiftFromPeriod} – {shiftToTime || '--:--'} {shiftToPeriod}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* From Time Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  From (Start Time)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={shiftFromTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShiftFromTime(val);
                        setFormData((prev) => ({
                          ...prev,
                          shiftTiming: `${val.trim()} ${shiftFromPeriod} - ${shiftToTime.trim()} ${shiftToPeriod}`,
                        }));
                      }}
                      placeholder="e.g. 11:00"
                      className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                      required
                    />
                  </div>
                  <select
                    value={shiftFromPeriod}
                    onChange={(e) => {
                      const period = e.target.value;
                      setShiftFromPeriod(period);
                      setFormData((prev) => ({
                        ...prev,
                        shiftTiming: `${shiftFromTime.trim()} ${period} - ${shiftToTime.trim()} ${shiftToPeriod}`,
                      }));
                    }}
                    className="rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 font-bold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              {/* To Time Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  To (End Time)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={shiftToTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShiftToTime(val);
                        setFormData((prev) => ({
                          ...prev,
                          shiftTiming: `${shiftFromTime.trim()} ${shiftFromPeriod} - ${val.trim()} ${shiftToPeriod}`,
                        }));
                      }}
                      placeholder="e.g. 07:00"
                      className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                      required
                    />
                  </div>
                  <select
                    value={shiftToPeriod}
                    onChange={(e) => {
                      const period = e.target.value;
                      setShiftToPeriod(period);
                      setFormData((prev) => ({
                        ...prev,
                        shiftTiming: `${shiftFromTime.trim()} ${shiftFromPeriod} - ${shiftToTime.trim()} ${period}`,
                      }));
                    }}
                    className="rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 font-bold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Type the exact working hours manually. Active shift displays on employee's clock in/out timer.
            </p>
          </div>

          {/* Reporting Manager & Assigned HR Partner Section */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Reporting Manager & Assigned HR Partner
                </span>
              </div>
              <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-semibold">
                Hierarchy & Governance
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Assign this employee's reporting manager for direct operational oversight and an HR partner for personnel governance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Reporting Manager Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Reporting Manager
                </label>
                <select
                  value={formData.managerId || ''}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="block w-full rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                >
                  <option value="">No Direct Manager (Direct to Org)</option>
                  {(metadata.managers || [])
                    .filter((m) => !editingEmployee || m.id !== editingEmployee.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName || `${m.firstName || ''} ${m.lastName || ''}`.trim()} ({m.employeeCode || m.id?.slice(0, 7)}) {m.designationTitle ? `— ${m.designationTitle}` : ''}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Direct manager oversees day-to-day work, reviews leaves, and tracks attendance.
                </p>
              </div>

              {/* Assigned HR Partner Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Assigned HR Partner (HRBP)
                </label>
                <select
                  value={formData.hrId || ''}
                  onChange={(e) => setFormData({ ...formData, hrId: e.target.value })}
                  className="block w-full rounded-lg border text-sm py-2.5 px-3 bg-white border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                >
                  <option value="">No Assigned HR (General HR Pool)</option>
                  {(metadata.hrs || metadata.managers || [])
                    .filter((h) => !editingEmployee || h.id !== editingEmployee.id)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.fullName || `${h.firstName || ''} ${h.lastName || ''}`.trim()} ({h.employeeCode || h.id?.slice(0, 7)}) {h.roleName ? `[${h.roleName}]` : ''}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Oversees personnel files, compliance, grievances, and employee lifecycle management.
                </p>
              </div>
            </div>
          </div>

          {/* Annual Leave Quotas & Entitlements Segment (Decided by Admin) */}
          <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Annual Leave Quotas & Entitlements
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddLeaveTypeOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Category</span>
                </button>
                <span className="text-[11px] text-amber-800 bg-amber-100/90 border border-amber-200/70 px-2.5 py-0.5 rounded-full font-bold">
                  Decided by Admin
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Define the exact annual paid leave days allocated to this employee. These will reflect directly on their personal account and leave balance cards.
            </p>

            {loadingLeaveBalances ? (
              <div className="py-4 text-center text-xs text-slate-500">
                Loading employee's current leave allocations...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {leaveTypes.map((lt) => {
                  const currentVal = leaveAllocations[lt.id] !== undefined ? leaveAllocations[lt.id] : 0;
                  const isFemaleOnly = lt.genderEligibility === 'FEMALE' || lt.code === 'ML';
                  const isMaleOnly = lt.genderEligibility === 'MALE' || lt.code === 'PTL' || lt.code === 'PATL';
                  const isEligibleForThisGender = 
                    (!isFemaleOnly && !isMaleOnly) ||
                    (isFemaleOnly && formData.gender === 'Female') ||
                    (isMaleOnly && formData.gender === 'Male');

                  return (
                    <div
                      key={lt.id}
                      className={`p-3 rounded-xl border shadow-xs space-y-1.5 transition-all ${
                        !isEligibleForThisGender
                          ? 'opacity-50 border-slate-200 bg-slate-100/70'
                          : 'bg-white border-slate-200/80 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-800 truncate">{lt.name}</span>
                          {isFemaleOnly && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 shrink-0">
                              Female Only
                            </span>
                          )}
                          {isMaleOnly && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                              Male Only
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {lt.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="365"
                          value={currentVal}
                          disabled={!isEligibleForThisGender}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                            setLeaveAllocations((prev) => ({
                              ...prev,
                              [lt.id]: val,
                            }));
                          }}
                          placeholder="0"
                          className="block w-full rounded-lg border text-sm py-1.5 px-3 bg-white border-slate-300 text-slate-900 font-semibold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-400"
                          required
                        />
                        <span className="text-xs text-slate-500 font-medium shrink-0">days</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate" title={lt.description}>
                        {!isEligibleForThisGender
                          ? `Not applicable to ${formData.gender} employees`
                          : (lt.description || 'Annual entitlement')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Personal Information Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Personal & Family Details
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Father's Name"
                value={formData.fatherName}
                onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                placeholder="Father's full name"
              />
              <Input
                label="Mother's Name"
                value={formData.motherName}
                onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                placeholder="Mother's full name"
              />
              <Input
                label="Emergency Contact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                placeholder="e.g. +91 98765 43210 (Spouse / Parent)"
              />
              <Input
                label="Residential Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Permanent or current address"
              />
            </div>
          </div>

          {/* Banking & Statutory Details Section */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Banking & Statutory Details (Operations / HR)
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200">
                Direct Edits Restricted for Employees
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Employees can view bank and UAN details in Payroll / Profile, but cannot change them directly. Raise requests go via Help Desk / Service Request for Operations manual verification.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Bank Name"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="e.g. HDFC Bank"
              />
              <Input
                label="Bank Account Number"
                value={formData.bankAccountNumber}
                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                placeholder="Account number"
              />
              <Input
                label="Bank IFSC Code"
                value={formData.bankIfsc}
                onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                placeholder="e.g. HDFC0001234"
              />
              <Input
                label="Bank Branch"
                value={formData.bankBranch}
                onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                placeholder="Branch name or city"
              />
              <div className="sm:col-span-2">
                <Input
                  label="UAN Number (Universal Account Number)"
                  value={formData.uanNumber}
                  onChange={(e) => setFormData({ ...formData, uanNumber: e.target.value })}
                  placeholder="12-digit EPF UAN number"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingEmployee ? 'Save Changes' : 'Register Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Department Modal */}
      <Modal
        isOpen={isQuickAddDeptOpen}
        onClose={() => setIsQuickAddDeptOpen(false)}
        title="Add New Department"
        subtitle="Quickly define a new corporate department or business division."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickAddDepartment} className="space-y-4">
          {quickDeptError && (
            <Alert variant="danger">
              {quickDeptError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Finance & Accounting"
              value={quickDeptName}
              onChange={(e) => setQuickDeptName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. FIN (auto-generated if empty)"
              value={quickDeptCode}
              onChange={(e) => setQuickDeptCode(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="Brief description of department scope..."
              value={quickDeptDescription}
              onChange={(e) => setQuickDeptDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsQuickAddDeptOpen(false)}
              disabled={quickDeptLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={quickDeptLoading}
              icon={Plus}
            >
              Add Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Designation Modal */}
      <Modal
        isOpen={isQuickAddDesigOpen}
        onClose={() => setIsQuickAddDesigOpen(false)}
        title="Add New Designation"
        subtitle="Quickly define a new corporate title or job role."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickAddDesignation} className="space-y-4">
          {quickDesigError && (
            <Alert variant="danger">
              {quickDesigError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designation Title <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Operations Team Leader"
              value={quickDesigTitle}
              onChange={(e) => setQuickDesigTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designation Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. OPS-TL (auto-generated if empty)"
              value={quickDesigCode}
              onChange={(e) => setQuickDesigCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsQuickAddDesigOpen(false)}
              disabled={quickDesigLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={quickDesigLoading}
              icon={Plus}
            >
              Add Designation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Leave Category Modal */}
      <Modal
        isOpen={isQuickAddLeaveTypeOpen}
        onClose={() => setIsQuickAddLeaveTypeOpen(false)}
        title="Add New Leave Category"
        subtitle="Define a new company leave type, default annual days, and policy."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickAddLeaveType} className="space-y-4">
          {quickLTError && (
            <Alert variant="danger">
              {quickLTError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Bereavement Leave"
              value={quickLTName}
              onChange={(e) => setQuickLTName(e.target.value)}
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
                value={quickLTCode}
                onChange={(e) => setQuickLTCode(e.target.value.toUpperCase())}
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
                value={quickLTDays}
                onChange={(e) => setQuickLTDays(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Gender Eligibility
            </label>
            <select
              value={quickLTGender}
              onChange={(e) => setQuickLTGender(e.target.value)}
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
              value={quickLTDesc}
              onChange={(e) => setQuickLTDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsQuickAddLeaveTypeOpen(false)}
              disabled={quickLTLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={quickLTLoading}
              icon={Plus}
            >
              Add Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Employee Detail Modal */}
      <Modal
        isOpen={!!viewingEmployee}
        onClose={() => setViewingEmployee(null)}
        maxWidth="max-w-lg"
        title="Employee Profile"
        subtitle="Detailed employment record and organizational assignment"
      >
        {loadingViewProfile ? (
          <div className="p-8">
            <LoadingSpinner message="Refreshing employee record..." />
          </div>
        ) : viewingEmployee ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-brand-50/50 border border-brand-100">
              <div className="w-14 h-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {viewingEmployee.firstName?.[0]}
                {viewingEmployee.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {viewingEmployee.firstName} {viewingEmployee.lastName}
                </h3>
                <p className="text-xs text-brand-600 font-semibold">
                  {(viewingEmployee.user?.roleName === 'Admin' || viewingEmployee.roleName === 'Admin' || viewingEmployee.email === 'sheetalbedi@tasknera.com')
                    ? 'CEO'
                    : (viewingEmployee.designation?.title || 'Staff Member')}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{viewingEmployee.status}</Badge>
                  <span className="text-xs text-slate-500 font-medium">
                    Code: {viewingEmployee.employeeCode}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {viewingEmployee.gender || 'Male'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </div>
                <div className="font-medium text-slate-800 break-all">{viewingEmployee.email}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5" />
                  Phone
                </div>
                <div className="font-medium text-slate-800">{viewingEmployee.phone || '—'}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  Organization
                </div>
                <div className="font-medium text-slate-800">
                  {viewingEmployee.organization?.name || 'Default Org'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  Department
                </div>
                <div className="font-medium text-slate-800">
                  {(viewingEmployee.user?.roleName === 'Admin' || viewingEmployee.roleName === 'Admin' || viewingEmployee.email === 'sheetalbedi@tasknera.com')
                    ? (viewingEmployee.department?.name || 'Main')
                    : (viewingEmployee.department?.name || 'General')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Date of Joining
                </div>
                <div className="font-medium text-slate-800">
                  {viewingEmployee.dateOfJoining || '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <IndianRupee className="w-3.5 h-3.5" />
                  Compensation
                </div>
                <div className="font-medium text-slate-800 flex items-center gap-1.5">
                  {canViewSalary(viewingEmployee) ? (
                    viewingEmployee.salary ? (
                      `₹${Number(viewingEmployee.salary).toLocaleString('en-IN')} / yr`
                    ) : (
                      'Not specified'
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Confidential: Executive and HR access only">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      Confidential
                    </span>
                  )}
                </div>
              </div>

              {/* Detailed Compensation Breakdown Card (Visible if allowed) */}
              {canViewSalary(viewingEmployee) && viewingEmployee.salaryStructure && (
                <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                      Salary Structure & Compensation Breakdown
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      Annual CTC: ₹{Number(viewingEmployee.salary || viewingEmployee.salaryStructure.annualCtc || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Monthly Gross</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">
                        ₹{Number(viewingEmployee.salaryStructure.monthlyGross || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase">Net In-Hand</div>
                      <div className="text-xs font-bold text-emerald-700 mt-0.5">
                        ₹{Number(viewingEmployee.salaryStructure.netTakeHome || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-rose-100 text-center">
                      <div className="text-[10px] font-bold text-rose-600 uppercase">Deductions</div>
                      <div className="text-xs font-bold text-rose-700 mt-0.5">
                        ₹{Number(viewingEmployee.salaryStructure.totalDeductions || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Basic Salary</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">
                        ₹{Number(viewingEmployee.salaryStructure.basic || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-brand-600" />
                  Assigned Work Shift & Time Slot
                </div>
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>{viewingEmployee.shiftTiming || '11:00 AM - 07:00 PM'}</span>
                  <span className="text-[11px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded font-medium border border-brand-100">
                    Timer Schedule
                  </span>
                </div>
              </div>

              {/* Reporting Manager & Assigned HR Display */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  Reporting Manager
                </div>
                <div className="font-semibold text-slate-800">
                  {viewingEmployee.manager?.fullName || 'Direct to Organization'}
                </div>
                {viewingEmployee.manager?.employeeCode && (
                  <div className="text-[11px] text-slate-400 font-mono">Code: {viewingEmployee.manager.employeeCode}</div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Assigned HR Partner
                </div>
                <div className="font-semibold text-slate-800">
                  {viewingEmployee.hr?.fullName || 'General HR Pool'}
                </div>
                {viewingEmployee.hr?.employeeCode && (
                  <div className="text-[11px] text-slate-400 font-mono">Code: {viewingEmployee.hr.employeeCode}</div>
                )}
              </div>

              {/* 6-Month Probation Status Card */}
              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Probation Lifecycle (6 Months Policy)
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    viewingEmployee.probationStatus === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : viewingEmployee.probationStatus === 'EXTENDED'
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : viewingEmployee.probationStatus === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {viewingEmployee.probationStatus || 'IN_PROBATION'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Policy Duration</div>
                    <div className="text-sm font-bold text-amber-900 mt-0.5">6 Months</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Probation Starts</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">
                      {viewingEmployee.probationStartDate || viewingEmployee.dateOfJoining || '—'}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs col-span-2 sm:col-span-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Probation Ends</div>
                    <div className="text-sm font-semibold text-amber-900 mt-0.5">
                      {viewingEmployee.probationEndDate || getProbationEndDate(viewingEmployee.dateOfJoining) || '—'}
                    </div>
                  </div>
                </div>
                {viewingEmployee.probationNotes && (
                  <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded border border-amber-100/70">
                    <span className="font-semibold text-slate-700">Notes:</span> {viewingEmployee.probationNotes}
                  </div>
                )}
              </div>

              {/* Annual Leave Allocations Display */}
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100/90 col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Allocated Leave Quotas (Decided by Admin)
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    Entitlements
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {viewingLeaveBalances.length > 0 ? (
                    viewingLeaveBalances.map((b) => (
                      <div key={b.id || b.leaveTypeId} className="bg-white p-2.5 rounded-lg border border-emerald-100 text-center shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase truncate">
                          {b.leaveType?.name || b.lt_name || b.leaveTypeId}
                        </div>
                        <div className="text-base font-bold text-emerald-700 mt-0.5">
                          {b.allocatedDays ?? b.allocated_days ?? 0} <span className="text-[10px] font-normal text-slate-400">days</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-1 text-xs text-slate-400 italic">
                      Standard organizational leave balances apply
                    </div>
                  )}
                </div>
              </div>

              {/* Portal Account Status Card */}
              <div className="p-3.5 rounded-xl bg-brand-50/60 border border-brand-100/80 flex items-center justify-between col-span-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center shadow-xs">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Portal Login Account</div>
                    <div className="text-xs text-slate-500">
                      {viewingEmployee.user
                        ? `Linked User Account • Role: ${viewingEmployee.user.roleName || 'Employee'}`
                        : 'No linked portal account'}
                    </div>
                  </div>
                </div>
                <Badge variant={viewingEmployee.user ? 'success' : 'neutral'}>
                  {viewingEmployee.user ? 'Login Active' : 'No Account'}
                </Badge>
              </div>

              {/* Personal Details Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 col-span-2 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-brand-600" />
                  Personal Information
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Father's Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.fatherName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Mother's Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.motherName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Emergency Contact</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.emergencyContact || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Residential Address</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.address || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Banking & Statutory Details Card */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 col-span-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    Banking & Statutory Details
                  </div>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Bank Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.bankName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Account Number</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {canViewSalary(viewingEmployee) ? (
                        viewingEmployee.bankAccountNumber
                          ? (viewingEmployee.bankAccountNumber.length > 4
                              ? `•••• •••• •••• ${viewingEmployee.bankAccountNumber.slice(-4)}`
                              : viewingEmployee.bankAccountNumber)
                          : '—'
                      ) : (
                        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 italic">
                          <Lock className="w-3 h-3 text-slate-400" />
                          Confidential
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">IFSC Code</span>
                    <span className="font-mono font-semibold text-slate-800">{viewingEmployee.bankIfsc || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Bank Branch</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.bankBranch || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-medium">UAN Number</span>
                    <span className="font-mono font-semibold text-slate-800">{viewingEmployee.uanNumber || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Can permission="employee:write">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Edit2}
                  onClick={() => {
                    const empToEdit = viewingEmployee;
                    setViewingEmployee(null);
                    handleOpenEdit(empToEdit);
                  }}
                >
                  Edit Profile
                </Button>
              </Can>
              <Button
                variant="neutral"
                size="sm"
                icon={Clock}
                onClick={() => {
                  setTimelineEmployee(viewingEmployee);
                }}
              >
                Lifecycle Timeline
              </Button>
              <div className="ml-auto">
                <Button variant="primary" size="sm" onClick={() => setViewingEmployee(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Employee Lifecycle Timeline Modal */}
      <EmployeeTimelineModal
        isOpen={!!timelineEmployee}
        onClose={() => setTimelineEmployee(null)}
        employeeId={timelineEmployee?.id}
        employeeName={`${timelineEmployee?.firstName || ''} ${timelineEmployee?.lastName || ''}`}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Employee Record"
        message={`Are you sure you want to delete ${deleteTarget?.firstName} ${deleteTarget?.lastName} (${deleteTarget?.employeeCode})? This action removes employee employment records.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Assign Manager & HR Hierarchy Modal */}
      <AssignManagerModal
        isOpen={Boolean(reassigningEmployee)}
        employee={reassigningEmployee}
        onClose={() => setReassigningEmployee(null)}
        onSuccess={() => fetchEmployees(pagination?.page || 1)}
      />
    </div>
  );
};
