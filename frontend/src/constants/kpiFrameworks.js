/**
 * TaskNera – Designation-wise KPI Framework & Performance Rating Engine
 * 
 * Standardized KPI allocations, monthly targets, responsibilities,
 * and weighted scoring formula: Weighted Score = (Achievement % * Weight) / 100
 */

export const KPI_DESIGNATION_FRAMEWORKS = [
  {
    id: 'operations_manager',
    title: 'Operations Manager',
    category: 'Operations',
    totalWeight: 100,
    primaryObjective:
      'Manage daily business operations, ensure departmental accountability, monitor productivity and ensure timely execution of company objectives.',
    keyResponsibilities: [
      'Managing recruitment, IT and operations teams.',
      'Ensuring employees follow login, logout and break schedules.',
      'Monitoring assigned work and deadlines.',
      'Maintaining departmental trackers.',
      'Reporting operational issues to the CEO.',
      'Ensuring team targets are achieved.',
      'Preventing delays in client deliverables.',
    ],
    kpis: [
      {
        id: 'dept_perf',
        name: 'Department Performance Management',
        weight: 20,
        monthlyTarget: 'Achieve 90% of departmental targets',
      },
      {
        id: 'task_alloc',
        name: 'Task Allocation & Monitoring',
        weight: 15,
        monthlyTarget: '95% tasks assigned and tracked on time',
      },
      {
        id: 'team_prod',
        name: 'Team Productivity & Accountability',
        weight: 15,
        monthlyTarget: 'Maintain 90% team productivity target',
      },
      {
        id: 'client_deliv',
        name: 'Client Delivery & Coordination',
        weight: 15,
        monthlyTarget: '95% client deliverables completed on time',
      },
      {
        id: 'reporting_tracker',
        name: 'Reporting & Tracker Management',
        weight: 10,
        monthlyTarget: '100% daily/weekly tracker updates',
      },
      {
        id: 'issue_resolution',
        name: 'Issue Resolution',
        weight: 10,
        monthlyTarget: 'Resolve 90% of operational issues within agreed timelines',
      },
      {
        id: 'sop_compliance',
        name: 'Process & SOP Implementation',
        weight: 10,
        monthlyTarget: 'Maintain 100% compliance with mandatory SOPs',
      },
      {
        id: 'leadership_comm',
        name: 'Leadership & Communication',
        weight: 5,
        monthlyTarget: 'Conduct weekly team reviews and follow-ups',
      },
    ],
  },
  {
    id: 'recruitment_client_coordinator',
    title: 'Recruitment Coordinator + Client Coordinator',
    category: 'Recruitment',
    totalWeight: 100,
    primaryObjective:
      'Coordinate recruitment activities, manage client requirements, maintain candidate submissions and ensure smooth communication between recruiters and clients.',
    keyResponsibilities: [
      'Understanding and documenting client JDs.',
      'Allocating requirements to recruiters.',
      'Tracking candidate submissions.',
      'Maintaining client communication.',
      'Coordinating interviews and feedback.',
      'Following up on pending selections and offers.',
      'Maintaining client-wise recruitment sheets.',
    ],
    kpis: [
      {
        id: 'jd_understanding',
        name: 'Job Requirement Understanding',
        weight: 15,
        monthlyTarget: '100% requirements documented accurately',
      },
      {
        id: 'recruiter_coord',
        name: 'Recruiter Coordination',
        weight: 15,
        monthlyTarget: 'Daily follow-ups and requirement allocation',
      },
      {
        id: 'submission_mgmt',
        name: 'Candidate Submission Management',
        weight: 20,
        monthlyTarget: '95% submissions completed within client deadlines',
      },
      {
        id: 'client_comm',
        name: 'Client Communication',
        weight: 15,
        monthlyTarget: 'Respond to client queries within 4 working hours',
      },
      {
        id: 'client_followup',
        name: 'Client Follow-ups',
        weight: 10,
        monthlyTarget: '100% scheduled follow-ups completed',
      },
      {
        id: 'rec_tracker',
        name: 'Recruitment Tracker Management',
        weight: 10,
        monthlyTarget: '100% tracker accuracy',
      },
      {
        id: 'interview_coord',
        name: 'Interview Coordination',
        weight: 10,
        monthlyTarget: '95% interviews coordinated without avoidable errors',
      },
      {
        id: 'reporting_escalation',
        name: 'Reporting & Escalation',
        weight: 5,
        monthlyTarget: 'Timely reporting of pending requirements and blockers',
      },
    ],
  },
  {
    id: 'recruiter_ta_exec',
    title: 'Recruiters / Talent Acquisition Executives',
    category: 'Recruitment',
    totalWeight: 100,
    primaryObjective:
      'Source, screen and submit qualified candidates who meet client requirements and contribute to successful placements.',
    guidelineNote:
      'Important: Successful joining should be measured, but recruiters should not be penalized unfairly for client-side delays, salary changes or cancelled vacancies outside their control.',
    keyResponsibilities: [
      'Sourcing candidates through job portals and professional networks.',
      'Screening resumes against JDs.',
      'Validating mandatory requirements.',
      'Maintaining ATS records.',
      'Submitting candidates within deadlines.',
      'Coordinating interviews.',
      'Following up with candidates until joining.',
      'Maintaining accurate recruitment trackers.',
    ],
    kpis: [
      {
        id: 'candidate_sourcing',
        name: 'Candidate Sourcing',
        weight: 15,
        monthlyTarget: 'Meet assigned sourcing target',
      },
      {
        id: 'resume_screening',
        name: 'Resume Screening',
        weight: 15,
        monthlyTarget: '95% screening accuracy',
      },
      {
        id: 'ats_jd_match',
        name: 'ATS & JD Matching',
        weight: 15,
        monthlyTarget: 'Follow mandatory screening criteria; 90%+ ATS match where applicable',
      },
      {
        id: 'qualified_submissions',
        name: 'Qualified Candidate Submissions',
        weight: 20,
        monthlyTarget: '3–5 qualified submissions per working day, subject to active requirements',
      },
      {
        id: 'interview_coord',
        name: 'Interview Coordination',
        weight: 10,
        monthlyTarget: '95% scheduled interviews coordinated properly',
      },
      {
        id: 'followups_engagement',
        name: 'Follow-ups & Candidate Engagement',
        weight: 10,
        monthlyTarget: '100% scheduled candidate follow-ups',
      },
      {
        id: 'successful_joinings',
        name: 'Successful Joinings',
        weight: 10,
        monthlyTarget: 'Achieve assigned monthly joining target',
      },
      {
        id: 'tracker_compliance',
        name: 'Tracker & Reporting Compliance',
        weight: 5,
        monthlyTarget: '100% daily tracker updates',
      },
    ],
  },
  {
    id: 'hr_ld_executive',
    title: 'HR & L&D Executive',
    category: 'Human Resources',
    totalWeight: 100,
    primaryObjective:
      'Manage employee lifecycle activities, maintain HR compliance, coordinate employee engagement and develop employee learning and performance.',
    keyResponsibilities: [
      'Employee onboarding and offboarding.',
      'Maintaining employee records.',
      'Preparing HR documentation.',
      'Managing attendance and leave records.',
      'Conducting employee induction.',
      'Creating and assigning training courses.',
      'Conducting assessments.',
      'Maintaining training completion records.',
      'Supporting employee engagement.',
      'Maintaining HR policies and SOPs.',
    ],
    kpis: [
      {
        id: 'emp_documentation',
        name: 'Employee Documentation',
        weight: 15,
        monthlyTarget: '100% employee files maintained',
      },
      {
        id: 'onboarding_induction',
        name: 'Onboarding & Induction',
        weight: 15,
        monthlyTarget: '100% scheduled inductions completed',
      },
      {
        id: 'attendance_leave_mgmt',
        name: 'Attendance & Leave Management',
        weight: 15,
        monthlyTarget: '100% records updated accurately',
      },
      {
        id: 'hr_ops_queries',
        name: 'HR Operations & Employee Queries',
        weight: 15,
        monthlyTarget: '95% queries resolved within agreed timelines',
      },
      {
        id: 'training_program_mgmt',
        name: 'Training Program Management',
        weight: 15,
        monthlyTarget: 'Complete assigned monthly training programs',
      },
      {
        id: 'training_effectiveness',
        name: 'Training Effectiveness',
        weight: 10,
        monthlyTarget: 'Maintain 85% average assessment target',
      },
      {
        id: 'policy_compliance',
        name: 'Policy & SOP Compliance',
        weight: 10,
        monthlyTarget: '100% mandatory policy communication',
      },
      {
        id: 'hr_reporting',
        name: 'HR Reporting & Documentation',
        weight: 5,
        monthlyTarget: 'All scheduled reports submitted on time',
      },
    ],
  },
  {
    id: 'fullstack_developer',
    title: 'Full-Stack Developers',
    category: 'Engineering',
    totalWeight: 100,
    primaryObjective:
      'Develop, maintain and deploy reliable software products and client applications while meeting technical requirements and project deadlines.',
    guidelineNote:
      'Important: Developers should be evaluated on completed and accepted work, not simply the number of hours spent coding or lines of code written.',
    keyResponsibilities: [
      'Frontend and backend development.',
      'Database management.',
      'API development and integration.',
      'Bug fixing.',
      'Testing and debugging.',
      'Application deployment.',
      'Code maintenance.',
      'Technical documentation.',
      'Internal product development.',
      'Client project delivery.',
    ],
    kpis: [
      {
        id: 'feature_delivery',
        name: 'Project & Feature Delivery',
        weight: 20,
        monthlyTarget: 'Complete at least 90% of committed sprint deliverables',
      },
      {
        id: 'code_quality',
        name: 'Code Quality',
        weight: 15,
        monthlyTarget: 'Follow coding standards and complete peer reviews',
      },
      {
        id: 'bug_resolution',
        name: 'Bug Resolution',
        weight: 15,
        monthlyTarget: 'Resolve 90% of assigned priority bugs within SLA',
      },
      {
        id: 'dev_productivity',
        name: 'Development Productivity',
        weight: 15,
        monthlyTarget: 'Meet agreed development milestones',
      },
      {
        id: 'testing_reliability',
        name: 'Testing & Reliability',
        weight: 10,
        monthlyTarget: 'Complete required testing before deployment',
      },
      {
        id: 'technical_doc',
        name: 'Documentation',
        weight: 10,
        monthlyTarget: 'Maintain updated technical documentation',
      },
      {
        id: 'comm_reporting',
        name: 'Communication & Reporting',
        weight: 10,
        monthlyTarget: 'Daily updates and timely blocker escalation',
      },
      {
        id: 'security_maintenance',
        name: 'Security & Code Maintenance',
        weight: 5,
        monthlyTarget: 'Follow security and code review requirements',
      },
    ],
  },
];

