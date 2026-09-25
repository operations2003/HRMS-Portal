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
  FileText,
  Download,
  Check,
  X,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { teamService } from '../../services/teamService.js';
import { managerService } from '../../services/managerService.js';
import { departmentService } from '../../services/departmentService.js';
import { documentService } from '../../services/documentService.js';
import { getDocumentLabel } from '../../constants/documentTypes.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { TeamMemberDetailModal } from '../../components/team/TeamMemberDetailModal.jsx';
import { AssignManagerModal } from '../../components/team/AssignManagerModal.jsx';
import { ApprovalActionModal } from '../../components/approvals/ApprovalActionModal.jsx';
import { AttendanceDetailModal } from '../../components/attendance/AttendanceDetailModal.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { Avatar } from '../../components/common/Avatar.jsx';

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

  // Team Documents State
  const [teamDocuments, setTeamDocuments] = useState([]);
  const [pendingDocCount, setPendingDocCount] = useState(0);
  const [docPage, setDocPage] = useState(1);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState('ALL');
  const [docCategoryFilter, setDocCategoryFilter] = useState('ALL');
  const [rejectModalDoc, setRejectModalDoc] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isVerifyingDoc, setIsVerifyingDoc] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState(null);

  useEffect(() => {
    if (isAuthorized) {
      loadDepartments();
      loadPendingDocCount();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadTabData();
    } else {
      setIsLoading(false);
    }
  }, [
    activeTab,
    selectedDate,
    selectedDept,
    selectedStatus,
    attendanceStatusFilter,
    docSearchQuery,
    docStatusFilter,
    docCategoryFilter,
    isAuthorized,
  ]);

  const loadDepartments = async () => {
    try {
      const res = await departmentService.getAllDepartments();
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      setDepartments(list);
    } catch {
      // Non-blocking
    }
  };

  const loadPendingDocCount = async () => {
    try {
      const res = await teamService.getTeamDocuments({ status: 'PENDING' });
      const list = Array.isArray(res) ? res : (res?.data || []);
      setPendingDocCount(list.length);
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
      } else if (activeTab === 'documents') {
        const docs = await teamService.getTeamDocuments({
          search: docSearchQuery || undefined,
          status: docStatusFilter !== 'ALL' ? docStatusFilter : undefined,
          category: docCategoryFilter !== 'ALL' ? docCategoryFilter : undefined,
        });
        const docList = Array.isArray(docs) ? docs : (docs?.data || []);
        setTeamDocuments(docList);
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
            <Avatar
              src={row.avatarUrl}
              name={name}
              firstName={row.firstName}
              lastName={row.lastName}
              size="md"
              className="ring-1 ring-slate-200"
            />
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
      render: (row) => {
        const isAdminOrCeo =
          row.roleName === 'Admin' ||
          row.user?.roleName === 'Admin' ||
          row.designation?.title === 'CEO' ||
          row.email === 'sheetalbedi@tasknera.com';
        const desig = isAdminOrCeo
          ? 'CEO'
          : (typeof row.designation === 'object' ? (row.designation?.title || row.designation?.name) : row.designation) || row.designationTitle || row.jobTitle || 'Staff';
        const dept = isAdminOrCeo
          ? 'Main'
          : (typeof row.department === 'object' ? row.department?.name : row.department) || row.departmentName || 'Department';
        return (
          <div>
            <p className="text-xs font-medium text-slate-800">{desig}</p>
            <p className="text-[11px] text-slate-400">{dept}</p>
          </div>
        );
      },
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
            <Avatar
              src={row.avatarUrl || row.employee?.avatarUrl}
              name={name}
              size="sm"
              className="ring-1 ring-slate-200"
            />
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

  // Document Actions
  const handleApproveDoc = async (doc) => {
    try {
      setIsVerifyingDoc(true);
      await teamService.verifyTeamDocument(doc.id, { verificationStatus: 'VERIFIED' });
      toast.success(`Approved "${doc.title}".`);
      setPendingDocCount((prev) => Math.max(0, prev - 1));
      loadTabData();
    } catch (err) {
      toast.error(err.message || 'Failed to approve document.');
    } finally {
      setIsVerifyingDoc(false);
    }
  };

  const handleRejectDoc = async () => {
    if (!rejectModalDoc) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter or select a rejection reason.');
      return;
    }
    try {
      setIsVerifyingDoc(true);
      await teamService.verifyTeamDocument(rejectModalDoc.id, {
        verificationStatus: 'REJECTED',
        rejectionReason: rejectReason.trim(),
      });
      toast.success(`Rejected "${rejectModalDoc.title}".`);
      setPendingDocCount((prev) => Math.max(0, prev - 1));
      setRejectModalDoc(null);
      setRejectReason('');
      loadTabData();
    } catch (err) {
      toast.error(err.message || 'Failed to reject document.');
    } finally {
      setIsVerifyingDoc(false);
    }
  };

  const handlePreviewDoc = async (doc) => {
    try {
      const { blob, contentType } = await documentService.getDocumentBlob(doc.id);
      const blobUrl = window.URL.createObjectURL(blob);
      setPreviewDocModal({
        doc,
        blobUrl,
        contentType,
        isImage: (contentType || doc.mimeType || '').startsWith('image/'),
        isPdf: (contentType || doc.mimeType || '').includes('pdf'),
      });
    } catch (err) {
      documentService.downloadDocument(doc.id, doc.title);
    }
  };

  const QUICK_DOC_REJECTION_REASONS = [
    'Blurry or difficult to read',
    'Document has expired',
    'Name does not match profile',
    'Missing signature or official stamp',
    'Incomplete pages or cut-off corners',
  ];

  const totalDocPages = Math.ceil(teamDocuments.length / pageSize) || 1;
  const paginatedDocs = teamDocuments.slice((docPage - 1) * pageSize, docPage * pageSize);
  const docPagination = {
    page: docPage,
    totalPages: totalDocPages,
    totalItems: teamDocuments.length,
    pageSize,
  };

  const documentColumns = [
    {
      header: 'Team Member',
      render: (row) => {
        const name = row.employeeName || `${row.employeeFirstName || ''} ${row.employeeLastName || ''}`.trim() || 'Team Member';
        const code = row.employeeCode || row.ownerId?.slice(0, 8);
        const dept = row.departmentName || 'Team';
        return (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.avatarUrl || row.employeeAvatar}
              name={name}
              size="sm"
              className="ring-1 ring-brand-200"
            />
            <div>
              <p className="font-semibold text-slate-800 text-xs">{name}</p>
              <p className="text-[11px] text-slate-400">
                {dept} • <span className="font-mono">ID: {code}</span>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Document Name & Category',
      render: (row) => {
        const catLabel = getDocumentLabel(row.documentType || row.category);
        return (
          <div>
            <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              {row.title}
            </p>
            <span className="inline-block mt-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {catLabel}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Uploaded On',
      render: (row) => {
        const dateStr = row.createdAt
          ? new Date(row.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Recent';
        return <span className="text-xs text-slate-600 font-medium">{dateStr}</span>;
      },
    },
    {
      header: 'Status',
      render: (row) => {
        const st = (row.verificationStatus || 'PENDING').toUpperCase();
        if (st === 'VERIFIED' || st === 'APPROVED') {
          return (
            <Badge variant="success" size="sm">
              Approved
            </Badge>
          );
        }
        if (st === 'REJECTED') {
          return (
            <div>
              <Badge variant="danger" size="sm">
                Rejected
              </Badge>
              {row.rejectionReason && (
                <p className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate" title={row.rejectionReason}>
                  {row.rejectionReason}
                </p>
              )}
            </div>
          );
        }
        return (
          <Badge variant="warning" size="sm">
            Pending Review
          </Badge>
        );
      },
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => {
        const st = (row.verificationStatus || 'PENDING').toUpperCase();
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              icon={Eye}
              title="View Document"
              onClick={() => handlePreviewDoc(row)}
            >
              View
            </Button>
            <Button
              size="xs"
              variant="ghost"
              icon={Download}
              title="Download Document"
              onClick={() => documentService.downloadDocument(row.id, row.title)}
            >
              Download
            </Button>

            {st === 'PENDING' ? (
              <>
                <Button
                  size="xs"
                  variant="success"
                  icon={CheckCircle2}
                  disabled={isVerifyingDoc}
                  onClick={() => handleApproveDoc(row)}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  icon={XCircle}
                  disabled={isVerifyingDoc}
                  onClick={() => {
                    setRejectModalDoc(row);
                    setRejectReason('');
                  }}
                >
                  Reject
                </Button>
              </>
            ) : (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  if (st === 'VERIFIED' || st === 'APPROVED') {
                    setRejectModalDoc(row);
                    setRejectReason('');
                  } else {
                    handleApproveDoc(row);
                  }
                }}
              >
                {st === 'VERIFIED' || st === 'APPROVED' ? 'Reject' : 'Approve'}
              </Button>
            )}
          </div>
        );
      },
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
            Team Management
          </h1>
          <p className="text-sm text-slate-500">
            View your team members, check daily attendance, review leaves, and check documents.
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
          Team Members ({members.length})
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
          Attendance ({attendance.length})
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
          Leaves ({safeLeaves.filter((l) => l.status === 'PENDING').length} Pending)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Team Documents ({pendingDocCount > 0 ? `${pendingDocCount} Pending` : teamDocuments.length})
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

      {/* Tab 4: Team Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Filters toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by member name or title..."
                value={docSearchQuery}
                onChange={(e) => {
                  setDocSearchQuery(e.target.value);
                  setDocPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Quick Status and Category Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Dropdown */}
              <select
                value={docCategoryFilter}
                onChange={(e) => {
                  setDocCategoryFilter(e.target.value);
                  setDocPage(1);
                }}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ALL">All Categories</option>
                <option value="IDENTITY">ID Proof</option>
                <option value="OFFER">Offer Letter & Contract</option>
                <option value="EDUCATION">Education Certificates</option>
                <option value="EXPERIENCE">Experience Letters</option>
                <option value="TAX">Tax Documents</option>
                <option value="MEDICAL">Medical Certificates</option>
                <option value="OTHER">Other Documents</option>
              </select>

              {/* Status Buttons */}
              <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setDocStatusFilter('ALL');
                    setDocPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    docStatusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocStatusFilter('PENDING');
                    setDocPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    docStatusFilter === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  Pending Review ({pendingDocCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocStatusFilter('VERIFIED');
                    setDocPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    docStatusFilter === 'VERIFIED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocStatusFilter('REJECTED');
                    setDocPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    docStatusFilter === 'REJECTED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  Rejected
                </button>
              </div>

              {(docSearchQuery || docStatusFilter !== 'ALL' || docCategoryFilter !== 'ALL') && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setDocSearchQuery('');
                    setDocStatusFilter('ALL');
                    setDocCategoryFilter('ALL');
                    setDocPage(1);
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Documents Table */}
          <DataTable
            columns={documentColumns}
            data={paginatedDocs}
            pagination={docPagination}
            onPageChange={setDocPage}
            isLoading={isLoading}
            error={error}
            emptyTitle="No team documents found"
            emptyDescription="Documents uploaded by your team members will appear here for verification."
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

      {/* Document Rejection Modal */}
      <Modal
        isOpen={Boolean(rejectModalDoc)}
        onClose={() => {
          setRejectModalDoc(null);
          setRejectReason('');
        }}
        title="Reject Document"
        subtitle={`Please give a reason for rejecting "${rejectModalDoc?.title || 'this document'}".`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Quick Reasons (click to select)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DOC_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left ${
                    rejectReason === reason
                      ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              placeholder="Explain why this document is being rejected..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRejectModalDoc(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isVerifyingDoc}
              onClick={handleRejectDoc}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Preview Modal */}
      {previewDocModal && (
        <Modal
          isOpen={Boolean(previewDocModal)}
          onClose={() => {
            if (previewDocModal.blobUrl) window.URL.revokeObjectURL(previewDocModal.blobUrl);
            setPreviewDocModal(null);
          }}
          title={previewDocModal.doc.title || 'Document Preview'}
          subtitle={previewDocModal.doc.employeeName ? `Uploaded by ${previewDocModal.doc.employeeName}` : ''}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 min-h-[350px] max-h-[550px] flex items-center justify-center p-2">
              {previewDocModal.isImage ? (
                <img
                  src={previewDocModal.blobUrl}
                  alt={previewDocModal.doc.title}
                  className="max-h-[500px] w-auto mx-auto object-contain rounded"
                />
              ) : previewDocModal.isPdf ? (
                <iframe
                  src={previewDocModal.blobUrl}
                  title={previewDocModal.doc.title}
                  className="w-full h-[500px] rounded"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Preview not available for this file type</p>
                  <p className="text-xs text-slate-400 mt-1">Please download the file to view its contents.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => documentService.downloadDocument(previewDocModal.doc.id, previewDocModal.doc.title)}
              >
                Download Document
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (previewDocModal.blobUrl) window.URL.revokeObjectURL(previewDocModal.blobUrl);
                  setPreviewDocModal(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
