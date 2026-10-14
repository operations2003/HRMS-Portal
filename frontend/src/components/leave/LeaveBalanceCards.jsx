import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  PieChart,
  LayoutGrid,
  Table as TableIcon,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

const RESTRICTED_LEAVE_CODES = ['HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL', 'UPL'];

export const isRestrictedLeave = (bal) => {
  if (!bal) return false;
  if (bal.isRestricted) return true;
  const code = String(bal.leaveTypeCode || bal.code || '').trim().toUpperCase();
  const name = String(bal.leaveTypeName || bal.name || '').trim().toLowerCase();
  if (RESTRICTED_LEAVE_CODES.includes(code)) return true;
  return (
    code === 'UPL' ||
    name.includes('holiday') ||
    name.includes('unplanned') ||
    name.includes('sabbatical') ||
    name.includes('maternity') ||
    name.includes('paternity') ||
    name.includes('awol') ||
    name.includes('without leave') ||
    name.includes('without pay') ||
    name.includes('loss of pay')
  );
};

export const LeaveBalanceCards = ({
  balances = [],
  isLoading = false,
  error = null,
  onApplyClick,
  canApply = true,
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Display standard leaves, PLUS any consumed leaves (like LWP, LOP, AWOL where usedDays > 0 or pendingDays > 0)
  const displayBalances = (balances || []).filter((bal) => {
    if (!isRestrictedLeave(bal)) return true;
    const used = Number(bal.usedDays || 0);
    const pending = Number(bal.pendingDays || 0);
    return used > 0 || pending > 0;
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 text-center">
        <LoadingSpinner message="Loading leave entitlement balances from server..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-6 text-center">
        <p className="text-sm font-bold text-rose-600 mb-1">Failed to load leave balances</p>
        <p className="text-xs text-slate-500">{typeof error === 'string' ? error : error.message}</p>
      </div>
    );
  }

  if (!displayBalances || displayBalances.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 text-center text-slate-500 text-xs">
        No applicable leave allocation balances recorded for the current calendar year.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header & View Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Annual Leave Entitlements & Balances
          </h2>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Card View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Table View"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Grid View of Balances */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {displayBalances.map((bal, idx) => {
            const allocated = Number(bal.allocatedDays || 0);
            const used = Number(bal.usedDays || 0);
            const pending = Number(bal.pendingDays || 0);
            const remaining = Number(bal.remainingDays || 0);
            const isUnpaid = bal.isPaid === false || ['LWP', 'LOP', 'AWOL'].includes(String(bal.leaveTypeCode || '').toUpperCase());

            // Compute usage percentage if allocated > 0
            const percentUsed = allocated > 0 ? Math.min(100, Math.round(((used + pending) / allocated) * 100)) : 0;

            return (
              <div
                key={bal.id || idx}
                className={`rounded-3xl border ${
                  isUnpaid
                    ? 'border-rose-200/90 bg-rose-50/20'
                    : 'border-slate-200/80 bg-white'
                } p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate" title={bal.leaveTypeName}>
                      {bal.leaveTypeName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        isUnpaid
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-brand-50 text-brand-600 border-brand-100'
                      }`}
                    >
                      {bal.leaveTypeCode}
                    </span>
                  </div>

                  {/* Consumed / Remaining Stat */}
                  {isUnpaid ? (
                    <div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-black text-rose-600 font-mono tracking-tight">
                          {used}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          days consumed
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-600 font-semibold mt-0.5 flex items-center gap-1">
                        <span>Leave Without Pay (Consumed)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                          {remaining}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          / {allocated} days
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                        Remaining Balance
                      </div>
                    </div>
                  )}

                  {/* Visual allocation progress bar */}
                  {allocated > 0 && !isUnpaid && (
                    <div className="mt-3.5">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                        <div
                          className="bg-brand-500 h-1.5 transition-all duration-300"
                          style={{ width: `${(used / allocated) * 100}%` }}
                          title={`Used: ${used} days`}
                        />
                        <div
                          className="bg-amber-400 h-1.5 transition-all duration-300"
                          style={{ width: `${(pending / allocated) * 100}%` }}
                          title={`Pending: ${pending} days`}
                        />
                      </div>
                    </div>
                  )}
                  {isUnpaid && used > 0 && (
                    <div className="mt-3.5">
                      <div className="w-full bg-rose-100 rounded-full h-1.5 overflow-hidden flex">
                        <div
                          className="bg-rose-500 h-1.5 transition-all duration-300 w-full"
                          title={`Consumed: ${used} days`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Used & Pending Breakdowns */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-medium">
                      {isUnpaid ? 'Consumed' : 'Used'}
                    </span>
                    <span className={`font-bold font-mono ${isUnpaid ? 'text-rose-600' : 'text-slate-700'}`}>
                      {used} d
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block font-medium">Pending</span>
                    <span className={`font-bold font-mono ${pending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {pending > 0 ? `${pending} d` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View of Balances */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Leave Type
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Total Allocation
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Used Days
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Pending Approval
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap">
                    Remaining Balance
                  </th>
                  <th scope="col" className="px-6 py-4 whitespace-nowrap text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayBalances.map((bal, idx) => {
                  const allocated = Number(bal.allocatedDays || 0);
                  const used = Number(bal.usedDays || 0);
                  const pending = Number(bal.pendingDays || 0);
                  const remaining = Number(bal.remainingDays || 0);
                  const isUnpaid = bal.isPaid === false || ['LWP', 'LOP', 'AWOL'].includes(String(bal.leaveTypeCode || '').toUpperCase());

                  return (
                    <tr key={bal.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{bal.leaveTypeName}</div>
                        <div className="text-xs text-slate-400">{bal.leaveTypeCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-slate-700">
                        {isUnpaid ? 'Unpaid (No Quota)' : `${allocated} days`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-600">
                        {used} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono">
                        {pending > 0 ? (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {pending} days
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isUnpaid ? (
                          <span className="font-mono text-sm font-bold text-rose-600">
                            {used} days consumed
                          </span>
                        ) : (
                          <span className="font-mono text-base font-extrabold text-brand-600">
                            {remaining} days
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {isUnpaid ? (
                          <Badge variant="warning">Consumed (Unpaid)</Badge>
                        ) : remaining > 0 ? (
                          <Badge variant="success">Available</Badge>
                        ) : allocated === 0 ? (
                          <Badge variant="neutral">Uncapped / Unpaid</Badge>
                        ) : (
                          <Badge variant="danger">Exhausted</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
