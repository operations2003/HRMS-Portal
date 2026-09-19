import React, { useState, useEffect, useCallback } from 'react';
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

  // Tab: 'my' | 'directory' (for HR/Admin)
  const [activeTab, setActiveTab] = useState('my');

  // Documents state
  const [myDocuments, setMyDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // HR/Admin directory view state
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeDocs, setSelectedEmployeeDocs] = useState([]);
  const [loadingEmpDocs, setLoadingEmpDocs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      fetchEmployees();
    }
  }, [canManageDocuments, fetchEmployees]);

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
  const currentDocs = activeTab === 'my' ? myDocuments : selectedEmployeeDocs;
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

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const filteredEmployees = safeEmployees.filter((emp) => {
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''} ${emp.email || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const selectedEmpObj = safeEmployees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Employee Document Vault
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Secure enterprise vault for identification, compliance records, and contracts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => {
              if (activeTab === 'my') {
                fetchMyDocuments(true);
              } else if (selectedEmployeeId) {
                fetchSelectedEmployeeDocs(selectedEmployeeId);
              }
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Role-Based Tabs (for HR / Admins) */}
      {canManageDocuments && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'my'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            My Documents
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'directory'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Employee Vaults (HR Admin)
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Documents
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Uploaded to secure vault</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Verified & Approved
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {approvedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Compliance verified</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending Review
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {pendingCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Awaiting HR review</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Acknowledged
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {acknowledgedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">Receipt acknowledged</p>
        </div>
      </div>

      {/* Error state */}
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

      {/* Main Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">
            Loading your secure documents...
          </p>
        </div>
      ) : activeTab === 'my' ? (
        /* Employee's Own Document Vault */
        <DocumentVaultUploader
          documents={myDocuments}
          canUpload={true}
          canAcknowledge={true}
          canVerify={false}
          titlePrefix="My Document Vault"
          subtitle="Your personal identity verification documents, compliance submissions, and contracts."
          onDocumentsUpdated={() => fetchMyDocuments(true)}
        />
      ) : (
        /* HR/Admin Employee Directory Vault View */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-600" />
                  Select Employee Vault
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review, approve, or reject employee documents across departments.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                >
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber || emp.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loadingEmpDocs ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <LoadingSpinner size="md" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                Loading employee documents...
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
