import React, { useState } from 'react';
import {
  Printer,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Building2,
  Calendar,
  Wallet,
  ShieldCheck,
  Send,
  Edit3,
} from 'lucide-react';
import { TaskNeraLogo } from '../common/TaskNeraLogo.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { numberToWordsIndian } from '../../utils/numberToWords.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Format date to DD/MM/YYYY
 */
const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

/**
 * Format currency with 2 decimals (INR standard)
 */
const formatAmount = (val) => {
  if (val === undefined || val === null || isNaN(val) || val === '') return '0.00';
  const num = Number(val);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * FnFStatementDocument
 * Matches the official TaskNera PayslipDocument design & aesthetics for Full & Final Settlement
 */
export const FnFStatementDocument = ({
  fnf,
  exitRecord = null,
  canManage = false,
  onCalculate = null,
  onApprove = null,
  onDisburse = null,
  className = '',
}) => {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!fnf) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/70">
        <FileText className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No FnF Settlement Calculated</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          The Full & Final settlement statement for this employee has not been computed yet.
        </p>
        {canManage && onCalculate && (
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            icon={Edit3}
            onClick={onCalculate}
          >
            Compute FnF Settlement Now
          </Button>
        )}
      </div>
    );
  }

  // Employee details from exitRecord or nested fnf
  const emp = exitRecord?.employee || exitRecord || {};
  const empName =
    emp.employeeName ||
    emp.fullName ||
    `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
    fnf.employeeName ||
    'Employee';
  const empCode = emp.employeeCode || emp.code || fnf.employeeCode || fnf.employeeId || '—';
  const empDept = emp.department || emp.departmentName || '—';
  const empDesig = emp.designation || emp.designationTitle || '—';
  const doj = emp.dateOfJoining || emp.doj;

  const lwd = fnf.lastWorkingDay || exitRecord?.approvedLastWorkingDay || exitRecord?.requestedLastWorkingDay;
  const settlementDate = fnf.settlementDate || (fnf.createdAt ? fnf.createdAt.split('T')[0] : null);

  // Bank & Identification details (with fallbacks if in profile)
  const bankName = emp.bankName || 'HDFC Bank';
  const bankAccountNo = emp.bankAccountNumber ? `••••${emp.bankAccountNumber.slice(-4)}` : '••••••••4172';
  const panNumber = emp.panNumber || 'ABCDE1234F';

  // Calculations & Figures
  const dailyRate = parseFloat(fnf.dailyRate) || 0;
  const payableDays = parseFloat(fnf.payableDays) || 0;
  const salaryPayable = parseFloat(fnf.salaryPayable) || 0;
  const leaveEncashmentDays = parseFloat(fnf.leaveEncashmentDays) || 0;
  const leaveEncashmentAmount = parseFloat(fnf.leaveEncashmentAmount) || 0;
  const bonusGratuity = parseFloat(fnf.bonusGratuity) || 0;
  const otherAllowances = parseFloat(fnf.otherAllowances) || 0;
  const reimbursements = parseFloat(fnf.reimbursements) || 0;

  // Gross Earnings
  const grossPayable =
    parseFloat(fnf.grossPayable) ||
    salaryPayable + leaveEncashmentAmount + bonusGratuity + otherAllowances + reimbursements;

  // Deductions & Recoveries
  const noticePeriodRecovery = parseFloat(fnf.noticePeriodRecovery) || 0;
  const assetRecoveryDeduction = parseFloat(fnf.assetRecoveryDeduction) || 0;
  const taxDeduction = parseFloat(fnf.taxDeduction) || 0;
  const otherDeductions = parseFloat(fnf.otherDeductions) || 0;

  const totalDeductions =
    noticePeriodRecovery + assetRecoveryDeduction + taxDeduction + otherDeductions;

  // Net Settlement Amount
  const netSettlementAmount =
    fnf.netSettlementAmount !== undefined
      ? parseFloat(fnf.netSettlementAmount)
      : Math.max(0, grossPayable - totalDeductions);

  // Statuses
  const approvalStatus = (fnf.approvalStatus || 'PENDING').toUpperCase();
  const paymentStatus = (fnf.paymentStatus || 'DRAFT').toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      window.print();
      setDownloading(false);
      toast.success('FnF statement ready for download/print.');
    }, 400);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm print:hidden">
        <div className="flex items-center gap-2.5">
          <Badge
            variant={
              approvalStatus === 'APPROVED'
                ? 'success'
                : approvalStatus === 'REJECTED'
                ? 'danger'
                : 'warning'
            }
          >
            Approval: {approvalStatus}
          </Badge>
          <Badge
            variant={
              paymentStatus === 'DISBURSED'
                ? 'success'
                : paymentStatus === 'APPROVED'
                ? 'info'
                : paymentStatus === 'ON_HOLD'
                ? 'danger'
                : 'neutral'
            }
          >
            Payment: {paymentStatus}
          </Badge>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Ref: {fnf.id ? `FNF-${fnf.id.slice(-8).toUpperCase()}` : '—'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              {approvalStatus !== 'APPROVED' && onCalculate && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Edit3}
                  onClick={onCalculate}
                >
                  Adjust Figures
                </Button>
              )}

              {approvalStatus !== 'APPROVED' && onApprove && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={ShieldCheck}
                  onClick={onApprove}
                >
                  Approve FnF
                </Button>
              )}

              {approvalStatus === 'APPROVED' && paymentStatus !== 'DISBURSED' && onDisburse && (
                <Button
                  variant="success"
                  size="sm"
                  icon={Wallet}
                  onClick={onDisburse}
                >
                  Disburse Payment
                </Button>
              )}
            </>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={Printer}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            isLoading={downloading}
            onClick={handleDownload}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Official FnF Settlement Document */}
      <div
        id="official-fnf-document"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-12 text-slate-900 print:border-0 print:shadow-none print:p-0 print:m-0 w-full max-w-4xl mx-auto"
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header: Brand Logo, Company Name, Official Subtitle */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4">
            <TaskNeraLogo variant="icon" size="lg" colorScheme="terracotta" className="w-14 h-14 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#BF6649] flex items-center gap-1 leading-none">
                <span className="text-slate-900">Task</span>
                <span>Nera</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-semibold tracking-wide uppercase mt-1">
                Full & Final Settlement Statement
              </p>
              <p className="text-[11px] text-slate-400 italic">
                Official employee offboarding dues and recovery reconciliation
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs font-mono font-medium text-slate-500 block">
              Doc Ref: {fnf.id ? `FNF-${fnf.id.slice(-8).toUpperCase()}` : '—'}
            </span>
            <span className="text-xs text-slate-500">
              Settlement Date: <strong className="text-slate-700">{formatDateDDMMYYYY(settlementDate)}</strong>
            </span>
          </div>
        </div>

        {/* Terracotta Horizontal Divider */}
        <div className="border-t-[2px] border-[#C0664B] w-full my-4" />

        {/* Employee & Employment Details Grid (4 Columns) */}
        <div className="w-full overflow-x-auto my-4">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[13px]">
            <tbody>
              {/* Row 1: Employee Name & ID */}
              <tr className="border-b border-slate-300">
                <td className="w-[20%] bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Employee Name
                </td>
                <td className="w-[30%] px-3 py-2 text-slate-900 font-semibold border-r border-slate-300">
                  {empName}
                </td>
                <td className="w-[20%] bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Employee Code
                </td>
                <td className="w-[30%] px-3 py-2 text-slate-900 font-mono">
                  {empCode}
                </td>
              </tr>

              {/* Row 2: Designation & Department */}
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Designation
                </td>
                <td className="px-3 py-2 text-slate-900 border-r border-slate-300">
                  {empDesig}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Department
                </td>
                <td className="px-3 py-2 text-slate-900">
                  {empDept}
                </td>
              </tr>

              {/* Row 3: Joining Date & Last Working Day */}
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Date of Joining
                </td>
                <td className="px-3 py-2 text-slate-900 border-r border-slate-300">
                  {formatDateDDMMYYYY(doj)}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Last Working Day
                </td>
                <td className="px-3 py-2 text-slate-900 font-semibold text-[#BF6649]">
                  {formatDateDDMMYYYY(lwd)}
                </td>
              </tr>

              {/* Row 4: Bank Name & Bank A/C */}
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Bank Name
                </td>
                <td className="px-3 py-2 text-slate-900 border-r border-slate-300">
                  {bankName}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Bank A/C No.
                </td>
                <td className="px-3 py-2 text-slate-900 font-mono">
                  {bankAccountNo}
                </td>
              </tr>

              {/* Row 5: PAN & Settlement Date */}
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  PAN / Tax ID
                </td>
                <td className="px-3 py-2 text-slate-900 font-mono border-r border-slate-300">
                  {panNumber}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Settlement Date
                </td>
                <td className="px-3 py-2 text-slate-900 font-medium">
                  {formatDateDDMMYYYY(settlementDate)}
                </td>
              </tr>

              {/* Row 6: Payable Days & Daily Rate */}
              <tr>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Payable Days (Salary)
                </td>
                <td className="px-3 py-2 text-slate-900 border-r border-slate-300 font-semibold">
                  {payableDays} Days
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Per-Day Base Rate
                </td>
                <td className="px-3 py-2 text-slate-900 font-semibold">
                  ₹ {formatAmount(dailyRate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Itemized Earnings & Deductions Table */}
        <div className="w-full overflow-x-auto my-6">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[13px]">
            {/* Terracotta Header */}
            <thead>
              <tr className="bg-[#C0664B] text-white font-bold uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left border-r border-[#C0664B]/80 w-[32%]">
                  EARNINGS / PAYABLE
                </th>
                <th className="px-3 py-2.5 text-right border-r border-[#C0664B]/80 w-[18%]">
                  AMOUNT (₹)
                </th>
                <th className="px-3 py-2.5 text-left border-r border-[#C0664B]/80 w-[32%]">
                  DEDUCTIONS & RECOVERIES
                </th>
                <th className="px-3 py-2.5 text-right w-[18%]">
                  AMOUNT (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Prorated Salary | Notice Period Recovery */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Prorated Base Salary Payable ({payableDays}d)
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(salaryPayable)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Notice Period Shortfall Recovery
                </td>
                <td className="px-3 py-2 text-right font-medium text-rose-600">
                  {formatAmount(noticePeriodRecovery)}
                </td>
              </tr>

              {/* Row 2: Leave Encashment | Asset & Equipment Recovery */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Leave Encashment ({leaveEncashmentDays} Days)
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(leaveEncashmentAmount)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Asset / Equipment Damage Recovery
                </td>
                <td className="px-3 py-2 text-right font-medium text-rose-600">
                  {formatAmount(assetRecoveryDeduction)}
                </td>
              </tr>

              {/* Row 3: Bonus & Gratuity | Withholding Tax / TDS */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Statutory Gratuity & Exit Bonus
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(bonusGratuity)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Withholding Tax / TDS Deductions
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(taxDeduction)}
                </td>
              </tr>

              {/* Row 4: Other Allowances | Other Deductions */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Other Adjustments & Allowances
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(otherAllowances)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Other Recoveries / Advance Deductions
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(otherDeductions)}
                </td>
              </tr>

              {/* Row 5: Expense Reimbursements | Empty Right */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Pending Expense Reimbursements
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(reimbursements)}
                </td>
                <td className="px-3 py-2 text-slate-400 italic border-r border-slate-300">
                  —
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-400">
                  0.00
                </td>
              </tr>

              {/* Totals Row */}
              <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-400">
                <td className="px-3 py-2.5 text-slate-900 uppercase tracking-wider border-r border-slate-300">
                  TOTAL GROSS EARNINGS
                </td>
                <td className="px-3 py-2.5 text-right text-slate-900 border-r border-slate-300">
                  ₹ {formatAmount(grossPayable)}
                </td>
                <td className="px-3 py-2.5 text-slate-900 uppercase tracking-wider border-r border-slate-300">
                  TOTAL DEDUCTIONS & RECOVERIES
                </td>
                <td className="px-3 py-2.5 text-right text-rose-700">
                  ₹ {formatAmount(totalDeductions)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terracotta Net Settlement Banner Box */}
        <div className="w-full bg-[#C0664B] text-white p-5 rounded-none shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-6">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest font-bold opacity-90 block">
              NET SETTLEMENT PAYABLE
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight block">
              ₹ {formatAmount(netSettlementAmount)}
            </span>
            <p className="text-xs italic text-white/95 font-serif mt-1 pt-1 border-t border-white/20">
              {numberToWordsIndian(netSettlementAmount)}
            </p>
          </div>

          <div className="text-right sm:border-l sm:border-white/20 sm:pl-6 space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {paymentStatus === 'DISBURSED' ? 'Settlement Disbursed' : `${approvalStatus} • ${paymentStatus}`}
            </div>
            {fnf.disbursedAt && (
              <p className="text-[11px] text-white/80">
                Paid on: {formatDateDDMMYYYY(fnf.disbursedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Settlement Notes & Disbursement Details */}
        {(fnf.notes || fnf.disbursedAt || paymentStatus === 'DISBURSED') && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl my-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-semibold border-b border-slate-200 pb-1.5">
              <span>Settlement Audit & Payment Notes</span>
              <span className="font-mono text-slate-500 font-normal">
                Status: {paymentStatus}
              </span>
            </div>
            {fnf.notes && (
              <p className="text-slate-600 italic">"{fnf.notes}"</p>
            )}
            {fnf.disbursedAt && (
              <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                <span>Disbursed At: <strong>{new Date(fnf.disbursedAt).toLocaleString('en-IN')}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Signatures and Acknowledgement Section */}
        <div className="w-full pt-10 pb-4 mt-8 border-t border-slate-200 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-slate-600">
            <div className="flex flex-col items-center">
              <div className="w-40 border-b border-slate-400 mb-2 h-10 flex items-end justify-center">
                <span className="font-serif italic text-slate-800 text-sm">Human Resources</span>
              </div>
              <span className="font-semibold text-slate-800">Prepared By</span>
              <span className="text-[10px] text-slate-400">HR Operations & Payroll</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-40 border-b border-slate-400 mb-2 h-10 flex items-end justify-center">
                <span className="font-serif italic text-slate-800 text-sm">Finance Authority</span>
              </div>
              <span className="font-semibold text-slate-800">Authorized Signatory</span>
              <span className="text-[10px] text-slate-400">Finance & Accounts</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-40 border-b border-slate-400 mb-2 h-10 flex items-end justify-center">
                <span className="font-serif italic text-slate-400 text-xs">Signature</span>
              </div>
              <span className="font-semibold text-slate-800">Employee Acknowledged</span>
              <span className="text-[10px] text-slate-400">Full & Final Settlement Accepted</span>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400 italic mt-8 font-serif">
            This is a computer-generated Full & Final Settlement document issued by TaskNera HRMS.
          </p>
        </div>
      </div>
    </div>
  );
};
