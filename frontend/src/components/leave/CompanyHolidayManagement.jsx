import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Layers,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { holidayService } from '../../services/holidayService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

export const CompanyHolidayManagement = () => {
  const toast = useToast();
  const currentYear = new Date().getFullYear();

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for declaring a holiday
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('COMPANY');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [holidayToDelete, setHolidayToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch holidays
  const fetchHolidays = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const params = {};
      if (selectedYear) params.year = selectedYear;

      const data = await holidayService.getHolidays(params);
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load company holidays.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedYear, toast]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Handle Declare Holiday submit
  const handleDeclareHoliday = async (e) => {
    e.preventDefault();
    if (!formDate) {
      toast.error('Please select a date for the holiday.');
      return;
    }
    if (!formName.trim()) {
      toast.error('Please enter a holiday name or reason.');
      return;
    }

    try {
      setIsSubmitting(true);
      await holidayService.createHoliday({
        holidayDate: formDate,
        name: formName.trim(),
        holidayType: formType,
        description: formDescription.trim(),
        status: 'Active',
      });

      toast.success(`Holiday '${formName.trim()}' declared on ${formDate}! It is now active and reflected as 'HL' on all employee rosters.`);
      setFormName('');
      setFormDescription('');
      await fetchHolidays(true);
    } catch (err) {
      toast.error(err.message || 'Failed to declare company holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async (holiday) => {
    const newStatus = holiday.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await holidayService.updateHoliday(holiday.id, { status: newStatus });
      toast.success(
        newStatus === 'Active'
          ? `Holiday '${holiday.name}' activated and reflected on rosters.`
          : `Holiday '${holiday.name}' set to inactive (removed from active roster).`
      );
      await fetchHolidays(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update holiday status.');
    }
  };

  // Handle Delete Confirmation
  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      setIsDeleting(true);
      await holidayService.deleteHoliday(holidayToDelete.id);
      toast.success(`Holiday '${holidayToDelete.name}' deleted successfully.`);
      setHolidayToDelete(null);
      await fetchHolidays(true);
    } catch (err) {
      toast.error(err.message || 'Failed to delete company holiday.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper date formatter
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Filtered list
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        h.name?.toLowerCase().includes(term) ||
        h.holidayDate?.includes(term) ||
        h.holidayType?.toLowerCase().includes(term) ||
        h.description?.toLowerCase().includes(term)
      );
    });
  }, [holidays, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const total = holidays.length;
    const active = holidays.filter((h) => h.status === 'Active').length;
    const upcoming = holidays.filter((h) => h.status === 'Active' && h.holidayDate >= todayStr).length;
    return { total, active, upcoming };
  }, [holidays]);

  return (
    <div className="space-y-6">
      {/* Overview & Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Declared Holidays</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.active}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400">
              <Sun className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Reflected as <span className="font-bold text-rose-600">HL</span> across all rosters</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming Holidays</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.upcoming}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Remaining company holidays in {selectedYear}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total in System</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Selected calendar year: {selectedYear}
          </p>
        </div>
      </div>

      {/* Main Declare Holiday Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Declare Company Holiday
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a date to declare an official company holiday. It will instantly show as <span className="font-semibold text-rose-600">HL</span> on every employee's monthly schedule roster.
            </p>
          </div>
        </div>

        <form onSubmit={handleDeclareHoliday} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Date Picker */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Holiday Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>
          </div>

          {/* Holiday Name */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Holiday Name / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Diwali Festival, Corporate Off..."
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>

          {/* Holiday Type */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-all"
            >
              <option value="COMPANY">Company Holiday</option>
              <option value="NATIONAL">National / Public</option>
              <option value="OPTIONAL">Optional Off</option>
            </select>
          </div>

          {/* Description */}
          <div className="md:col-span-3 flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="shrink-0 font-bold px-4 py-2 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Declare Holiday</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Declared Holidays Directory */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Table Filters & Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-brand-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Official Declared Holidays ({filteredHolidays.length})
            </h4>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search holiday..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear + 1}>{currentYear + 1}</option>
            </select>

            {/* Refresh */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fetchHolidays(true)}
              disabled={isRefreshing}
              className="p-2"
              title="Refresh holiday list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-500 mt-2">Loading official holidays...</p>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No declared holidays found for {selectedYear}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Use the form above to select a date and declare an official company holiday. It will instantly reflect across everyone's roster.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Holiday Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Roster Impact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHolidays.map((holiday) => {
                  const isActive = holiday.status === 'Active';
                  return (
                    <tr
                      key={holiday.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-brand-600" />
                          <span>{formatDateDisplay(holiday.holidayDate)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {holiday.name}
                        </div>
                        {holiday.description && (
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {holiday.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            holiday.holidayType === 'COMPANY'
                              ? 'brand'
                              : holiday.holidayType === 'NATIONAL'
                              ? 'rose'
                              : 'neutral'
                          }
                          size="xs"
                        >
                          {holiday.holidayType}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Reflected on Rosters (HL)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Not on roster
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(holiday)}
                          className="cursor-pointer transition-transform hover:scale-105"
                          title="Click to toggle holiday status"
                        >
                          <Badge variant={isActive ? 'success' : 'neutral'} size="xs">
                            {isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => setHolidayToDelete(holiday)}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Delete holiday"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(holidayToDelete)}
        title="Delete Company Holiday"
        message={
          holidayToDelete
            ? `Are you sure you want to remove '${holidayToDelete.name}' on ${holidayToDelete.holidayDate}? It will no longer reflect as a holiday on employee monthly rosters.`
            : ''
        }
        confirmText="Yes, Delete Holiday"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDeleteHoliday}
        onCancel={() => setHolidayToDelete(null)}
      />
    </div>
  );
};

