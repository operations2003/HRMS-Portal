import React from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { EmptyState } from './EmptyState.jsx';
import { Button } from './Button.jsx';

export const DataTable = ({
  columns = [],
  data = [],
  isLoading = false,
  error = null,
  emptyTitle = 'No data available',
  emptyDescription = 'No records match your criteria.',
  pagination = null,
  onPageChange = null,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
        <LoadingSpinner message="Fetching records..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center">
        <p className="text-sm font-semibold text-rose-600 mb-1">Failed to load data</p>
        <p className="text-xs text-slate-500">{typeof error === 'string' ? error : error.message}</p>
      </div>
    );
  }

  const safeData = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.employees)
    ? data.employees
    : Array.isArray(data?.records)
    ? data.records
    : Array.isArray(data?.results)
    ? data.results
    : [];

  if (!safeData || safeData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              {columns.map((col, index) => (
                <th
                  key={col.key || index}
                  scope="col"
                  className={`px-6 py-4 whitespace-nowrap ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {safeData.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                className="hover:bg-slate-50/60 transition-colors duration-100"
              >
                {columns.map((col, colIndex) => {
                  const cellValue = col.accessor
                    ? typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : row[col.accessor]
                    : null;

                  let rendered = col.render ? col.render(row, rowIndex) : cellValue;

                  // Safety guard against React child object crashes (e.g. raw department or designation objects)
                  if (rendered && typeof rendered === 'object' && !React.isValidElement(rendered)) {
                    rendered = rendered.name || rendered.title || rendered.label || rendered.code || '—';
                  }

                  return (
                    <td
                      key={col.key || colIndex}
                      className={`px-6 py-4 whitespace-nowrap text-slate-700 ${col.cellClassName || ''}`}
                    >
                      {rendered ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing page <span className="font-semibold text-slate-700">{pagination.page}</span> of{' '}
            <span className="font-semibold text-slate-700">{pagination.totalPages}</span> (
            <span className="font-semibold text-slate-700">{pagination.total}</span> total)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={pagination.page <= 1}
              onClick={() => onPageChange && onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange && onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
