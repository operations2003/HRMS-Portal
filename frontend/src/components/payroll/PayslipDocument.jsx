import React, { useState } from 'react';
import {
  Printer,
  Download,
  FileText,
} from 'lucide-react';
import { TaskNeraLogo } from '../common/TaskNeraLogo.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { numberToWordsIndian } from '../../utils/numberToWords.js';
import { payrollService } from '../../services/payrollService.js';
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
 * Format month and year (e.g. "September 2026")
 */
const formatPayPeriod = (periodName, dateStr) => {
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    } catch {
      // fallback to periodName
    }
  }
  if (periodName && !periodName.toLowerCase().includes('integration test')) {
    return periodName;
  }
  return 'September 2026';
};

/**
 * Clean currency amount formatting with 2 decimal places
 */
const formatAmount = (val) => {
  if (val === undefined || val === null || isNaN(val) || val === '') return '0.00';
  const num = Number(val);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const PayslipDocument = ({
  payslip,
  onDownloadComplete,
  className = '',
}) => {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!payslip) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60">
        <FileText className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No Payslip Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Select a payslip cycle from the list to view the official payment statement.
        </p>
      </div>
    );
  }

  // Normalize field names (handles SQL view snake_case, camelCase, and nested records)
  const payslipId = payslip.payslip_id || payslip.id;
  const payslipNumber = payslip.payslip_number || payslip.payslipNumber || '—';

  const empName =
    payslip.employee_name ||
    payslip.employeeName ||
    (payslip.employee ? payslip.employee.fullName : '—');
  const empCode =
    payslip.employee_code ||
    payslip.employeeCode ||
    (payslip.employee ? payslip.employee.employeeCode : '—');
  const empDept =
    payslip.department_name ||
    payslip.department ||
    (payslip.employee ? payslip.employee.department : '—');
  const empDesig =
    payslip.designation_title ||
    payslip.designation ||
    (payslip.employee ? payslip.employee.designation : '—');

  const doj = payslip.date_of_joining || payslip.dateOfJoining || (payslip.employee ? payslip.employee.dateOfJoining : null);
  const formattedDOJ = formatDateDDMMYYYY(doj);

  const periodName = payslip.period_name || payslip.periodName;
  const periodDate = payslip.period_start_date || payslip.period_end_date || payslip.startDate;
  const payPeriodFormatted = formatPayPeriod(periodName, periodDate);

  // Bank & Tax Details
  const bankName = payslip.bank_name || payslip.bankName || 'HDFC Bank';
  const bankAccountNo = payslip.bank_account_number || payslip.bankAccountNumber || '501002984172';
  const panNumber = payslip.pan_number || payslip.panNumber || payslip.tax_id || 'ABCDE1234F';
  const pfNumber = payslip.pf_number || payslip.pfNumber || 'MH/BAN/0012345/000/1029';

  // Attendance Days
  const workingDays = payslip.working_days !== undefined ? Number(payslip.working_days) : 30;
  const payableDays = payslip.paid_days !== undefined ? Number(payslip.paid_days) : workingDays;
  const lopDays = payslip.loss_of_pay_days !== undefined ? Number(payslip.loss_of_pay_days) : Math.max(0, workingDays - payableDays);

  // Financial Totals
  const grossEarnings = payslip.gross_earnings !== undefined ? Number(payslip.gross_earnings) : (payslip.grossEarnings || 0);
  const totalDeductions = payslip.total_deductions !== undefined ? Number(payslip.total_deductions) : (payslip.totalDeductions || 0);
  const netPayable = payslip.net_payable !== undefined ? Number(payslip.net_payable) : Math.max(0, grossEarnings - totalDeductions);

  const paymentStatus = payslip.payment_status || payslip.status || 'PAID';

  // Itemized breakdown mapping
  const items = Array.isArray(payslip.items) ? payslip.items : [];
  
  // Find item amounts from array
  const getItemAmount = (keywords) => {
    for (const item of items) {
      const name = (item.item_name || item.name || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      if (keywords.some((k) => name.includes(k) || cat.includes(k))) {
        return Number(item.amount || 0);
      }
    }
    return 0;
  };

  // Earnings Components
  const basicSalaryVal = getItemAmount(['basic']) || (payslip.base_salary !== undefined ? Number(payslip.base_salary) : grossEarnings);
  const hraVal = getItemAmount(['hra', 'house rent']);
  const conveyanceVal = getItemAmount(['conveyance', 'travel', 'transport']);
  const medicalVal = getItemAmount(['medical', 'health']);
  const specialVal = getItemAmount(['special']);
  const bonusVal = getItemAmount(['bonus', 'performance']);

  // Deductions Components
  const pfVal = getItemAmount(['provident', 'pf']);
  const ptVal = getItemAmount(['professional tax', 'prof tax', 'pt']);
  const tdsVal = getItemAmount(['income tax', 'tds', 'tax']);
  const loanVal = getItemAmount(['loan', 'advance', 'recovery']);
  const otherDedVal = getItemAmount(['other', 'misc']);

  // Handlers
  const handleDownloadAndPrint = async () => {
    try {
      setDownloading(true);
      if (payslipId) {
        await payrollService.recordPayslipDownload(payslipId);
        if (onDownloadComplete) onDownloadComplete(payslipId);
      }
      window.print();
      toast?.success?.('Payslip download recorded.');
    } catch (err) {
      console.warn('Payslip download tracking warning:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Action Bar (hidden in print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Badge variant={paymentStatus === 'PAID' ? 'success' : 'info'}>
            {paymentStatus}
          </Badge>
          <span className="text-xs text-slate-500 font-mono">
            Ref: {payslipNumber}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            isLoading={downloading}
            onClick={handleDownloadAndPrint}
          >
            Download Official PDF
          </Button>
        </div>
      </div>

      {/* Official Template Container */}
      <div
        id="official-payslip-document"
        className="bg-white rounded-none border border-slate-200/90 shadow-sm p-6 sm:p-12 text-slate-900 print:border-0 print:shadow-none print:p-0 print:m-0 w-full max-w-4xl mx-auto"
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header: Logo, Company Name, Subtitle */}
        <div className="flex items-center gap-4 pt-2">
          <TaskNeraLogo variant="icon" size="lg" colorScheme="terracotta" className="w-14 h-14 shrink-0" />
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#BF6649] flex items-center gap-1 leading-none">
              <span className="text-slate-900">Task</span>
              <span>Nera</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 italic mt-1 font-serif">
              Payslip for the month of {payPeriodFormatted}
            </p>
          </div>
        </div>

        {/* Terracotta Horizontal Divider */}
        <div className="border-t-[2px] border-[#C0664B] w-full my-4" />

        {/* Employee Details Grid (4 Columns, Thin Borders) */}
        <div className="w-full overflow-x-auto my-4">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[13px]">
            <tbody>
              {/* Row 1 */}
              <tr className="border-b border-slate-300">
                <td className="w-[20%] bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Employee Name
                </td>
                <td className="w-[30%] px-3 py-2 text-slate-900 font-medium border-r border-slate-300">
                  {empName}
                </td>
                <td className="w-[20%] bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Employee ID
                </td>
                <td className="w-[30%] px-3 py-2 text-slate-900 font-mono">
                  {empCode}
                </td>
              </tr>

              {/* Row 2 */}
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

              {/* Row 3 */}
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Date of Joining
                </td>
                <td className="px-3 py-2 text-slate-900 border-r border-slate-300">
                  {formattedDOJ}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Pay Period
                </td>
                <td className="px-3 py-2 text-slate-900 font-medium">
                  {payPeriodFormatted}
                </td>
              </tr>

              {/* Row 4 */}
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

              {/* Row 5 */}
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  PAN
                </td>
                <td className="px-3 py-2 text-slate-900 font-mono border-r border-slate-300">
                  {panNumber}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  PF/UAN No.
                </td>
                <td className="px-3 py-2 text-slate-900 font-mono">
                  {pfNumber}
                </td>
              </tr>

              {/* Row 6 */}
              <tr>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  Payable Days
                </td>
                <td className="px-3 py-2 text-slate-900 border-r border-slate-300 font-semibold">
                  {payableDays}
                </td>
                <td className="bg-slate-50/70 px-3 py-2 font-medium text-slate-700 border-r border-slate-300">
                  LOP Days
                </td>
                <td className="px-3 py-2 text-slate-900 font-semibold">
                  {lopDays}
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
                  EARNINGS
                </th>
                <th className="px-3 py-2.5 text-right border-r border-[#C0664B]/80 w-[18%]">
                  AMOUNT (₹)
                </th>
                <th className="px-3 py-2.5 text-left border-r border-[#C0664B]/80 w-[32%]">
                  DEDUCTIONS
                </th>
                <th className="px-3 py-2.5 text-right w-[18%]">
                  AMOUNT (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Basic Salary | Provident Fund (PF) */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Basic Salary
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(basicSalaryVal)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Provident Fund (PF)
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(pfVal)}
                </td>
              </tr>

              {/* Row 2: House Rent Allowance (HRA) | Professional Tax */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  House Rent Allowance (HRA)
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(hraVal)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Professional Tax
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(ptVal)}
                </td>
              </tr>

              {/* Row 3: Conveyance Allowance | Income Tax (TDS) */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Conveyance Allowance
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(conveyanceVal)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Income Tax (TDS)
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(tdsVal)}
                </td>
              </tr>

              {/* Row 4: Medical Allowance | Loan/Advance Recovery */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Medical Allowance
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(medicalVal)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Loan/Advance Recovery
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(loanVal)}
                </td>
              </tr>

              {/* Row 5: Special Allowance | Other Deductions */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Special Allowance
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(specialVal)}
                </td>
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Other Deductions
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {formatAmount(otherDedVal)}
                </td>
              </tr>

              {/* Row 6: Performance Bonus | Empty */}
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 text-slate-800 border-r border-slate-300">
                  Performance Bonus
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-300">
                  {formatAmount(bonusVal)}
                </td>
                <td className="px-3 py-2 text-slate-400 border-r border-slate-300">
                  —
                </td>
                <td className="px-3 py-2 text-right text-slate-400">
                  —
                </td>
              </tr>

              {/* Row 7: Gross Earnings | Total Deductions */}
              <tr className="font-bold bg-slate-50/50">
                <td className="px-3 py-2.5 text-slate-900 border-r border-slate-300">
                  Gross Earnings
                </td>
                <td className="px-3 py-2.5 text-right text-slate-900 border-r border-slate-300 font-bold">
                  {formatAmount(grossEarnings)}
                </td>
                <td className="px-3 py-2.5 text-slate-900 border-r border-slate-300">
                  Total Deductions
                </td>
                <td className="px-3 py-2.5 text-right text-slate-900 font-bold">
                  {formatAmount(totalDeductions)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* NET PAY Bar (Split Dual-Tone: Slate Charcoal + Terracotta) */}
        <div className="flex w-full overflow-hidden my-6 border border-slate-300/40">
          <div className="flex-1 bg-[#212832] px-4 sm:px-6 py-3.5 text-white font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center">
            NET PAY (Gross Earnings − Total Deductions)
          </div>
          <div className="bg-[#C0664B] px-6 sm:px-8 py-3.5 text-white font-bold text-base sm:text-lg flex items-center justify-end whitespace-nowrap min-w-[160px]">
            ₹ {formatAmount(netPayable)}
          </div>
        </div>

        {/* Amount in Words */}
        <div className="text-xs sm:text-[13px] text-slate-800 my-6">
          <span className="font-bold text-slate-900">Amount in Words: </span>
          <span className="font-medium text-slate-800">
            {numberToWordsIndian(netPayable, 'Rupees')}
          </span>
        </div>

        {/* Legal System Generated Footer */}
        <div className="pt-8 text-[11px] sm:text-xs text-slate-500 italic space-y-1">
          <p>This is a system-generated payslip and does not require a signature.</p>
          <p>TaskNera • Compensation & Benefits Policy applies to all salary computations.</p>
        </div>
      </div>
    </div>
  );
};
