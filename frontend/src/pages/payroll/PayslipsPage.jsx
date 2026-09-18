import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Download,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { payrollService } from '../../services/payrollService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { PayslipDocument } from '../../components/payroll/PayslipDocument.jsx';
import { formatMoney } from '../../components/payroll/PayrollStatsCard.jsx';

export const PayslipsPage = () => {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetId = searchParams.get('id');

  const [payslipsList, setPayslipsList] = useState([]);
  const [selectedPayslipId, setSelectedPayslipId] = useState(targetId || null);
  const [selectedPayslipDetail, setSelectedPayslipDetail] = useState(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Load all available payslips for the authenticated employee
   */
  const fetchPayslips = useCallback(async () => {
    try {
      setError(null);
      const list = await payrollService.getMyPayslips();
      const safeList = Array.isArray(list) ? list : [];
      setPayslipsList(safeList);

      // Auto-select first payslip if none selected
      if (safeList.length > 0) {
        const toSelect = targetId && safeList.find((p) => (p.payslip_id || p.id) === targetId)
          ? targetId
          : (safeList[0].payslip_id || safeList[0].id);
        setSelectedPayslipId(toSelect);
      } else {
        setSelectedPayslipId(null);
        setSelectedPayslipDetail(null);
      }
    } catch (err) {
      console.error('Failed to load employee payslips:', err);
      setError(err.message || 'Unable to retrieve your payslips from the server.');
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  /**
   * Fetch full payslip details with itemized earnings & deductions whenever selected ID changes
   */
  useEffect(() => {
    if (!selectedPayslipId) {
      setSelectedPayslipDetail(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const detail = await payrollService.getMyPayslipById(selectedPayslipId);
        setSelectedPayslipDetail(detail);
      } catch (err) {
        console.error('Failed to load payslip detail:', err);
        toast?.error?.(err.message || 'Failed to fetch payslip details.');
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchDetail();
  }, [selectedPayslipId, toast]);

  const handleSelectPayslip = (p) => {
    const id = p.payslip_id || p.id;
    setSelectedPayslipId(id);
    setSearchParams({ id });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPayslips();
    toast?.success?.('Payslips refreshed.');
  };

  const handleDownloadCompleted = (downloadedId) => {
    // Increment local download count
    setPayslipsList((prev) =>
      prev.map((p) =>
        (p.payslip_id || p.id) === downloadedId
          ? { ...p, download_count: (p.download_count || 0) + 1 }
          : p
      )
    );
    if (selectedPayslipDetail && (selectedPayslipDetail.payslip_id || selectedPayslipDetail.id) === downloadedId) {
      setSelectedPayslipDetail((prev) => ({
        ...prev,
        download_count: (prev.download_count || 0) + 1,
      }));
    }
  };

  // Filtered list
  const filteredList = payslipsList.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const periodName = (p.period_name || p.periodName || '').toLowerCase();
    const periodCode = (p.period_code || p.periodCode || '').toLowerCase();
    const num = (p.payslip_number || p.payslipNumber || '').toLowerCase();
    return periodName.includes(q) || periodCode.includes(q) || num.includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/payroll"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Back to Payroll Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Salary Payslips</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                Self-Service
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Access and download official statements of earnings, deductions, and payment remittances.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            isLoading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <Alert
          type="error"
          title="Error Loading Payslips"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Main Content Area */}
      {loadingList ? (
        <div className="py-20">
          <LoadingSpinner message="Retrieving your published payslips..." />
        </div>
      ) : payslipsList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
          <EmptyState
            icon={FileText}
            title="No Payslips Published Yet"
            description="Your organization has not published any salary payslips for your account yet. Statements will appear here once processed and settled by HR/Finance."
            actionLabel="View Payroll Summary"
            onAction={() => window.location.assign('/payroll')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block print:w-full">
          {/* Left Column: Payslip Selector / List */}
          <div className="lg:col-span-4 space-y-3 print:hidden">
            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by period or payslip number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* List of Available Payslips */}
            <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
              {filteredList.map((ps) => {
                const id = ps.payslip_id || ps.id;
                const isSelected = id === selectedPayslipId;
                const status = ps.payslip_status || ps.status || 'PUBLISHED';
                const periodName = ps.period_name || ps.periodName || 'Payroll Period';
                const periodCode = ps.period_code || ps.periodCode || '';
                const netPay = ps.net_payable !== undefined ? ps.net_payable : ps.netPayable;
                const currency = ps.currency || 'INR';
                const issueDate = ps.issue_date || ps.issueDate;

                return (
                  <div
                    key={id}
                    onClick={() => handleSelectPayslip(ps)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-brand-50/70 border-brand-300 ring-2 ring-brand-500/20 shadow-sm'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{periodName}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          {periodCode || ps.payslip_number || ps.payslipNumber}
                        </div>
                      </div>
                      <Badge variant={status === 'PUBLISHED' || status === 'PAID' ? 'success' : 'neutral'}>
                        {status}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between mt-3 pt-2.5 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Net Pay
                        </span>
                        <span className="text-base font-black text-slate-900">
                          {formatMoney(netPay, currency)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-medium block">Issued</span>
                        <span className="text-xs text-slate-600 font-medium">
                          {issueDate ? new Date(issueDate).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredList.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 bg-white rounded-xl border border-slate-200 p-4">
                  No payslips matched "{searchQuery}".
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Full Payslip Document Viewer */}
          <div className="lg:col-span-8 print:w-full print:m-0 print:p-0">
            {loadingDetail ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16">
                <LoadingSpinner message="Rendering official payslip statement..." />
              </div>
            ) : selectedPayslipDetail ? (
              <PayslipDocument
                payslip={selectedPayslipDetail}
                onDownloadComplete={handleDownloadCompleted}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
                Select a payslip from the left list to view the full document.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
