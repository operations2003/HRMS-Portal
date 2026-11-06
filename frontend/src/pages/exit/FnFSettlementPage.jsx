import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Wallet,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  Download,
  Printer,
  ShieldCheck,
  AlertCircle,
  FileText,
  User,
  Building,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Filter,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exitService } from '../../services/exitService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { FnFStatementDocument } from '../../components/exit/FnFStatementDocument.jsx';
import { CalculateFnFModal } from '../../components/exit/CalculateFnFModal.jsx';
import { DisburseFnFModal } from '../../components/exit/DisburseFnFModal.jsx';

export const FnFSettlementPage = () => {
  const { user, hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetExitId = searchParams.get('exitId') || searchParams.get('id');

  const isHrOrAdmin =
    hasPermission('exit:admin') ||
    hasPermission('fnf:manage') ||
    hasRole(['Admin', 'SuperAdmin', 'HR']);

  // HR Master-Detail states
  const [exitsList, setExitsList] = useState([]);
  const [selectedExitId, setSelectedExitId] = useState(targetExitId || null);
  const [selectedExitDetail, setSelectedExitDetail] = useState(null);
  const [selectedFnf, setSelectedFnf] = useState(null);

  // Employee Self-Service states
  const [myExit, setMyExit] = useState(null);

  // Common UI states
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Operational Action Submodals
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  /**
   * Load data based on role
   */
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      if (isHrOrAdmin) {
        const res = await exitService.getAllExits({ limit: 100 });
        const items = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setExitsList(items);

        // Auto-select exit
        if (items.length > 0) {
          const toSelect = targetExitId && items.find((e) => e.id === targetExitId)
            ? targetExitId
            : items[0].id;
          setSelectedExitId(toSelect);
        } else {
          setSelectedExitId(null);
          setSelectedExitDetail(null);
          setSelectedFnf(null);
        }
      } else {
        // Employee self-service
        const exitData = await exitService.getMyExit();
        setMyExit(exitData);
      }
    } catch (err) {
      console.error('Failed to load FnF settlement records:', err);
      setError(err.message || 'Unable to retrieve settlement records from server.');
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, [isHrOrAdmin, targetExitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Fetch full details & FnF statement for selected exit (HR Mode)
   */
  useEffect(() => {
    if (!isHrOrAdmin || !selectedExitId) {
      setSelectedExitDetail(null);
      setSelectedFnf(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const [exitDetail, fnfData] = await Promise.all([
          exitService.getExitById(selectedExitId).catch(() => null),
          exitService.getFnf(selectedExitId).catch(() => null),
        ]);
        setSelectedExitDetail(exitDetail);
        setSelectedFnf(fnfData || exitDetail?.fnf || null);
      } catch (err) {
        console.error('Failed to load exit FnF detail:', err);
        toast?.error?.(err.message || 'Failed to fetch settlement details.');
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchDetail();
  }, [isHrOrAdmin, selectedExitId, toast]);

  const handleSelectExit = (exit) => {
    setSelectedExitId(exit.id);
    setSearchParams({ exitId: exit.id });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    toast?.success?.('Settlement records refreshed.');
  };

  // Operational Action Handlers
  const handleApproveConfirm = async () => {
    if (!selectedExitId) return;
    try {
      setIsApproving(true);
      setError(null);
      const updated = await exitService.approveFnf(selectedExitId, {
        notes: 'Full & Final settlement approved by HR/Finance authority.',
      });
      setSelectedFnf(updated);
      setIsApproveConfirmOpen(false);
      toast.success('FnF statement approved successfully. Signed slip generated in Document Vault.');
      // Refresh list to update badge
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to approve FnF settlement.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCalculated = (updatedFnf) => {
    setSelectedFnf(updatedFnf);
    fetchData();
  };

  const handleDisbursed = (updatedFnf) => {
    setSelectedFnf(updatedFnf);
    fetchData();
  };

  // Filtered Exits for HR Master List with defensive array guards
  const safeExitsList = Array.isArray(exitsList) ? exitsList : [];
  const filteredExits = safeExitsList.filter((e) => {
    const name = (e.employeeName || `${e.employee?.firstName || ''} ${e.employee?.lastName || ''}`).toLowerCase();
    const code = (e.employeeCode || e.employee?.employeeCode || '').toLowerCase();
    const dept = ((typeof e.department === 'object' ? e.department?.name : e.department) || (typeof e.employee?.department === 'object' ? e.employee?.department?.name : e.employee?.department) || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = !q || name.includes(q) || code.includes(q) || dept.includes(q);
    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'NEEDS_CALCULATION') return !e.fnf && e.currentStage !== 'COMPLETED';
    if (statusFilter === 'PENDING_APPROVAL') return e.fnf?.approvalStatus === 'PENDING';
    if (statusFilter === 'APPROVED') return e.fnf?.approvalStatus === 'APPROVED' && e.fnf?.paymentStatus !== 'DISBURSED';
    if (statusFilter === 'DISBURSED') return e.fnf?.paymentStatus === 'DISBURSED';
    return true;
  });

  // KPI Calculations
  const totalExitsCount = safeExitsList.length;
  const needsCalcCount = safeExitsList.filter((e) => !e.fnf && e.currentStage !== 'COMPLETED').length;
  const pendingApprovalCount = safeExitsList.filter((e) => e.fnf?.approvalStatus === 'PENDING').length;
  const disbursedCount = safeExitsList.filter((e) => e.fnf?.paymentStatus === 'DISBURSED').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/offboarding" className="hover:text-brand-600 transition-colors">
              Offboarding
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Settlement Processing</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#BF6649]" />
            Full & Final (FnF) Settlement
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isHrOrAdmin
              ? 'Reconcile salary dues, leave encashments, asset recoveries, and payment disbursals.'
              : 'Review your authorized Full & Final exit statement and payment reconciliation.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            isLoading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          {isHrOrAdmin && (
            <Link to="/offboarding">
              <Button variant="ghost" size="sm" icon={Layers}>
                Offboarding Command
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* HR OPERATIONAL VIEW */}
      {isHrOrAdmin ? (
        <div className="space-y-6">
          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total Exit Cases</span>
                <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <User className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{totalExitsCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">In offboarding lifecycle</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Needs Calculation</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-bold text-amber-600 mt-2">{needsCalcCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Awaiting initial figures</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Pending Approval</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-bold text-blue-600 mt-2">{pendingApprovalCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Ready for HR/Finance sign-off</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Disbursed & Closed</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-bold text-emerald-600 mt-2">{disbursedCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Payment transfer finalized</p>
            </div>
          </div>

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Master List (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-4">
              {/* Search & Filter */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employee or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'ALL', label: 'All' },
                    { key: 'NEEDS_CALCULATION', label: 'To Calc' },
                    { key: 'PENDING_APPROVAL', label: 'Pending' },
                    { key: 'APPROVED', label: 'Approved' },
                    { key: 'DISBURSED', label: 'Disbursed' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                        statusFilter === f.key
                          ? 'bg-[#BF6649] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* List of Exits */}
              {loadingList ? (
                <div className="py-12">
                  <LoadingSpinner message="Loading exit cases..." />
                </div>
              ) : filteredExits.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No matching exit records found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {filteredExits.map((item) => {
                    const isSelected = item.id === selectedExitId;
                    const empTitle =
                      item.employeeName ||
                      `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.trim() ||
                      'Employee';
                    const empCode = item.employeeCode || item.employee?.employeeCode || '—';
                    const lwd = item.approvedLastWorkingDay || item.requestedLastWorkingDay;
                    const hasFnf = !!item.fnf;
                    const approvalSt = item.fnf?.approvalStatus || (hasFnf ? 'CALCULATED' : 'NOT_CALCULATED');
                    const paymentSt = item.fnf?.paymentStatus || 'UNPAID';
                    const netAmt = parseFloat(item.fnf?.netSettlementAmount || 0);

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectExit(item)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                          isSelected
                            ? 'border-[#BF6649] bg-orange-50/40 shadow-sm'
                            : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-slate-900 leading-snug">
                              {empTitle}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {empCode} • {(typeof item.department === 'object' ? item.department?.name : item.department) || (typeof item.employee?.department === 'object' ? item.employee?.department?.name : item.employee?.department) || 'Operations'}
                            </p>
                          </div>
                          <Badge
                            size="sm"
                            variant={
                              paymentSt === 'DISBURSED'
                                ? 'success'
                                : approvalSt === 'APPROVED'
                                ? 'info'
                                : hasFnf
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {paymentSt === 'DISBURSED' ? 'Paid' : approvalSt === 'APPROVED' ? 'Approved' : hasFnf ? 'Calculated' : 'To Calc'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100/80 text-[11px] text-slate-500">
                          <span>
                            LWD: <strong className="text-slate-700">{lwd || '—'}</strong>
                          </span>
                          <span className="font-semibold text-slate-900">
                            {hasFnf ? `₹${netAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Detail Document View (8 cols) */}
            <div className="lg:col-span-8">
              {loadingDetail ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 flex items-center justify-center">
                  <LoadingSpinner message="Loading settlement statement details..." />
                </div>
              ) : selectedExitDetail ? (
                <FnFStatementDocument
                  fnf={selectedFnf}
                  exitRecord={selectedExitDetail}
                  canManage={true}
                  onCalculate={() => setIsCalcOpen(true)}
                  onApprove={() => setIsApproveConfirmOpen(true)}
                  onDisburse={() => setIsDisburseOpen(true)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center">
                  <EmptyState
                    icon={FileText}
                    title="No Exit Case Selected"
                    description="Select an employee exit record from the left list to view and manage their Full & Final settlement statement."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* EMPLOYEE SELF-SERVICE VIEW */
        <div className="space-y-6">
          {loadingList ? (
            <div className="py-20 flex items-center justify-center">
              <LoadingSpinner message="Retrieving your Full & Final settlement records..." />
            </div>
          ) : !myExit ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center max-w-2xl mx-auto shadow-sm">
              <EmptyState
                icon={Wallet}
                title="No Active Exit Settlement Record"
                description="You do not currently have an initiated exit or resignation request. Full & Final settlement statements are generated automatically during employee offboarding."
                action={
                  <Link to="/resignation">
                    <Button variant="primary" size="sm">
                      Go to Resignation Screen
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : !myExit.fnf ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 max-w-3xl mx-auto shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
                <Clock className="w-6 h-6 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Settlement Computation in Progress</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your exit request is active ({myExit.currentStage || 'NOTICE_PERIOD'}). The Finance and HR departments are
                    currently compiling your payable days, unutilized leave balance, and clearances to finalize your settlement slip.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Last Working Day:</span>
                  <strong className="text-slate-900">
                    {myExit.approvedLastWorkingDay || myExit.requestedLastWorkingDay || '—'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Exit Lifecycle Status:</span>
                  <Badge variant="info">{myExit.status}</Badge>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Department Clearance:</span>
                  <Link to="/exit-checklist" className="text-brand-600 hover:underline font-semibold">
                    View Clearance Tasks →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <FnFStatementDocument
              fnf={myExit.fnf}
              exitRecord={myExit}
              canManage={false}
            />
          )}
        </div>
      )}

      {/* Operational Modal: Calculate / Adjust FnF */}
      {isCalcOpen && selectedExitDetail && (
        <CalculateFnFModal
          isOpen={isCalcOpen}
          onClose={() => setIsCalcOpen(false)}
          exitRequestId={selectedExitId}
          employeeName={selectedExitDetail.employeeName || selectedExitDetail.employee?.fullName || 'Employee'}
          initialFnf={selectedFnf}
          clearanceRecoveryTotal={parseFloat(selectedExitDetail?.clearancesSummary?.totalRecoveryAmount || 0)}
          onCalculated={handleCalculated}
        />
      )}

      {/* Operational Modal: Disburse Settlement */}
      {isDisburseOpen && selectedExitDetail && (
        <DisburseFnFModal
          isOpen={isDisburseOpen}
          onClose={() => setIsDisburseOpen(false)}
          exitRequestId={selectedExitId}
          employeeName={selectedExitDetail.employeeName || selectedExitDetail.employee?.fullName || 'Employee'}
          netAmount={selectedFnf?.netSettlementAmount || 0}
          onDisbursed={handleDisbursed}
        />
      )}

      {/* Confirmation Dialog: Approve Settlement */}
      <ConfirmDialog
        isOpen={isApproveConfirmOpen}
        onClose={() => setIsApproveConfirmOpen(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Full & Final Statement?"
        message={`Confirm approval of the Full & Final settlement for ${
          selectedExitDetail?.employeeName || 'this employee'
        }? A signed copy will be issued to Document Vault, and payment disbursement will be unlocked.`}
        confirmText="Approve Settlement"
        confirmVariant="primary"
        isLoading={isApproving}
      />
    </div>
  );
};
