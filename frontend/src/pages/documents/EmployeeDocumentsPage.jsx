import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderLock,
  RefreshCw,
  Search,
  UserCheck,
  ShieldCheck,
  Users,
  ShieldAlert,
  FileCheck,
  Filter,
  X,
  Sparkles,
  Shield,
  Layers,
  ChevronRight,
  User,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { documentService } from '../../services/documentService.js';
import { employeeService } from '../../services/employeeService.js';
import { DocumentVaultUploader } from '../../components/onboarding/DocumentVaultUploader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';

export const EmployeeDocumentsPage = () => {
  const { user, hasRole, hasPermission, isAuthenticated } = useAuth();
  const toast = useToast();

  const canManageDocuments =
    hasPermission('document:manage') ||
    hasPermission('document:write') ||
    hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  const isAuthorized =
    isAuthenticated &&
    (canManageDocuments ||
      hasPermission('document:read') ||
      hasPermission('employee:read') ||
      hasRole(['Employee', 'Manager']));

  // Tab: 'all' | 'directory' | 'my'
  const [activeTab, setActiveTab] = useState(canManageDocuments ? 'all' : 'my');

  // Documents state
  const [myDocuments, setMyDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllDocs, setLoadingAllDocs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters for organization documents
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [allSearchTerm, setAllSearchTerm] = useState('');

  // HR/Admin directory view state
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeDocs, setSelectedEmployeeDocs] = useState([]);
  const [loadingEmpDocs, setLoadingEmpDocs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all organization documents for HR/Admin
  const fetchAllDocuments = useCallback(async (showRefreshing = false) => {
    if (!canManageDocuments) return;
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoadingAllDocs(true);
      setError(null);

      const docs = await documentService.getAllDocuments({
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        verificationStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: allSearchTerm || undefined,
      });
      setAllDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Error fetching company documents:', err);
      toast.showError(err.message || 'Failed to retrieve company documents.');
    } finally {
      setLoadingAllDocs(false);
      setRefreshing(false);
    }
  }, [canManageDocuments, categoryFilter, statusFilter, allSearchTerm, toast]);

  // Fetch current user's documents
  const fetchMyDocuments = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const docs = await documentService.getMyDocuments();
      setMyDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Error fetching employee documents:', err);
      setError(err.message || 'Failed to retrieve your authorized documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch employee list for HR/Admin
  const fetchEmployees = useCallback(async () => {
    if (!canManageDocuments) return;
    try {
      const res = await employeeService.listEmployees({ limit: 100 });
      const empList = Array.isArray(res?.employees)
        ? res.employees
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];
      setEmployees(empList);
      if (empList.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(empList[0].id);
      }
    } catch (err) {
      console.error('Error loading employees for document management:', err);
      setEmployees([]);
    }
  }, [canManageDocuments, selectedEmployeeId]);

  // Fetch selected employee's documents for HR/Admin
  const fetchSelectedEmployeeDocs = useCallback(async (empId) => {
    if (!empId) return;
    try {
      setLoadingEmpDocs(true);
      const docs = await documentService.getDocumentsByOwner('EMPLOYEE', empId);
      setSelectedEmployeeDocs(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Error loading selected employee docs:', err);
      toast.showError(err.message || 'Failed to load employee documents.');
      setSelectedEmployeeDocs([]);
    } finally {
      setLoadingEmpDocs(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMyDocuments();
  }, [fetchMyDocuments]);

  useEffect(() => {
    if (canManageDocuments) {
      fetchAllDocuments();
      fetchEmployees();
    }
  }, [canManageDocuments, fetchAllDocuments, fetchEmployees]);

  useEffect(() => {
    if (activeTab === 'directory' && selectedEmployeeId) {
      fetchSelectedEmployeeDocs(selectedEmployeeId);
    }
  }, [activeTab, selectedEmployeeId, fetchSelectedEmployeeDocs]);

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Alert
          variant="danger"
          title="Access Denied"
          message="You do not have permission to view this document repository. Please contact your HR administrator."
        />
      </div>
    );
  }

  // Calculate statistics for current view with defensive array guards
  const currentDocs =
    activeTab === 'all'
      ? allDocuments
      : activeTab === 'directory'
      ? selectedEmployeeDocs
      : myDocuments;
  const safeCurrentDocs = Array.isArray(currentDocs) ? currentDocs : [];
  const totalCount = safeCurrentDocs.length;
  const approvedCount = safeCurrentDocs.filter((d) => d.verificationStatus === 'APPROVED').length;
  const pendingCount = safeCurrentDocs.filter(
    (d) => !d.verificationStatus || d.verificationStatus === 'PENDING'
  ).length;
  const acknowledgedCount = safeCurrentDocs.filter((d) => {
    const acks = d.acknowledgementLog || d.acknowledgement_log || [];
    return Array.isArray(acks) && acks.length > 0;
  }).length;
  const rejectedCount = safeCurrentDocs.filter((d) => d.verificationStatus === 'REJECTED').length;

  const complianceRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 100;

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const filteredEmployees = safeEmployees.filter((emp) => {
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''} ${emp.email || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const selectedEmpObj = safeEmployees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      {/* Premium Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-brand-50/50 via-slate-50/20 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-brand shrink-0 ring-4 ring-brand-50">
              <FolderLock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 font-display">
                  Enterprise Document Vault
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Encrypted Binary Storage
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Centralized cloud repository for verified identities, employee contracts, regulatory compliance records, and digital acknowledgements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              className="bg-white hover:bg-slate-50 border-slate-200 shadow-2xs font-medium text-slate-700 text-xs px-3.5 py-2 rounded-xl transition-all"
              onClick={() => {
                if (activeTab === 'all') {
                  fetchAllDocuments(true);
                } else if (activeTab === 'my') {
                  fetchMyDocuments(true);
                } else if (selectedEmployeeId) {
                  fetchSelectedEmployeeDocs(selectedEmployeeId);
                }
              }}
            >
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Role-Based Segmented Navigation Tabs (for HR / Admins) */}
      {canManageDocuments && (
        <div className="flex items-center">
          <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-inner">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-4 h-4 text-brand-600" />
              <span>All Company Documents</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'all'
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/50'
                    : 'bg-slate-300/60 text-slate-700'
                }`}
              >
                {allDocuments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'directory'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span>By Employee Vault</span>
            </button>

            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'my'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>My Personal Documents</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'my'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50'
                    : 'bg-slate-300/60 text-slate-700'
                }`}
              >
                {myDocuments.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modern Executive Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-indigo-500 opacity-90" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Documents
            </span>
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-brand-100 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
              {totalCount}
            </span>
            <span className="text-xs font-medium text-slate-400">files</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
            Uploaded to secure database vault
          </p>
        </div>

        {/* Verified & Approved */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-90" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Verified & Approved
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
              {approvedCount}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              {complianceRate}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Compliance checks passed
          </p>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-90" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Pending Review
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-100 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
              {pendingCount}
            </span>
            {pendingCount > 0 && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md animate-pulse">
                Action required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Awaiting verification & sign-off
          </p>
        </div>

        {/* Acknowledged */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500 opacity-90" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
              Acknowledged
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center ring-1 ring-sky-100 group-hover:scale-105 transition-transform">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
              {acknowledgedCount}
            </span>
            <span className="text-xs font-medium text-slate-400">signed</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Digital receipt acknowledged
          </p>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <Alert
          variant="danger"
          title="Document Vault Error"
          message={error}
          action={
            <Button size="xs" variant="outline" onClick={() => fetchMyDocuments()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center shadow-xs">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-semibold text-slate-700 mt-4 font-display">
            Loading secure document vault...
          </p>
          <p className="text-xs text-slate-400 mt-1">Verifying encrypted signatures and database records</p>
        </div>
      ) : activeTab === 'all' ? (
        /* HR / Admin: Organization-Wide Document Repository */
        <div className="space-y-5">
          {/* Sleek Filter & Search Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Quick Status Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
                  Status:
                </span>
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({allDocuments.length})
                </button>
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Pending Review ({pendingCount})
                </button>
                <button
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'APPROVED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('REJECTED')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'REJECTED'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Rejected ({rejectedCount})
                </button>
              </div>

              {/* Search & Category Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by title or employee..."
                    value={allSearchTerm}
                    onChange={(e) => setAllSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                  />
                  {allSearchTerm && (
                    <button
                      onClick={() => setAllSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Dropdown */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-2xs cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  <option value="IDENTITY">Identity (Passport, PAN, Aadhaar)</option>
                  <option value="OFFER">Offer & Contracts</option>
                  <option value="EDUCATION">Educational Certificates</option>
                  <option value="EXPERIENCE">Experience Letters</option>
                  <option value="TAX">Tax Forms</option>
                  <option value="MEDICAL">Medical & Fitness</option>
                  <option value="OTHER">Other Documents</option>
                </select>

                {(allSearchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={X}
                    className="text-slate-500 hover:text-slate-800 text-xs px-2.5 py-2 rounded-xl"
                    onClick={() => {
                      setAllSearchTerm('');
                      setCategoryFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Documents Table / Card Container */}
          {loadingAllDocs ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center shadow-xs">
              <LoadingSpinner size="md" />
              <p className="text-xs font-semibold text-slate-600 mt-3 font-display">
                Filtering company documents...
              </p>
            </div>
          ) : (
            <DocumentVaultUploader
              candidateId={null}
              documents={allDocuments}
              canUpload={false}
              canVerify={true}
              canAcknowledge={false}
              titlePrefix="Company Document Repository"
              subtitle="All documents uploaded across organization departments with real-time verification and compliance controls."
              onDocumentsUpdated={() => fetchAllDocuments(true)}
            />
          )}
        </div>
      ) : activeTab === 'my' ? (
        /* Employee's Own Document Vault */
        <DocumentVaultUploader
          documents={myDocuments}
          canUpload={true}
          canAcknowledge={true}
          canVerify={false}
          titlePrefix="My Document Vault"
          subtitle="Your personal identity verification documents, compliance submissions, and signed employment contracts."
          onDocumentsUpdated={() => fetchMyDocuments(true)}
        />
      ) : (
        /* HR / Admin: Employee Directory Vault View */
        <div className="space-y-5">
          {/* Employee Directory Selector Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-100">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    Select Employee Vault
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review specific employee files, verify submitted certificates, or upload contracts directly.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search employee list..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                </div>

                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs cursor-pointer"
                >
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber || emp.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Employee Info Banner */}
            {selectedEmpObj && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center">
                    {selectedEmpObj.firstName?.[0] || 'E'}
                    {selectedEmpObj.lastName?.[0] || ''}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {selectedEmpObj.firstName} {selectedEmpObj.lastName}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {selectedEmpObj.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {selectedEmpObj.department?.name && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      Dept: {selectedEmpObj.department.name}
                    </span>
                  )}
                  {selectedEmpObj.designation?.title && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                      {selectedEmpObj.designation.title}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {loadingEmpDocs ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center shadow-xs">
              <LoadingSpinner size="md" />
              <p className="text-xs font-semibold text-slate-600 mt-3 font-display">
                Loading employee document vault...
              </p>
            </div>
          ) : (
            <DocumentVaultUploader
              candidateId={null}
              documents={selectedEmployeeDocs}
              canUpload={true}
              canVerify={true}
              canAcknowledge={false}
              titlePrefix={
                selectedEmpObj
                  ? `${selectedEmpObj.firstName} ${selectedEmpObj.lastName}'s Document Vault`
                  : 'Employee Document Vault'
              }
              subtitle="Review verification status, verify submitted proofs, or upload employer-issued contracts."
              onUpload={async (formData) => {
                await documentService.uploadDocumentForOwner('EMPLOYEE', selectedEmployeeId, formData);
              }}
              onDocumentsUpdated={() => fetchSelectedEmployeeDocs(selectedEmployeeId)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeDocumentsPage;
