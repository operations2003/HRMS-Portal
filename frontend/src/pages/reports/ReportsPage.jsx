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

  // Recipient ("My Performance") States
  const [myReports, setMyReports] = useState([]);
  const [loadingMyReports, setLoadingMyReports] = useState(true);
  const [activeMyReportIdx, setActiveMyReportIdx] = useState(0);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);

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
    reviewDate: '2026-09-15',
    reviewPeriod: '01/01/2026 – 31/08/2026',
    ldExecutive: 'Swati Batabyal',
    reviewCycle: 'Quarterly Review',
    competencies: [
      { area: 'Quality of Work (Accuracy)', score: 4.5, comment: 'High degree of accuracy in order processing and audits.' },
      { area: 'Productivity', score: 4.0, comment: 'Consistently completes 15% above the daily dispatch benchmark.' },
      { area: 'Meeting Deadlines (TAT)', score: 4.0, comment: 'Strict adherence to SLA Turn-Around-Time.' },
      { area: 'Communication', score: 4.5, comment: 'Clear status updates to warehouse coordinators and clients.' },
      { area: 'Teamwork', score: 5.0, comment: 'Always ready to step in during peak logistics surges.' },
      { area: 'Process / SOP Understanding', score: 4.0, comment: 'Sound knowledge of operational checklists and safety protocols.' },
      { area: 'Attendance & Punctuality', score: 4.5, comment: 'Flawless attendance record with zero unplanned leaves.' },
      { area: 'Initiative & Ownership', score: 4.0, comment: 'Introduced a digital reconciliation sheet that saved 3 hours weekly.' },
      { area: 'Issue Resolution & Follow-up', score: 3.5, comment: 'Good troubleshooting; can improve on documenting post-incident logs.' },
    ],
    achievements: `• Successfully streamlined the dispatch verification pipeline, achieving 99.4% error-free fulfillment rate.\n• Spearheaded inventory reconciliation across 3 warehouse zones without downtime.\n• Mentored 2 junior operations trainees on compliance SOPs and inventory tracking.`,
    improvements: `1. Enhance proactive escalation on supplier shipment delays before SLA impact.\n2. Advance data visualization skills (Excel dashboarding & inventory analytics).\n3. Formulate root cause analysis (RCA) logs for vendor discrepancy tickets.`,
    goals: [
      { goal: 'Zero Misrouting Campaign', target: 'Maintain dispatch error rate under 0.2%', deadline: '2026-10-31', status: 'Planned' },
      { goal: 'Warehouse Automation Integration', target: 'Complete pilot run of RFID handheld scanner rollout', deadline: '2026-11-15', status: 'In Progress' },
      { goal: 'SOP Refresh & Audit', target: 'Update returns handling SOP and train cross-docking team', deadline: '2026-12-05', status: 'Planned' },
    ],
    training: [
      { skill: 'Advanced Excel & Operations Analytics', training: 'PivotTables, Power BI, and Supply Chain Dashboards', priority: 'High' },
      { skill: 'Lean Six Sigma / 5S Methodology', training: 'Yellow Belt Process Optimization Workshop', priority: 'Medium' },
    ],
    employeeComments: 'I appreciate the team support during the quarterly distribution peak. Looking forward to attending the operational analytics training to further streamline our fulfillment reports.',
    managerComments: 'Pooja is a reliable and proactive pillar of our operations squad. Her execution efficiency is admirable. With advanced dashboard training, she can take over independent shift leadership.',
    overallRating: 'Exceeds Expectations',
    actions: {
      action1: true,
      action2: true,
      action3: false,
      action4: true,
      action5: false,
      action6: false,
    },
    ceoName: "Sheetal Ma'am",
    ceoDate: '2026-09-16',
  });

  // 2. IT FORM STATE
  const [itData, setItData] = useState({
    employeeName: '',
    employeeId: '',
    department: 'IT Team',
    designation: '',
    manager: '',
    reviewDate: '2026-09-14',
    reviewPeriod: '30/08/2026 – 12/09/2026',
    ldExecutive: 'Swati Batabyal',
    reviewCycle: 'Bi-Weekly Review',
    competencies: [
      { area: 'Quality of Portal / Application', score: 3.0, comment: 'Code architecture is good; need stricter UI polish.' },
      { area: 'Productivity & Output Volume', score: 4.0, comment: 'Consistent commit history and active feature delivery.' },
      { area: 'Meeting Deadlines & Timelines', score: 2.0, comment: 'Delays experienced in sprint deliverables. Needs proactive flagging.' },
      { area: 'Communication & Updates', score: 5.0, comment: 'Excellent daily standup participation and proactive clarity.' },
      { area: 'Teamwork & Collaboration', score: 5.0, comment: 'Great peer synergy and helpful attitude with teammates.' },
      { area: 'Portal & System Understanding', score: 4.5, comment: 'Quick grasp of database schemas and backend integrations.' },
      { area: 'Attendance & Punctuality', score: 3.5, comment: 'Generally on time; 1 ad-hoc log recorded.' },
      { area: 'Initiative & Ownership', score: 5.0, comment: 'Took complete charge of the ATS evaluator module unprompted.' },
      { area: 'Post-Launch Bugs & Stability', score: 2.0, comment: 'ATS application required 3 hotfixes immediately after release.' },
    ],
    achievements: `• Achieved milestone target and launched the ATS evaluator module ahead of quarterly showcase.\n• Demonstrated strong technical ownership with the engineering team, reducing backlog tickets by 30%.`,
    improvements: `1. Meet committed sprint deadlines consistently by breaking complex stories into manageable micro-tasks.\n2. Implement pre-deployment test cases and rigorous QA before production portal release to cut post-launch defects.\n3. Continually synchronize dependencies across cross-functional squad members.`,
    goals: [
      { goal: 'HRMS Core Upgrade', target: 'Complete employee leave and attendance module APIs', deadline: '2026-09-25', status: 'In Progress' },
      { goal: 'Zero Critical Bug Policy', target: 'Unit test coverage > 80% for ATS evaluation backend', deadline: '2026-10-05', status: 'Planned' },
    ],
    training: [
      { skill: 'Automated Testing & QA', training: 'Jest & Cypress End-to-End Testing Workshop', priority: 'High' },
    ],
    employeeComments: 'I am actively prioritizing QA testing cycles to prevent regression bugs in upcoming releases. Grateful for the mentorship provided by the senior engineering lead.',
    managerComments: 'Ajay displays tremendous initiative and technical potential. Sharpening automated test discipline and timeline management will quickly elevate him to full engineering contributor level.',
    overallRating: 'Meets Expectations',
    actions: {
      action1: true,
      action2: false,
      action3: false,
      action4: true,
      action5: false,
      action6: true,
    },
    ceoName: "Sheetal Ma'am",
    ceoDate: '2026-09-16',
  });

  // 3. TA FORM STATE
  const [taData, setTaData] = useState({
    employeeName: '',
    employeeId: '',
    department: 'TA Team',
    designation: '',
    manager: '',
    reviewDate: '2026-09-14',
    reviewPeriod: '30/08/2026 – 12/09/2026',
    ldExecutive: 'Swati Batabyal',
    reviewCycle: 'Bi-Weekly Review',
    competencies: [
      { area: 'Quality of CVs', score: 3.0, comment: 'Good candidate background screening & relevance.' },
      { area: 'Productivity (TL)', score: 4.5, comment: 'Consistent daily sourcing output and screening throughput.' },
      { area: 'Meeting Deadlines', score: 2.0, comment: 'Need tighter adherence to hiring turnaround SLAs.' },
      { area: 'Communication (TL)', score: 3.0, comment: 'Clear candidate communication; need stakeholder updates.' },
      { area: 'Teamwork (TL)', score: 4.5, comment: 'Strong pod collaboration and active mentorship.' },
      { area: 'Recruitment Understanding', score: 4.0, comment: 'Solid role comprehension and multi-channel search strategy.' },
      { area: 'Attendance & Punctuality', score: 3.0, comment: 'Reliable attendance and daily meeting punctuality.' },
      { area: 'Initiative & Ownership', score: 5.0, comment: 'Proactive problem solving in talent pipeline bottlenecks.' },
      { area: 'Candidate Submission', score: 2.0, comment: 'Candidate submission velocity needs acceleration.' },
    ],
    achievements: 'Achieved target ATS score of 90+ and closed 4 critical senior openings within SLA.',
    improvements: 'Increase your LinkedIn connections.\nUse company resources to get more leads to achieve the targeted number.',
    goals: [
      { goal: '10 Candidate Submissions', target: '6 Candidate Submissions qualified per week', deadline: '2026-09-19', status: 'Planned' },
      { goal: 'Tech Sourcing Expansion', target: 'Source 30 qualified fullstack engineers for pipeline', deadline: '2026-09-30', status: 'Planned' },
    ],
    training: [
      { skill: 'Advanced Boolean & AI Sourcing', training: 'AI-Powered Talent Sourcing & Headhunting Masterclass', priority: 'High' },
    ],
    employeeComments: 'Working on expanding sourcing channels and leveraging referral networks to hit the increased quarterly hiring quota.',
    managerComments: 'Harsh has given a good performance as a recruiter. Although he has exceptional skills, we need him to improve his communication skills and leadership skills in order to get the work done smoothly — he needs to achieve targets more consistently going forward. Please work on deadlines and maintain your tracker on time; improve time management and task allocation as given.',
    overallRating: 'Meets Expectations',
    actions: {
      action1: true,
      action2: false,
      action3: false,
      action4: true,
      action5: false,
      action6: false,
    },
    ceoName: "Sheetal Ma'am",
    ceoDate: '2026-09-16',
  });

  const showToast = (msg, type = 'info', duration = 3000) => {
    setToastMessage({ msg, type });
    if (duration > 0) {
      setTimeout(() => setToastMessage(null), duration);
    }
  };

  // Active form data selector
  const currentData = department === 'operations' ? opsData : department === 'it' ? itData : taData;
  const setCurrentData = (updater) => {
    if (department === 'operations') setOpsData(updater);
    else if (department === 'it') setItData(updater);
    else setTaData(updater);
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

  // Helper to load reports for logged in user (My Performance view)
  const loadMyReports = async () => {
    try {
      setLoadingMyReports(true);
      const res = await performanceReportService.getMyReports();
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
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
  const handleSelectEmployee = async (empId) => {
    setSelectedEmployeeId(empId);
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

      // Check delivery status for this employee
      try {
        setLoadingStatus(true);
        const stRes = await performanceReportService.getEmployeeStatus(empId, activeD);
        const st = stRes?.data || stRes;
        setEmpReportStatus(st || null);

        if (st && st.reportData) {
          setCurrentData({
            ...st.reportData,
            employeeName: fullName,
            employeeId: code,
            department: dept,
            designation: desig,
            ...(mgr ? { manager: mgr } : {}),
          });
          showToast(`Selected ${fullName}. Loaded previous evaluation (Sent: ${st.sentCount || 1}x).`, 'info');
          return;
        }
      } catch (err) {
        setEmpReportStatus(null);
      } finally {
        setLoadingStatus(false);
      }

      setCurrentData((prev) => ({
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

  const baseFallbackData = currentData || opsData || {};

  const effectiveData = useMemo(() => {
    const raw = isViewingMyReport && activeMyReport && parsedActiveReportData
      ? parsedActiveReportData
      : baseFallbackData;

    return {
      ...baseFallbackData,
      ...(raw || {}),
      competencies: Array.isArray(raw?.competencies) ? raw.competencies : (baseFallbackData.competencies || []),
      goals: Array.isArray(raw?.goals) ? raw.goals : (baseFallbackData.goals || []),
      training: Array.isArray(raw?.training) ? raw.training : (baseFallbackData.training || []),
      actions: raw?.actions && typeof raw.actions === 'object' ? raw.actions : (baseFallbackData.actions || {}),
      overallRating: raw?.overallRating || baseFallbackData.overallRating || 'Meets Expectations',
    };
  }, [isViewingMyReport, activeMyReport, parsedActiveReportData, baseFallbackData]);

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

  // Export to Excel
  const handleDownloadExcel = () => {
    const deptTitle = effectiveDepartment === 'operations' ? 'Operations' : effectiveDepartment === 'it' ? 'IT' : 'Talent Acquisition';
    const empName = effectiveData.employeeName || 'Employee';

    showToast(`Generating ${deptTitle} Excel review...`, 'loading', 1500);

    const summaryData = [
      { Property: 'Department', Value: deptTitle },
      { Property: 'Employee Name', Value: empName },
      { Property: 'Employee ID', Value: effectiveData.employeeId },
      { Property: 'Designation', Value: effectiveData.designation },
      { Property: 'Reporting Manager', Value: effectiveData.manager },
      { Property: 'Review Date', Value: effectiveData.reviewDate },
      { Property: 'Review Period', Value: effectiveData.reviewPeriod },
      { Property: 'L&D Executive', Value: effectiveData.ldExecutive },
      { Property: 'Average Score', Value: `${effectiveAverageScore} / 5.0` },
      { Property: 'Overall Determination', Value: effectiveData.overallRating },
      { Property: 'Major Accomplishments', Value: effectiveData.achievements },
      { Property: 'Areas for Development', Value: effectiveData.improvements },
      { Property: 'Employee Comments', Value: effectiveData.employeeComments },
      { Property: 'Manager Comments', Value: effectiveData.managerComments },
      { Property: 'Authorized Signatory', Value: effectiveData.ceoName },
      { Property: 'Authorization Date', Value: effectiveData.ceoDate },
    ];

    const competencyData = (effectiveData.competencies || []).map((c, i) => ({
      '#': i + 1,
      'Performance Competency Area': c.area,
      'Rating (1-5)': c.score,
      'Comments / Observations': c.comment,
    }));

    const goalsData = (effectiveData.goals || []).map((g, i) => ({
      '#': i + 1,
      'Goal Objective': g.goal,
      'Target / Key Result': g.target,
      Deadline: g.deadline,
      Status: g.status,
    }));

    const trainingData = (effectiveData.training || []).map((t, i) => ({
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

  // High-Resolution Multi-Page Executive PDF Generation
  const handleDownloadPdf = async () => {
    if (!printDossierRef.current) return;
    setIsGeneratingPdf(true);

    const deptTitle = effectiveDepartment === 'operations' ? 'Operations' : effectiveDepartment === 'it' ? 'IT' : 'Talent_Acquisition';
    const empName = (effectiveData.employeeName || 'Employee').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${empName}_${deptTitle}_Performance_Appraisal_${effectiveData.reviewDate || '2026'}.pdf`;

    showToast(`Rendering official ${deptTitle.replace('_', ' ')} executive review PDF...`, 'loading', 0);

    const originalScrollX = window.scrollX || window.pageXOffset || 0;
    const originalScrollY = window.scrollY || window.pageYOffset || 0;

    try {
      // 1. Ensure all fonts and typographic assets are fully loaded and rendered
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Temporarily reset window scroll so canvas origin maps exactly to (0,0)
      window.scrollTo(0, 0);

      // Allow DOM layout and subpixel rasterization to stabilize
      await new Promise((resolve) => setTimeout(resolve, 150));

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
          scale: 2, // 2x Retina clarity: numbers, text and badges are crystal clear
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1000,
          windowHeight: 3000,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }
        // Exactly standard A4 dimensions: 210mm x 297mm
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(fileName);
      showToast('Official review PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Error exporting PDF. Please try again.', 'error');
    } finally {
      window.scrollTo(originalScrollX, originalScrollY);
      setIsGeneratingPdf(false);
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
          <Button
            size="sm"
            variant={row?.status === 'DELETED_BY_USER' ? 'primary' : 'outline'}
            icon={RotateCw}
            onClick={() => handleSendAgainFromHistory(row)}
          >
            Send Again
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => {
              handleSelectEmployee(row.employeeId);
              setDepartment(row.department || 'operations');
              setReviewerSubTab('form');
            }}
          >
            Review in Form
          </Button>
        </div>
      ),
    },
  ];

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
              Appraisal Evaluation Form
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-brand-500" />
                <span>Sent Performance Reports Tracker</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit delivery status of reports sent to specific team members. Monitor sent counts, see if a user dismissed a report, and re-send anytime.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              icon={RefreshCw}
              loading={loadingSentReports}
              onClick={fetchSentReports}
              className="text-xs font-semibold"
            >
              Refresh Tracker
            </Button>
          </div>

          <DataTable
            columns={sentTrackerColumns}
            data={sentReports}
            isLoading={loadingSentReports}
            emptyMessage="No performance reports have been sent yet. Switch back to the Appraisal Evaluation Form to select an employee and dispatch their report."
          />
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
      ) : (
        <div className="space-y-6">
          {/* Top Banner when recipient user is viewing their delivered report */}
          {isViewingMyReport && activeMyReport && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Official Performance Appraisal Delivered
                    </h4>
                    <Badge variant="success">Delivered</Badge>
                    {activeMyReport.sentCount > 1 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                        Updated ({activeMyReport.sentCount}x)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Cycle: <span className="font-semibold">{activeMyReport.reviewCycle || 'Performance Appraisal'}</span>
                    {activeMyReport.lastSentAt && (
                      <> • Delivered on {new Date(activeMyReport.lastSentAt).toLocaleDateString()} at {new Date(activeMyReport.lastSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {myReports.length > 1 && (
                  <div className="relative">
                    <select
                      value={activeMyReportIdx}
                      onChange={(e) => setActiveMyReportIdx(Number(e.target.value))}
                      className="appearance-none text-xs font-semibold pl-3 pr-8 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 text-slate-800 dark:text-white shadow-2xs cursor-pointer focus:outline-none"
                    >
                      {myReports.map((r, i) => (
                        <option key={r.id || i} value={i}>
                          {r.reviewPeriod || `Report #${i + 1}`} ({new Date(r.lastSentAt || r.createdAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-emerald-600 dark:text-emerald-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  loading={isGeneratingPdf}
                  onClick={handleDownloadPdf}
                  className="text-xs font-semibold bg-white dark:bg-slate-800"
                >
                  Download PDF
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  icon={Trash2}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800"
                  onClick={() => setReportToDelete(activeMyReport)}
                >
                  Delete Report
                </Button>
              </div>
            </div>
          )}

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
                    <Button
                      variant="ghost"
                      size="md"
                      icon={RotateCcw}
                      onClick={handleResetForm}
                      className="text-xs font-black bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 border border-amber-500 shadow-sm shadow-amber-400/25 transition-all"
                    >
                      Reset Form
                    </Button>
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
        className="pointer-events-none overflow-visible print:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '794px',
          minWidth: '794px',
          maxWidth: '794px',
          zIndex: -50,
          opacity: 0.999,
          backgroundColor: '#ffffff',
        }}
        aria-hidden="true"
      >
        <PrintableReportDossier
          ref={printDossierRef}
          department={effectiveDepartment}
          data={effectiveData}
          averageScore={effectiveAverageScore}
        />
      </div>

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
