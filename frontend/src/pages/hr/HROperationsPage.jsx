import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Megaphone,
  UserCheck,
  Clock,
  CalendarDays,
  Award,
  RefreshCw,
  Search,
  Eye,
  Building2,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { hrOperationsService } from '../../services/hrOperationsService.js';
import { employeeService } from '../../services/employeeService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { HROperationsOverviewCards } from '../../components/hr/HROperationsOverviewCards.jsx';
import { EmployeeDossierModal } from '../../components/hr/EmployeeDossierModal.jsx';
import { BroadcastAnnouncementModal } from '../../components/hr/BroadcastAnnouncementModal.jsx';

export const HROperationsPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [overview, setOverview] = useState({});
  const [teams, setTeams] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [leaveSummary, setLeaveSummary] = useState({});
  const [allEmployees, setAllEmployees] = useState([]);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'attendance' | 'leaves' | 'employees'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendanceSummary();
    } else if (activeTab === 'leaves') {
      loadLeaveSummary();
    } else if (activeTab === 'employees' && allEmployees.length === 0) {
      loadEmployees();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      setIsRefreshing(true);
      const [ovRes, tRes] = await Promise.allSettled([
        hrOperationsService.getOverview(),
        hrOperationsService.getTeams(),
      ]);

      if (ovRes.status === 'fulfilled') {
        setOverview(ovRes.value || {});
      }
      if (tRes.status === 'fulfilled') {
        const t = tRes.value;
        setTeams(t.items || t.teams || (Array.isArray(t) ? t : []));
      }
    } catch (err) {
      toast.error('Failed to load HR operations overview.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadAttendanceSummary = async () => {
    try {
      const res = await hrOperationsService.getAttendanceSummary();
      setAttendanceSummary(res || {});
    } catch (err) {
      toast.error('Failed to load attendance summary.');
    }
  };

  const loadLeaveSummary = async () => {
    try {
      const res = await hrOperationsService.getLeaveSummary();
      setLeaveSummary(res || {});
    } catch (err) {
      toast.error('Failed to load leave summary.');
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await employeeService.getAllEmployees({ limit: 100 });
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      setAllEmployees(list);
    } catch (err) {
      toast.error('Failed to load employee list.');
    }
  };

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
            <p className="text-[11px] text-slate-400">{row.departmentName || row.department || 'Department'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Team Size',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.memberCount ?? row.teamSize ?? row.totalMembers ?? 0} direct reports
        </span>
      ),
    },
    {
      header: 'Attendance Check-in',
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
      header: 'Pending Actions',
      render: (row) => {
        const count = row.pendingLeaves ?? row.pendingApprovals ?? 0;
        return (
          <Badge variant={count > 0 ? 'warning' : 'neutral'} size="sm">
            {count} pending
          </Badge>
        );
      },
    },
  ];

  const employeeColumns = [
    {
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
            {(row.fullName || row.firstName || 'E').charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-xs">
              {row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim()}
            </p>
            <p className="text-[11px] text-slate-400">{row.email || 'N/A'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department / Title',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-slate-800">{row.designation?.name || 'Staff'}</p>
          <p className="text-[11px] text-slate-400">{row.department?.name || 'Department'}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
          {row.status || 'Active'}
        </Badge>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={Eye}
          onClick={() => setSelectedEmployeeId(row.id)}
        >
          View 360° Dossier
        </Button>
      ),
    },
  ];

  const filteredEmployees = allEmployees.filter((e) => {
    const q = searchEmployeeQuery.toLowerCase();
    const name = (e.fullName || `${e.firstName || ''} ${e.lastName || ''}`).toLowerCase();
    const email = (e.email || '').toLowerCase();
    const dept = (e.department?.name || '').toLowerCase();
    return name.includes(q) || email.includes(q) || dept.includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            HR Operations Cockpit
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Workforce intelligence, manager oversight, operational health metrics, and emergency broadcasts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={loadInitialData}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={Megaphone}
            onClick={() => setIsBroadcastOpen(true)}
          >
            Broadcast Announcement
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <HROperationsOverviewCards stats={overview} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Manager Teams ({teams.length})
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
          Organization Attendance
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
          Leave Utilization
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'employees'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Employee 360° Dossiers
        </button>
      </div>

      {/* Tab 1: Teams */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <DataTable
            columns={teamColumns}
            data={teams}
            isLoading={isLoading}
            emptyTitle="No manager teams found"
            emptyDescription="There are currently no manager teams registered in the organization."
          />
        </div>
      )}

      {/* Tab 2: Attendance */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-emerald-700 block">Overall Present</span>
              <h3 className="text-2xl font-bold text-emerald-900 mt-1">
                {attendanceSummary.presentToday ?? attendanceSummary.presentCount ?? overview.presentToday ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-amber-700 block">Late Arrivals</span>
              <h3 className="text-2xl font-bold text-amber-900 mt-1">
                {attendanceSummary.lateToday ?? attendanceSummary.lateCount ?? 0}
              </h3>
            </div>
            <div className="p-4 bg-rose-50/70 border border-rose-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-rose-700 block">Absent Today</span>
              <h3 className="text-2xl font-bold text-rose-900 mt-1">
                {attendanceSummary.absentToday ?? attendanceSummary.absentCount ?? 0}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Leaves */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-blue-700 block">Approved Leaves This Month</span>
              <h3 className="text-2xl font-bold text-blue-900 mt-1">
                {leaveSummary.approvedThisMonth ?? 12}
              </h3>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <span className="text-xs uppercase font-semibold text-amber-700 block">Pending Leaves Across Teams</span>
              <h3 className="text-2xl font-bold text-amber-900 mt-1">
                {leaveSummary.pendingCount ?? overview.pendingLeaves ?? 0}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Employee Dossiers */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee by name, email, or dept..."
              value={searchEmployeeQuery}
              onChange={(e) => setSearchEmployeeQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <DataTable
            columns={employeeColumns}
            data={filteredEmployees}
            isLoading={allEmployees.length === 0 && isLoading}
            emptyTitle="No employees found"
            emptyDescription="No employees match your search query."
          />
        </div>
      )}

      {/* Broadcast Announcement Modal */}
      <BroadcastAnnouncementModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        onSuccess={loadInitialData}
      />

      {/* Employee Dossier Modal */}
      <EmployeeDossierModal
        isOpen={Boolean(selectedEmployeeId)}
        onClose={() => setSelectedEmployeeId(null)}
        employeeId={selectedEmployeeId}
      />
    </div>
  );
};
