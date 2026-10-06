import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  History,
  X,
  AlertCircle,
} from 'lucide-react';
import { appsumoService } from '../../services/appsumoService.js';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { DataTable } from '../common/DataTable.jsx';
import { Alert } from '../common/Alert.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Modal } from '../common/Modal.jsx';

export const AppSumoLicenseManagement = () => {
  const [licenses, setLicenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [error, setError] = useState(null);

  // Detail Modal State
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [licenseDetail, setLicenseDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchLicenses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await appsumoService.listAdminLicenses({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        tier: tierFilter || undefined,
        limit: 50,
      });
      setLicenses(data?.licenses || []);
      setTotal(data?.total || 0);
    } catch (err) {
      console.error('Failed to load AppSumo licenses:', err);
      setError(err.message || 'Failed to load AppSumo license registry.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, tierFilter]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleOpenDetail = async (row) => {
    setSelectedLicense(row);
    try {
      setIsLoadingDetail(true);
      const detail = await appsumoService.getAdminLicenseDetail(row.licenseKey);
      setLicenseDetail(detail);
    } catch (err) {
      console.error('Failed to load license details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'deactivated':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const columns = [
    {
      header: 'AppSumo License Key',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900 block truncate max-w-[200px]" title={row.licenseKey}>
            {row.licenseKey}
          </span>
          {row.prevLicenseKey && (
            <span className="text-[11px] text-slate-400 font-mono truncate block" title={`Previous: ${row.prevLicenseKey}`}>
              Prev: {row.prevLicenseKey.slice(0, 12)}...
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Organization',
      render: (row) => (
        <div>
          <span className="font-semibold text-xs text-slate-800 block">
            {row.organizationName || 'Unlinked (Purchased)'}
          </span>
          {row.activatedByUserEmail && (
            <span className="text-[11px] text-slate-500 block truncate">{row.activatedByUserEmail}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Plan & Tier',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="brand" size="sm">
            Tier {row.tier}
          </Badge>
          <span className="text-xs text-slate-600 hidden sm:inline">{row.partnerPlanName}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={getStatusBadgeVariant(row.status)} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Last Event',
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-700 capitalize block">{row.event || 'purchase'}</span>
          <span className="text-[11px] text-slate-400">
            {row.lastEventAt ? new Date(row.lastEventAt).toLocaleDateString() : '—'}
          </span>
        </div>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon={History} onClick={() => handleOpenDetail(row)}>
            Audit Log
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by license key, organization, or user email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deactivated">Deactivated</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Tiers</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchLicenses} isLoading={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Licenses Table */}
      <DataTable
        columns={columns}
        data={licenses}
        isLoading={isLoading}
        emptyMessage="No AppSumo licenses found matching the selected filters."
      />

      {/* License Detail & Audit Event Modal */}
      {selectedLicense && (
        <Modal
          isOpen={!!selectedLicense}
          onClose={() => {
            setSelectedLicense(null);
            setLicenseDetail(null);
          }}
          title="AppSumo License Audit & Lifecycle"
          subtitle={`Detailed event records for license key: ${selectedLicense.licenseKey}`}
          maxWidth="max-w-2xl"
        >
          {isLoadingDetail ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner message="Loading audit history..." />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Tier</span>
                  <span className="font-bold text-slate-900 text-sm">Tier {selectedLicense.tier}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <Badge variant={getStatusBadgeVariant(selectedLicense.status)} size="sm">
                    {selectedLicense.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500 block">Seats Limit</span>
                  <span className="font-semibold text-slate-800">
                    {licenseDetail?.tierConfig?.maxEmployees || 15} Employees
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Departments Limit</span>
                  <span className="font-semibold text-slate-800">
                    {licenseDetail?.tierConfig?.maxDepartments || 5} Depts
                  </span>
                </div>
              </div>

              {/* Event History Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-600" />
                  <span>Webhook Event Audit Log</span>
                </h4>

                {licenseDetail?.events?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No webhook events logged yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {licenseDetail?.events?.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                evt.event === 'activate'
                                  ? 'success'
                                  : evt.event === 'deactivate'
                                  ? 'danger'
                                  : evt.event === 'upgrade'
                                  ? 'brand'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {evt.event.toUpperCase()}
                            </Badge>
                            {evt.test && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                                TEST
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            {evt.createdAt ? new Date(evt.createdAt).toLocaleString() : '—'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600">
                          <span className="font-mono text-slate-800">Key: {evt.licenseKey}</span>
                          {evt.prevLicenseKey && (
                            <span className="font-mono text-slate-500 ml-2">Prev: {evt.prevLicenseKey}</span>
                          )}
                        </div>

                        {evt.payload && (
                          <pre className="bg-slate-50 text-slate-700 p-2 rounded-lg text-[10px] font-mono overflow-x-auto max-h-24">
                            {JSON.stringify(evt.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
