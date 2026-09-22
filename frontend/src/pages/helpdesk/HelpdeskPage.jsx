import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  MessageSquare,
  Users,
  ShieldCheck,
  Building2,
  FileQuestion,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { helpdeskService } from '../../services/helpdeskService.js';
import { EmployeeRequestsPage } from '../requests/EmployeeRequestsPage.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { CreateTicketModal } from '../../components/helpdesk/CreateTicketModal.jsx';
import {
  TicketDetailModal,
  getTicketStatusBadge,
  getTicketPriorityBadge,
} from '../../components/helpdesk/TicketDetailModal.jsx';

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'HR', label: 'HR Inquiries' },
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'LEAVE_ATTENDANCE', label: 'Leave & Attendance' },
  { value: 'DOCUMENT', label: 'Documents' },
  { value: 'IT_SUPPORT', label: 'IT Support' },
  { value: 'GENERAL', label: 'General' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const HelpdeskPage = () => {
  const navigate = useNavigate();
  const { id, ticketId, requestId } = useParams();
  const { user, hasPermission, hasRole, isAuthenticated } = useAuth();
  const toast = useToast();

  const canManageHelpdesk =
    hasPermission('helpdesk:manage') ||
    hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  const isAuthorized =
    isAuthenticated &&
    (canManageHelpdesk ||
      hasPermission('helpdesk:read') ||
      hasRole(['Employee', 'Manager']));

  const [searchParams, setSearchParams] = useSearchParams();
  const routeTicketId = ticketId || id;
  const routeRequestId = requestId;
  const queryTicketId = searchParams.get('ticket') || searchParams.get('ticketId') || searchParams.get('id');
  const queryRequestId = searchParams.get('requestId') || searchParams.get('request');
  const targetTicketId = routeTicketId || queryTicketId;
  const targetRequestId = routeRequestId || queryRequestId;

  const urlTab = searchParams.get('tab');
  const [mainSection, setMainSection] = useState(
    targetRequestId || urlTab === 'requests' || urlTab === 'service' ? 'requests' : 'tickets'
  );

  // Tab: 'my' | 'all' (only for HR/Admin)
  const [activeTab, setActiveTab] = useState(canManageHelpdesk ? 'all' : 'my');

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (targetTicketId) {
      setSelectedTicketId(targetTicketId);
      setIsDetailModalOpen(true);
      setMainSection('tickets');
    } else if (targetRequestId) {
      setMainSection('requests');
    } else {
      const tab = searchParams.get('tab');
      if (tab === 'requests' || tab === 'service') {
        setMainSection('requests');
      } else if (tab === 'tickets') {
        setMainSection('tickets');
      }
    }
  }, [targetTicketId, targetRequestId, searchParams]);

  const handleSectionSwitch = (sec) => {
    setMainSection(sec);
    setSearchParams({ tab: sec });
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedTicketId(null);
    if (routeTicketId) {
      navigate('/helpdesk', { replace: true });
    } else if (queryTicketId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('ticket');
      nextParams.delete('ticketId');
      nextParams.delete('id');
      setSearchParams(nextParams, { replace: true });
    }
  };
  const handleCloseDetail = handleCloseDetailModal;

  // Fetch Tickets
  const fetchTickets = useCallback(
    async (isBackground = false) => {
      try {
        if (isBackground) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const params = {};
        if (categoryFilter) params.category = categoryFilter;
        if (statusFilter) params.status = statusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        let data = [];
        if (activeTab === 'all' && canManageHelpdesk) {
          data = await helpdeskService.listTickets(params);
        } else {
          data = await helpdeskService.getMyTickets(params);
        }

        setTickets(Array.isArray(data) ? data : []);

        // Also fetch stats in background
        try {
          const s = await helpdeskService.getStats();
          setStats(s);
        } catch {
          // Non-blocking
        }
      } catch (err) {
        console.error('Error fetching tickets:', err);
        setError(err.message || 'Failed to retrieve helpdesk tickets.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, canManageHelpdesk, categoryFilter, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleOpenDetail = (ticketId) => {
    setSelectedTicketId(ticketId);
    setIsDetailModalOpen(true);
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Alert
          variant="danger"
          title="Access Restricted"
          message="You do not have permission to access the employee helpdesk portal."
        />
      </div>
    );
  }

  // Filter tickets locally for search term if needed
  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesNumber = (t.ticketNumber || '').toLowerCase().includes(query);
    const matchesSubject = (t.subject || '').toLowerCase().includes(query);
    const matchesRequester = (t.requester?.fullName || '').toLowerCase().includes(query);
    return matchesNumber || matchesSubject || matchesRequester;
  });

  // Table Columns
  const columns = [
    {
      header: 'Ticket #',
      key: 'ticketNumber',
      accessor: (row) => (
        <button
          onClick={() => handleOpenDetail(row.id)}
          className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-mono hover:underline focus:outline-hidden"
        >
          {row.ticketNumber}
        </button>
      ),
    },
    ...(activeTab === 'all'
      ? [
          {
            header: 'Requester',
            key: 'requester',
            accessor: (row) => (
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-xs">
                  {row.requester?.fullName || 'Employee'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {(typeof row.requester?.department === 'object' ? row.requester?.department?.name : row.requester?.department) || 'Staff'}
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      header: 'Category',
      key: 'category',
      accessor: (row) => <Badge variant="secondary">{row.category}</Badge>,
    },
    {
      header: 'Subject',
      key: 'subject',
      accessor: (row) => (
        <div className="max-w-xs sm:max-w-md">
          <p className="font-medium text-slate-900 dark:text-white truncate">
            {row.subject}
          </p>
          {row.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <MessageSquare className="w-3 h-3" /> {row.commentCount}{' '}
              {row.commentCount === 1 ? 'reply' : 'replies'}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Priority',
      key: 'priority',
      accessor: (row) => getTicketPriorityBadge(row.priority),
    },
    {
      header: 'Status',
      key: 'status',
      accessor: (row) => getTicketStatusBadge(row.status),
    },
    ...(activeTab === 'all'
      ? [
          {
            header: 'Assigned To',
            key: 'assignedTo',
            accessor: (row) => (
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {row.assignee?.fullName || row.assignedTeam || (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </span>
            ),
          },
        ]
      : []),
    {
      header: 'Created',
      key: 'createdAt',
      accessor: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      key: 'actions',
      className: 'text-right',
      accessor: (row) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={() => handleOpenDetail(row.id)}
        >
          View
        </Button>
      ),
    },
  ];

  // Stats calculation
  const totalTickets = stats?.total ?? tickets.length;
  const openCount =
    stats?.open ?? tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount =
    stats?.in_progress ?? stats?.inProgress ?? tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount =
    stats?.resolved ?? tickets.filter((t) => t.status === 'RESOLVED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Primary Section Switcher: Support Tickets vs Service Requests */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => handleSectionSwitch('tickets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mainSection === 'tickets'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Support Tickets</span>
        </button>

        <button
          type="button"
          onClick={() => handleSectionSwitch('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mainSection === 'requests'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Service Requests (Bank / UAN / Docs)</span>
        </button>
      </div>

      {mainSection === 'requests' ? (
        <EmployeeRequestsPage isEmbedded initialRequestId={targetRequestId} />
      ) : (
        <>
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Helpdesk & Support Tickets
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Submit requests, track ticket status, and collaborate with HR & IT support.
                </p>
              </div>
            </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchTickets(true)}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Open Ticket
          </Button>
        </div>
      </div>

      {/* Overview Statistics Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
              Total Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {totalTickets}
          </div>
          <p className="text-xs text-slate-400 mt-1">Logged in system</p>
        </div>

        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Open Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {openCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Awaiting review</p>
        </div>

        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              In Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {inProgressCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Currently being handled</p>
        </div>

        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Resolved
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {resolvedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Successfully closed</p>
        </div>
      </div>

      {/* Tabs (for HR / Support staff) */}
      {canManageHelpdesk && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Tickets (HR & Support)
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'my'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            My Submitted Tickets
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by ticket #, subject, or requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            >
              {CATEGORY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert
          variant="danger"
          title="Failed to Load Tickets"
          message={error}
          action={
            <Button size="xs" variant="outline" onClick={() => fetchTickets()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Tickets Table */}
      <DataTable
        columns={columns}
        data={filteredTickets}
        isLoading={loading}
        emptyTitle="No tickets found"
        emptyDescription={
          searchQuery || categoryFilter || statusFilter
            ? 'Try changing your search keywords or filter criteria.'
            : activeTab === 'my'
            ? 'You have not submitted any helpdesk requests yet.'
            : 'No tickets currently assigned or pending in this queue.'
        }
      />

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTicketCreated={() => fetchTickets(true)}
      />

      {/* Ticket Detail & Thread Modal */}
      <TicketDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        ticketId={selectedTicketId}
        onTicketUpdated={() => fetchTickets(true)}
      />
    </>
  )}
    </div>
  );
};

export default HelpdeskPage;
