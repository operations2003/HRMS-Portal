import React, { useState, useEffect } from 'react';
import { Users, Mail, Building2, Briefcase, CheckCircle2, ShieldAlert, RefreshCw } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { DataTable } from '../common/DataTable.jsx';
import { hrOperationsService } from '../../services/hrOperationsService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const TeamRosterModal = ({ isOpen, onClose, managerId, managerName }) => {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && managerId) {
      loadTeamRoster();
    }
  }, [isOpen, managerId]);

  const loadTeamRoster = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await hrOperationsService.getTeamByManager(managerId);
      setData(res || {});
    } catch (err) {
      setError(err.message || 'Failed to load manager team roster.');
      toast.error('Unable to fetch manager team details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const members = data?.teamMembers || [];
  const manager = data?.manager || {};

  const columns = [
    {
      header: 'Direct Report',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            src={row.avatarUrl || row.avatar_url}
            alt={row.name || row.fullName || 'E'}
            name={row.name || row.fullName || 'E'}
            size="sm"
          />
          <div>
            <p className="font-semibold text-slate-800 text-xs">{row.name || row.fullName}</p>
            <p className="text-[11px] text-slate-400 font-mono">{row.employeeCode || row.id?.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department / Title',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-slate-800">
            {(typeof row.designation === 'object' ? row.designation?.name : row.designation) || 'Staff'}
          </p>
          <p className="text-[11px] text-slate-400">
            {(typeof row.department === 'object' ? row.department?.name : row.department) || 'Department'}
          </p>
        </div>
      ),
    },
    {
      header: 'Email',
      render: (row) => (
        <span className="text-xs text-slate-600 flex items-center gap-1">
          <Mail className="w-3.5 h-3.5 text-slate-400" />
          {row.email || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
          {row.status || 'Active'}
        </Badge>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manager Team Roster"
      subtitle={`Direct reports assigned to ${manager.name || managerName || 'Manager'}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-sm">
        {/* Manager Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-50/70 via-white to-slate-50 border border-brand-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              src={manager.avatarUrl || manager.avatar_url}
              alt={manager.name || managerName || 'Manager'}
              name={manager.name || managerName || 'Manager'}
              size="md"
              className="rounded-xl shadow-sm"
            />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{manager.name || managerName || 'Manager'}</h4>
              <p className="text-xs text-slate-500">
                Code: <span className="font-mono text-slate-700 font-medium">{manager.employeeCode || managerId}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider block">Team Headcount</span>
            <span className="text-xl font-bold text-slate-900">{members.length} direct reports</span>
          </div>
        </div>

        {error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={members}
            isLoading={isLoading}
            emptyTitle="No direct reports found"
            emptyDescription="This manager does not have any active direct reports assigned."
          />
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
