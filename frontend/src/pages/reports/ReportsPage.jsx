import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Printer,
  FileSpreadsheet,
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
  ShieldCheck,
  Award,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

// Helper to generate the default cursive CEO signature canvas
const generateDefaultSignatureDataUrl = (name = 'Sheetal', strokeColor = '#1e3a8a') => {
  const c = document.createElement('canvas');
  c.width = 340;
  c.height = 100;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = strokeColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cursive signature strokes
  ctx.beginPath();
  ctx.moveTo(35, 65);
  ctx.bezierCurveTo(65, 20, 100, 20, 120, 50);
  ctx.bezierCurveTo(130, 65, 150, 70, 170, 40);
  ctx.bezierCurveTo(185, 20, 200, 25, 220, 50);
  ctx.bezierCurveTo(240, 65, 260, 40, 290, 35);
  ctx.stroke();

  // Flourish underline
  ctx.beginPath();
  ctx.lineWidth = 1.8;
  ctx.moveTo(40, 78);
  ctx.quadraticCurveTo(170, 88, 295, 68);
  ctx.stroke();

  return c.toDataURL('image/png');
};

export const ReportsPage = () => {
  const [department, setDepartment] = useState('operations'); // 'operations' | 'it' | 'ta'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const documentRef = useRef(null);
  const fileInputRef = useRef(null);

  // Common default signature
  const [ceoSignature, setCeoSignature] = useState(() =>
    generateDefaultSignatureDataUrl('Sheetal', '#1e3a8a')
  );
  const [sigFileName, setSigFileName] = useState('');

  // 1. OPERATIONS FORM STATE
  const [opsData, setOpsData] = useState({
    employeeName: 'Pooja Sharma',
    employeeId: 'OPS-2026-114',
    department: 'Operations',
    designation: 'Senior Operations Executive',
    manager: 'Rajesh Verma',
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
    employeeName: 'Maurya Ajay Munnalal',
    employeeId: 'IT-2026-084',
    department: 'TA & Platform Engineering',
    designation: 'IT Intern',
    manager: 'Nabila Hussain',
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
    employeeName: 'Harsh Agarwal',
    employeeId: 'TA-2026-042',
    department: 'Talent Acquisition',
    designation: 'TA Team Lead',
    manager: 'Aakanksha Jadhav',
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

  // Average score calculation
  const calculateAverage = (competencies) => {
    if (!competencies || competencies.length === 0) return '0.00';
    const sum = competencies.reduce((acc, curr) => acc + (parseFloat(curr.score) || 0), 0);
    return (sum / competencies.length).toFixed(2);
  };

  const currentAverageScore = calculateAverage(currentData.competencies);

  // Handle signature upload
  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCeoSignature(event.target.result);
      setSigFileName(file.name);
      showToast('CEO Signature updated for all department forms!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleResetSignature = () => {
    const defaultSig = generateDefaultSignatureDataUrl('Sheetal', '#1e3a8a');
    setCeoSignature(defaultSig);
    setSigFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast("Signature reset to default Sheetal Ma'am signature.", 'info');
  };

  // Add / remove rows for goals
  const addGoalRow = () => {
    setCurrentData((prev) => ({
      ...prev,
      goals: [...prev.goals, { goal: '', target: '', deadline: '', status: 'Planned' }],
    }));
  };

  const removeGoalRow = (idx) => {
    setCurrentData((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== idx),
    }));
  };

  // Add / remove rows for training
  const addTrainingRow = () => {
    setCurrentData((prev) => ({
      ...prev,
      training: [...prev.training, { skill: '', training: '', priority: 'Medium' }],
    }));
  };

  const removeTrainingRow = (idx) => {
    setCurrentData((prev) => ({
      ...prev,
      training: prev.training.filter((_, i) => i !== idx),
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
      showToast('Form reset to blank.', 'info');
    }
  };

  // Export to Excel
  const handleDownloadExcel = () => {
    const deptTitle = department === 'operations' ? 'Operations' : department === 'it' ? 'IT' : 'Talent Acquisition';
    const empName = currentData.employeeName || 'Employee';

    showToast(`Generating ${deptTitle} Excel review...`, 'loading', 1500);

    const summaryData = [
      { Property: 'Department', Value: deptTitle },
      { Property: 'Employee Name', Value: empName },
      { Property: 'Employee ID', Value: currentData.employeeId },
      { Property: 'Designation', Value: currentData.designation },
      { Property: 'Reporting Manager', Value: currentData.manager },
      { Property: 'Review Date', Value: currentData.reviewDate },
      { Property: 'Review Period', Value: currentData.reviewPeriod },
      { Property: 'L&D Executive', Value: currentData.ldExecutive },
      { Property: 'Average Score', Value: `${currentAverageScore} / 5.0` },
      { Property: 'Overall Determination', Value: currentData.overallRating },
      { Property: 'Major Accomplishments', Value: currentData.achievements },
      { Property: 'Areas for Development', Value: currentData.improvements },
      { Property: 'Employee Comments', Value: currentData.employeeComments },
      { Property: 'Manager Comments', Value: currentData.managerComments },
      { Property: 'Authorized Signatory', Value: currentData.ceoName },
      { Property: 'Authorization Date', Value: currentData.ceoDate },
    ];

    const competencyData = currentData.competencies.map((c, i) => ({
      '#': i + 1,
      'Performance Competency Area': c.area,
      'Rating (1-5)': c.score,
      'Comments / Observations': c.comment,
    }));

    const goalsData = currentData.goals.map((g, i) => ({
      '#': i + 1,
      'Goal Objective': g.goal,
      'Target / Key Result': g.target,
      Deadline: g.deadline,
      Status: g.status,
    }));

    const trainingData = currentData.training.map((t, i) => ({
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

  // High-Resolution Multi-Page PDF Generation
  const handleDownloadPdf = async () => {
    if (!documentRef.current) return;
    setIsGeneratingPdf(true);

    const deptTitle = department === 'operations' ? 'Operations' : department === 'it' ? 'IT' : 'Talent_Acquisition';
    const empName = (currentData.employeeName || 'Employee').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${empName}_${deptTitle}_Performance_Review_${currentData.reviewDate || '2026'}.pdf`;

    showToast(`Rendering official ${deptTitle.replace('_', ' ')} review PDF...`, 'loading', 0);

    const element = documentRef.current;

    // Temporarily replace input elements with pre-wrapped text divs for crisp, non-clipped PDF rendering
    const replacers = [];

    // Replace textareas
    element.querySelectorAll('textarea').forEach((ta) => {
      const div = document.createElement('div');
      div.className = 'pdf-rendered-block';
      div.textContent = ta.value || ' ';
      div.style.cssText =
        'display:block;width:100%;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:6px;background:#ffffff;font-size:13px;line-height:1.6;color:#0f172a;white-space:pre-wrap;word-break:break-word;min-height:60px;box-sizing:border-box;';
      ta.style.display = 'none';
      ta.parentNode?.insertBefore(div, ta);
      replacers.push({ orig: ta, replacer: div });
    });

    // Replace inputs and selects
    element.querySelectorAll('input[type="text"], input[type="date"], select').forEach((inp) => {
      const div = document.createElement('div');
      div.className = 'pdf-rendered-inline';
      div.textContent = inp.tagName === 'SELECT' ? inp.options[inp.selectedIndex]?.text || inp.value : inp.value || ' ';
      div.style.cssText =
        'display:block;width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:6px;background:#ffffff;font-size:13px;color:#0f172a;word-break:break-word;box-sizing:border-box;';
      inp.style.display = 'none';
      inp.parentNode?.insertBefore(div, inp);
      replacers.push({ orig: inp, replacer: div });
    });

    // Wait for repaint
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const masterCanvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const canvasWidth = masterCanvas.width;
      const canvasHeight = masterCanvas.height;

      // Printable dimensions for A4 portrait with 8mm margins
      const margin = 8;
      const printWidth = 194;
      const pagePrintHeight = 281;

      const pxPageHeight = Math.floor((canvasWidth * pagePrintHeight) / printWidth);

      let sourceY = 0;
      let pageIndex = 0;

      while (sourceY < canvasHeight) {
        const chunkPxHeight = Math.min(pxPageHeight, canvasHeight - sourceY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = chunkPxHeight;
        const pageCtx = pageCanvas.getContext('2d');

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, canvasWidth, chunkPxHeight);
          pageCtx.drawImage(masterCanvas, 0, sourceY, canvasWidth, chunkPxHeight, 0, 0, canvasWidth, chunkPxHeight);

          const chunkImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          const chunkMmHeight = (chunkPxHeight * printWidth) / canvasWidth;

          if (pageIndex > 0) {
            pdf.addPage('a4', 'portrait');
          }

          pdf.addImage(chunkImgData, 'JPEG', margin, margin, printWidth, chunkMmHeight);
        }

        sourceY += chunkPxHeight;
        pageIndex++;
      }

      pdf.save(fileName);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Error exporting PDF. Opening print preview...', 'error');
      window.print();
    } finally {
      // Revert DOM back to interactive controls
      replacers.forEach(({ orig, replacer }) => {
        orig.style.display = '';
        if (replacer.parentNode) {
          replacer.parentNode.removeChild(replacer);
        }
      });
      setIsGeneratingPdf(false);
    }
  };

  // Department theme styles
  const getTheme = () => {
    if (department === 'operations') {
      return {
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        primaryBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
        accentColor: '#059669',
        headerGradient: 'from-slate-950 via-slate-900 to-teal-950',
        lineGradient: 'from-emerald-400 via-teal-400 to-cyan-400',
        numBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        focusRing: 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
        scoreBadge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        sigCardBorder: 'border-emerald-200/90 dark:border-emerald-800/60',
        tagText: 'Department of Operations • L&D',
        title: 'Operations Team Performance Review',
        subtitle: 'Learning & Development | Operations Department Performance Calibration & Progression Review',
        icon: '🏢',
      };
    } else if (department === 'it') {
      return {
        badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        primaryBg: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20',
        accentColor: '#4f46e5',
        headerGradient: 'from-slate-950 via-slate-900 to-indigo-950',
        lineGradient: 'from-sky-400 via-indigo-400 to-purple-400',
        numBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
        focusRing: 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
        scoreBadge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        sigCardBorder: 'border-indigo-200/90 dark:border-indigo-800/60',
        tagText: 'Department of Information Technology • L&D',
        title: 'IT & Engineering Performance Review Form',
        subtitle: 'Official periodic performance assessment, technical calibration, and career progression record.',
        icon: '💻',
      };
    } else {
      return {
        badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        primaryBg: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20',
        accentColor: '#7c3aed',
        headerGradient: 'from-slate-950 via-slate-900 to-purple-950',
        lineGradient: 'from-purple-400 via-fuchsia-400 to-pink-400',
        numBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
        focusRing: 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
        scoreBadge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        sigCardBorder: 'border-purple-200/90 dark:border-purple-800/60',
        tagText: 'Department of Talent Acquisition • L&D',
        title: 'Talent Acquisition Performance Review',
        subtitle: 'Learning & Development | TA Department Performance Calibration & Progression Review',
        icon: '🎯',
      };
    }
  };

  const theme = getTheme();

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Sticky Action Bar */}
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-30 transition-all">
          <div className="flex items-center gap-3.5 w-full md:w-auto">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md ${
                department === 'operations'
                  ? 'bg-gradient-to-br from-teal-700 to-emerald-600'
                  : department === 'it'
                  ? 'bg-gradient-to-br from-indigo-700 to-blue-600'
                  : 'bg-gradient-to-br from-purple-700 to-violet-600'
              }`}
            >
              {theme.icon}
            </div>
            <div>
              <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Department Performance Evaluation Portal
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Operations, IT &amp; TA Department Evaluation, Scoring &amp; PDF Export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Print Form</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer ${
                theme.primaryBg
              } ${isGeneratingPdf ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </header>

        {/* Department Switcher Tabs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-2 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-slate-400" />
            <span>Select Review Department:</span>
          </div>

          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDepartment('operations')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                department === 'operations'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🏢 Operations Team</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 font-bold border border-teal-200 dark:border-teal-800">
                Operations
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepartment('it')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                department === 'it'
                  ? 'bg-white dark:bg-slate-900 text-indigo-800 dark:text-indigo-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>💻 IT &amp; Engineering</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                IT
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepartment('ta')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                department === 'ta'
                  ? 'bg-white dark:bg-slate-900 text-purple-800 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🎯 Talent Acquisition</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
                TA
              </span>
            </button>
          </div>
        </div>

        {/* MAIN DOCUMENT CARD (Rendered for view and canvas export) */}
        <section
          ref={documentRef}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden print:border-none print:shadow-none"
        >
          {/* Document Header Banner */}
          <div className={`bg-gradient-to-br ${theme.headerGradient} text-white p-8 sm:p-10 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-slate-100 mb-3 shadow-xs">
                <span>{theme.icon}</span>
                {theme.tagText}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 leading-tight">
                {theme.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">{theme.subtitle}</p>
            </div>
            {/* Color Accent Bar */}
            <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.lineGradient}`} />
          </div>

          {/* Form Body */}
          <div className="p-6 sm:p-10 space-y-10">
            {/* 01: Employee Information */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Employee Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentData.employeeName}
                    onChange={(e) => setCurrentData((p) => ({ ...p, employeeName: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={currentData.employeeId}
                    onChange={(e) => setCurrentData((p) => ({ ...p, employeeId: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
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
                    value={currentData.department}
                    onChange={(e) => setCurrentData((p) => ({ ...p, department: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={currentData.designation}
                    onChange={(e) => setCurrentData((p) => ({ ...p, designation: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
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
                    value={currentData.manager}
                    onChange={(e) => setCurrentData((p) => ({ ...p, manager: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                    placeholder="Manager name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Review Date
                  </label>
                  <input
                    type="date"
                    value={currentData.reviewDate}
                    onChange={(e) => setCurrentData((p) => ({ ...p, reviewDate: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Review Period
                  </label>
                  <input
                    type="text"
                    value={currentData.reviewPeriod}
                    onChange={(e) => setCurrentData((p) => ({ ...p, reviewPeriod: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
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
                    value={currentData.ldExecutive}
                    onChange={(e) => setCurrentData((p) => ({ ...p, ldExecutive: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                    placeholder="L&D Lead name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Review Cycle
                  </label>
                  <select
                    value={currentData.reviewCycle}
                    onChange={(e) => setCurrentData((p) => ({ ...p, reviewCycle: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                  >
                    <option value="Bi-Weekly Review">Bi-Weekly Review</option>
                    <option value="Monthly Review">Monthly Review</option>
                    <option value="Quarterly Review">Quarterly Review</option>
                    <option value="Mid-Year Review">Mid-Year Review</option>
                    <option value="Probation / Internship Completion">Probation / Internship Completion</option>
                    <option value="Annual Appraisal">Annual Appraisal</option>
                  </select>
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
                      {department === 'operations'
                        ? 'Operations Performance Evaluation'
                        : department === 'it'
                        ? 'Technical Competency Evaluation'
                        : 'Functional Competency Evaluation'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Rate individual competencies on scale of 1.0 to 5.0</p>
                  </div>
                </div>

                <div className={`px-4 py-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-2 self-start sm:self-auto shadow-xs ${theme.scoreBadge}`}>
                  <span>Average Score:</span>
                  <span className="text-sm font-black tracking-tight">{currentAverageScore} / 5.0</span>
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
                    {currentData.competencies.map((comp, idx) => (
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
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1;
                                setCurrentData((p) => ({
                                  ...p,
                                  competencies: p.competencies.map((c, i) => (i === idx ? { ...c, score: val } : c)),
                                }));
                              }}
                              className={`w-16 text-center font-bold px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                            />
                            <span className="text-slate-400 font-semibold text-[11px]">/ 5</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={comp.comment}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                competencies: p.competencies.map((c, i) => (i === idx ? { ...c, comment: val } : c)),
                              }));
                            }}
                            placeholder="Observations or justification..."
                            className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
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
                  value={currentData.achievements}
                  onChange={(e) => setCurrentData((p) => ({ ...p, achievements: e.target.value }))}
                  placeholder="Detail key achievements and milestones..."
                  className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
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
                  value={currentData.improvements}
                  onChange={(e) => setCurrentData((p) => ({ ...p, improvements: e.target.value }))}
                  placeholder="Specify developmental targets and coaching areas..."
                  className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
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

                <button
                  type="button"
                  onClick={addGoalRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Goal</span>
                </button>
              </div>

              <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Goal Objective</th>
                      <th className="py-2.5 px-3">Target / Key Result</th>
                      <th className="py-2.5 px-3 w-36">Deadline</th>
                      <th className="py-2.5 px-3 w-32">Status</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentData.goals.map((g, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={g.goal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                goals: p.goals.map((item, i) => (i === idx ? { ...item, goal: val } : item)),
                              }));
                            }}
                            placeholder="Goal title..."
                            className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={g.target}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                goals: p.goals.map((item, i) => (i === idx ? { ...item, target: val } : item)),
                              }));
                            }}
                            placeholder="Target deliverable / metric..."
                            className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={g.deadline}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                goals: p.goals.map((item, i) => (i === idx ? { ...item, deadline: val } : item)),
                              }));
                            }}
                            className={`w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={g.status}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                goals: p.goals.map((item, i) => (i === idx ? { ...item, status: val } : item)),
                              }));
                            }}
                            placeholder="Status..."
                            className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          {currentData.goals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeGoalRow(idx)}
                              className="text-slate-400 hover:text-rose-500 transition cursor-pointer p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
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

                <button
                  type="button"
                  onClick={addTrainingRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Training</span>
                </button>
              </div>

              <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Skill / Operational Area</th>
                      <th className="py-2.5 px-3">Training Required / Workshop</th>
                      <th className="py-2.5 px-3 w-36">Priority</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentData.training.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={t.skill}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                training: p.training.map((item, i) => (i === idx ? { ...item, skill: val } : item)),
                              }));
                            }}
                            placeholder="Skill domain..."
                            className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={t.training}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                training: p.training.map((item, i) => (i === idx ? { ...item, training: val } : item)),
                              }));
                            }}
                            placeholder="Course / program..."
                            className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={t.priority}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentData((p) => ({
                                ...p,
                                training: p.training.map((item, i) => (i === idx ? { ...item, priority: val } : item)),
                              }));
                            }}
                            className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {currentData.training.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTrainingRow(idx)}
                              className="text-slate-400 hover:text-rose-500 transition cursor-pointer p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
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
                  value={currentData.employeeComments}
                  onChange={(e) => setCurrentData((p) => ({ ...p, employeeComments: e.target.value }))}
                  placeholder="Employee feedback and reflection..."
                  className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
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
                  value={currentData.managerComments}
                  onChange={(e) => setCurrentData((p) => ({ ...p, managerComments: e.target.value }))}
                  placeholder="Manager review and observations..."
                  className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing} leading-relaxed`}
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
                  const isChecked = currentData.overallRating === rating.label;
                  return (
                    <label
                      key={rating.label}
                      onClick={() => setCurrentData((p) => ({ ...p, overallRating: rating.label }))}
                      className={`cursor-pointer rounded-2xl border-2 p-3.5 text-center transition flex flex-col items-center justify-center gap-1.5 shadow-2xs ${
                        isChecked
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
                ].map((act) => (
                  <label
                    key={act.id}
                    className="flex items-center gap-3 p-3.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-2xs"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(currentData.actions[act.id])}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCurrentData((p) => ({
                          ...p,
                          actions: { ...p.actions, [act.id]: checked },
                        }));
                      }}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{act.text}</span>
                  </label>
                ))}
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
                        value={currentData.ceoName}
                        onChange={(e) => setCurrentData((p) => ({ ...p, ceoName: e.target.value }))}
                        className={`w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        CEO Official Signature
                      </label>
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center min-h-[100px]">
                        {ceoSignature ? (
                          <img
                            src={ceoSignature}
                            alt="CEO Signature"
                            className="max-h-20 max-w-[260px] object-contain"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">No signature attached</span>
                        )}
                        {sigFileName && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
                            Uploaded: {sigFileName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Upload Signature File</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetSignature}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Default</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Authorization Date
                      </label>
                      <input
                        type="date"
                        value={currentData.ceoDate}
                        onChange={(e) => setCurrentData((p) => ({ ...p, ceoDate: e.target.value }))}
                        className={`w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all ${theme.focusRing}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Form Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 print:hidden">
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Form</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-md transition cursor-pointer ${
                  theme.primaryBg
                } ${isGeneratingPdf ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Save & Download PDF'}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

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
      </div>

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
