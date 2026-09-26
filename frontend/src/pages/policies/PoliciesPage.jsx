import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { policyService } from '../../services/policyService.js';
import { Button } from '../../components/common/Button.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';

const POLICY_CATEGORIES = [
  { value: '', label: 'All Policy Categories' },
  { value: 'Conduct & Compliance', label: 'Conduct & Compliance' },
  { value: 'Leave & Attendance', label: 'Leave & Attendance' },
  { value: 'Security & IT', label: 'Security & IT' },
  { value: 'Benefits & Wellness', label: 'Benefits & Wellness' },
  { value: 'General', label: 'General Corporate' },
];

export const PoliciesPage = () => {
  const { hasRole } = useAuth();
  const toast = useToast();

  const canManagePolicies = hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [viewingPolicy, setViewingPolicy] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Conduct & Compliance',
    description: '',
    version: '1.0',
    effectiveDate: new Date().toISOString().split('T')[0],
    documentUrl: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchPolicies = async (isBackground = false) => {
    try {
      if (isBackground) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await policyService.listPolicies({
        category: categoryFilter,
        search: searchQuery,
      });
      setPolicies(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      console.error('Failed to load policies:', err);
      setError(err.message || 'Unable to retrieve company policy documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [categoryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPolicies();
  };

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setFormData({
      title: '',
      category: 'Conduct & Compliance',
      description: '',
      version: '1.0',
      effectiveDate: new Date().toISOString().split('T')[0],
      documentUrl: '',
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPolicy(p);
    setFormData({
      title: p.title || '',
      category: p.category || 'General',
      description: p.description || '',
      version: p.version || '1.0',
      effectiveDate: p.effective_date ? p.effective_date.split('T')[0] : '',
      documentUrl: p.document_url || '',
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Policy title is required.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);

      if (editingPolicy) {
        await policyService.updatePolicy(editingPolicy.id, formData);
        toast.success(`Policy "${formData.title}" updated successfully.`);
      } else {
        await policyService.createPolicy(formData);
        toast.success(`New policy "${formData.title}" published successfully.`);
      }

      setIsFormModalOpen(false);
      fetchPolicies(true);
    } catch (err) {
      setFormError(err.message || 'Failed to save policy document.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeletePolicy = async (id, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete the policy "${title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await policyService.deletePolicy(id);
      toast.success('Policy deleted successfully.');
      fetchPolicies(true);
    } catch (err) {
      toast.error(err.message || 'Failed to delete policy.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Company Policies
              </h1>
              {!canManagePolicies && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200">
                  <Lock className="w-3 h-3" />
                  View-Only
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Access official handbook, compliance regulations, workplace standards, and organizational guidelines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchPolicies(true)}
          >
            Refresh
          </Button>

          {canManagePolicies && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenCreate}
            >
              Add Policy
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search policies by keyword, regulation, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
          />
        </form>

        <div className="w-full sm:w-64">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
          >
            {POLICY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner fullPage message="Loading official company policies..." />
      ) : error ? (
        <Alert variant="danger" title="Error Loading Policies" message={error} />
      ) : policies.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">No policies found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || categoryFilter
              ? 'No policy documents match your criteria. Try adjusting your search keywords.'
              : 'There are currently no company policy documents published for this organization.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {policies.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-card hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200">
                    {p.category || 'General'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold">
                    v{p.version || '1.0'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {p.description || 'Official company policy document.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {p.effective_date ? new Date(p.effective_date).toLocaleDateString() : 'Active'}
                </span>

                <div className="flex items-center gap-1.5">
                  {(p.document_url || p.documentUrl) && (
                    <a
                      href={(p.document_url || p.documentUrl).startsWith('http') ? (p.document_url || p.documentUrl) : `https://${p.document_url || p.documentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                      title="Open Policy Link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Policy Link
                    </a>
                  )}

                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setViewingPolicy(p)}
                  >
                    Read
                  </Button>

                  {canManagePolicies && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                        title="Edit Policy"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(p.id, p.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Policy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Policy Detail Modal */}
      {viewingPolicy && (
        <Modal
          isOpen={!!viewingPolicy}
          onClose={() => setViewingPolicy(null)}
          title={viewingPolicy.title}
          subtitle={`${viewingPolicy.category} • Version ${viewingPolicy.version || '1.0'} • Effective ${viewingPolicy.effective_date ? new Date(viewingPolicy.effective_date).toLocaleDateString() : 'Current'}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            {(viewingPolicy.document_url || viewingPolicy.documentUrl) && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200 truncate">
                  <ExternalLink className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">Policy Material / External Document Link</span>
                </div>
                <a
                  href={(viewingPolicy.document_url || viewingPolicy.documentUrl).startsWith('http') ? (viewingPolicy.document_url || viewingPolicy.documentUrl) : `https://${viewingPolicy.document_url || viewingPolicy.documentUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shrink-0 shadow-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Link
                </a>
              </div>
            )}

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Policy Summary & Directives
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {viewingPolicy.description || 'No detailed text available for this policy.'}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Published for organization: TaskNera HRMS</span>
              <Button size="sm" variant="secondary" onClick={() => setViewingPolicy(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit Policy Modal (Admin & HR only) */}
      {canManagePolicies && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingPolicy ? 'Edit Company Policy' : 'Publish New Company Policy'}
          subtitle={editingPolicy ? 'Update policy terms, version, or description' : 'Make an official policy accessible to all employees and managers'}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {formError && <Alert variant="danger" message={formError} />}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Policy Title <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Leave & Attendance Policy 2026"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  options={[
                    { value: 'Conduct & Compliance', label: 'Conduct & Compliance' },
                    { value: 'Leave & Attendance', label: 'Leave & Attendance' },
                    { value: 'Security & IT', label: 'Security & IT' },
                    { value: 'Benefits & Wellness', label: 'Benefits & Wellness' },
                    { value: 'General', label: 'General Corporate' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Version
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 1.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective Date
              </label>
              <Input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Policy Document Link (URL)
              </label>
              <Input
                type="url"
                placeholder="https://example.com/policy-document or Google Drive / OneDrive link"
                value={formData.documentUrl}
                onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Employees and staff can click this link to directly open and view the official policy document, slides, or handbook.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Policy Description & Directives <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                placeholder="Detail the terms, purpose, compliance expectations, and operational guidelines..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsFormModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={formSubmitting}
              >
                {editingPolicy ? 'Save Changes' : 'Publish Policy'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default PoliciesPage;
