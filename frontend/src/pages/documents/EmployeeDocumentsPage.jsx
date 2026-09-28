import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  FolderLock,
  RefreshCw,
  Search,
  Users,
  FileCheck,
  X,
  Shield,
  ChevronRight,
  ArrowLeft,
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
import { Avatar } from '../../components/common/Avatar.jsx';

export const EmployeeDocumentsPage = () => {
  const { hasRole, hasPermission, isAuthenticated } = useAuth();
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

  // Tab: 'all-employees' | 'my'
  const [activeTab, setActiveTab] = useState(canManageDocuments ? 'all-employees' : 'my');

  // Documents state
  const [myDocuments, setMyDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Employee Directory state
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedEmployeeDocs, setSelectedEmployeeDocs] = useState([]);
  const [loadingEmpDocs, setLoadingEmpDocs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all company documents (for high-level metrics)
  const fetchAllDocuments = useCallback(async (showRefreshing = false) => {
    if (!canManageDocuments) return;
    try {
      if (showRefreshing) setRefreshing(true);
      setError(null);
      const docs = await documentService.getAllDocuments();
      setAllDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Error fetching company documents:', err);
    } finally {
      setRefreshing(false);
    }
  }, [canManageDocuments]);

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

  // Fetch employee list for Directory
  const fetchEmployees = useCallback(async (showRefreshing = false) => {
    if (!canManageDocuments) return;
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoadingEmployees(true);
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
    } catch (err) {
      console.error('Error loading employees for document directory:', err);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
      setRefreshing(false);
    }
  }, [canManageDocuments]);

  // Fetch selected employee's documents
  const fetchSelectedEmployeeDocs = useCallback(async (empId) => {
    if (!empId) {
      setSelectedEmployeeDocs([]);
      return;
    }
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
    if (selectedEmployeeId) {
      fetchSelectedEmployeeDocs(selectedEmployeeId);
    }
  }, [selectedEmployeeId, fetchSelectedEmployeeDocs]);

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

  // Filtered employees list based on search term
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return safeEmployees;
    const term = searchTerm.toLowerCase();
    return safeEmployees.filter((emp) => {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const code = (emp.employeeCode || emp.employeeNumber || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const dept = (emp.department?.name || '').toLowerCase();
      const desig = (emp.designation?.title || '').toLowerCase();
      return (
        fullName.includes(term) ||
        code.includes(term) ||
        email.includes(term) ||
        dept.includes(term) ||
        desig.includes(term)
      );
    });
  }, [safeEmployees, searchTerm]);

  const selectedEmpObj = safeEmployees.find((e) => e.id === selectedEmployeeId);

  // Calculate statistics for current view
  const currentDocs =
    activeTab === 'my'
      ? myDocuments
      : selectedEmployeeId
      ? selectedEmployeeDocs
      : allDocuments;
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

  const complianceRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 100;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      {/* Premium Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-brand-50/50 via-slate-50/20 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-brand shrink-0 ring-4 ring-brand-50">
              <FolderLock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 font-display">
                  Employee Documents
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Safe &amp; Secure
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                View, upload, and verify employee documents like ID cards, certificates, and employment contracts.
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
                if (activeTab === 'my') {
                  fetchMyDocuments(true);
                } else if (selectedEmployeeId) {
                  fetchSelectedEmployeeDocs(selectedEmployeeId);
                } else {
                  fetchEmployees(true);
                  fetchAllDocuments(true);
                }
              }}
            >
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Role-Based Navigation Tabs (for HR / Admins) */}
      {canManageDocuments && (
        <div className="flex items-center">
          <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-inner">
            <button
              onClick={() => {
                setActiveTab('all-employees');
                setSelectedEmployeeId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'all-employees'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4 text-brand-600" />
              <span>All Employee Documents</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'all-employees'
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/50'
                    : 'bg-slate-300/60 text-slate-700'
                }`}
              >
                {employees.length}
              </span>
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
              {selectedEmployeeId ? 'Employee Files' : 'Total Documents'}
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
            Stored safely and securely
          </p>
        </div>

        {/* Verified & Approved */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-90" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Verified &amp; Approved
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
            Verified and approved
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
                Needs attention
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Waiting for review
          </p>
        </div>

        {/* Acknowledged */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500 opacity-90" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
              Signed &amp; Accepted
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
            Signed and accepted
          </p>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <Alert
          variant="danger"
          title="Document Error"
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
            Loading documents...
          </p>
          <p className="text-xs text-slate-400 mt-1">Please wait while we load your files</p>
        </div>
      ) : activeTab === 'my' ? (
        /* Employee's Own Document Vault */
        <DocumentVaultUploader
          documents={myDocuments}
          canUpload={true}
          canAcknowledge={true}
          canVerify={false}
          titlePrefix="My Documents"
          subtitle="Your identity proofs, certificates, and employment contracts."
          onDocumentsUpdated={() => fetchMyDocuments(true)}
        />
      ) : selectedEmployeeId ? (
        /* View That Employee's Documents View */
        <div className="space-y-5">
          {/* Selected Employee Breadcrumb / Navigation Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedEmployeeId(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 shadow-2xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                Back to Employee List
              </button>

              <span className="text-slate-300 hidden sm:inline">•</span>

              <div className="flex items-center gap-2.5">
                <Avatar
                  src={selectedEmpObj?.avatarUrl}
                  firstName={selectedEmpObj?.firstName}
                  lastName={selectedEmpObj?.lastName}
                  size="sm"
                  className="ring-1 ring-brand-200"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                    <span>{selectedEmpObj?.firstName} {selectedEmpObj?.lastName}</span>
                    {selectedEmpObj?.employeeCode && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {selectedEmpObj.employeeCode}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedEmpObj?.department?.name || 'General'} • {selectedEmpObj?.designation?.title || 'Staff'} • {selectedEmpObj?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="outline"
                size="xs"
                icon={RefreshCw}
                loading={loadingEmpDocs}
                onClick={() => fetchSelectedEmployeeDocs(selectedEmployeeId)}
              >
                Refresh Documents
              </Button>
            </div>
          </div>

          {/* Only this employee's documents */}
          {loadingEmpDocs ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center shadow-xs">
              <LoadingSpinner size="md" />
              <p className="text-xs font-semibold text-slate-600 mt-3 font-display">
                Loading {selectedEmpObj?.firstName || 'employee'}'s documents...
              </p>
            </div>
          ) : (
            <DocumentVaultUploader
              candidateId={null}
              documents={selectedEmployeeDocs}
              canUpload={true}
              canVerify={true}
              canAcknowledge={false}
              canDelete={true}
              titlePrefix={
                selectedEmpObj
                  ? `${selectedEmpObj.firstName} ${selectedEmpObj.lastName}'s Documents`
                  : 'Employee Documents'
              }
              subtitle="Review uploaded documents, approve or reject them, or upload new files."
              onUpload={async (formData) => {
                await documentService.uploadDocumentForOwner('EMPLOYEE', selectedEmployeeId, formData);
              }}
              onDocumentsUpdated={() => fetchSelectedEmployeeDocs(selectedEmployeeId)}
            />
          )}
        </div>
      ) : (
        /* All Employee Documents -> Employee List (Directory View) */
        <div className="space-y-4">
          {/* Search & Counter Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-600" />
                  All Employee Documents
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an employee to view, approve, and manage their uploaded documents.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by name, code, email, dept..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200/80 px-2.5 py-1.5 rounded-xl whitespace-nowrap">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
                </span>
              </div>
            </div>
          </div>

          {/* Employee Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loadingEmployees ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <LoadingSpinner size="md" />
                <p className="text-xs font-semibold text-slate-600 mt-3 font-display">
                  Loading employee directory...
                </p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700 font-display">
                  No employees found
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchTerm ? 'No employees matched your search.' : 'There are no active employee records.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Employee</th>
                      <th className="py-3.5 px-5">Department &amp; Designation</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={emp.avatarUrl}
                              firstName={emp.firstName}
                              lastName={emp.lastName}
                              size="md"
                              className="ring-1 ring-slate-200 group-hover:ring-brand-200 transition-all shrink-0"
                            />
                            <div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmployeeId(emp.id);
                                }}
                                className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors flex items-center gap-2 text-left cursor-pointer"
                              >
                                <span>{emp.firstName} {emp.lastName}</span>
                                {emp.employeeCode && (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {emp.employeeCode}
                                  </span>
                                )}
                              </button>
                              <div className="text-xs text-slate-400 mt-0.5">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-800">
                            {emp.department?.name || 'General'}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {emp.designation?.title || 'Staff'}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <Badge
                            variant={emp.status === 'Active' ? 'success' : emp.status === 'On Leave' ? 'warning' : 'neutral'}
                            size="sm"
                          >
                            {emp.status || 'Active'}
                          </Badge>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(emp.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100/80 border border-brand-200/60 shadow-2xs group-hover:bg-brand-600 group-hover:text-white transition-all cursor-pointer"
                          >
                            <span>View Documents</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDocumentsPage;
