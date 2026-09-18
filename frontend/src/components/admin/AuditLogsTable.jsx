import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Eye,
  ChevronDown,
  ChevronUp,
  Shield,
  User,
  Clock,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { DataTable } from '../common/DataTable.jsx';

export const AuditLogsTable = ({ logs = [], isLoading = false, onFilterChange }) => {
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const filtered = logs.filter((log) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchActor = (log.actorName || log.actorEmail || '').toLowerCase().includes(q);
      const matchAction = (log.action || '').toLowerCase().includes(q);
      const matchTarget = (log.targetType || log.targetId || '').toLowerCase().includes(q);
      if (!matchActor && !matchAction && !matchTarget) return false;
    }
    if (actionFilter) {
      if ((log.action || '').toUpperCase() !== actionFilter.toUpperCase()) return false;
    }
    return true;
  });

  const columns = [
    {
      header: 'Timestamp',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</span>
        </div>
      ),
    },
    {
      header: 'Actor',
      render: (row) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-900">{row.actorName || row.actorEmail || 'System Admin'}</p>
          <p className="text-[10px] text-slate-400 font-mono">{row.ipAddress || 'Internal'}</p>
        </div>
      ),
    },
    {
      header: 'Action',
      render: (row) => (
        <Badge
          variant={
            (row.action || '').includes('DELETE') || (row.action || '').includes('REVOKE')
              ? 'danger'
              : (row.action || '').includes('UPDATE') || (row.action || '').includes('ASSIGN')
              ? 'warning'
              : 'brand'
          }
          size="sm"
        >
          {row.action || 'OPERATION'}
        </Badge>
      ),
    },
    {
      header: 'Target Entity',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{row.targetType || 'SYSTEM'}</span>
          {row.targetId && <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">{row.targetId}</p>}
        </div>
      ),
    },
    {
      header: 'Details',
      render: (row) => {
        const isExpanded = expandedLogId === (row.id || row.createdAt);
        return (
          <div>
            <Button
              variant="ghost"
              size="sm"
              icon={isExpanded ? ChevronUp : ChevronDown}
              onClick={() => toggleExpand(row.id || row.createdAt)}
            >
              {isExpanded ? 'Hide Payload' : 'View Payload'}
            </Button>
            {isExpanded && (
              <div className="mt-2 bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono max-w-md overflow-x-auto">
                <pre>{JSON.stringify(row.details || row.metadata || row, null, 2)}</pre>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by actor, action, or target ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700"
        >
          <option value="">All Action Types</option>
          <option value="CREATE_USER">CREATE_USER</option>
          <option value="UPDATE_USER">UPDATE_USER</option>
          <option value="ASSIGN_ROLE">ASSIGN_ROLE</option>
          <option value="UPDATE_CONFIG">UPDATE_CONFIG</option>
          <option value="DEPROVISION_ACCESS">DEPROVISION_ACCESS</option>
          <option value="SUBMIT_RESIGNATION">SUBMIT_RESIGNATION</option>
          <option value="APPROVE_EXIT">APPROVE_EXIT</option>
          <option value="DISBURSE_FNF">DISBURSE_FNF</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No Audit Logs Found"
        emptyDescription="System operational events will be captured and displayed here in real time."
      />
    </div>
  );
};
