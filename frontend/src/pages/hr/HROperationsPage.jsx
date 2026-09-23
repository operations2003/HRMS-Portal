import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  Megaphone,
  CalendarOff,
  UserCheck,
  ShieldCheck,
  Clock,
  CalendarDays,
  Award,
  RefreshCw,
  Search,
  Eye,
  Building2,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Layers,
  HelpCircle,
  Calendar,
  AlertTriangle,
  UserPlus,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { hrOperationsService } from '../../services/hrOperationsService.js';
import { employeeService } from '../../services/employeeService.js';
import { departmentService } from '../../services/departmentService.js';
import { attendanceService } from '../../services/attendanceService.js';
import { leaveService } from '../../services/leaveService.js';
import { performanceService } from '../../services/performanceService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { HROperationsOverviewCards } from '../../components/hr/HROperationsOverviewCards.jsx';
import { EmployeeDossierModal } from '../../components/hr/EmployeeDossierModal.jsx';
import { BroadcastAnnouncementModal } from '../../components/hr/BroadcastAnnouncementModal.jsx';
import { TeamRosterModal } from '../../components/hr/TeamRosterModal.jsx';
import { AssignManagerModal } from '../../components/team/AssignManagerModal.jsx';
import { ApprovalActionModal } from '../../components/approvals/ApprovalActionModal.jsx';
import { WorkforceAnalyticsTab } from '../../components/hr/WorkforceAnalyticsTab.jsx';