/**
 * 6. Common Performance Rating System
 * Scale 1 to 5 mapped to 0-100% score
 */
export const RATING_SCALE = [
  {
    rating: 5,
    minScore: 90,
    maxScore: 100,
    level: 'Outstanding',
    badgeVariant: 'success',
    color: '#059669', // Emerald
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Consistently surpasses all targets with exceptional quality and leadership.',
  },
  {
    rating: 4,
    minScore: 80,
    maxScore: 89.99,
    level: 'Exceeds Expectations',
    badgeVariant: 'info',
    color: '#0284c7', // Sky
    bgColor: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    description: 'Consistently meets all commitments and frequently exceeds target goals.',
  },
  {
    rating: 3,
    minScore: 70,
    maxScore: 79.99,
    level: 'Meets Expectations',
    badgeVariant: 'brand',
    color: '#BF6649', // TaskNera Brand
    bgColor: 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    description: 'Consistently delivers on core responsibilities and meets agreed targets.',
  },
  {
    rating: 2,
    minScore: 50,
    maxScore: 69.99,
    level: 'Needs Improvement',
    badgeVariant: 'warning',
    color: '#d97706', // Amber
    bgColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    description: 'Partially meets expectations; active coaching and turnaround required.',
  },
  {
    rating: 1,
    minScore: 0,
    maxScore: 49.99,
    level: 'Unsatisfactory',
    badgeVariant: 'danger',
    color: '#e11d48', // Rose
    bgColor: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    description: 'Performance fails to meet essential requirements; formal PIP recommended.',
  },
];

