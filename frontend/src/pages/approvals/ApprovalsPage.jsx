import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  Filter,
  RefreshCw,
  Layers,
  CalendarDays,
  Award,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { workflowService } from '../../services/workflowService.js';
import { hrOperationsService } from '../../services/hrOperationsService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ApprovalActionModal } from '../../components/approvals/ApprovalActionModal.jsx';

export const ApprovalsPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const [queue, setQueue] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('ALL'); // 'ALL' | 'LEAVE' | 'PERFORMANCE' | 'REQUEST'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [actionModal, setActionModal] = useState({
    isOpen: false,
    item: null,
    actionType: 'APPROVE',
  });

  const isHrOrAdmin = hasRole('HR') || hasRole('HRManager') || hasRole('Admin') || hasRole('SuperAdmin') || hasRole('OrgAdmin');

  useEffect(() => {
    loadApprovalQueue();
  }, []);

  const loadApprovalQueue = async () => {
    try {
      setIsRefreshing(true);
      // Try HR unified queue first if HR/Admin, otherwise workflow pending queue
      let items = [];
      if (isHrOrAdmin) {
        try {
          const hrRes = await hrOperationsService.getApprovalQueue();
          items = hrRes.items || hrRes.queue || (Array.isArray(hrRes) ? hrRes : []);
        } catch (e) {
          const wfRes = await workflowService.getPendingQueue();
          items = wfRes.items || wfRes.data || (Array.isArray(wfRes) ? wfRes : []);
        }
      } else {
        const wfRes = await workflowService.getPendingQueue();
        items = wfRes.items || wfRes.data || (Array.isArray(wfRes) ? wfRes : []);
      }
      setQueue(items);
    } catch (err) {
      toast.error('Failed to load pending approvals queue.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filteredItems = queue.filter((item) => {
    if (moduleFilter === 'ALL') return true;
    const type = (item.entityType || item.module || item.type || '').toUpperCase();
    if (moduleFilter === 'LEAVE') return type.includes('LEAVE');
    if (moduleFilter === 'PERFORMANCE') return type.includes('PERFORMANCE') || type.includes('REVIEW');
    if (moduleFilter === 'REQUEST') return type.includes('REQUEST') || type.includes('HELPDESK');
    return true;
  });

  const columns = [
    {
      header: 'Requester',
      render: (row) => {
        const name =
          row.employeeName ||
          row.employee?.fullName ||
          `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.trim() ||
          'Employee';
        const isSelf =
          (user?.employeeId && (row.employeeId === user.employeeId || row.employee_id === user.employeeId)) ||
          (user?.id && (row.requesterUserId === user.id || row.employee?.userId === user.id));

        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
              {name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-slate-800 text-xs">{name}</p>
                {isSelf && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                    You (Self)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {row.departmentName || row.employee?.department?.name || 'Department'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Module / Item',
      render: (row) => {
        const type = (row.entityType || row.module || row.type || 'Workflow').toUpperCase();
        return (
          <div>
            <Badge variant={type.includes('LEAVE') ? 'info' : type.includes('PERFORMANCE') ? 'brand' : 'neutral'} size="sm">
              {type}
            </Badge>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs truncate">
              {row.description || row.reason || row.title || 'Pending workflow decision'}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Stage',
      render: (row) => (
        <span className="text-xs font-mono font-medium text-slate-700">
          {row.currentStage || row.stage || row.status || 'PENDING'}
        </span>
      ),
    },
    {
      header: 'Submission Time',
      render: (row) => {
        const d = row.submittedAt || row.createdAt || row.created_at;
        return (
          <span className="text-xs text-slate-500">
            {d ? new Date(d).toLocaleDateString() : 'Recent'}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const isSelf =
          (user?.employeeId && (row.employeeId === user.employeeId || row.employee_id === user.employeeId)) ||
          (user?.id && (row.requesterUserId === user.id || row.employee?.userId === user.id));

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="success"
              icon={CheckCircle2}
              disabled={isSelf}
              title={isSelf ? 'Self-approval is forbidden' : 'Approve'}
              onClick={() => setActionModal({ isOpen: true, item: row, actionType: 'APPROVE' })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="warning"
              icon={RotateCcw}
              onClick={() => setActionModal({ isOpen: true, item: row, actionType: 'RETURN' })}
            >
              Return
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={XCircle}
              onClick={() => setActionModal({ isOpen: true, item: row, actionType: 'REJECT' })}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Approvals & Governance Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and execute pending approval workflows across leaves, appraisals, and employee requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            isLoading={isRefreshing}
            onClick={loadApprovalQueue}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setModuleFilter('ALL')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            moduleFilter === 'ALL'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          All Pending ({queue.length})
        </button>
        <button
          type="button"
          onClick={() => setModuleFilter('LEAVE')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            moduleFilter === 'LEAVE'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Leaves
        </button>
        <button
          type="button"
          onClick={() => setModuleFilter('PERFORMANCE')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            moduleFilter === 'PERFORMANCE'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          Performance
        </button>
        <button
          type="button"
          onClick={() => setModuleFilter('REQUEST')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            moduleFilter === 'REQUEST'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Helpdesk & Requests
        </button>
      </div>

      {/* Queue Table */}
      <DataTable
        columns={columns}
        data={filteredItems}
        isLoading={isLoading}
        emptyTitle="Approval queue is empty"
        emptyDescription="All pending requests have been approved or processed. Good job!"
      />

      {/* Universal Action Modal */}
      <ApprovalActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, item: null, actionType: 'APPROVE' })}
        onSuccess={loadApprovalQueue}
        item={actionModal.item}
        actionType={actionModal.actionType}
        currentUser={user}
      />
    </div>
  );
};
