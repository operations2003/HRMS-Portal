import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  FileText,
  UserCheck,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { requestService } from '../../services/requestService.js';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { CreateRequestModal } from '../../components/requests/CreateRequestModal.jsx';
import {
  RequestDetailModal,
  getRequestStatusBadge,
  formatRequestType,
} from '../../components/requests/RequestDetailModal.jsx';

const REQUEST_TYPE_FILTERS = [
  { value: '', label: 'All Request Types' },
  { value: 'DOCUMENT_REQUEST', label: 'Document Requests' },
  { value: 'HR_REQUEST', label: 'HR Inquiries' },
  { value: 'PAYROLL_CLARIFICATION', label: 'Payroll Queries' },
  { value: 'EMPLOYEE_SERVICE', label: 'Employee Services' },
  { value: 'OTHER', label: 'Other Requests' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const EmployeeRequestsPage = () => {
  const { user, hasPermission, hasRole, isAuthenticated } = useAuth();
  const toast = useToast();

  const canManageRequests =
    hasPermission('request:manage') ||
    hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  const isAuthorized =
    isAuthenticated &&
    (canManageRequests ||
      hasPermission('request:read') ||
      hasRole(['Employee', 'Manager']));

  // Tab: 'my' | 'all' (HR/Admin)
  const [activeTab, setActiveTab] = useState(canManageRequests ? 'all' : 'my');

  // Requests state
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch requests
  const fetchRequests = useCallback(
    async (isBackground = false) => {
      try {
        if (isBackground) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const params = {};
        if (typeFilter) params.requestType = typeFilter;
        if (statusFilter) params.status = statusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        let data = [];
        if (activeTab === 'all' && canManageRequests) {
          data = await requestService.listRequests(params);
        } else {
          data = await requestService.getMyRequests(params);
        }

        setRequests(Array.isArray(data) ? data : []);

        try {
          const s = await requestService.getStats();
          setStats(s);
        } catch {
          // ignore
        }
      } catch (err) {
        console.error('Failed to load employee requests:', err);
        setError(err.message || 'Failed to retrieve service requests.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, canManageRequests, typeFilter, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenDetail = (id) => {
    setSelectedRequestId(id);
    setIsDetailModalOpen(true);
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Alert
          variant="danger"
          title="Access Restricted"
          message="You do not have permission to access the employee service request portal."
        />
      </div>
    );
  }

  // Filter requests locally if search query is present
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const num = (r.requestNumber || '').toLowerCase();
    const sub = (r.subject || '').toLowerCase();
    const emp = (r.requester?.fullName || '').toLowerCase();
    return num.includes(q) || sub.includes(q) || emp.includes(q);
  });

  // Table Columns per Prompt 5:
  // Display: employee, request type, subject, status, created date, updated date, resolution where available
  const columns = [
    {
      header: 'Request #',
      key: 'requestNumber',
      accessor: (row) => (
        <button
          onClick={() => handleOpenDetail(row.id)}
          className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-mono hover:underline focus:outline-hidden"
        >
          {row.requestNumber}
        </button>
      ),
    },
    {
      header: 'Employee',
      key: 'employee',
      accessor: (row) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white text-xs">
            {row.requester?.fullName || 'Employee'}
          </p>
          <p className="text-[11px] text-slate-400">
            {row.requester?.department || 'Staff'}
          </p>
        </div>
      ),
    },
    {
      header: 'Request Type',
      key: 'requestType',
      accessor: (row) => (
        <Badge variant="secondary">{formatRequestType(row.requestType)}</Badge>
      ),
    },
    {
      header: 'Subject',
      key: 'subject',
      accessor: (row) => (
        <div className="max-w-xs sm:max-w-md">
          <p className="font-medium text-slate-900 dark:text-white truncate">
            {row.subject}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      accessor: (row) => getRequestStatusBadge(row.status),
    },
    {
      header: 'Resolution',
      key: 'resolution',
      accessor: (row) =>
        row.responseNotes ? (
          <div className="max-w-xs truncate text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            {row.responseNotes}
          </div>
        ) : row.rejectionReason ? (
          <div className="max-w-xs truncate text-xs text-rose-600 dark:text-rose-400">
            Rejected: {row.rejectionReason}
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">Pending</span>
        ),
    },
    {
      header: 'Created Date',
      key: 'createdAt',
      accessor: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Updated Date',
      key: 'updatedAt',
      accessor: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(row.updatedAt || row.createdAt).toLocaleDateString()}
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
  const totalRequests = stats?.total ?? requests.length;
  const pendingCount =
    stats?.pending ?? requests.filter((r) => r.status === 'PENDING').length;
  const inProgressCount =
    stats?.in_progress ?? stats?.inProgress ?? requests.filter((r) => r.status === 'IN_PROGRESS').length;
  const resolvedCount =
    stats?.resolved ?? requests.filter((r) => r.status === 'RESOLVED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Employee Service Requests
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Submit letters, salary certificates, policy questions, and track resolution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchRequests(true)}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Request
          </Button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
              Total Requests
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {totalRequests}
          </div>
          <p className="text-xs text-slate-400 mt-1">Recorded service requests</p>
        </div>

        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {pendingCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Awaiting review</p>
        </div>

        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-brand-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              In Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-display">
            {inProgressCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Being fulfilled</p>
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
          <p className="text-xs text-slate-400 mt-1">Successfully fulfilled</p>
        </div>
      </div>

      {/* Tabs (HR / Admin) */}
      {canManageRequests && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Requests (HR Management)
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'my'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            My Submitted Requests
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search request #, subject, employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            >
              {REQUEST_TYPE_FILTERS.map((opt) => (
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
              {STATUS_FILTERS.map((opt) => (
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
          title="Error Loading Requests"
          message={error}
          action={
            <Button size="xs" variant="outline" onClick={() => fetchRequests()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredRequests}
        isLoading={loading}
        emptyTitle="No service requests found"
        emptyDescription={
          searchQuery || typeFilter || statusFilter
            ? 'Try altering your search query or filter selection.'
            : activeTab === 'my'
            ? 'You have not submitted any service requests yet.'
            : 'No service requests found in the current queue.'
        }
      />

      {/* Create Request Modal */}
      <CreateRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRequestCreated={() => fetchRequests(true)}
      />

      {/* Request Detail Modal */}
      <RequestDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        requestId={selectedRequestId}
        onRequestUpdated={() => fetchRequests(true)}
      />
    </div>
  );
};

export default EmployeeRequestsPage;
