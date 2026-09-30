import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Download,
  Building2,
  Laptop,
  Target,
  Plus,
  Trash2,
  Upload,
  RotateCcw,
  Star,
  Check,
  Calendar,
  User,
  Users,
  ShieldCheck,
  Award,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Send,
  CheckCircle2,
  RotateCw,
  History,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  X,
  FileEdit,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { employeeService } from '../../services/employeeService.js';
import { performanceReportService } from '../../services/performanceReportService.js';
import { notificationService } from '../../services/notificationService.js';
import { PrintableReportDossier } from '../../components/performance/PrintableReportDossier.jsx';
import { filterNonCeoEmployees } from '../../utils/roleUtils.js';



export const ReportsPage = () => {
  const { user, hasRole } = useAuth();
  const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().trim();
  const isAdmin = ['admin', 'superadmin', 'orgadmin'].some((r) => userRoleStr.includes(r));
  const isHR = !isAdmin && ['hr', 'hrmanager'].some((r) => userRoleStr.includes(r));
  const isManager = !isAdmin && !isHR && (['manager', 'lead', 'supervisor'].some((r) => userRoleStr.includes(r)) || hasRole('Manager'));
  const isEmployeeOnly = !isAdmin && !isHR && !isManager;

  // Role permissions per prompt requirements:
  // Admin: can review other employees, does NOT have own performance review
  // HR: can review other employees AND has own performance review
  // Manager: can review direct reportees AND has own performance review
  // Employee: ONLY has own performance review ("My Performance") and CANNOT review or send reports to anyone
  const canReviewOthers = isAdmin || isHR || isManager;
  const hasOwnReview = !isAdmin;

  // View mode: 'reviews' (give/review evaluations) | 'my' (view own report dossier)
  // Admin: always 'reviews' (never 'my')
  // HR & Manager: defaults to 'reviews', can switch to 'my'
  // Employee: ALWAYS 'my' (only option is 'My Performance')
  const [viewMode, setViewMode] = useState(() => (canReviewOthers ? 'reviews' : 'my'));

  useEffect(() => {
    if (isAdmin && viewMode !== 'reviews') {
      setViewMode('reviews');
    } else if (isEmployeeOnly && viewMode !== 'my') {
      setViewMode('my');
    }
  }, [isAdmin, isEmployeeOnly, viewMode]);

  // Helper to match logged in employee with their specific performance dossier
  const resolveUserDepartment = () => {
    if (!user) return 'operations';
    const email = (user.email || '').toLowerCase();
    const name = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const empCode = (user.employeeCode || user.employeeId || '').toLowerCase();
    const dept = (
      user.departmentName ||
      user.department?.name ||
      (typeof user.department === 'string' ? user.department : '') ||
      user.departmentCode ||
      ''
    ).toLowerCase();

    if (
      email.includes('ajay') ||
      name.includes('ajay') ||
      empCode.includes('it') ||
      dept.includes('it') ||
      dept.includes('eng') ||
      dept.includes('tech')
    ) {
      return 'it';
    }
    if (
      email.includes('harsh') ||
      name.includes('harsh') ||
      empCode.includes('ta') ||
      dept.includes('talent') ||
      dept.includes('recruit')
    ) {
      return 'ta';
    }
    if (
      email.includes('pooja') ||
      name.includes('pooja') ||
      empCode.includes('ops') ||
      dept.includes('operat') ||
      dept.includes('logist')
    ) {
      return 'operations';
    }
    return 'operations';
  };

  const [department, setDepartment] = useState(() => resolveUserDepartment());

  useEffect(() => {
    if (viewMode === 'my') {
      setDepartment(resolveUserDepartment());
    }
  }, [user, viewMode]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Reviewer Sub-Tab: 'form' | 'tracker'
  const [reviewerSubTab, setReviewerSubTab] = useState('form');
  const [sentReports, setSentReports] = useState([]);
  const [loadingSentReports, setLoadingSentReports] = useState(false);
  const [empReportStatus, setEmpReportStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Tracker Employee Directory States
  const [trackerSearch, setTrackerSearch] = useState('');
  const [trackerDeptFilter, setTrackerDeptFilter] = useState('all');
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [editingReport, setEditingReport] = useState(null);

  // Recipient ("My Performance") States
  const [myReports, setMyReports] = useState([]);
  const [loadingMyReports, setLoadingMyReports] = useState(true);
  const [activeMyReportIdx, setActiveMyReportIdx] = useState(0);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [sentReportToDelete, setSentReportToDelete] = useState(null);
  const [isDeletingSentReport, setIsDeletingSentReport] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [pdfCustomReport, setPdfCustomReport] = useState(null);
  const [previewReport, setPreviewReport] = useState(null);

  // Dynamic employee roster per department
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (!canReviewOthers) return;
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const res = await employeeService.listEmployees({ status: 'Active', limit: 300 });
        const list = Array.isArray(res?.employees)
          ? res.employees
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];

        // Exclude Admin / SuperAdmin / OrgAdmin accounts from the employee review list
        const reviewCandidates = list.filter((emp) => {
          const role = (
            emp.user?.roleName ||
            emp.roleName ||
            emp.role?.name ||
            (typeof emp.role === 'string' ? emp.role : '') ||
            ''
          ).toLowerCase();
          const desig = (
            emp.designation?.title ||
            emp.designationName ||
            emp.designation?.name ||
            (typeof emp.designation === 'string' ? emp.designation : '')
          ).toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();

          const isAdminRole = ['admin', 'superadmin', 'orgadmin'].some((r) => role.includes(r));
          const isAdminEmail = email.startsWith('admin@') || email.includes('superadmin');
          const isAdminName = name === 'admin' || name === 'administrator' || name.startsWith('admin ');
          const isAdminDesig = desig.includes('administrator') || desig.includes('system admin');

          return !isAdminRole && !isAdminEmail && !isAdminName && !isAdminDesig;
        });

        setEmployees(reviewCandidates);
      } catch (err) {
        console.error('Failed to load employees for reports:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, [canReviewOthers]);

  const documentRef = useRef(null);
  const printDossierRef = useRef(null);

  // 1. OPERATIONS FORM STATE
  const [opsData, setOpsData] = useState({
    employeeName: '',
    employeeId: '',
    department: 'Operations Team',
    designation: '',
    manager: '',
    reviewDate: new Date().toISOString().split('T')[0],
    reviewPeriod: '',
    ldExecutive: 'Swati Batabyal',
    reviewCycle: 'Quarterly Review',
    competencies: [
      { area: 'Quality of Work (Accuracy)', score: 0, comment: '' },
      { area: 'Productivity', score: 0, comment: '' },
      { area: 'Meeting Deadlines (TAT)', score: 0, comment: '' },
      { area: 'Communication', score: 0, comment: '' },
      { area: 'Teamwork', score: 0, comment: '' },
      { area: 'Process / SOP Understanding', score: 0, comment: '' },
      { area: 'Attendance & Punctuality', score: 0, comment: '' },
      { area: 'Initiative & Ownership', score: 0, comment: '' },
      { area: 'Issue Resolution & Follow-up', score: 0, comment: '' },
    ],
    achievements: '',
    improvements: '',
    goals: [
      { goal: '', target: '', deadline: '', status: 'Planned' },
    ],
    training: [
      { skill: '', training: '', priority: 'Medium' },
    ],
    employeeComments: '',
    managerComments: '',
    overallRating: 'Meets Expectations',
    actions: {
      action1: true,
      action2: false,
      action3: false,
      action4: true,
      action5: false,
      action6: false,
    },
    ceoName: "Sheetal Bedi (CEO)",
    ceoDate: new Date().toISOString().split('T')[0],
  });

  // 2. IT FORM STATE
  const [itData, setItData] = useState({
    employeeName: '',
    employeeId: '',
    department: 'IT Team',
    designation: '',
    manager: '',
    reviewDate: new Date().toISOString().split('T')[0],
    reviewPeriod: '',
    ldExecutive: 'Swati Batabyal',
    reviewCycle: 'Bi-Weekly Review',
    competencies: [
      { area: 'Quality of Portal / Application', score: 0, comment: '' },
      { area: 'Productivity & Output Volume', score: 0, comment: '' },
      { area: 'Meeting Deadlines & Timelines', score: 0, comment: '' },
      { area: 'Communication & Updates', score: 0, comment: '' },
      { area: 'Teamwork & Collaboration', score: 0, comment: '' },
      { area: 'Portal & System Understanding', score: 0, comment: '' },
      { area: 'Attendance & Punctuality', score: 0, comment: '' },
      { area: 'Initiative & Ownership', score: 0, comment: '' },
      { area: 'Post-Launch Bugs & Stability', score: 0, comment: '' },
    ],
    achievements: '',
    improvements: '',
    goals: [
      { goal: '', target: '', deadline: '', status: 'Planned' },
    ],
    training: [
      { skill: '', training: '', priority: 'Medium' },
    ],
    employeeComments: '',
    managerComments: '',
    overallRating: 'Meets Expectations',
    actions: {
      action1: true,
      action2: false,
      action3: false,
      action4: true,
      action5: false,
      action6: false,
    },
    ceoName: "Sheetal Bedi (CEO)",
    ceoDate: new Date().toISOString().split('T')[0],
  });

  // 3. TA FORM STATE
  const [taData, setTaData] = useState({
    employeeName: '',
    employeeId: '',
    department: 'TA Team',
    designation: '',
    manager: '',
    reviewDate: new Date().toISOString().split('T')[0],
    reviewPeriod: '',
    ldExecutive: 'Swati Batabyal',
    reviewCycle: 'Bi-Weekly Review',
    competencies: [
      { area: 'Quality of CVs', score: 0, comment: '' },
      { area: 'Productivity (TL)', score: 0, comment: '' },
      { area: 'Meeting Deadlines', score: 0, comment: '' },
      { area: 'Communication (TL)', score: 0, comment: '' },
      { area: 'Teamwork (TL)', score: 0, comment: '' },
      { area: 'Recruitment Understanding', score: 0, comment: '' },
      { area: 'Attendance & Punctuality', score: 0, comment: '' },
      { area: 'Initiative & Ownership', score: 0, comment: '' },
      { area: 'Candidate Submission', score: 0, comment: '' },
    ],
    achievements: '',
    improvements: '',
    goals: [
      { goal: '', target: '', deadline: '', status: 'Planned' },
    ],
    training: [
      { skill: '', training: '', priority: 'Medium' },
    ],
    employeeComments: '',
    managerComments: '',
    overallRating: 'Meets Expectations',
    actions: {
      action1: true,
      action2: false,
      action3: false,
      action4: true,
      action5: false,
      action6: false,
    },
    ceoName: "Sheetal Bedi (CEO)",
    ceoDate: new Date().toISOString().split('T')[0],
  });

  const showToast = (msg, type = 'info', duration = 3000) => {
    setToastMessage({ msg, type });
    if (duration > 0) {
      setTimeout(() => setToastMessage(null), duration);
    }
  };

  // Helper to safely update a specific department slice without relying on stale closure
  const setDeptData = (targetDept, updater) => {
    const d = (targetDept || department || 'operations').toLowerCase();
    if (d === 'it') setItData(updater);
    else if (d === 'ta') setTaData(updater);
    else setOpsData(updater);
  };

  // Active form data selector
  const currentData = department === 'operations' ? opsData : department === 'it' ? itData : taData;
  const setCurrentData = (updater) => {
    setDeptData(department, updater);
  };

  // Filter employees for active department tab using real API employees (excluding Admin accounts)
  const departmentEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];

    // Exclude CEO and Admin accounts globally (cannot be assigned or reviewed)
    let candidates = filterNonCeoEmployees(employees);

    // Sort alphabetically by employee name so it is easy to find anyone
    return [...candidates].sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [employees]);

  // Helper to parse review period end timestamp for robust chronological sorting
  const parseReviewPeriodEnd = (periodStr, reviewDate, lastSentAt) => {
    if (periodStr && typeof periodStr === 'string') {
      const parts = periodStr.split(/[-–—to]/);
      const endPart = (parts[parts.length - 1] || '').trim();
      const match = endPart.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
      if (match) {
        let day = parseInt(match[1], 10);
        let month = parseInt(match[2], 10) - 1;
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    if (reviewDate) {
      const d = new Date(reviewDate);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    if (lastSentAt) {
      const d = new Date(lastSentAt);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  };

  // Helper to load reports for logged in user (My Performance view)
  const loadMyReports = async () => {
    try {
      setLoadingMyReports(true);
      const res = await performanceReportService.getMyReports();
      let items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      // Sort so that the latest / last review period of the candidate is strictly first
      items = [...items].sort((a, b) => {
        const timeA = parseReviewPeriodEnd(a.reviewPeriod || a.reportData?.reviewPeriod, a.reviewDate, a.lastSentAt || a.createdAt);
        const timeB = parseReviewPeriodEnd(b.reviewPeriod || b.reportData?.reviewPeriod, b.reviewDate, b.lastSentAt || b.createdAt);
        if (timeB !== timeA) return timeB - timeA;
        const sentA = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0;
        const sentB = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0;
        return sentB - sentA;
      });
      setMyReports(items);
      if (items.length > 0) {
        setActiveMyReportIdx(0);
      }
    } catch (err) {
      console.error('Failed to load my performance reports:', err);
    } finally {
      setLoadingMyReports(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'my' || !canReviewOthers) {
      loadMyReports();
    }
  }, [viewMode, canReviewOthers]);

  // Fetch all sent reports across organization for reviewer
  const fetchSentReports = async () => {
    if (!canReviewOthers) return;
    try {
      setLoadingSentReports(true);
      const res = await performanceReportService.getSentReports({
        department: department !== 'all' ? department : undefined,
      });
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      setSentReports(items);
    } catch (err) {
      console.error('Failed to load sent reports:', err);
    } finally {
      setLoadingSentReports(false);
    }
  };

  useEffect(() => {
    if (canReviewOthers && viewMode === 'reviews') {
      fetchSentReports();
    }
  }, [department, viewMode, canReviewOthers]);

  // Handle employee selection from combobox in Section 01
  const handleSelectEmployee = async (empId, isNew = false) => {
    setSelectedEmployeeId(empId);
    if (isNew) {
      setEditingReport(null);
    }
    const selectedEmp = employees.find(
      (e) => String(e.id || e._id) === String(empId)
    );
    if (selectedEmp) {
      const fullName = `${selectedEmp.firstName || ''} ${selectedEmp.lastName || ''}`.trim() || selectedEmp.name || selectedEmp.email;
      const code = selectedEmp.employeeCode || selectedEmp.employeeId || '';

      // Auto-detect and align department tab if needed
      const rawDept = (
        selectedEmp.departmentName ||
        selectedEmp.department?.name ||
        (typeof selectedEmp.department === 'string' ? selectedEmp.department : '')
      ).toLowerCase().trim();
      const empDeptId = (selectedEmp.deptId || selectedEmp.department?.id || '').toLowerCase();
      const empDeptCode = (selectedEmp.department?.code || selectedEmp.deptCode || '').toUpperCase().trim();

      let activeD = department;
      if (empDeptId === 'dept-ta' || empDeptCode === 'TA' || rawDept === 'talent acquisition' || rawDept.includes('talent acquisition')) {
        activeD = 'ta';
      } else if (empDeptId === 'dept-it' || empDeptCode === 'IT' || rawDept === 'it' || rawDept.includes('information technology') || rawDept.includes('software') || rawDept.includes('engineering')) {
        activeD = 'it';
      } else if (empDeptId === 'dept-ops' || empDeptId === 'dept-1790249674162-188' || empDeptCode === 'OPS' || rawDept.includes('operation') || rawDept.includes('logist')) {
        activeD = 'operations';
      }
      if (activeD !== department) {
        setDepartment(activeD);
      }

      const dept =
        selectedEmp.departmentName ||
        selectedEmp.department?.name ||
        (typeof selectedEmp.department === 'string'
          ? selectedEmp.department
          : activeD === 'operations'
            ? 'Operations Team'
            : activeD === 'it'
              ? 'IT Team'
              : 'TA Team');
      const desig =
        selectedEmp.designation?.title ||
        selectedEmp.designationName ||
        selectedEmp.designation?.name ||
        (typeof selectedEmp.designation === 'string' ? selectedEmp.designation : '');
      const mgr =
        selectedEmp.manager?.fullName ||
        selectedEmp.managerName ||
        (selectedEmp.manager
          ? `${selectedEmp.manager.firstName || ''} ${selectedEmp.manager.lastName || ''}`.trim()
          : '') ||
        '';

      if (isNew) {
        // Create clean form for new review
        setDeptData(activeD, (prev) => ({
          ...prev,
          employeeName: fullName,
          employeeId: code,
          department: dept,
          designation: desig,
          ...(mgr ? { manager: mgr } : {}),
          reviewDate: new Date().toISOString().split('T')[0],
          reviewPeriod: '',
          achievements: '',
          improvements: '',
          managerComments: '',
          employeeComments: '',
          competencies: (prev.competencies || []).map((c) => ({ ...c, score: 0, comment: '' })),
          goals: [{ goal: '', target: '', deadline: '', status: 'Planned' }],
          training: [{ skill: '', training: '', priority: 'Medium' }],
        }));
        showToast(`Started new clean evaluation form for ${fullName}.`, 'info');
        return;
      }

      // Check delivery status for this employee
      try {
        setLoadingStatus(true);
        const stRes = await performanceReportService.getEmployeeStatus(empId, activeD);
        const st = stRes?.data || stRes;
        setEmpReportStatus(st || null);

        if (st && st.reportData) {
          const loadedData = {
            ...st.reportData,
            employeeName: fullName,
            employeeId: code,
            department: dept,
            designation: desig,
            ...(mgr ? { manager: mgr } : {}),
          };
          setDeptData(activeD, loadedData);
          showToast(`Selected ${fullName}. Loaded previous evaluation (Sent: ${st.sentCount || 1}x).`, 'info');
          return;
        }
      } catch (err) {
        setEmpReportStatus(null);
      } finally {
        setLoadingStatus(false);
      }

      setDeptData(activeD, (prev) => ({
        ...prev,
        employeeName: fullName || prev.employeeName,
        employeeId: code || prev.employeeId,
        department: dept || prev.department,
        designation: desig || prev.designation,
        ...(mgr ? { manager: mgr } : {}),
      }));

      showToast(`Selected ${fullName}. Details auto-populated.`, 'info');
    }
  };

  // Handle Send / Re-send Report action specifically to the selected employee
  const handleSendReport = async (overrideEmpId = null, overrideData = null) => {
    if (!canReviewOthers) {
      showToast('You do not have permission to evaluate or dispatch performance reports to other employees.', 'error');
      return;
    }

    const empId = overrideEmpId || selectedEmployeeId;
    const sendData = overrideData || currentData;
    const empName = sendData.employeeName;

    if (!empId || !empName) {
      showToast('Please select an Employee Name from the dropdown before sending the report.', 'error');
      return;
    }
    setIsSending(true);
    showToast(`Dispatching performance appraisal report to ${empName}...`, 'loading', 0);

    try {
      const avgScore = calculateAverage(sendData.competencies);
      const res = await performanceReportService.sendReport({
        employeeId: empId,
        department,
        reportData: sendData,
        averageScore: avgScore,
        overallRating: sendData.overallRating,
      });

      const count = res?.data?.sentCount || res?.sentCount || 1;
      showToast(`Performance report successfully sent to ${empName}! (Sent count: ${count})`, 'success');

      setEmpReportStatus(res?.data || res);
      fetchSentReports();
    } catch (err) {
      console.error('Error sending report:', err);
      showToast(err.message || 'Failed to dispatch report. Please try again.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Re-send directly from tracker history
  const handleSendAgainFromHistory = async (row) => {
    try {
      showToast(`Re-sending performance report to ${row.employeeName}...`, 'loading', 0);
      const res = await performanceReportService.sendReport({
        employeeId: row.employeeId,
        department: row.department,
        reportData: row.reportData,
        averageScore: row.averageScore,
        overallRating: row.overallRating,
      });
      const count = res?.data?.sentCount || res?.sentCount || (row.sentCount + 1);
      showToast(`Performance report successfully re-sent to ${row.employeeName}! (Sent count: ${count})`, 'success');
      fetchSentReports();
      if (selectedEmployeeId === row.employeeId) {
        setEmpReportStatus(res?.data || res);
      }
    } catch (err) {
      showToast(err.message || 'Failed to re-send report.', 'error');
    }
  };

  // Handle report deletion by recipient user
  const handleDeleteMyReport = async () => {
    if (!reportToDelete) return;
    try {
      setIsDeletingReport(true);
      await performanceReportService.deleteMyReport(reportToDelete.id);
      showToast('Performance report removed from your view. Your manager or HR can send it to you again at any time.', 'success');
      setReportToDelete(null);
      await loadMyReports();
    } catch (err) {
      showToast(err.message || 'Failed to remove report.', 'error');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // Handle report deletion by reviewer/admin from Sent Tracker or Form
  const handleDeleteSentReport = async () => {
    if (!sentReportToDelete) return;
    try {
      setIsDeletingSentReport(true);
      await performanceReportService.deleteSentReport(sentReportToDelete.id);
      showToast(
        `Performance report for ${sentReportToDelete.employeeName || 'employee'} deleted successfully.`,
        'success'
      );
      setSentReportToDelete(null);
      await fetchSentReports();
      if (selectedEmployeeId === sentReportToDelete.employeeId) {
        setEmpReportStatus(null);
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete performance report.', 'error');
    } finally {
      setIsDeletingSentReport(false);
    }
  };

  // Average score calculation
  const calculateAverage = (competencies) => {
    if (!competencies || competencies.length === 0) return '0.00';
    const sum = competencies.reduce((acc, curr) => acc + (parseFloat(curr.score) || 0), 0);
    return (sum / competencies.length).toFixed(2);
  };

  const currentAverageScore = calculateAverage(currentData.competencies);

  // Computed active dossier data (for recipient employee vs reviewer)
  const isViewingMyReport = viewMode === 'my';
  const activeMyReport = isViewingMyReport && Array.isArray(myReports) && myReports.length > 0
    ? (myReports[activeMyReportIdx] || myReports[0] || null)
    : null;

  const cleanCeoName = (name) => {
    if (!name || typeof name !== 'string') return 'Sheetal Bedi (CEO)';
    const trimmed = name.trim();
    if (trimmed.includes('Jamdar') || trimmed === "Sheetal Ma'am" || trimmed === 'Sheetal') {
      return 'Sheetal Bedi (CEO)';
    }
    return trimmed;
  };

  // Helper to parse individual report data safely
  const parseReportData = (report) => {
    if (!report) return {};
    let raw = report.reportData;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    return {
      ...(raw || {}),
      employeeName: report.employeeName || raw?.employeeName || 'Employee',
      employeeId: report.employeeCode || report.employeeId || raw?.employeeId || '',
      designation: report.designation || raw?.designation || '',
      reviewPeriod: report.reviewPeriod || raw?.reviewPeriod || '',
      reviewDate: report.reviewDate || raw?.reviewDate || '',
      reviewCycle: report.reviewCycle || raw?.reviewCycle || 'Performance Appraisal',
      overallRating: report.overallRating || raw?.overallRating || 'Meets Expectations',
      averageScore: report.averageScore || raw?.averageScore || 0,
      competencies: Array.isArray(raw?.competencies) ? raw.competencies : [],
      goals: Array.isArray(raw?.goals) ? raw.goals : [],
      training: Array.isArray(raw?.training) ? raw.training : [],
      actions: raw?.actions && typeof raw.actions === 'object' ? raw.actions : {},
      ceoName: cleanCeoName(raw?.ceoName || report.ceoName),
      ceoDate: raw?.ceoDate || report.reviewDate || '',
      achievements: raw?.achievements || '',
      improvements: raw?.improvements || '',
      employeeComments: raw?.employeeComments || '',
      managerComments: raw?.managerComments || '',
      manager: raw?.manager || '',
      ldExecutive: raw?.ldExecutive || '',
    };
  };

  // Start editing a sent report
  const handleStartEditReport = (report) => {
    if (!report) return;
    const targetDept = (report.department || 'operations').toLowerCase();
    setEditingReport(report);
    setSelectedEmployeeId(report.employeeId);
    setDepartment(targetDept);

    const parsed = parseReportData(report);
    const updatedData = {
      ...parsed,
      employeeName: report.employeeName || parsed.employeeName,
      employeeId: report.employeeCode || report.employeeId || parsed.employeeId,
      department: targetDept,
      designation: report.designation || parsed.designation,
      reviewPeriod: report.reviewPeriod || parsed.reviewPeriod,
      reviewDate: report.reviewDate || parsed.reviewDate,
      reviewCycle: report.reviewCycle || parsed.reviewCycle,
    };
    setDeptData(targetDept, updatedData);
    setEmpReportStatus(report);
    setReviewerSubTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Loaded appraisal for ${report.employeeName}. Edit any rating or feedback and click "Update & Save Appraisal".`, 'info', 4000);
  };

  // Cancel edit mode
  const handleCancelEditReport = () => {
    setEditingReport(null);
    handleResetForm();
    showToast('Exited appraisal edit mode.', 'info');
  };

  // Save updated report
  const handleUpdateReport = async () => {
    if (!editingReport) return;
    setIsSending(true);
    showToast(`Updating performance appraisal for ${currentData.employeeName}...`, 'loading', 0);
    try {
      const avgScore = calculateAverage(currentData.competencies);
      await performanceReportService.updateReport(editingReport.id, {
        reportData: currentData,
        averageScore: avgScore,
        overallRating: currentData.overallRating,
        reviewPeriod: currentData.reviewPeriod,
        reviewDate: currentData.reviewDate,
        reviewCycle: currentData.reviewCycle,
      });

      showToast(`Performance appraisal for ${currentData.employeeName} updated successfully!`, 'success');
      setEditingReport(null);
      await fetchSentReports();
      setReviewerSubTab('tracker');
    } catch (err) {
      showToast(err.message || 'Failed to update performance report.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const parsedActiveReportData = useMemo(() => {
    if (!activeMyReport) return null;
    let data = activeMyReport.reportData;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }
    return data && typeof data === 'object' ? data : null;
  }, [activeMyReport]);

  const effectiveDepartment = isViewingMyReport && activeMyReport
    ? (activeMyReport.department || department || 'operations')
    : (department || 'operations');

  const effectiveData = useMemo(() => {
    if (isViewingMyReport && activeMyReport && parsedActiveReportData) {
      return {
        ...parsedActiveReportData,
        employeeName: activeMyReport.employeeName || parsedActiveReportData.employeeName || '',
        employeeId: activeMyReport.employeeCode || activeMyReport.employeeId || parsedActiveReportData.employeeId || '',
        department: activeMyReport.department || parsedActiveReportData.department || '',
        designation: activeMyReport.designation || parsedActiveReportData.designation || '',
        reviewPeriod: activeMyReport.reviewPeriod || parsedActiveReportData.reviewPeriod || '',
        reviewDate: activeMyReport.reviewDate || parsedActiveReportData.reviewDate || '',
        reviewCycle: activeMyReport.reviewCycle || parsedActiveReportData.reviewCycle || '',
        competencies: Array.isArray(parsedActiveReportData.competencies) ? parsedActiveReportData.competencies : [],
        goals: Array.isArray(parsedActiveReportData.goals) ? parsedActiveReportData.goals : [],
        training: Array.isArray(parsedActiveReportData.training) ? parsedActiveReportData.training : [],
        actions: parsedActiveReportData.actions && typeof parsedActiveReportData.actions === 'object' ? parsedActiveReportData.actions : {},
        overallRating: activeMyReport.overallRating || parsedActiveReportData.overallRating || 'Meets Expectations',
      };
    }
    return currentData;
  }, [isViewingMyReport, activeMyReport, parsedActiveReportData, currentData]);

  const effectiveAverageScore = useMemo(() => {
    if (isViewingMyReport && activeMyReport?.averageScore) {
      return Number(activeMyReport.averageScore).toFixed(2);
    }
    return calculateAverage(effectiveData.competencies) || currentAverageScore || '0.00';
  }, [isViewingMyReport, activeMyReport, effectiveData, currentAverageScore]);

  // Add / remove rows for goals
  const addGoalRow = () => {
    setCurrentData((prev) => ({
      ...prev,
      goals: [...(prev.goals || []), { goal: '', target: '', deadline: '', status: 'Planned' }],
    }));
  };

  const removeGoalRow = (idx) => {
    setCurrentData((prev) => ({
      ...prev,
      goals: (prev.goals || []).filter((_, i) => i !== idx),
    }));
  };

  // Add / remove rows for training
  const addTrainingRow = () => {
    setCurrentData((prev) => ({
      ...prev,
      training: [...(prev.training || []), { skill: '', training: '', priority: 'Medium' }],
    }));
  };

  const removeTrainingRow = (idx) => {
    setCurrentData((prev) => ({
      ...prev,
      training: (prev.training || []).filter((_, i) => i !== idx),
    }));
  };

  // Reset form to blank
  const handleResetForm = () => {
    if (window.confirm('Are you sure you want to clear all data and reset this review to a blank form?')) {
      setCurrentData((prev) => ({
        ...prev,
        employeeName: '',
        employeeId: '',
        designation: '',
        manager: '',
        reviewDate: new Date().toISOString().split('T')[0],
        reviewPeriod: '',
        ldExecutive: '',
        achievements: '',
        improvements: '',
        employeeComments: '',
        managerComments: '',
        competencies: prev.competencies.map((c) => ({ ...c, score: 3.0, comment: '' })),
        goals: [{ goal: '', target: '', deadline: '', status: 'Planned' }],
        training: [{ skill: '', training: '', priority: 'Medium' }],
        overallRating: 'Meets Expectations',
        actions: {
          action1: false,
          action2: false,
          action3: false,
          action4: false,
          action5: false,
          action6: false,
        },
      }));
      setEmpReportStatus(null);
      showToast('Form reset to blank.', 'info');
    }
  };

  // Export to Excel (supports individual reports or active form)
  const handleDownloadExcel = (customReport = null) => {
    const targetReport = customReport || activeMyReport;
    const targetData = customReport ? parseReportData(customReport) : effectiveData;
    const targetDept = customReport ? (customReport.department || 'operations') : effectiveDepartment;
    const targetAvg = customReport ? (Number(customReport.averageScore || 0).toFixed(2)) : effectiveAverageScore;

    const deptTitle = targetDept === 'operations' ? 'Operations' : targetDept === 'it' ? 'IT' : 'Talent Acquisition';
    const empName = targetData.employeeName || 'Employee';

    showToast(`Generating ${deptTitle} Excel review...`, 'loading', 1500);

    const summaryData = [
      { Property: 'Department', Value: deptTitle },
      { Property: 'Employee Name', Value: empName },
      { Property: 'Employee ID', Value: targetData.employeeId },
      { Property: 'Designation', Value: targetData.designation },
      { Property: 'Reporting Manager', Value: targetData.manager },
      { Property: 'Review Date', Value: targetData.reviewDate },
      { Property: 'Review Period', Value: targetData.reviewPeriod },
      { Property: 'Review Cycle', Value: targetReport?.reviewCycle || targetData.reviewCycle || 'Performance Appraisal' },
      { Property: 'L&D Executive', Value: targetData.ldExecutive },
      { Property: 'Average Score', Value: `${targetAvg} / 5.0` },
      { Property: 'Overall Determination', Value: targetData.overallRating },
      { Property: 'Major Accomplishments', Value: targetData.achievements },
      { Property: 'Areas for Development', Value: targetData.improvements },
      { Property: 'Employee Comments', Value: targetData.employeeComments },
      { Property: 'Manager Comments', Value: targetData.managerComments },
      { Property: 'Authorized Signatory', Value: cleanCeoName(targetData.ceoName) },
      { Property: 'Authorization Date', Value: targetData.ceoDate || targetData.reviewDate },
    ];

    const competencyData = (targetData.competencies || []).map((c, i) => ({
      '#': i + 1,
      'Performance Competency Area': c.area,
      'Rating (1-5)': c.score,
      'Comments / Observations': c.comment,
    }));

    const goalsData = (targetData.goals || []).map((g, i) => ({
      '#': i + 1,
      'Goal Objective': g.goal,
      'Target / Key Result': g.target,
      Deadline: g.deadline,
      Status: g.status,
    }));

    const trainingData = (targetData.training || []).map((t, i) => ({
      '#': i + 1,
      'Skill Area': t.skill,
      'Recommended Training': t.training,
      Priority: t.priority,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Review Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(competencyData), 'Competency Ratings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalsData), 'Upcoming Goals');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trainingData), 'Training Needs');

    const cleanEmp = empName.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `${cleanEmp}_${deptTitle}_Performance_Review.xlsx`);
    showToast('Excel report downloaded successfully!', 'success');
  };

  // High-Resolution Multi-Page Executive PDF Generation (supports downloading any delivered report or active form)
  const handleDownloadPdf = async (customReport = null) => {
    const targetReport = customReport || activeMyReport;
    const targetData = customReport ? parseReportData(customReport) : effectiveData;
    const targetDept = customReport ? (customReport.department || 'operations') : effectiveDepartment;
    const targetAvg = customReport ? (Number(customReport.averageScore || 0).toFixed(2)) : effectiveAverageScore;

    setPdfCustomReport({
      department: targetDept,
      data: targetData,
      averageScore: targetAvg,
    });
    setDownloadingReportId(customReport?.id || 'active');
    setIsGeneratingPdf(true);

    const deptTitle = targetDept === 'operations' ? 'Operations' : targetDept === 'it' ? 'IT' : 'Talent_Acquisition';
    const empName = (targetData.employeeName || 'Employee').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${empName}_${deptTitle}_Performance_Appraisal_${targetData.reviewDate || '2026'}.pdf`;

    showToast(`Rendering official ${deptTitle.replace('_', ' ')} executive review PDF...`, 'loading', 0);

    try {
      // 1. Ensure all fonts and typographic assets are fully loaded and rendered
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Allow DOM layout and subpixel rasterization to stabilize with the targeted report
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (!printDossierRef.current) {
        throw new Error('Dossier printable element not mounted');
      }

      const pageElements = printDossierRef.current.querySelectorAll('.pdf-dossier-page');
      if (!pageElements || pageElements.length === 0) {
        throw new Error('Dossier printable pages not found');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        const canvas = await html2canvas(pageEl, {
          scale: 3, // 3x ultra-high-definition clarity (equivalent to ~300 DPI print quality)
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          removeContainer: true,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            const dossierRoot = clonedDoc.getElementById('pdf-dossier-export-root');
            if (dossierRoot) {
              dossierRoot.style.position = 'absolute';
              dossierRoot.style.left = '0';
              dossierRoot.style.top = '0';
              dossierRoot.style.display = 'block';
              dossierRoot.style.visibility = 'visible';
              dossierRoot.style.opacity = '1';
              dossierRoot.style.zIndex = '999999';
            }
          },
        });

        // Use lossless PNG for pin-sharp typography and badges with ZERO JPEG compression artifacts
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }
        // Exactly standard A4 dimensions: 210mm x 297mm
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(fileName);
      showToast('Official review PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Error exporting PDF. Please try again.', 'error');
    } finally {
      setIsGeneratingPdf(false);
      setDownloadingReportId(null);
    }
  };

  // Sent Reports Tracker Columns for Reviewers
  const sentTrackerColumns = [
    {
      header: 'Recipient Employee',
      render: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 dark:text-white block">
            {row?.employeeName || 'Employee'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {row?.employeeCode || row?.employeeId || ''} {row?.empEmail ? `• ${row.empEmail}` : ''}
          </span>
        </div>
      ),
    },
    {
      header: 'Department',
      render: (row) => (
        <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
          {row?.department || 'operations'}
        </span>
      ),
    },
    {
      header: 'Review Period & Cycle',
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {row?.reviewPeriod || 'Current Period'}
          </span>
          <span className="text-[11px] text-slate-400">
            {row?.reviewCycle || 'Quarterly Review'}
          </span>
        </div>
      ),
    },
    {
      header: 'Score / Rating',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-800">
            {row?.averageScore ? Number(row.averageScore).toFixed(1) : '--'}/5.0
          </span>
          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[130px]">
            {row?.overallRating || 'Meets Expectations'}
          </span>
        </div>
      ),
    },
    {
      header: 'Delivery Status',
      render: (row) => {
        if (row?.status === 'DELETED_BY_USER') {
          return (
            <div>
              <Badge variant="warning" size="sm">
                Deleted by Recipient
              </Badge>
              <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">
                Option to Send Again
              </span>
            </div>
          );
        }
        return (
          <div>
            <Badge variant="success" size="sm">
              Delivered
            </Badge>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Sent {row?.sentCount || 1} time{(row?.sentCount || 1) > 1 ? 's' : ''}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Last Sent',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row?.lastSentAt ? new Date(row.lastSentAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {/* Review appraisal button */}
          <Button
            size="sm"
            variant="outline"
            icon={Eye}
            onClick={() => setPreviewReport(row)}
            title="Review performance appraisal report"
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 border-brand-200 dark:border-brand-800"
          >
            Review
          </Button>

          {/* Edit appraisal button */}
          <Button
            size="sm"
            variant="outline"
            icon={FileEdit}
            onClick={() => handleStartEditReport(row)}
            title="Edit this performance report"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800"
          >
            Edit
          </Button>

          {/* Send Again button */}
          <Button
            size="sm"
            variant={row?.status === 'DELETED_BY_USER' ? 'primary' : 'outline'}
            icon={RotateCw}
            onClick={() => handleSendAgainFromHistory(row)}
            title="Re-send appraisal report"
            className="text-xs font-semibold"
          >
            Send Again
          </Button>

          {/* Delete report button */}
          <Button
            size="sm"
            variant="outline"
            icon={Trash2}
            onClick={() => setSentReportToDelete(row)}
            title="Delete this performance report"
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Initials generator
  const getInitials = (name) => {
    if (!name) return 'EM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Group sent reports by recipient employee into an Employee Directory
  const employeeDirectory = useMemo(() => {
    const map = new Map();

    (sentReports || []).forEach((report) => {
      const key = String(report.employeeId || report.employeeUserId || report.employeeName || report.id);
      if (!map.has(key)) {
        map.set(key, {
          key,
          employeeId: report.employeeId,
          employeeUserId: report.employeeUserId,
          employeeName: report.employeeName || 'Unknown Employee',
          employeeCode: report.employeeCode || report.empCode || '',
          empEmail: report.empEmail || '',
          designation: report.designation || '',
          department: report.department || 'operations',
          reports: [],
          totalSentCount: 0,
        });
      }
      const entry = map.get(key);
      entry.reports.push(report);
      entry.totalSentCount += (report.sentCount || 1);
    });

    const list = Array.from(map.values()).map((emp) => {
      emp.reports.sort((a, b) => new Date(b.lastSentAt || b.createdAt || 0) - new Date(a.lastSentAt || a.createdAt || 0));
      emp.latestReport = emp.reports[0] || null;
      return emp;
    });

    list.sort((a, b) => {
      const dateA = new Date(a.latestReport?.lastSentAt || a.latestReport?.createdAt || 0);
      const dateB = new Date(b.latestReport?.lastSentAt || b.latestReport?.createdAt || 0);
      return dateB - dateA;
    });

    return list;
  }, [sentReports]);

  // Filtered employee directory based on search query & department
  const filteredEmployeeDirectory = useMemo(() => {
    return employeeDirectory.filter((emp) => {
      if (trackerDeptFilter !== 'all') {
        const d = (emp.department || '').toLowerCase();
        if (d !== trackerDeptFilter.toLowerCase()) return false;
      }
      if (trackerSearch.trim()) {
        const q = trackerSearch.toLowerCase().trim();
        const matchName = (emp.employeeName || '').toLowerCase().includes(q);
        const matchCode = (emp.employeeCode || '').toLowerCase().includes(q);
        const matchEmail = (emp.empEmail || '').toLowerCase().includes(q);
        const matchCycle = emp.reports.some((r) =>
          (r.reviewCycle || '').toLowerCase().includes(q) ||
          (r.reviewPeriod || '').toLowerCase().includes(q) ||
          (r.overallRating || '').toLowerCase().includes(q)
        );
        return matchName || matchCode || matchEmail || matchCycle;
      }
      return true;
    });
  }, [employeeDirectory, trackerSearch, trackerDeptFilter]);

  // Auto-expand all employees on initial directory load
  useEffect(() => {
    if (sentReports.length > 0) {
      setExpandedEmployees((prev) => {
        if (prev.size === 0) {
          return new Set(sentReports.map((r) => String(r.employeeId || r.employeeUserId || r.employeeName || r.id)));
        }
        return prev;
      });
    }
  }, [sentReports]);

  const toggleExpandEmployee = (key) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isAllExpanded = filteredEmployeeDirectory.length > 0 &&
    filteredEmployeeDirectory.every((e) => expandedEmployees.has(e.key));

  const toggleAllExpanded = () => {
    if (isAllExpanded) {
      setExpandedEmployees(new Set());
    } else {
      setExpandedEmployees(new Set(filteredEmployeeDirectory.map((e) => e.key)));
    }
  };

  // Department theme styles
  const getTheme = () => {
    const activeD = effectiveDepartment || department;
    if (activeD === 'operations') {
      return {
        badgeBg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
        primaryBg: 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand/20',
        accentColor: '#4f46e5',
        headerGradient: 'from-slate-900 via-brand-950 to-slate-900',
        lineGradient: 'from-brand-500 via-indigo-400 to-brand-600',
        numBg: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 border border-brand-200 dark:border-brand-800',
        focusRing: 'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
        scoreBadge: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        sigCardBorder: 'border-slate-200 dark:border-slate-800',
        tagText: 'Operations Team • L&D',
        title: 'Operations Team Performance Review',
        subtitle: 'Learning & Development | Operations Team Performance Calibration & Progression Review',
        Icon: Building2,
      };
    } else if (activeD === 'it') {
      return {
        badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
        primaryBg: 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand/20',
        accentColor: '#4f46e5',
        headerGradient: 'from-slate-900 via-brand-950 to-slate-900',
        lineGradient: 'from-brand-500 via-indigo-400 to-brand-600',
        numBg: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 border border-brand-200 dark:border-brand-800',
        focusRing: 'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
        scoreBadge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        sigCardBorder: 'border-slate-200 dark:border-slate-800',
        tagText: 'IT Team • L&D',
        title: 'IT Team Performance Review Form',
        subtitle: 'Official periodic performance assessment, technical calibration, and career progression record.',
        Icon: Laptop,
      };
    } else {
      return {
        badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        primaryBg: 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand/20',
        accentColor: '#4f46e5',
        headerGradient: 'from-slate-900 via-brand-950 to-slate-900',
        lineGradient: 'from-brand-500 via-indigo-400 to-brand-600',
        numBg: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 border border-brand-200 dark:border-brand-800',
        focusRing: 'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
        scoreBadge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        sigCardBorder: 'border-slate-200 dark:border-slate-800',
        tagText: 'TA Team • L&D',
        title: 'TA Team Performance Review',
        subtitle: 'Learning & Development | TA Team Performance Calibration & Progression Review',
        Icon: Target,
      };
    }
  };

  const theme = getTheme();
  const ThemeIcon = theme.Icon;

  return (
    <div className="space-y-6">
      {/* Standard TaskNera Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {canReviewOthers && viewMode === 'reviews'
                ? 'Performance Reports'
                : 'My Performance'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {canReviewOthers && viewMode === 'reviews'
                ? isManager
                  ? 'Evaluate direct reporting employees, calibrate scores, and generate official appraisal reports.'
                  : 'Department performance evaluations, competency scoring calibrations, and official PDF reports.'
                : 'Official performance assessment record, skill calibration ratings, and career progression overview.'}
            </p>
          </div>
        </div>
      </div>

      {/* Role Navigation: Review Dossiers vs My Review */}
      {canReviewOthers && hasOwnReview ? (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('reviews')}
            className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${viewMode === 'reviews'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
          >
            <FileText className="w-4 h-4" />
            Performance Reports
          </button>

          <button
            type="button"
            onClick={() => setViewMode('my')}
            className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${viewMode === 'my'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
          >
            <Award className="w-4 h-4" />
            My Performance
          </button>
        </div>
      ) : isEmployeeOnly ? (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-semibold">
          <button
            type="button"
            className="pb-3 text-brand-600 border-b-2 border-brand-600 flex items-center gap-2 font-bold cursor-default"
          >
            <Award className="w-4 h-4" />
            My Performance
          </button>
        </div>
      ) : null}

      {/* Reviewer Sub-Tabs: Form vs Sent Reports Tracker (Visible when reviewing others) */}
      {canReviewOthers && viewMode === 'reviews' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReviewerSubTab('form')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${reviewerSubTab === 'form'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
            >
              Performance Review Form
            </button>
            <button
              type="button"
              onClick={() => {
                setReviewerSubTab('tracker');
                fetchSentReports();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${reviewerSubTab === 'tracker'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Sent Reports Tracker</span>
              {sentReports.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${reviewerSubTab === 'tracker' ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                  }`}>
                  {sentReports.length}
                </span>
              )}
            </button>
          </div>

          {reviewerSubTab === 'form' && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDepartment('operations')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${department === 'operations'
                  ? 'bg-brand-500 text-white shadow-brand shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-700'
                  }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Operations Team</span>
              </button>

              <button
                type="button"
                onClick={() => setDepartment('ta')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${department === 'ta'
                  ? 'bg-brand-500 text-white shadow-brand shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-700'
                  }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>TA Team</span>
              </button>

              <button
                type="button"
                onClick={() => setDepartment('it')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${department === 'it'
                  ? 'bg-brand-500 text-white shadow-brand shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-700'
                  }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>IT Team</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tracker View vs Evaluation Form / My Performance View */}
      {canReviewOthers && viewMode === 'reviews' && reviewerSubTab === 'tracker' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                  <Users className="w-3 h-3" />
                  Employee Directory
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {filteredEmployeeDirectory.length} {filteredEmployeeDirectory.length === 1 ? 'Recipient' : 'Recipients'} • {sentReports.length} {sentReports.length === 1 ? 'Report Sent' : 'Reports Sent'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-brand-500" />
                <span>Sent Performance Reports Directory</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Organized directory of all team members and their delivered performance appraisals. Click any employee to view all reports dispatched to them.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filteredEmployeeDirectory.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={isAllExpanded ? ChevronUp : ChevronDown}
                  onClick={toggleAllExpanded}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {isAllExpanded ? 'Collapse All' : 'Expand All'}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                icon={RefreshCw}
                loading={loadingSentReports}
                onClick={fetchSentReports}
                className="text-xs font-semibold"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Search & Department Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search directory by employee name, code, email, cycle..."
                value={trackerSearch}
                onChange={(e) => setTrackerSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
              {trackerSearch && (
                <button
                  type="button"
                  onClick={() => setTrackerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Department Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setTrackerDeptFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${trackerDeptFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                All ({employeeDirectory.length})
              </button>
              <button
                type="button"
                onClick={() => setTrackerDeptFilter('operations')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${trackerDeptFilter === 'operations'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 border border-teal-200/60 dark:border-teal-800/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Operations ({employeeDirectory.filter((e) => (e.department || '').toLowerCase() === 'operations').length})
              </button>
              <button
                type="button"
                onClick={() => setTrackerDeptFilter('ta')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${trackerDeptFilter === 'ta'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/60 dark:border-amber-800/60'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                TA ({employeeDirectory.filter((e) => (e.department || '').toLowerCase() === 'ta').length})
              </button>
              <button
                type="button"
                onClick={() => setTrackerDeptFilter('it')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${trackerDeptFilter === 'it'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200/60 dark:border-indigo-800/60'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                IT ({employeeDirectory.filter((e) => (e.department || '').toLowerCase() === 'it').length})
              </button>
            </div>
          </div>

          {/* Directory Content */}
          {loadingSentReports ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <LoadingSpinner size="lg" message="Loading employee performance reports directory..." />
            </div>
          ) : sentReports.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto border border-brand-200 dark:border-brand-800 shadow-sm">
                <History className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">No Performance Reports Sent Yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  When you evaluate and dispatch performance review reports from the Performance Review Form, they will appear here neatly grouped under each employee's directory entry.
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" variant="primary" onClick={() => setReviewerSubTab('form')}>
                  Go to Review Form
                </Button>
              </div>
            </div>
          ) : filteredEmployeeDirectory.length === 0 ? (
            <div className="py-14 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Search className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">No Matching Employees in Directory</h4>
                <p className="text-xs text-slate-500">No records match your search or filter. Try a different query or clear the filter.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTrackerSearch('');
                  setTrackerDeptFilter('all');
                }}
              >
                Clear Search &amp; Filter
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEmployeeDirectory.map((emp) => {
                const isExpanded = expandedEmployees.has(emp.key);
                const dept = (emp.department || 'operations').toLowerCase();
                const DeptIcon = dept === 'it' ? Laptop : dept === 'ta' ? Target : Building2;
                const deptLabel = dept === 'it' ? 'IT' : dept === 'ta' ? 'TA' : 'Operations';

                return (
                  <div
                    key={emp.key}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'border-brand-500/40 dark:border-brand-500/30 shadow-md shadow-brand-500/5 bg-white dark:bg-slate-900 ring-1 ring-brand-500/20'
                        : 'border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Employee Directory Header Row */}
                    <div
                      onClick={() => toggleExpandEmployee(emp.key)}
                      className="p-4 sm:p-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Left: Avatar + Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-brand-950 dark:to-slate-800 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80 flex items-center justify-center font-bold text-sm tracking-wider shadow-2xs shrink-0">
                          {getInitials(emp.employeeName)}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                              {emp.employeeName}
                            </h3>
                            {emp.employeeCode && (
                              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                {emp.employeeCode}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              dept === 'it'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                                : dept === 'ta'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                                  : 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60'
                            }`}>
                              <DeptIcon className="w-3 h-3" />
                              {deptLabel}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                            {emp.empEmail && <span>{emp.empEmail}</span>}
                            {emp.empEmail && emp.designation && <span>•</span>}
                            {emp.designation && <span>{emp.designation}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Latest Score & Reports Count Pill & Toggle */}
                      <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                        {emp.latestReport && (
                          <div className="text-left lg:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Latest Review
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-black text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-800 font-mono">
                                {emp.latestReport.averageScore ? Number(emp.latestReport.averageScore).toFixed(1) : '--'}
                                <span className="text-[10px] font-normal text-slate-400">/5.0</span>
                              </span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                                {emp.latestReport.overallRating || 'Meets Expectations'}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80">
                            <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                            {emp.reports.length} {emp.reports.length === 1 ? 'Report' : 'Reports'}
                          </span>

                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                              isExpanded
                                ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Section: All Reports Sent to This Employee */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-200">
                        {/* Section Sub-Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-brand-500" />
                              Reports Delivered to {emp.employeeName} ({emp.reports.length})
                            </span>
                            <span className="text-[11px] text-slate-400">
                              (Sent {emp.totalSentCount} time{emp.totalSentCount > 1 ? 's' : ''} total)
                            </span>
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Plus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEmployee(emp.employeeId, true);
                              setDepartment(emp.department || 'operations');
                              setReviewerSubTab('form');
                            }}
                            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                          >
                            New Report for {emp.employeeName.split(' ')[0]}
                          </Button>
                        </div>

                        {/* Reports Table for this Employee */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                              <tr>
                                <th className="py-3 px-4 font-bold">Review Period &amp; Cycle</th>
                                <th className="py-3 px-4 font-bold">Score / Rating</th>
                                <th className="py-3 px-4 font-bold">Delivery Status</th>
                                <th className="py-3 px-4 font-bold">Last Sent</th>
                                <th className="py-3 px-4 font-bold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                              {emp.reports.map((report) => (
                                <tr
                                  key={report.id}
                                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  {/* Period & Cycle */}
                                  <td className="py-3.5 px-4">
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                                        {report.reviewPeriod || 'Current Period'}
                                      </span>
                                      <span className="text-[11px] text-slate-400 block font-mono">
                                        {report.reviewCycle || 'Quarterly Review'}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Score / Rating */}
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-800 font-mono">
                                        {report.averageScore ? Number(report.averageScore).toFixed(1) : '--'}/5.0
                                      </span>
                                      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        {report.overallRating || 'Meets Expectations'}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Delivery Status */}
                                  <td className="py-3.5 px-4">
                                    {report.status === 'DELETED_BY_USER' ? (
                                      <div>
                                        <Badge variant="warning" size="sm">
                                          Deleted by Recipient
                                        </Badge>
                                        <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">
                                          Option to Send Again
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <Badge variant="success" size="sm">
                                          Delivered
                                        </Badge>
                                        <span className="text-[10px] text-slate-400 block mt-0.5">
                                          Sent {report.sentCount || 1} time{(report.sentCount || 1) > 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Last Sent */}
                                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                                    {report.lastSentAt ? new Date(report.lastSentAt).toLocaleDateString() : 'N/A'}
                                  </td>

                                  {/* Action Buttons */}
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        icon={Eye}
                                        onClick={() => setPreviewReport(report)}
                                        title="Review performance appraisal report"
                                        className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 border-brand-200 dark:border-brand-800"
                                      >
                                        Review
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        icon={FileEdit}
                                        onClick={() => handleStartEditReport(report)}
                                        title="Edit this performance report"
                                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800"
                                      >
                                        Edit
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant={report.status === 'DELETED_BY_USER' ? 'primary' : 'outline'}
                                        icon={RotateCw}
                                        onClick={() => handleSendAgainFromHistory(report)}
                                        title="Re-send appraisal report"
                                        className="text-xs font-semibold"
                                      >
                                        Send Again
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        icon={Trash2}
                                        onClick={() => setSentReportToDelete(report)}
                                        title="Delete this performance report"
                                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isViewingMyReport && loadingMyReports ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <LoadingSpinner size="lg" message="Loading your official performance review..." />
        </div>
      ) : isViewingMyReport && myReports.length === 0 ? (
        <div className="py-20 px-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800 shadow-sm">
            <Award className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No Performance Report Available Yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              Your performance review report has not been published or sent by your manager or HR yet.
              Performance evaluations are delivered directly and exclusively to the selected individual upon authorization.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={loadMyReports}
            >
              Check Again
            </Button>
          </div>
        </div>
      ) : isViewingMyReport ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Banner / Summary Card */}
          <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-800">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Official Performance Records
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {myReports.length} {myReports.length === 1 ? 'Performance Review Report' : 'Performance Review Reports'} Delivered
                  </span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
                  My Delivered Performance Review Reports
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Official evaluation records, competency calibration ratings, and career progression documentation delivered by management. Download your executive PDF report directly below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={RefreshCw}
                  loading={loadingMyReports}
                  onClick={loadMyReports}
                  className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
                >
                  Refresh Reports
                </Button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10 relative z-10">
              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[11px] font-semibold text-slate-400 block">Total Reports</span>
                <span className="text-lg font-black text-white">{myReports.length}</span>
              </div>
              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[11px] font-semibold text-slate-400 block">Latest Rating</span>
                <span className="text-sm font-bold text-emerald-300 truncate block">
                  {myReports[0]?.overallRating || 'Meets Expectations'}
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[11px] font-semibold text-slate-400 block">Latest Score</span>
                <span className="text-lg font-black text-brand-300">
                  {myReports[0]?.averageScore ? Number(myReports[0].averageScore).toFixed(2) : '—'} <span className="text-xs font-normal text-slate-400">/ 5.0</span>
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[11px] font-semibold text-slate-400 block">Signatory</span>
                <span className="text-xs font-bold text-slate-200 truncate block">Sheetal Bedi (CEO)</span>
              </div>
            </div>
          </div>

          {/* Reports Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" />
                Delivered Performance Review Reports ({myReports.length})
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Click Download PDF on any report below
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myReports.map((report, idx) => {
                const parsed = parseReportData(report);
                const isLatest = idx === 0;
                const score = Number(report.averageScore || 0).toFixed(2);
                const isCurrentGenerating = isGeneratingPdf && downloadingReportId === report.id;

                const dept = (report.department || 'operations').toLowerCase();
                const DeptIcon = dept === 'it' ? Laptop : dept === 'ta' ? Target : Building2;
                const deptLabel = dept === 'it' ? 'IT Team' : dept === 'ta' ? 'TA Team' : 'Operations Team';

                const rating = report.overallRating || 'Meets Expectations';
                const isExceptional = rating.toLowerCase().includes('exceptional');
                const isExceeds = rating.toLowerCase().includes('exceed');
                const isNeedsImp = rating.toLowerCase().includes('need') || rating.toLowerCase().includes('pip');

                return (
                  <div
                    key={report.id || idx}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 hover:shadow-lg flex flex-col justify-between overflow-hidden group ${isLatest
                        ? 'border-brand-500/40 dark:border-brand-500/30 shadow-md shadow-brand-500/5 ring-1 ring-brand-500/20'
                        : 'border-slate-200/90 dark:border-slate-800 shadow-xs'
                      }`}
                  >
                    {/* Card Content */}
                    <div className="p-5 pb-4 space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <DeptIcon className="w-3.5 h-3.5 text-brand-500" />
                          {deptLabel}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isLatest && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300">
                              Latest
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {report.reviewCycle || 'Performance Appraisal'}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Period: <strong className="text-slate-700 dark:text-slate-200">{report.reviewPeriod || 'Evaluation Cycle'}</strong></span>
                        </div>
                      </div>

                      {/* Score & Rating Bar */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Rating</span>
                          <span className={`inline-block text-xs font-extrabold mt-0.5 px-2 py-0.5 rounded-md ${isExceptional
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isExceeds
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : isNeedsImp
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            }`}>
                            {rating}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Score</span>
                          <div className="flex items-baseline gap-0.5 justify-end">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{score}</span>
                            <span className="text-xs text-slate-400 font-semibold">/ 5.0</span>
                          </div>
                        </div>
                      </div>

                      {/* Metadata details */}
                      <div className="space-y-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span>Delivered Date:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {report.lastSentAt ? new Date(report.lastSentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Delivered'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Authorized by:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {cleanCeoName(parsed.ceoName)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-4 pt-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Download}
                        loading={isCurrentGenerating}
                        onClick={() => handleDownloadPdf(report)}
                        className="w-full text-xs font-bold shadow-md shadow-brand-500/10 justify-center py-2"
                      >
                        {isCurrentGenerating ? 'Generating PDF...' : 'Download PDF'}
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => setPreviewReport(report)}
                          className="flex-1 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 justify-center py-1.5"
                        >
                          View Details
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          icon={Trash2}
                          title="Remove from my view"
                          onClick={() => setReportToDelete(report)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800 px-2.5 py-1.5 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* MAIN PERFORMANCE REVIEW REPORT */}
          <section
            ref={documentRef}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none"
          >
            {/* Document Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
              <div className="relative z-10 max-w-3xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-slate-100 mb-3 shadow-xs">
                  <ThemeIcon className="w-3.5 h-3.5 text-brand-300" />
                  {theme.tagText}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 leading-tight">
                  {theme.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">{theme.subtitle}</p>
              </div>
              {/* Color Accent Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-indigo-400 to-brand-600" />
            </div>

            {/* Form Body */}
            <div className="p-6 sm:p-10 space-y-10">
              {/* Active Editing Report Banner */}
              {editingReport && (
                <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border-2 border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
                      <FileEdit className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white tracking-wider">
                          Edit Mode Active
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Editing Sent Appraisal: {editingReport.employeeName}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Cycle: <strong className="text-slate-800 dark:text-slate-100">{editingReport.reviewPeriod || 'Current Period'}</strong> ({editingReport.reviewCycle || 'Performance Appraisal'}). Modifying ratings, feedback, or goals will update the delivered appraisal record directly.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEditReport}
                      className="text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    >
                      Cancel Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={FileEdit}
                      loading={isSending}
                      onClick={handleUpdateReport}
                      className="text-xs font-bold shadow-md shadow-indigo-500/20"
                    >
                      Update &amp; Save
                    </Button>
                  </div>
                </div>
              )}

              {/* 01: Employee Information */}
              <section className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                      01
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Employee &amp; Review Information
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Basic details of the team member under review</p>
                    </div>
                  </div>

                  {/* Recipient Delivery Status Indicator (Reviewer Form Mode) */}
                  {!isViewingMyReport && selectedEmployeeId && (
                    <div className="flex items-center gap-2">
                      {loadingStatus ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                          <Clock className="w-3.5 h-3.5 animate-spin" /> Checking delivery status...
                        </span>
                      ) : empReportStatus?.status === 'DELETED_BY_USER' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-3 py-1 rounded-full shadow-2xs">
                          <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                          Deleted by recipient • Re-send available (Sent {empReportStatus.sentCount}x)
                        </span>
                      ) : empReportStatus?.status === 'DELIVERED' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 px-3 py-1 rounded-full shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Delivered to employee • Sent {empReportStatus.sentCount}x • Last sent: {new Date(empReportStatus.lastSentAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Not sent yet • Click &quot;Send Report&quot; below to deliver specifically to this employee
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Employee Name <span className="text-rose-500">*</span>
                    </label>
                    {isViewingMyReport ? (
                      <input
                        type="text"
                        value={effectiveData.employeeName || ''}
                        readOnly
                        className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-default"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={currentData.employeeName}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            const matched = departmentEmployees.find(
                              (emp) => `${emp.firstName || ''} ${emp.lastName || ''}`.trim() === selectedName
                            );
                            if (matched) {
                              handleSelectEmployee(matched.id || matched._id);
                            } else {
                              setCurrentData((p) => ({ ...p, employeeName: selectedName }));
                            }
                          }}
                          className={`w-full appearance-none pl-3.5 pr-10 py-2.5 text-sm font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all cursor-pointer ${theme.focusRing}`}
                        >
                          <option value="">
                            {loadingEmployees
                              ? 'Loading team members...'
                              : departmentEmployees.length === 0
                                ? 'No employees registered'
                                : 'Select employee...'}
                          </option>
                          {departmentEmployees.map((emp) => {
                            const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.email;
                            const key = emp.id || emp._id || name;
                            const dept = emp.department?.name || emp.departmentName || '';
                            const desig = emp.designation?.title || emp.designation?.name || emp.designation || 'Member';
                            return (
                              <option key={key} value={name}>
                                {name} ({dept ? `${dept} • ` : ''}{desig})
                              </option>
                            );
                          })}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={isViewingMyReport ? (effectiveData.employeeId || '') : currentData.employeeId}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, employeeId: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-mono font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      placeholder="e.g. OPS-2026-114"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      value={isViewingMyReport ? (effectiveData.department || '') : currentData.department}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, department: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={isViewingMyReport ? (effectiveData.designation || '') : currentData.designation}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, designation: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      placeholder="e.g. Senior Operations Executive"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Reporting Manager <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={isViewingMyReport ? (effectiveData.manager || '') : currentData.manager}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, manager: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      placeholder="Manager name"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Review Date
                    </label>
                    <input
                      type="date"
                      value={isViewingMyReport ? (effectiveData.reviewDate || '') : currentData.reviewDate}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, reviewDate: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Review Period
                    </label>
                    <input
                      type="text"
                      value={isViewingMyReport ? (effectiveData.reviewPeriod || '') : currentData.reviewPeriod}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, reviewPeriod: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      placeholder="e.g. 01/01/2026 – 31/08/2026"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      L&amp;D / HR Executive
                    </label>
                    <input
                      type="text"
                      value={isViewingMyReport ? (effectiveData.ldExecutive || '') : currentData.ldExecutive}
                      readOnly={isViewingMyReport}
                      onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, ldExecutive: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      placeholder="L&D Lead name"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Review Cycle
                    </label>
                    <div className="relative">
                      <select
                        value={isViewingMyReport ? (effectiveData.reviewCycle || 'Annual Appraisal') : currentData.reviewCycle}
                        disabled={isViewingMyReport}
                        onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, reviewCycle: e.target.value }))}
                        className={`w-full appearance-none pl-3.5 pr-10 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      >
                        <option value="Bi-Weekly Review">Bi-Weekly Review</option>
                        <option value="Monthly Review">Monthly Review</option>
                        <option value="Quarterly Review">Quarterly Review</option>
                        <option value="Mid-Year Review">Mid-Year Review</option>
                        <option value="Probation / Internship Completion">Probation / Internship Completion</option>
                        <option value="Annual Appraisal">Annual Appraisal</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 02: Rating Scale Reference */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                    02
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Rating Scale Reference
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Universal evaluation rubric standard applied across competencies
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {[
                    { val: 5, title: 'Exceptional', desc: 'Consistently surpasses highest standards', color: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300', numColor: 'bg-emerald-600 text-white' },
                    { val: 4, title: 'Exceeds Expectations', desc: 'Frequently goes beyond role demands', color: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800 text-sky-800 dark:text-sky-300', numColor: 'bg-sky-600 text-white' },
                    { val: 3, title: 'Meets Expectations', desc: 'Consistently achieves core deliverables', color: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300', numColor: 'bg-indigo-600 text-white' },
                    { val: 2, title: 'Needs Improvement', desc: 'Fails to meet expected benchmarks', color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800 text-amber-800 dark:text-amber-300', numColor: 'bg-amber-600 text-white' },
                    { val: 1, title: 'Unsatisfactory', desc: 'Critical performance deficiency', color: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800 text-rose-800 dark:text-rose-300', numColor: 'bg-rose-600 text-white' },
                  ].map((item) => (
                    <div
                      key={item.val}
                      className={`border rounded-2xl p-3.5 text-center hover:-translate-y-0.5 transition shadow-xs ${item.color}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl font-extrabold text-xs flex items-center justify-center mx-auto mb-2 shadow-xs ${item.numColor}`}
                      >
                        {item.val}
                      </div>
                      <div className="text-xs font-bold leading-tight mb-1">{item.title}</div>
                      <div className="text-[11px] opacity-80 leading-snug">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 03: Competency Evaluation Table */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                      03
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {effectiveDepartment === 'operations'
                          ? 'Operations Performance Evaluation'
                          : effectiveDepartment === 'it'
                            ? 'Technical Competency Evaluation'
                            : 'Functional Competency Evaluation'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Rate individual competencies on scale of 1.0 to 5.0</p>
                    </div>
                  </div>

                  <div className={`px-4 py-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-2 self-start sm:self-auto shadow-xs ${theme.scoreBadge}`}>
                    <span>Average Score:</span>
                    <span className="text-sm font-black tracking-tight">{effectiveAverageScore} / 5.0</span>
                  </div>
                </div>

                <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-1/3">Performance Area / Metric</th>
                        <th className="py-3 px-4 w-36">Rating (1-5)</th>
                        <th className="py-3 px-4">Evaluator Comments / Observations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {(effectiveData.competencies || []).map((comp, idx) => (
                        <tr key={comp.area} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{comp.area}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                max="5"
                                step="0.5"
                                value={comp.score}
                                readOnly={isViewingMyReport}
                                onChange={(e) => {
                                  if (isViewingMyReport) return;
                                  const val = parseFloat(e.target.value) || 1;
                                  setCurrentData((p) => ({
                                    ...p,
                                    competencies: p.competencies.map((c, i) => (i === idx ? { ...c, score: val } : c)),
                                  }));
                                }}
                                className={`w-16 text-center font-bold px-2 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                              />
                              <span className="text-slate-400 font-semibold text-[11px]">/ 5</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={comp.comment || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  competencies: p.competencies.map((c, i) => (i === idx ? { ...c, comment: val } : c)),
                                }));
                              }}
                              placeholder={isViewingMyReport ? '' : 'Observations or justification...'}
                              className={`w-full px-3 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 04: Key Achievements */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                    04
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Key Accomplishments &amp; Milestones
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Major operational deliverables completed in this review cycle</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Major Accomplishments <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={isViewingMyReport ? (effectiveData.achievements || '') : currentData.achievements}
                    readOnly={isViewingMyReport}
                    onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, achievements: e.target.value }))}
                    placeholder="Detail key achievements and milestones..."
                    className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
                  />
                </div>
              </section>

              {/* 05: Areas for Improvement */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                    05
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Areas for Development &amp; Improvement
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Constructive growth focal points for the upcoming period</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Focus Areas for Growth <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={isViewingMyReport ? (effectiveData.improvements || '') : currentData.improvements}
                    readOnly={isViewingMyReport}
                    onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, improvements: e.target.value }))}
                    placeholder="Specify developmental targets and coaching areas..."
                    className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
                  />
                </div>
              </section>

              {/* 06: Goals for Next Period */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                      06
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Goals &amp; Performance Objectives
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Key performance deliverables agreed upon for upcoming review cycle</p>
                    </div>
                  </div>

                  {!isViewingMyReport && (
                    <button
                      type="button"
                      onClick={addGoalRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Goal</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Goal Objective</th>
                        <th className="py-2.5 px-3">Target / Key Result</th>
                        <th className="py-2.5 px-3 w-36">Deadline</th>
                        <th className="py-2.5 px-3 w-32">Status</th>
                        {!isViewingMyReport && <th className="py-2.5 px-3 w-10 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(effectiveData.goals || []).map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={g.goal || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  goals: p.goals.map((item, i) => (i === idx ? { ...item, goal: val } : item)),
                                }));
                              }}
                              placeholder="Goal title..."
                              className={`w-full px-2.5 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={g.target || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  goals: p.goals.map((item, i) => (i === idx ? { ...item, target: val } : item)),
                                }));
                              }}
                              placeholder="Target deliverable / metric..."
                              className={`w-full px-2.5 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={g.deadline || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  goals: p.goals.map((item, i) => (i === idx ? { ...item, deadline: val } : item)),
                                }));
                              }}
                              className={`w-full px-2 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={g.status || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  goals: p.goals.map((item, i) => (i === idx ? { ...item, status: val } : item)),
                                }));
                              }}
                              placeholder="Status..."
                              className={`w-full px-2.5 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                          {!isViewingMyReport && (
                            <td className="py-2 px-3 text-center">
                              {(effectiveData.goals?.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeGoalRow(idx)}
                                  className="text-slate-400 hover:text-rose-500 transition cursor-pointer p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 07: Training Needs */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                      07
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Training &amp; Skill Development Needs
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Identified certifications, workshops, or operational training</p>
                    </div>
                  </div>

                  {!isViewingMyReport && (
                    <button
                      type="button"
                      onClick={addTrainingRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Training</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Skill / Operational Area</th>
                        <th className="py-2.5 px-3">Training Required / Workshop</th>
                        <th className="py-2.5 px-3 w-36">Priority</th>
                        {!isViewingMyReport && <th className="py-2.5 px-3 w-10 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(effectiveData.training || []).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={t.skill || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  training: p.training.map((item, i) => (i === idx ? { ...item, skill: val } : item)),
                                }));
                              }}
                              placeholder="Skill domain..."
                              className={`w-full px-2.5 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={t.training || ''}
                              readOnly={isViewingMyReport}
                              onChange={(e) => {
                                if (isViewingMyReport) return;
                                const val = e.target.value;
                                setCurrentData((p) => ({
                                  ...p,
                                  training: p.training.map((item, i) => (i === idx ? { ...item, training: val } : item)),
                                }));
                              }}
                              placeholder="Course / program..."
                              className={`w-full px-2.5 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="relative">
                              <select
                                value={t.priority || 'Medium'}
                                disabled={isViewingMyReport}
                                onChange={(e) => {
                                  if (isViewingMyReport) return;
                                  const val = e.target.value;
                                  setCurrentData((p) => ({
                                    ...p,
                                    training: p.training.map((item, i) => (i === idx ? { ...item, priority: val } : item)),
                                  }));
                                }}
                                className={`w-full appearance-none px-2.5 pr-7 py-1.5 ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800 cursor-default' : 'bg-slate-50 dark:bg-slate-800 cursor-pointer'} border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </td>
                          {!isViewingMyReport && (
                            <td className="py-2 px-3 text-center">
                              {(effectiveData.training?.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTrainingRow(idx)}
                                  className="text-slate-400 hover:text-rose-500 transition cursor-pointer p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 08 & 09: Comments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-3">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                      08
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">Employee Comments</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Feedback and self-reflection</p>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={isViewingMyReport ? (effectiveData.employeeComments || '') : currentData.employeeComments}
                    readOnly={isViewingMyReport}
                    onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, employeeComments: e.target.value }))}
                    placeholder="Employee feedback and reflection..."
                    className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
                  />
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                      09
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">Manager Comments</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Overall performance summary</p>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={isViewingMyReport ? (effectiveData.managerComments || '') : currentData.managerComments}
                    readOnly={isViewingMyReport}
                    onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, managerComments: e.target.value }))}
                    placeholder="Manager review and observations..."
                    className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
                  />
                </section>
              </div>

              {/* 10: Overall Performance Rating */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                    10
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Overall Performance Rating
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Consolidated review outcome score</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { label: 'Exceptional', icon: '⭐', color: 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300' },
                    { label: 'Exceeds Expectations', icon: '✨', color: 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-300' },
                    { label: 'Meets Expectations', icon: '👍', color: 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300' },
                    { label: 'Needs Improvement', icon: '⚠️', color: 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300' },
                    { label: 'Unsatisfactory', icon: '❌', color: 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300' },
                  ].map((rating) => {
                    const activeRating = isViewingMyReport ? effectiveData.overallRating : currentData.overallRating;
                    const isChecked = activeRating === rating.label;
                    return (
                      <label
                        key={rating.label}
                        onClick={() => !isViewingMyReport && setCurrentData((p) => ({ ...p, overallRating: rating.label }))}
                        className={`rounded-2xl border-2 p-3.5 text-center transition flex flex-col items-center justify-center gap-1.5 shadow-2xs ${isViewingMyReport ? 'cursor-default' : 'cursor-pointer'
                          } ${isChecked
                            ? `${rating.color} font-bold shadow-sm`
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        <span className="text-xl">{rating.icon}</span>
                        <span className="text-xs font-bold leading-tight">{rating.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* 11: Final Recommendations / Administrative Actions */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                    11
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Final Actions &amp; Recommendations
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Select administrative / HR decisions for this cycle</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'action1', text: 'Continue in Current Role' },
                    { id: 'action2', text: 'Salary Revision Recommended' },
                    { id: 'action3', text: 'Promotion / Role Advancement Recommended' },
                    { id: 'action4', text: 'Additional / Advanced Training Required' },
                    { id: 'action5', text: 'Performance Improvement Plan (PIP) Required' },
                    { id: 'action6', text: 'Role / Responsibility Change Recommended' },
                  ].map((act) => {
                    const actionsObj = isViewingMyReport ? (effectiveData.actions || {}) : (currentData.actions || {});
                    return (
                      <label
                        key={act.id}
                        className={`flex items-center gap-3 p-3.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl transition shadow-2xs ${isViewingMyReport ? 'cursor-default' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(actionsObj[act.id])}
                          disabled={isViewingMyReport}
                          onChange={(e) => {
                            if (isViewingMyReport) return;
                            const checked = e.target.checked;
                            setCurrentData((p) => ({
                              ...p,
                              actions: { ...p.actions, [act.id]: checked },
                            }));
                          }}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer disabled:cursor-default"
                        />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{act.text}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* 12: CEO Signature & Authorization */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${theme.numBg}`}>
                    12
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      CEO Approval &amp; Final Authorization
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Executive authorization, signature verification, and approval date</p>
                  </div>
                </div>

                <div className="max-w-xl mx-auto">
                  <div className={`bg-white dark:bg-slate-900 rounded-3xl border-2 p-6 shadow-md ${theme.sigCardBorder}`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        CEO Authorization
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Chief Executive Officer
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                          Authorized Signatory Name
                        </label>
                        <input
                          type="text"
                          value={isViewingMyReport ? (effectiveData.ceoName || '') : currentData.ceoName}
                          readOnly={isViewingMyReport}
                          onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, ceoName: e.target.value }))}
                          className={`w-full px-3.5 py-2.5 text-xs font-bold ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                          Authorization Date
                        </label>
                        <input
                          type="date"
                          value={isViewingMyReport ? (effectiveData.ceoDate || '') : currentData.ceoDate}
                          readOnly={isViewingMyReport}
                          onChange={(e) => !isViewingMyReport && setCurrentData((p) => ({ ...p, ceoDate: e.target.value }))}
                          className={`w-full px-3.5 py-2.5 text-xs font-medium ${isViewingMyReport ? 'bg-slate-100 dark:bg-slate-800/80 cursor-default' : 'bg-slate-50/70 dark:bg-slate-800/60'} border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Form Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 print:hidden">
                <div>
                  {isViewingMyReport && activeMyReport && (
                    <Button
                      variant="outline"
                      size="md"
                      icon={Trash2}
                      onClick={() => setReportToDelete(activeMyReport)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                    >
                      Delete Report
                    </Button>
                  )}
                  {!isViewingMyReport && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="md"
                        icon={RotateCcw}
                        onClick={handleResetForm}
                        className="text-xs font-black bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 border border-amber-500 shadow-sm shadow-amber-400/25 transition-all"
                      >
                        Reset Form
                      </Button>
                      {empReportStatus?.id && (
                        <Button
                          variant="outline"
                          size="md"
                          icon={Trash2}
                          onClick={() => setSentReportToDelete(empReportStatus)}
                          title="Delete current performance report"
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                        >
                          Delete Report
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="md"
                    icon={Download}
                    loading={isGeneratingPdf}
                    onClick={handleDownloadPdf}
                    className="text-xs font-semibold"
                  >
                    {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
                  </Button>

                  {canReviewOthers && viewMode === 'reviews' && (
                    editingReport ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="md"
                          onClick={handleCancelEditReport}
                          className="text-xs font-semibold"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          icon={FileEdit}
                          loading={isSending}
                          onClick={handleUpdateReport}
                          className="text-xs font-bold shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Update &amp; Save Appraisal
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="md"
                        icon={empReportStatus?.sentCount > 0 ? RotateCw : Send}
                        loading={isSending}
                        onClick={() => handleSendReport()}
                        className="text-xs font-bold shadow-lg shadow-brand-500/20"
                      >
                        {empReportStatus?.status === 'DELETED_BY_USER'
                          ? 'Send Again (User Deleted)'
                          : empReportStatus?.sentCount > 0
                            ? `Send Again (${empReportStatus.sentCount} sent)`
                            : 'Send Report'}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Dedicated Clean Offscreen PDF Dossier Container */}
      <div
        id="pdf-dossier-export-root"
        className="pointer-events-none overflow-hidden print:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: '-15000px',
          width: '794px',
          minWidth: '794px',
          maxWidth: '794px',
          zIndex: -9999,
          opacity: 1,
          backgroundColor: '#ffffff',
        }}
        aria-hidden="true"
      >
        <PrintableReportDossier
          ref={printDossierRef}
          department={pdfCustomReport ? pdfCustomReport.department : effectiveDepartment}
          data={pdfCustomReport ? pdfCustomReport.data : effectiveData}
          averageScore={pdfCustomReport ? pdfCustomReport.averageScore : effectiveAverageScore}
        />
      </div>

      {/* Read-Only Clean Preview Modal for Delivered Appraisal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Official Appraisal Record
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    {previewReport.reviewCycle || 'Performance Appraisal'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {previewReport.employeeName || 'Employee'} • Performance Review
                </h3>
                <p className="text-xs text-slate-300">
                  Review Period: {previewReport.reviewPeriod || 'Evaluation'} • Delivered on {previewReport.lastSentAt ? new Date(previewReport.lastSentAt).toLocaleDateString() : 'Recent'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  loading={isGeneratingPdf && downloadingReportId === previewReport.id}
                  onClick={() => handleDownloadPdf(previewReport)}
                  className="text-xs font-bold shrink-0"
                >
                  Download PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {(() => {
                const parsed = parseReportData(previewReport);
                const score = Number(previewReport.averageScore || 0).toFixed(2);
                return (
                  <div className="space-y-6">
                    {/* Top Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 block">Overall Determination</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">{parsed.overallRating}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 block">Average Rating Score</span>
                        <span className="text-lg font-black text-brand-600 dark:text-brand-400 block mt-0.5">{score} / 5.0</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 block">Department</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5 uppercase">{previewReport.department || 'Operations'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 block">Authorized Signatory</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">{cleanCeoName(parsed.ceoName)}</span>
                      </div>
                    </div>

                    {/* Competency Ratings */}
                    {Array.isArray(parsed.competencies) && parsed.competencies.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Performance Competencies & Ratings
                        </h4>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                          {parsed.competencies.map((c, i) => (
                            <div key={i} className="p-3 flex items-center justify-between gap-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <div className="space-y-0.5 flex-1">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{c.area}</span>
                                {c.comment && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{c.comment}</p>}
                              </div>
                              <div className="flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 shrink-0">
                                <span>{Number(c.score || 0).toFixed(1)}</span>
                                <span className="text-[10px] text-brand-400">/ 5.0</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Accomplishments & Feedback */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {parsed.achievements && (
                        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 block">Major Accomplishments</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{parsed.achievements}</p>
                        </div>
                      )}
                      {parsed.improvements && (
                        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-1">
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">Areas for Development</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{parsed.improvements}</p>
                        </div>
                      )}
                    </div>

                    {parsed.managerComments && (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">Manager Feedback & Observations</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{parsed.managerComments}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewReport(null)}
                  className="text-xs font-semibold"
                >
                  Close Preview
                </Button>
                {canReviewOthers && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={FileEdit}
                      onClick={() => {
                        const r = previewReport;
                        setPreviewReport(null);
                        handleStartEditReport(r);
                      }}
                      title="Edit this performance review in the evaluation form"
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      Edit Report
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Trash2}
                      onClick={() => {
                        const r = previewReport;
                        setPreviewReport(null);
                        setSentReportToDelete(r);
                      }}
                      title="Delete this performance report"
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                    >
                      Delete Report
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">

                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  loading={isGeneratingPdf && downloadingReportId === previewReport.id}
                  onClick={() => handleDownloadPdf(previewReport)}
                  className="text-xs font-bold"
                >
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog for Recipient Deleting Report */}
      <ConfirmDialog
        isOpen={Boolean(reportToDelete)}
        onClose={() => setReportToDelete(null)}
        onConfirm={handleDeleteMyReport}
        title="Remove Performance Report from Your View?"
        message="This performance report will be removed from your dashboard. If needed, your manager or HR can send it back to you at any time with no restrictions."
        confirmText="Remove Report"
        cancelText="Keep Report"
        variant="danger"
        isLoading={isDeletingReport}
      />

      {/* Confirm Dialog for Reviewer/Admin Deleting Sent Report */}
      <ConfirmDialog
        isOpen={Boolean(sentReportToDelete)}
        onClose={() => setSentReportToDelete(null)}
        onConfirm={handleDeleteSentReport}
        title="Delete Sent Performance Report?"
        message={`Are you sure you want to delete the performance report for ${sentReportToDelete?.employeeName || 'this employee'}? This will remove the appraisal record from both the sent reports tracker and the employee's delivered appraisals.`}
        confirmText="Delete Report"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingSentReport}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          {toastMessage.type === 'loading' ? (
            <Clock className="w-4 h-4 text-blue-400 animate-spin" />
          ) : toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Info className="w-4 h-4 text-amber-400" />
          )}
          <span>{toastMessage.msg}</span>
        </div>
      )}
    </div>
  );
};