export const HROperationsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 'overview' | 'analytics' | 'employees' | 'teams' | 'managers' | 'attendance' | 'leaves' | 'performance' | 'approvals'
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== activeTab) {
      setActiveTab(t);
    }
  }, [searchParams]);

  // HR Scope & Partner Filter States
  const isHrUser = (user?.roleName || '').toLowerCase().includes('hr');
  const [hrScope, setHrScope] = useState(isHrUser ? 'mine' : 'all'); // 'mine' | 'all' | 'filtered'
  const [selectedHrFilter, setSelectedHrFilter] = useState(isHrUser && user?.employeeId ? user.employeeId : '');
  const [hrList, setHrList] = useState([]);

  // Active HR filter ID
  const activeHrId = hrScope === 'mine' ? (user?.employeeId || selectedHrFilter) : selectedHrFilter;

  // Overview & Operational Data States
  const [overview, setOverview] = useState({});
  const [teams, setTeams] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState({});
  const [orgLeaves, setOrgLeaves] = useState([]);
  const [performanceSummary, setPerformanceSummary] = useState({});
  const [pendingApprovalsQueue, setPendingApprovalsQueue] = useState([]);

  // Date and filter states
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');
  const [approvalModuleFilter, setApprovalModuleFilter] = useState('ALL');

  // Loading & refreshing flags
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedRosterManager, setSelectedRosterManager] = useState(null); // { id, name }
  const [reassigningEmployee, setReassigningEmployee] = useState(null);
  const [approvalActionModal, setApprovalActionModal] = useState({
    isOpen: false,
    item: null,
    actionType: 'APPROVE',
  });

  useEffect(() => {
    loadInitialData();
    loadDepartments();
    loadMetadata();
    loadEmployees();
  }, [activeHrId]);

  const loadMetadata = async () => {
    try {
      const meta = await employeeService.getMetadata();
      setHrList(meta.hrs || []);
    } catch {
      // Non-blocking
    }
  };

  const loadInitialData = async () => {
    try {
      setIsRefreshing(true);
      const [ovRes, tRes, attRes] = await Promise.allSettled([
        hrOperationsService.getOverview(activeHrId ? { assignedHrId: activeHrId } : {}),
        hrOperationsService.getTeams(),
        hrOperationsService.getAttendanceSummary(),
      ]);

      let statsObj = {};
      if (ovRes.status === 'fulfilled' && ovRes.value) {
        statsObj = { ...ovRes.value };
      }
      if (tRes.status === 'fulfilled' && tRes.value) {
        const t = tRes.value;
        const list = t.items || t.teams || (Array.isArray(t) ? t : []);
        setTeams(list);
        statsObj.totalManagers = list.length;
      }
      if (attRes.status === 'fulfilled' && attRes.value) {
        setAttendanceSummary(attRes.value);
        statsObj.attendance = attRes.value;
      }

      setOverview(statsObj);
    } catch (err) {
      toast.error('Failed to load HR operations overview.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await departmentService.getAllDepartments();
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      setDepartments(list);
    } catch {
      // Non-blocking
    }
  };

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const res = await employeeService.getAllEmployees({ limit: 100 });
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      setAllEmployees(list);
    } catch (err) {
      toast.error('Failed to load employee list.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      setIsLoading(true);
      const res = await hrOperationsService.getTeams();
      const list = res.items || res.teams || (Array.isArray(res) ? res : []);
      setTeams(list);
    } catch (err) {
      toast.error('Failed to load teams.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendanceData = async (date) => {
    try {
      setIsLoading(true);
      const [sumRes, recRes] = await Promise.allSettled([
        hrOperationsService.getAttendanceSummary({ date }),
        attendanceService.getOrgAttendance({ date, limit: 50 }),
      ]);

      if (sumRes.status === 'fulfilled') {
        setAttendanceSummary(sumRes.value || {});
      }
      if (recRes.status === 'fulfilled') {
        setAttendanceRecords(recRes.value?.records || []);
      }
    } catch (err) {
      toast.error('Failed to load organization attendance records.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaveData = async () => {
    try {
      setIsLoading(true);
      const [sumRes, recRes] = await Promise.allSettled([
        hrOperationsService.getLeaveSummary(),
        leaveService.getOrgLeaves({ limit: 50 }),
      ]);

      if (sumRes.status === 'fulfilled') {
        setLeaveSummary(sumRes.value || {});
      }
      if (recRes.status === 'fulfilled') {
        setOrgLeaves(recRes.value?.records || []);
      }
    } catch (err) {
      toast.error('Failed to load leave utilization data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPerformanceData = async () => {
    try {
      setIsLoading(true);
      const [sumRes, recRes] = await Promise.allSettled([
        hrOperationsService.getPerformanceSummary(),
        performanceService.getOrganizationRecords({ status: 'UNDER_REVIEW' }),
      ]);

      if (sumRes.status === 'fulfilled') {
        setPerformanceSummary(sumRes.value || {});
      }
    } catch (err) {
      toast.error('Failed to load performance analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadApprovalsQueue = async () => {
    try {
      setIsLoading(true);
      const res = await hrOperationsService.getApprovalQueue();
      const list = res.items || res.queue || (Array.isArray(res) ? res : []);
      setPendingApprovalsQueue(list);
    } catch (err) {
      toast.error('Failed to load unified pending approvals queue.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Filtered Lists Centered Around Assigned HR Scope
  // -------------------------------------------------------------
  const safeAllEmployees = Array.isArray(allEmployees) ? allEmployees : [];
  const filteredEmployees = safeAllEmployees.filter((e) => {
    if (activeHrId) {
      const empHrId = e.hrId || e.hr?.id || e.hr_id;
      if (empHrId !== activeHrId) return false;
    }

    const q = searchEmployeeQuery.toLowerCase();
    const name = (e.fullName || `${e.firstName || ''} ${e.lastName || ''}`).toLowerCase();
    const email = (e.email || '').toLowerCase();
    const code = (e.employeeCode || e.employee_code || '').toLowerCase();
    const matchesQuery = !searchEmployeeQuery || name.includes(q) || email.includes(q) || code.includes(q);

    const matchesDept = deptFilter ? (e.deptId === deptFilter || e.department?.id === deptFilter) : true;
    const matchesStatus = statusFilter ? (e.status || '').toUpperCase() === statusFilter.toUpperCase() : true;

    return matchesQuery && matchesDept && matchesStatus;
  });

  const safeAttendanceRecords = Array.isArray(attendanceRecords) ? attendanceRecords : [];
  const filteredAttendanceRecords = safeAttendanceRecords.filter((rec) => {
    if (activeHrId) {
      const empId = rec.employeeId || rec.employee_id || rec.employee?.id;
      const matchedEmp = safeAllEmployees.find((e) => e.id === empId);
      const empHrId = matchedEmp?.hrId || matchedEmp?.hr?.id || matchedEmp?.hr_id || rec.hrId || rec.employee?.hrId;
      if (empHrId && empHrId !== activeHrId) return false;
    }
    if (!attendanceStatusFilter) return true;
    return (rec.status || '').toUpperCase() === attendanceStatusFilter.toUpperCase();
  });

  const safeOrgLeaves = Array.isArray(orgLeaves) ? orgLeaves : [];
  const filteredOrgLeaves = safeOrgLeaves.filter((l) => {
    if (activeHrId) {
      const empId = l.employeeId || l.employee_id || l.employee?.id;
      const matchedEmp = safeAllEmployees.find((e) => e.id === empId);
      const empHrId = matchedEmp?.hrId || matchedEmp?.hr?.id || matchedEmp?.hr_id || l.hrId || l.employee?.hrId;
      if (empHrId && empHrId !== activeHrId) return false;
    }
    if (leaveStatusFilter === 'ALL') return true;
    return (l.status || '').toUpperCase() === leaveStatusFilter.toUpperCase();
  });

  const safePendingApprovalsQueue = Array.isArray(pendingApprovalsQueue) ? pendingApprovalsQueue : [];
  const filteredApprovals = safePendingApprovalsQueue.filter((item) => {
    if (activeHrId) {
      const empId = item.employeeId || item.employee_id || item.employee?.id || item.requesterId;
      const matchedEmp = safeAllEmployees.find((e) => e.id === empId);
      const empHrId = matchedEmp?.hrId || matchedEmp?.hr?.id || matchedEmp?.hr_id || item.hrId;
      if (empHrId && empHrId !== activeHrId) return false;
    }
    if (approvalModuleFilter === 'ALL') return true;
    const type = (item.module || item.entityType || '').toUpperCase();
    if (approvalModuleFilter === 'LEAVE') return type.includes('LEAVE');
    if (approvalModuleFilter === 'PERFORMANCE') return type.includes('PERFORMANCE') || type.includes('REVIEW');
    if (approvalModuleFilter === 'REQUEST') return type.includes('REQUEST') || type.includes('HELPDESK');
    return true;
  });

  // -------------------------------------------------------------
  // Data Table Columns
  // -------------------------------------------------------------

  // 1. Employees Columns
  const employeeColumns = [
    {
      header: 'Employee',
      render: (row) => {
        const name = row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Staff';
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
              {name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-xs">{name}</p>
              <p className="text-[11px] text-slate-400 font-mono">{row.employeeCode || row.id?.slice(0, 8)}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Department / Role',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-slate-800">{row.designation?.name || row.designation?.title || 'Staff'}</p>
          <p className="text-[11px] text-slate-400">{row.department?.name || 'Department'}</p>
        </div>
      ),
    },
    {
      header: 'Reporting Manager',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          {row.manager?.fullName || row.reportingManager?.name || row.managerName || (
            <span className="text-slate-400 italic">Direct to Org</span>
          )}
        </span>
      ),
    },
    {
      header: 'Assigned HR Partner',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          {row.hr?.fullName || row.hrName || (
            <span className="text-slate-400 italic">General HR Pool</span>
          )}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'ON LEAVE' ? 'warning' : 'neutral'} size="sm">
          {row.status || 'Active'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            icon={Eye}
            onClick={() => setSelectedEmployeeId(row.id)}
          >
            360° Dossier
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={UserCheck}
            onClick={() => setReassigningEmployee(row)}
            title="Reassign Reporting Manager & HR Partner"
          >
            Hierarchy
          </Button>
        </div>
      ),
    },
  ];

  // 2. Teams Columns
  const teamColumns = [
    {
      header: 'Manager / Lead',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
            {(row.managerName || row.name || 'M').charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-xs">{row.managerName || row.name || 'Manager'}</p>
            <p className="text-[11px] text-slate-400 font-mono">{row.managerCode || row.managerId?.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {(typeof row.department === 'object' ? row.department?.name : row.department) || row.departmentName || 'General'}
        </span>
      ),
    },
    {
      header: 'Direct Reports',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.teamSize ?? row.memberCount ?? row.totalMembers ?? 0} members
        </span>
      ),
    },
    {
      header: 'Attendance Rate',
      render: (row) => {
        const rate = row.attendanceRate ?? 95;
        return (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {rate}%
          </span>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          icon={Users}
          onClick={() =>
            setSelectedRosterManager({
              id: row.managerId || row.id,
              name: row.managerName || row.name || 'Manager',
            })
          }
        >
          Inspect Roster
        </Button>
      ),
    },
  ];

  // 3. Managers Oversight Columns
  const managerColumns = [
    {
      header: 'Manager Name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
            {(row.managerName || 'M').charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-xs">{row.managerName}</p>
            <p className="text-[11px] text-slate-400 font-mono">{row.managerCode || row.managerId}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      render: (row) => (
        <span className="text-xs text-slate-700">
          {(typeof row.department === 'object' ? row.department?.name : row.department) || 'General'}
        </span>
      ),
    },
    {
      header: 'Team Capacity',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">{row.teamSize} reports</span>
          <span className="text-[11px] text-slate-400">({row.activeMembers ?? row.teamSize} active)</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            icon={Eye}
            onClick={() =>
              setSelectedRosterManager({
                id: row.managerId,
                name: row.managerName,
              })
            }
          >
            Direct Reports
          </Button>
        </div>
      ),
    },
  ];

  // 4. Attendance Columns
  const attendanceColumns = [
    {
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
            {(row.employeeName || row.employee?.fullName || 'E').charAt(0)}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">
              {row.employeeName || row.employee?.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Employee'}
            </p>
            <p className="text-[10px] text-slate-400">{row.employeeCode || row.employee?.employeeCode}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Date',
      render: (row) => (
        <span className="text-xs font-mono text-slate-600">
          {row.attendanceDate ? row.attendanceDate.split('T')[0] : selectedAttendanceDate}
        </span>
      ),
    },
    {
      header: 'Check-In',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      header: 'Check-Out',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => {
        const s = (row.status || 'PRESENT').toUpperCase();
        const variant = s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : s === 'HALF-DAY' ? 'brand' : 'danger';
        return <Badge variant={variant} size="sm">{s}</Badge>;
      },
    },
  ];

  // 5. Leaves Columns
  const leaveColumns = [
    {
      header: 'Requester',
      render: (row) => {
        const name = row.employeeName || (row.employee ? `${row.employee.firstName || ''} ${row.employee.lastName || ''}`.trim() : 'Employee');
        return (
          <div>
            <p className="text-xs font-semibold text-slate-800">{name}</p>
            <p className="text-[11px] text-slate-400">{row.employeeCode || row.departmentName || 'Staff'}</p>
          </div>
        );
      },
    },
    {
      header: 'Leave Type',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.leaveTypeName || row.leaveType?.name || 'Leave'}
        </span>
      ),
    },
    {
      header: 'Duration',
      render: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {row.startDate ? row.startDate.split('T')[0] : ''} &rarr; {row.endDate ? row.endDate.split('T')[0] : ''} ({row.totalDays || 1}d)
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => {
        const s = (row.status || 'PENDING').toUpperCase();
        const variant = s === 'APPROVED' ? 'success' : s === 'PENDING' ? 'warning' : 'danger';
        return <Badge variant={variant} size="sm">{s}</Badge>;
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        if (row.status === 'PENDING') {
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="success"
                icon={CheckCircle2}
                onClick={() =>
                  setApprovalActionModal({
                    isOpen: true,
                    item: { ...row, entityType: 'LEAVE_REQUEST' },
                    actionType: 'APPROVE',
                  })
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={XCircle}
                onClick={() =>
                  setApprovalActionModal({
                    isOpen: true,
                    item: { ...row, entityType: 'LEAVE_REQUEST' },
                    actionType: 'REJECT',
                  })
                }
              >
                Reject
              </Button>
            </div>
          );
        }
        return <span className="text-xs text-slate-400 font-medium">Processed</span>;
      },
    },
  ];

  // 6. Pending Approvals Queue Columns
  const approvalColumns = [
    {
      header: 'Requester',
      render: (row) => {
        const isSelf =
          (user?.employeeId && (row.employeeId === user.employeeId || row.employee_id === user.employeeId)) ||
          (user?.id && (row.requesterUserId === user.id || row.employee?.userId === user.id));
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
              {(row.requester || 'E').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-slate-800 text-xs">{row.requester}</p>
                {isSelf && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-medium">
                    Self
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{row.employeeCode || 'Requester'}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Module & Title',
      render: (row) => (
        <div>
          <Badge
            variant={
              row.module === 'LEAVE'
                ? 'info'
                : row.module === 'PERFORMANCE'
                ? 'brand'
                : 'neutral'
            }
            size="sm"
          >
            {row.moduleLabel || row.module}
          </Badge>
          <p className="text-xs text-slate-700 font-medium mt-0.5">{row.title}</p>
        </div>
      ),
    },
    {
      header: 'Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.date ? new Date(row.date).toLocaleDateString() : 'Recent'}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const isSelf =
          (user?.employeeId && (row.employeeId === user.employeeId || row.employee_id === user.employeeId)) ||
          (user?.id && (row.requesterUserId === user.id || row.employee?.userId === user.id));

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="success"
              icon={CheckCircle2}
              disabled={isSelf}
              title={isSelf ? 'Self-approval is forbidden by policy' : 'Approve'}
              onClick={() =>
                setApprovalActionModal({
                  isOpen: true,
                  item: row,
                  actionType: 'APPROVE',
                })
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="warning"
              icon={RotateCcw}
              onClick={() =>
                setApprovalActionModal({
                  isOpen: true,
                  item: row,
                  actionType: 'RETURN',
                })
              }
            >
              Return
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={XCircle}
              onClick={() =>
                setApprovalActionModal({
                  isOpen: true,
                  item: row,
                  actionType: 'REJECT',
                })
              }
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              HR Operations & Analytics Cockpit
            </h1>
            <Badge variant="brand" size="sm">Phase 6 Authorized</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Unified cockpit for enterprise workforce administration, real-time analytics intelligence, and operational governance.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={() => {
              loadInitialData();
              loadEmployees();
              if (activeTab === 'attendance') loadAttendanceData(selectedAttendanceDate);
              if (activeTab === 'leaves') loadLeaveData();
              if (activeTab === 'performance') loadPerformanceData();
              if (activeTab === 'approvals') loadApprovalsQueue();
            }}
          >
            Refresh Cockpit
          </Button>
          <Button
            variant="primary"
            icon={Megaphone}
            onClick={() => setIsBroadcastOpen(true)}
          >
            Broadcast Alert
          </Button>
        </div>
      </div>

      {/* Workforce Scope & HR Assignment Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Operational Scope
              </span>
              <Badge variant={hrScope === 'mine' ? 'brand' : 'neutral'} size="sm">
                {hrScope === 'mine' ? 'My Assigned Subordinates' : activeHrId ? 'Filtered HR Portfolio' : 'All Organization Workforce'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {hrScope === 'mine'
                ? `Center operations & view activities for employees assigned under your HR management.`
                : activeHrId
                ? `Filtering workforce & activities for selected HR partner.`
                : `Viewing all company workforce records with complete cross-team visibility.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setHrScope('mine');
                setSelectedHrFilter(user?.employeeId || '');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                hrScope === 'mine'
                  ? 'bg-white text-brand-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              My Assigned Employees
            </button>
            <button
              type="button"
              onClick={() => {
                setHrScope('all');
                setSelectedHrFilter('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                hrScope === 'all'
                  ? 'bg-white text-brand-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              All Org Employees
            </button>
          </div>

          {/* HR Partner Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedHrFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedHrFilter(val);
                if (val && val === user?.employeeId) {
                  setHrScope('mine');
                } else if (val) {
                  setHrScope('filtered');
                } else {
                  setHrScope('all');
                }
              }}
              className="text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All HR Partners</option>
              {hrList.map((h) => (
                <option key={h.id} value={h.id}>
                  HR: {h.fullName || `${h.firstName || ''} ${h.lastName || ''}`.trim()} ({h.employeeCode || h.id?.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <HROperationsOverviewCards stats={overview} />

      {/* Operational Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 text-xs sm:text-sm font-semibold overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Operational Overview', icon: Layers },
          { id: 'analytics', label: 'Workforce Analytics', icon: BarChart3 },
          { id: 'employees', label: `Employees (${allEmployees.length || overview.workforce?.totalEmployees || 0})`, icon: Users },
          { id: 'teams', label: `Teams (${teams.length})`, icon: Users },
          { id: 'managers', label: 'Managers Oversight', icon: UserCheck },
          { id: 'attendance', label: 'Attendance Monitoring', icon: Clock },
          { id: 'leaves', label: 'Leave Utilization', icon: CalendarDays },
          { id: 'performance', label: 'Performance Cycles', icon: Award },
          { id: 'approvals', label: `Pending Approvals (${pendingApprovalsQueue.length || overview.actionItems?.totalPendingActions || 0})`, icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 transition-colors flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Urgent Attention Alert Banner */}
          {overview.actionItems?.totalPendingActions > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900">
                  {overview.actionItems.totalPendingActions} Operations Require HR Attention
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  There are {overview.actionItems.pendingLeaves || 0} pending leaves,{' '}
                  {overview.actionItems.pendingAppraisals || 0} appraisals awaiting HR review, and{' '}
                  {overview.actionItems.pendingRequests || 0} open employee service requests.
                </p>
              </div>
              <Button
                size="sm"
                variant="warning"
                onClick={() => setActiveTab('approvals')}
              >
                Action Queue
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Action Matrix */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-600" />
                Workforce Health Indicators
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] uppercase font-semibold text-slate-500">Active Headcount</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {overview.workforce?.activeEmployees ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] uppercase font-semibold text-slate-500">On Leave Today</span>
                  <p className="text-xl font-bold text-amber-700 mt-1">
                    {overview.workforce?.onLeaveToday ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] uppercase font-semibold text-slate-500">Active Onboardings</span>
                  <p className="text-xl font-bold text-brand-700 mt-1">
                    {overview.actionItems?.activeOnboardings ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] uppercase font-semibold text-slate-500">Open Tickets</span>
                  <p className="text-xl font-bold text-indigo-700 mt-1">
                    {overview.actionItems?.openTickets ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Operations Actions */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-brand-600" />
                Quick Operations Actions
              </h3>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(true)}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/40 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-brand-700">
                      Emergency Broadcast Announcement
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Dispatch alerts to all employees or specific roles.
                    </p>
                  </div>
                  <Megaphone className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700">
                      Monitor Daily Attendance
                    </p>
                    <p className="text-[11px] text-slate-400">
                      View present, late check-ins, and absent records.
                    </p>
                  </div>
                  <Clock className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('approvals')}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-amber-700">
                      Unified Approval Queue
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Action leaves, performance appraisals, and service requests.
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB: WORKFORCE ANALYTICS & INTELLIGENCE */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'analytics' && <WorkforceAnalyticsTab />}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 2: EMPLOYEES DIRECTORY */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, or code..."
                value={searchEmployeeQuery}
                onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON LEAVE">On Leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={employeeColumns}
            data={filteredEmployees}
            isLoading={allEmployees.length === 0 && isLoading}
            emptyTitle="No employees found"
            emptyDescription="No employees match your search query or filters."
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 3: TEAMS */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <DataTable
            columns={teamColumns}
            data={teams}
            isLoading={isLoading && teams.length === 0}
            emptyTitle="No manager teams found"
            emptyDescription="There are currently no manager teams registered in the organization."
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 4: MANAGERS OVERSIGHT */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'managers' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-purple-950">Manager Capacity & Hierarchy</h4>
              <p className="text-xs text-purple-700 mt-0.5">
                Inspect reporting structures, evaluate direct report distribution, and reassign team members.
              </p>
            </div>
            <span className="text-xs font-bold text-purple-800 bg-purple-100/80 px-2.5 py-1 rounded-lg">
              {teams.length} Active Leads
            </span>
          </div>

          <DataTable
            columns={managerColumns}
            data={teams}
            isLoading={isLoading && teams.length === 0}
            emptyTitle="No managers registered"
            emptyDescription="No reporting managers found in this organization."
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 5: ATTENDANCE MONITORING */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Date Selector & Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">Attendance Date:</span>
              <input
                type="date"
                value={selectedAttendanceDate}
                onChange={(e) => {
                  setSelectedAttendanceDate(e.target.value);
                  loadAttendanceData(e.target.value);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={attendanceStatusFilter}
                onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF-DAY">Half-Day</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-emerald-700 block">Present</span>
              <h3 className="text-2xl font-bold text-emerald-900 mt-1">
                {attendanceSummary.present ?? attendanceSummary.presentToday ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-amber-700 block">Late</span>
              <h3 className="text-2xl font-bold text-amber-900 mt-1">
                {attendanceSummary.late ?? attendanceSummary.lateToday ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-rose-50/70 border border-rose-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-rose-700 block">Absent</span>
              <h3 className="text-2xl font-bold text-rose-900 mt-1">
                {attendanceSummary.absent ?? attendanceSummary.absentToday ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-blue-700 block">Attendance Rate</span>
              <h3 className="text-2xl font-bold text-blue-900 mt-1">
                {attendanceSummary.attendanceRate ?? '95%'}
              </h3>
            </div>
          </div>

          <DataTable
            columns={attendanceColumns}
            data={filteredAttendanceRecords}
            isLoading={isLoading}
            emptyTitle="No attendance records found"
            emptyDescription="No attendance records recorded for this selected date."
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 6: LEAVE UTILIZATION */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-blue-700 block">Total Leaves Logged</span>
              <h3 className="text-2xl font-bold text-blue-900 mt-1">
                {leaveSummary.totalRequests ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-amber-700 block">Pending Leaves Across Teams</span>
              <h3 className="text-2xl font-bold text-amber-900 mt-1">
                {leaveSummary.pendingApprovals ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-emerald-700 block">Approved Leaves</span>
              <h3 className="text-2xl font-bold text-emerald-900 mt-1">
                {leaveSummary.approvedTotal ?? 0}
              </h3>
            </div>
          </div>

          {/* Leaves By Type Distribution */}
          {Array.isArray(leaveSummary.leavesByType) && leaveSummary.leavesByType.length > 0 && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Leave Category Distribution
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {leaveSummary.leavesByType.map((lt, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs font-semibold text-slate-800 block truncate">{lt.leaveType}</span>
                    <span className="text-base font-bold text-brand-700 mt-1 block">
                      {lt.requestCount} requests <span className="text-xs text-slate-500">({lt.totalDays}d)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <h4 className="text-sm font-bold text-slate-900">Organization Leave Applications</h4>
            <div className="flex items-center gap-2">
              <select
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Action</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={leaveColumns}
            data={filteredOrgLeaves}
            isLoading={isLoading}
            emptyTitle="No leave applications found"
            emptyDescription="There are currently no leave applications matching your criteria."
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 7: PERFORMANCE CYCLES */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-brand-50/70 border border-brand-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-brand-700 block">Total Appraisals</span>
              <h3 className="text-2xl font-bold text-brand-900 mt-1">
                {performanceSummary.totalAppraisals ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-emerald-700 block">Completion Rate</span>
              <h3 className="text-2xl font-bold text-emerald-900 mt-1">
                {performanceSummary.completionRate ?? '0%'}
              </h3>
            </div>
            <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-purple-700 block">Average Org Rating</span>
              <h3 className="text-2xl font-bold text-purple-900 mt-1">
                {performanceSummary.averageRating ? `${performanceSummary.averageRating} / 5.0` : 'Pending'}
              </h3>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-amber-700 block">Under Review</span>
              <h3 className="text-2xl font-bold text-amber-900 mt-1">
                {performanceSummary.statusBreakdown?.underReview ?? 0}
              </h3>
            </div>
          </div>

          {/* Status Breakdown Bar */}
          {performanceSummary.statusBreakdown && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Appraisal Lifecycle Stages
              </h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium">
                  Draft: <b>{performanceSummary.statusBreakdown.draft}</b>
                </span>
                <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium border border-blue-200">
                  Submitted: <b>{performanceSummary.statusBreakdown.submitted}</b>
                </span>
                <span className="px-3 py-1 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-200">
                  Manager/HR Review: <b>{performanceSummary.statusBreakdown.underReview}</b>
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium border border-emerald-200">
                  Final Approved: <b>{performanceSummary.statusBreakdown.approved}</b>
                </span>
                <span className="px-3 py-1 bg-rose-50 text-rose-800 rounded-lg text-xs font-medium border border-rose-200">
                  Returned: <b>{performanceSummary.statusBreakdown.returned}</b>
                </span>
              </div>
            </div>
          )}

          {/* Active Review Periods */}
          {Array.isArray(performanceSummary.recentCycles) && performanceSummary.recentCycles.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Active Review Periods</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {performanceSummary.recentCycles.map((cycle) => (
                  <div key={cycle.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">{cycle.name}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cycle.start_date ? cycle.start_date.split('T')[0] : ''} &rarr; {cycle.end_date ? cycle.end_date.split('T')[0] : ''}
                      </p>
                    </div>
                    <Badge variant={cycle.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                      {cycle.status || 'Active'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 8: UNIFIED PENDING APPROVALS */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
            {[
              { id: 'ALL', label: `All Modules (${pendingApprovalsQueue.length})` },
              { id: 'LEAVE', label: 'Leaves' },
              { id: 'PERFORMANCE', label: 'Performance' },
              { id: 'REQUEST', label: 'Requests' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setApprovalModuleFilter(f.id)}
                className={`pb-2.5 transition-colors ${
                  approvalModuleFilter === f.id
                    ? 'text-brand-600 border-b-2 border-brand-600 font-bold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <DataTable
            columns={approvalColumns}
            data={filteredApprovals}
            isLoading={isLoading && pendingApprovalsQueue.length === 0}
            emptyTitle="Approval queue is clear"
            emptyDescription="All cross-module requests have been processed."
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS */}
      {/* =================================================================== */}

      {/* 1. Broadcast Announcement Modal */}
      <BroadcastAnnouncementModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        onSuccess={() => {
          loadInitialData();
          toast.success('Operational announcement broadcasted to organization.');
        }}
      />

      {/* 2. Employee Dossier 360° Modal */}
      <EmployeeDossierModal
        isOpen={Boolean(selectedEmployeeId)}
        onClose={() => setSelectedEmployeeId(null)}
        employeeId={selectedEmployeeId}
      />

      {/* 3. Team Roster Modal */}
      <TeamRosterModal
        isOpen={Boolean(selectedRosterManager)}
        onClose={() => setSelectedRosterManager(null)}
        managerId={selectedRosterManager?.id}
        managerName={selectedRosterManager?.name}
      />

      {/* 4. Assign / Reassign Manager Modal */}
      <AssignManagerModal
        isOpen={Boolean(reassigningEmployee)}
        onClose={() => setReassigningEmployee(null)}
        onSuccess={() => {
          setReassigningEmployee(null);
          loadEmployees();
          loadTeams();
          toast.success('Manager reassigned successfully.');
        }}
        employee={reassigningEmployee}
      />

      {/* 5. Approval Action Modal */}
      <ApprovalActionModal
        isOpen={approvalActionModal.isOpen}
        onClose={() => setApprovalActionModal({ isOpen: false, item: null, actionType: 'APPROVE' })}
        onSuccess={() => {
          setApprovalActionModal({ isOpen: false, item: null, actionType: 'APPROVE' });
          loadInitialData();
          if (activeTab === 'approvals') loadApprovalsQueue();
          if (activeTab === 'leaves') loadLeaveData();
          toast.success('Approval decision recorded successfully.');
        }}
        item={approvalActionModal.item}
        actionType={approvalActionModal.actionType}
        currentUser={user}
      />
    </div>
  );
};

export default HROperationsPage;
