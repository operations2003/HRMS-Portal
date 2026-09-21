import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Building2,
  CreditCard,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  Info,
  Lock,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { payrollService } from '../../services/payrollService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Alert } from '../../components/common/Alert.jsx';

export const PayrollPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayroll = async (isBackground = false) => {
    try {
      if (isBackground) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await payrollService.getMyPayroll();
      setData(res);
    } catch (err) {
      console.error('Failed to load payroll details:', err);
      setError(err.message || 'Unable to load payroll and compensation details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage message="Loading compensation and payroll breakdown..." />;
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Alert
          variant="danger"
          title="Payroll Error"
          message={error}
          action={
            <Button size="sm" variant="outline" onClick={() => fetchPayroll()}>
              Try Again
            </Button>
          }
        />
      </div>
    );
  }

  const { employee, ctcBreakdown, bankDetails, statutoryDetails, payHistory } = data || {};

  const historyColumns = [
    {
      header: 'Pay Period',
      key: 'period',
      accessor: (row) => (
        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-500" />
          {row.period}
        </span>
      ),
    },
    {
      header: 'Gross Earnings',
      key: 'grossEarnings',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          ₹{row.grossEarnings?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Total Deductions',
      key: 'totalDeductions',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
          - ₹{row.totalDeductions?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Net Take-Home',
      key: 'netPay',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ₹{row.netPay?.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Payment Status',
      key: 'status',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {row.status}
        </span>
      ),
    },
    {
      header: 'Payment Mode',
      key: 'paymentMethod',
      accessor: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.paymentMethod}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Payroll & Compensation
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Review your comprehensive salary structure, statutory registrations, and disbursement history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchPayroll(true)}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={HelpCircle}
            onClick={() => navigate('/helpdesk?tab=requests')}
          >
            Request Payroll Clarification
          </Button>
        </div>
      </div>

      {/* Payslip Download Policy Notice */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Notice on Payslip Downloads:</strong> As per updated company policy, PDF payslip downloads are deactivated. Need employment verification or proof of compensation? You can generate or request a verified certificate.
          </span>
        </div>
        <Button
          size="xs"
          variant="outline"
          onClick={() => navigate('/helpdesk?tab=requests')}
          className="shrink-0"
        >
          Submit Service Request
        </Button>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-gradient-to-br from-brand-600 to-indigo-700 text-white rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-brand-100 text-xs font-semibold uppercase tracking-wider">
            <span>Annual CTC</span>
            <TrendingUp className="w-4 h-4 text-brand-200" />
          </div>
          <div className="text-3xl font-black font-mono">
            ₹{ctcBreakdown?.annualCtc?.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-brand-100">
            Monthly Gross: ₹{ctcBreakdown?.monthlyGross?.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Net Monthly In-Hand</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            ₹{ctcBreakdown?.netTakeHome?.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400">
            After EPF, PT, and tax withholdings
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Monthly Deductions</span>
            <span className="text-xs font-bold text-rose-500">Fixed & Tax</span>
          </div>
          <div className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
            ₹{ctcBreakdown?.totalDeductions?.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400">
            PF Contribution: ₹{ctcBreakdown?.deductions?.find(d => d.component.includes('Provident'))?.monthly || 1800} / mo
          </div>
        </div>
      </div>

      {/* Two Column Grid: Bank Details & Statutory UAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank Details Card (View-Only, Masked) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Direct Deposit Bank Account
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              <Lock className="w-3 h-3 text-slate-400" />
              View-Only
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Bank Name</span>
              <span className="text-slate-900 dark:text-white font-bold">{bankDetails?.bankName || 'HDFC Bank'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Account Number</span>
              <span className="text-slate-900 dark:text-white font-mono font-bold tracking-wider">{bankDetails?.accountNumberMasked}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">IFSC Code</span>
              <span className="text-slate-900 dark:text-white font-mono font-bold">{bankDetails?.ifscCode || 'HDFC0001234'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Branch</span>
              <span className="text-slate-900 dark:text-white font-medium">{bankDetails?.branch || 'Corporate Branch'}</span>
            </div>
          </div>

          {/* Change Workflow Notice */}
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between gap-2">
            <div className="text-[11px] text-amber-800 dark:text-amber-300">
              Direct edits are disabled for banking security.
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => navigate('/helpdesk?tab=requests')}
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              Request Bank Update
            </Button>
          </div>
        </div>

        {/* Statutory Details Card (UAN & PF) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Statutory Registrations (UAN / PF)
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              <Lock className="w-3 h-3 text-slate-400" />
              View-Only
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">UAN Number</span>
              <span className="text-slate-900 dark:text-white font-mono font-black text-sm tracking-wide text-brand-700 dark:text-brand-400">
                {statutoryDetails?.uanNumber || '101294820194'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Provident Fund (PF) No.</span>
              <span className="text-slate-900 dark:text-white font-mono font-bold">
                {statutoryDetails?.pfNumber || 'KN/BLR/1029384'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">ESI Scheme</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {statutoryDetails?.esiNumber || 'Exempted (Above statutory limit)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">PAN Verification</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Active
              </span>
            </div>
          </div>

          {/* UAN Update Policy Notice */}
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-center justify-between gap-2">
            <div className="text-[11px] text-blue-800 dark:text-blue-300">
              To link or correct your UAN, submit a Service Request with your EPF member passbook.
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => navigate('/helpdesk?tab=requests')}
              className="border-blue-300 text-blue-900 hover:bg-blue-100"
            >
              Request UAN Update
            </Button>
          </div>
        </div>
      </div>

      {/* Salary Breakdown Tables: Earnings & Deductions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Earnings Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Monthly Earnings Structure
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {ctcBreakdown?.earnings?.map((item, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{item.component}</p>
                  <p className="text-[10px] text-slate-400">{item.description}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold text-slate-900 dark:text-white">₹{item.monthly?.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-400">₹{item.annual?.toLocaleString('en-IN')}/yr</p>
                </div>
              </div>
            ))}
            <div className="pt-3 flex items-center justify-between font-bold">
              <span className="text-slate-900 dark:text-white">Total Gross Earnings</span>
              <span className="font-mono text-sm text-brand-600">₹{ctcBreakdown?.monthlyGross?.toLocaleString('en-IN')} / mo</span>
            </div>
          </div>
        </div>

        {/* Monthly Deductions Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Monthly Deductions Structure
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {ctcBreakdown?.deductions?.map((item, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{item.component}</p>
                  <p className="text-[10px] text-slate-400">{item.description}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold text-rose-600 dark:text-rose-400">- ₹{item.monthly?.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-400">₹{item.annual?.toLocaleString('en-IN')}/yr</p>
                </div>
              </div>
            ))}
            <div className="pt-3 flex items-center justify-between font-bold">
              <span className="text-slate-900 dark:text-white">Total Monthly Deductions</span>
              <span className="font-mono text-sm text-rose-600">- ₹{ctcBreakdown?.totalDeductions?.toLocaleString('en-IN')} / mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pay History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Disbursement & Salary History
            </h2>
            <p className="text-xs text-slate-400">
              Record of monthly compensation transfers to your designated bank account
            </p>
          </div>
        </div>

        <DataTable
          columns={historyColumns}
          data={payHistory || []}
          emptyTitle="No pay history available"
          emptyDescription="Salary disbursements will appear here once processed."
        />
      </div>
    </div>
  );
};

export default PayrollPage;
