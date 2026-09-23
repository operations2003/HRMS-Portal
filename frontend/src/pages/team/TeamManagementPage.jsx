import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CalendarDays,
  Award,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserCheck,
  ShieldCheck,
  Filter,
  ShieldAlert,
  Calendar,
  AlertCircle,
  Timer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { teamService } from '../../services/teamService.js';
import { managerService } from '../../services/managerService.js';
import { departmentService } from '../../services/departmentService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { TeamMemberDetailModal } from '../../components/team/TeamMemberDetailModal.jsx';
import { AssignManagerModal } from '../../components/team/AssignManagerModal.jsx';
import { ApprovalActionModal } from '../../components/approvals/ApprovalActionModal.jsx';
import { AttendanceDetailModal } from '../../components/attendance/AttendanceDetailModal.jsx';
import { attendanceService } from '../../services/attendanceService.js';

export const TeamManagementPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const isAuthorized = hasRole(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);
  const isHrOrAdmin = hasRole(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'attendance' | 'leaves'
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [leaves, setLeaves] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Pagination states
  const [memberPage, setMemberPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const pageSize = 10;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Modals state
  const [selectedMember, setSelectedMember] = useState(null);
  const [assigningMember, setAssigningMember] = useState(null);
  const [approvalAction, setApprovalAction] = useState({ isOpen: false, item: null, type: 'APPROVE' });
  const [selectedAttendanceDetail, setSelectedAttendanceDetail] = useState(null);

  useEffect(() => {
    if (isAuthorized) {
      loadDepartments();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadTabData();
    } else {
      setIsLoading(false);
    }
  }, [activeTab, selectedDate, selectedDept, selectedStatus, attendanceStatusFilter, isAuthorized]);

  const loadDepartments = async () => {
    try {
      const res = await departmentService.getAllDepartments();
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      setDepartments(list);
    } catch {
      // Non-blocking
    }
  };

  const loadTabData = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      if (activeTab === 'members') {
        const res = await teamService.getTeam({
          search: searchQuery || undefined,
          deptId: selectedDept || undefined,
          status: selectedStatus || undefined,
        });
        setMembers(res.items || res.data || (Array.isArray(res) ? res : []));
      } else if (activeTab === 'attendance') {
        const [attRes, sumRes] = await Promise.allSettled([
          teamService.getTeamAttendance({
            date: selectedDate,
            status: attendanceStatusFilter || undefined,
          }),
          teamService.getTeamAttendanceSummary({
            startDate: selectedDate,
            endDate: selectedDate,
          }),
        ]);

        if (attRes.status === 'fulfilled') {
          const a = attRes.value;
          setAttendance(a.items || a.data || (Array.isArray(a) ? a : []));
        }
        if (sumRes.status === 'fulfilled') {
          setAttendanceSummary(sumRes.value || {});
        }
      } else if (activeTab === 'leaves') {
        const res = await managerService.getTeamLeaves();
        setLeaves(res.items || res.data || (Array.isArray(res) ? res : []));
      }
    } catch (err) {
      const msg = err.message || `Failed to load ${activeTab} data.`;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleViewPunch = async (row) => {
    if (row.attendance?.id) {
      try {
        const fullRec = await attendanceService.getAttendanceById(row.attendance.id);
        if (fullRec) {
          setSelectedAttendanceDetail(fullRec);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch full attendance record from server, falling back:', err);
      }
    }

    const hrs = row.attendance?.totalHours ?? row.totalHours ?? 0;
    const ot = row.attendance?.overtimeHours ?? row.overtimeHours ?? 0;
    setSelectedAttendanceDetail({
      id: row.attendance?.id || row.id,
      attendanceDate: row.attendance?.attendanceDate || selectedDate,
      checkIn: row.attendance?.punchIn || row.punchIn || row.checkIn,
      checkOut: row.attendance?.punchOut || row.punchOut || row.checkOut,
      totalHours: hrs,
      status: (row.attendance?.status || row.status || 'ABSENT').toUpperCase(),
      overtimeHours: ot,
      employee: {
        firstName: row.firstName || row.fullName?.split(' ')[0] || '',
        lastName: row.lastName || row.fullName?.split(' ').slice(1).join(' ') || '',
        employeeCode: row.employeeCode || row.employee_code || row.id?.slice(0, 8) || '',
        departmentName: (typeof row.department === 'object' ? row.department?.name : row.department) || '',
        designationTitle: (typeof row.designation === 'object' ? row.designation?.name : row.designation) || '',
      },
    });
  };

  // Role Gate: Regular employees cannot see manager team controls
  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 ring-8 ring-amber-50/50">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Team Management Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          You do not possess supervisory permissions to manage team members or access supervisor attendance logs.
        </p>
        <Button variant="primary" onClick={() => window.history.back()}>
          Return to Previous Page
        </Button>
      </div>
    );
  }

  // Filter members on frontend search with defensive array guards
  const safeMembers = Array.isArray(members) ? members : [];
  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const safeLeaves = Array.isArray(leaves) ? leaves : [];

  const filteredMembers = safeMembers.filter((m) => {
    const q = searchQuery.toLowerCase();
    const name = (m.fullName || `${m.firstName || ''} ${m.lastName || ''}`).toLowerCase();
    const code = (m.employeeCode || m.employee_code || m.id || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    const dept = (m.department?.name || (typeof m.department === 'string' ? m.department : '')).toLowerCase();
    return name.includes(q) || code.includes(q) || email.includes(q) || dept.includes(q);
  });

  const paginatedMembers = filteredMembers.slice((memberPage - 1) * pageSize, memberPage * pageSize);
  const memberPagination = {
    page: memberPage,
    totalPages: Math.ceil(filteredMembers.length / pageSize) || 1,
    total: filteredMembers.length,
  };

  const paginatedAttendance = safeAttendance.slice((attendancePage - 1) * pageSize, attendancePage * pageSize);
  const attendancePagination = {
    page: attendancePage,
    totalPages: Math.ceil(safeAttendance.length / pageSize) || 1,
    total: safeAttendance.length,
  };

  const paginatedLeaves = safeLeaves.slice((leavePage - 1) * pageSize, leavePage * pageSize);
  const leavePagination = {
    page: leavePage,
    totalPages: Math.ceil(safeLeaves.length / pageSize) || 1,
    total: safeLeaves.length,
  };

  const memberColumns = [
    {
      header: 'Team Member',
      render: (row) => {
        const name = row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Team Member';
        const code = row.employeeCode || row.employee_code || row.id?.slice(0, 8);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
              {name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-xs">{name}</p>
              <p className="text-[11px] text-slate-400 font-mono">ID: {code}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Department / Role',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-slate-800">
            {(typeof row.designation === 'object' ? row.designation?.name : row.designation) || row.designationTitle || row.jobTitle || 'Staff'}
          </p>
          <p className="text-[11px] text-slate-400">
            {(typeof row.department === 'object' ? row.department?.name : row.department) || row.departmentName || 'Department'}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'Active' || row.status === 'ACTIVE'
              ? 'success'
              : row.status === 'On Leave'
              ? 'warning'
              : 'neutral'
          }
          size="sm"
        >
          {row.status || 'Active'}
        </Badge>
      ),
    },
    {
      header: 'Attendance Summary',
      render: (row) => {
        const att = row.attendanceSummary || row.attendance || {};
        const isPresent = att.status === 'PRESENT' || att.status === 'LATE';
        return (
          <div className="text-xs">
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                isPresent ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPresent ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {att.status || (row.status === 'On Leave' ? 'ON LEAVE' : 'Logged')}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Leave Status',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.status === 'On Leave' ? (
            <Badge variant="warning" size="sm">On Approved Leave</Badge>
          ) : (
            <span className="text-slate-500">Available</span>
          )}
        </span>
      ),
    },
    {
      header: 'Performance',
      render: (row) => {
        const p = row.performanceSummary || row.performance || {};
        return (
          <span className="text-xs font-medium text-slate-700">
            {p.lastRating ? `${p.lastRating} / 5.0` : 'Up to date'}
          </span>
        );
      },
    },
    {
      header: 'Assigned HR Partner',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          {row.hr?.fullName || row.hrName || 'General HR Pool'}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => setSelectedMember(row)}
          >
            Details
          </Button>
          {isHrOrAdmin && (
            <Button
              size="sm"
              variant="secondary"
              icon={UserCheck}
              onClick={() => setAssigningMember(row)}
            >
              Reassign
            </Button>
          )}
        </div>
      ),
    },
  ];

  const attendanceColumns = [
    {
      header: 'Employee',
      render: (row) => {
        const name = row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Team Member';
        const code = row.employeeCode || row.employee_code || row.employeeId?.slice(0, 8);
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
              {name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-xs">{name}</p>
              <p className="text-[11px] text-slate-400 font-mono">ID: {code}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Date',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.attendance?.attendanceDate || selectedDate}
        </span>
      ),
    },
    {
      header: 'Check-In',
      render: (row) => {
        const time = row.attendance?.punchIn || row.punchIn || row.checkInTime || row.checkIn;
        const isLate = row.attendance?.isLate;
        return (
          <div>
            <span className="text-xs font-mono font-medium text-slate-800">
              {time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </span>
            {isLate && (
              <span className="block text-[10px] text-amber-600 font-semibold">Late Check-in</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Check-Out',
      render: (row) => {
        const time = row.attendance?.punchOut || row.punchOut || row.checkOutTime || row.checkOut;
        return (
          <span className="text-xs font-mono font-medium text-slate-800">
            {time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
        );
      },
    },
    {
      header: 'Hours & Overtime',
      render: (row) => {
        const hrs = Number(row.attendance?.totalHours ?? row.totalHours ?? 0);
        const otVal = Number(row.attendance?.overtimeHours ?? row.overtimeHours ?? 0);
        const overtime = otVal > 0 ? otVal.toFixed(1) : null;
        return (
          <div>
            <span className="text-xs font-medium text-slate-800">{hrs.toFixed(1)} hrs</span>
            {overtime && (
              <span className="block text-[10px] text-emerald-600 font-semibold">+{overtime}h Overtime</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      render: (row) => {
        const status = (row.attendance?.status || row.status || 'ABSENT').toUpperCase();
        return (
          <Badge
            variant={
              status === 'PRESENT'
                ? 'success'
                : status === 'LATE'
                ? 'warning'
                : status === 'HALF_DAY'
                ? 'info'
                : 'danger'
            }
            size="sm"
          >
            {status}
          </Badge>
        );
      },
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={Eye}
          onClick={() => handleViewPunch(row)}
        >
          View Punch
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">
              Team Management
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Team Supervision & Attendance Console
          </h1>
          <p className="text-sm text-slate-500">
            Monitor direct reports, inspect daily clock-in records, and manage supervisory approvals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={loadTabData}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'members'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Team Roster ({members.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Team Attendance ({attendance.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'leaves'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Team Leaves ({safeLeaves.filter((l) => l.status === 'PENDING').length} Pending)
        </button>
      </div>

      {/* Tab 1: Team Members Roster */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Filters toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setMemberPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setMemberPage(1);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setMemberPage(1);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={memberColumns}
            data={paginatedMembers}
            pagination={memberPagination}
            onPageChange={setMemberPage}
            isLoading={isLoading}
            error={error}
            emptyTitle="No direct reports found"
            emptyDescription="No team members match your filter criteria or reporting line."
          />
        </div>
      )}

      {/* Tab 2: Team Attendance (Prompt 4) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Attendance Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Team</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5 block">
                {attendanceSummary.totalRecords ?? attendance.length}
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Present On-Time</span>
              <span className="text-xl font-bold text-emerald-900 mt-0.5 block">
                {attendanceSummary.presentCount ?? safeAttendance.filter((a) => a.attendance?.status === 'PRESENT').length}
              </span>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Late Arrivals</span>
              <span className="text-xl font-bold text-amber-900 mt-0.5 block">
                {attendanceSummary.lateCount ?? safeAttendance.filter((a) => a.attendance?.isLate || a.attendance?.status === 'LATE').length}
              </span>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-rose-700 block">Absent / Un-punched</span>
              <span className="text-xl font-bold text-rose-900 mt-0.5 block">
                {attendanceSummary.absentCount ?? safeAttendance.filter((a) => !a.attendance?.id || a.attendance?.status === 'ABSENT').length}
              </span>
            </div>
          </div>

          {/* Date & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Attendance Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setAttendancePage(1);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={attendanceStatusFilter}
                onChange={(e) => {
                  setAttendanceStatusFilter(e.target.value);
                  setAttendancePage(1);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none"
              >
                <option value="">All Attendance Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late Arrival</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={attendanceColumns}
            data={paginatedAttendance}
            pagination={attendancePagination}
            onPageChange={setAttendancePage}
            isLoading={isLoading}
            error={error}
            emptyTitle="No attendance records"
            emptyDescription={`No team member check-in records found for ${selectedDate}.`}
          />
        </div>
      )}

      {/* Tab 3: Team Leaves */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              {
                header: 'Employee',
                render: (row) => (
                  <span className="text-xs font-semibold text-slate-800">
                    {row.employeeName || row.employee?.fullName || 'Direct Report'}
                  </span>
                ),
              },
              {
                header: 'Leave Type',
                render: (row) => (
                  <span className="text-xs text-slate-700">{row.leaveTypeName || row.type || 'Leave'}</span>
                ),
              },
              {
                header: 'Schedule',
                render: (row) => (
                  <span className="text-xs text-slate-600">
                    {row.startDate} &rarr; {row.endDate} ({row.daysCount || row.totalDays || 1}d)
                  </span>
                ),
              },
              {
                header: 'Reason',
                render: (row) => (
                  <span className="text-xs text-slate-500 italic truncate max-w-xs block">
                    {row.reason || 'No reason provided'}
                  </span>
                ),
              },
              {
                header: 'Current Status',
                render: (row) => (
                  <Badge variant={row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                    {row.status}
                  </Badge>
                ),
              },
              {
                header: 'Submitted Date',
                render: (row) => {
                  const d = row.appliedDate || row.appliedAt || row.createdAt || row.created_at;
                  return (
                    <span className="text-xs text-slate-500 font-medium">
                      {d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    </span>
                  );
                },
              },
              {
                header: 'Action',
                className: 'text-right',
                render: (row) => {
                  const isSelf =
                    (user?.employeeId && row.employeeId === user.employeeId) ||
                    (user?.id && (row.requesterUserId === user.id || row.employee?.userId === user.id));

                  return (
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status === 'PENDING' && (
                        <>
                          {isSelf ? (
                            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 italic">
                              Self-request
                            </span>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                icon={CheckCircle2}
                                onClick={() => setApprovalAction({ isOpen: true, item: row, type: 'APPROVE' })}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={XCircle}
                                onClick={() => setApprovalAction({ isOpen: true, item: row, type: 'REJECT' })}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                },
              },
            ]}
            data={paginatedLeaves}
            pagination={leavePagination}
            onPageChange={setLeavePage}
            isLoading={isLoading}
            error={error}
            emptyTitle="No team leave requests"
            emptyDescription="All leave requests from your team have been processed."
          />
        </div>
      )}

      {/* Modals */}
      <TeamMemberDetailModal
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
      />

      <AssignManagerModal
        isOpen={Boolean(assigningMember)}
        onClose={() => setAssigningMember(null)}
        onSuccess={loadTabData}
        employee={assigningMember}
      />

      <ApprovalActionModal
        isOpen={approvalAction.isOpen}
        onClose={() => setApprovalAction({ isOpen: false, item: null, type: 'APPROVE' })}
        onSuccess={loadTabData}
        item={approvalAction.item}
        actionType={approvalAction.type}
        currentUser={user}
      />

      <AttendanceDetailModal
        isOpen={Boolean(selectedAttendanceDetail)}
        onClose={() => setSelectedAttendanceDetail(null)}
        record={selectedAttendanceDetail}
      />
    </div>
  );
};