/**
 * KPI Calculation:
 * Weighted Score = (Achievement % * Weight) / 100
 */
export const calculateKpiWeightedScore = (achievementPercent, weight) => {
  const ach = Math.max(0, Math.min(100, Number(achievementPercent) || 0));
  const wt = Number(weight) || 0;
  return Math.round(((ach * wt) / 100) * 100) / 100;
};

/**
 * Calculate total weighted score from a list of KPI evaluations
 */
export const calculateTotalKpiScore = (kpiItems = []) => {
  if (!Array.isArray(kpiItems) || kpiItems.length === 0) return 0;
  const total = kpiItems.reduce((acc, item) => {
    const ws = item.weightedScore !== undefined
      ? Number(item.weightedScore)
      : calculateKpiWeightedScore(item.achievement, item.weight);
    return acc + (Number(ws) || 0);
  }, 0);
  return Math.round(total * 100) / 100;
};

/**
 * Determine Rating (1 to 5) & Performance Level from Total Score
 */
export const getPerformanceRatingFromScore = (score) => {
  const num = Math.max(0, Math.min(100, Number(score) || 0));
  if (num >= 90) return RATING_SCALE[0]; // 5 - Outstanding
  if (num >= 80) return RATING_SCALE[1]; // 4 - Exceeds Expectations
  if (num >= 70) return RATING_SCALE[2]; // 3 - Meets Expectations
  if (num >= 50) return RATING_SCALE[3]; // 2 - Needs Improvement
  return RATING_SCALE[4]; // 1 - Below 50 Unsatisfactory
};

/**
 * Auto-detect the best matching framework for an employee designation / title
 */
export const matchFrameworkForDesignation = (designationTitle = '') => {
  const title = (designationTitle || '').toLowerCase().trim();
  if (!title) return KPI_DESIGNATION_FRAMEWORKS[4]; // Default to Developer

  if (title.includes('operation') || title.includes('ops manager') || title.includes('operations lead')) {
    return KPI_DESIGNATION_FRAMEWORKS[0];
  }
  if (title.includes('coordinator') || title.includes('client coord')) {
    return KPI_DESIGNATION_FRAMEWORKS[1];
  }
  if (title.includes('recruit') || title.includes('talent') || title.includes('sourcing') || title.includes('ta exec')) {
    return KPI_DESIGNATION_FRAMEWORKS[2];
  }
  if (title.includes('hr') || title.includes('l&d') || title.includes('learning') || title.includes('human')) {
    return KPI_DESIGNATION_FRAMEWORKS[3];
  }
  if (title.includes('dev') || title.includes('engineer') || title.includes('tech') || title.includes('fullstack') || title.includes('software')) {
    return KPI_DESIGNATION_FRAMEWORKS[4];
  }

  return KPI_DESIGNATION_FRAMEWORKS[4];
};

