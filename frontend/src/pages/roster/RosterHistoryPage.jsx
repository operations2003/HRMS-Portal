import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  History,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Upload,
  ChevronLeft,
  Eye,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Alert } from '../../components/common/Alert';
import { rosterService } from '../../services/rosterService';
import { Can } from '../../components/rbac/Can';

export const RosterHistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  useEffect(() => {
    // Show success message if coming from import
    if (location.state?.importResult) {
      const result = location.state.importResult;
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await rosterService.getImportHistory({ page, limit: 20 });
      setImports(response.data.imports);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('History error:', err);
      setError(err.response?.data?.message || 'Failed to load import history.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { variant: 'warning', label: 'Pending' },
      PREVIEWED: { variant: 'info', label: 'Previewed' },
      CONFIRMED: { variant: 'success', label: 'Confirmed' },
      PARTIAL: { variant: 'warning', label: 'Partial' },
      FAILED: { variant: 'danger', label: 'Failed' },
    };

    const config = statusMap[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMonthName = (month) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1] || month;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && imports.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Can permission="employee:write">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              icon={ChevronLeft}
              onClick={() => navigate('/roster/import')}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <History className="w-7 h-7 text-brand-600" />
                Roster Import History
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                View all roster imports and their status
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/roster/import')}
            icon={Upload}
          >
            New Import
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {/* Import History Table */}
        {imports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Import History
            </h3>
            <p className="text-slate-600 mb-6">
              You haven't imported any rosters yet.
            </p>
            <Button onClick={() => navigate('/roster/import')} icon={Upload}>
              Import First Roster
            </Button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Roster Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Employees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Assignments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Uploaded By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {imports.map((importJob) => (
                    <tr key={importJob.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-brand-600" />
                          <span className="font-medium text-slate-900">
                            {getMonthName(importJob.roster_month)} {importJob.roster_year}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 max-w-xs truncate" title={importJob.original_filename}>
                          {importJob.original_filename}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(importJob.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-slate-900">
                            {importJob.matched_employees} / {importJob.total_employees} matched
                          </div>
                          {importJob.unmatched_employees > 0 && (
                            <div className="text-xs text-red-600">
                              {importJob.unmatched_employees} unmatched
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {importJob.status === 'CONFIRMED' || importJob.status === 'PARTIAL' ? (
                          <div className="text-sm">
                            <div className="text-green-700">
                              {importJob.new_assignments} new
                            </div>
                            {importJob.updated_assignments > 0 && (
                              <div className="text-blue-700">
                                {importJob.updated_assignments} updated
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {importJob.uploaded_by_name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {formatDate(importJob.created_at)}
                        </div>
                        {importJob.confirmed_at && (
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {formatDate(importJob.confirmed_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {importJob.status === 'PENDING' || importJob.status === 'PREVIEWED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Eye}
                            onClick={() => navigate(`/roster/preview/${importJob.id}`)}
                          >
                            Review
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Eye}
                            onClick={() => navigate(`/roster/preview/${importJob.id}`)}
                          >
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} imports
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Can>
  );
};
