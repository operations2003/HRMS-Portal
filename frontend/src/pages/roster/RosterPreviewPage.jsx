import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  UserCheck,
  UserX,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Info,
  CalendarCheck,
  Edit3,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { Select } from '../../components/common/Select.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { rosterService } from '../../services/rosterService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const RosterPreviewPage = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [previewData, setPreviewData] = useState(location.state?.previewData || null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showAmbiguityModal, setShowAmbiguityModal] = useState(false);
  const [selectedAmbiguousMapping, setSelectedAmbiguousMapping] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [resolvingAmbiguity, setResolvingAmbiguity] = useState(false);
  const [isAiResolving, setIsAiResolving] = useState(false);

  // Search, filter, and pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, MATCHED, AMBIGUOUS, UNMATCHED, MISMATCH, CHANGED, NEW
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // 10, 20, 50, ALL (-1)

  // Cell Editing Modal State
  const [editingCell, setEditingCell] = useState(null);
  const [isSavingCell, setIsSavingCell] = useState(false);

  const formatTo12Hr = (time24) => {
    if (!time24) return '';
    const parts = time24.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const handleOpenCellEditor = (emp, day, empIndex, dayIndex) => {
    const shiftType = (day.shiftType || '').toUpperCase();
    const isLeave = ['CL', 'PL', 'SL', 'HD', 'HDL', 'LOP', 'LWP', 'ML', 'PTL', 'HL'].includes(shiftType);
    const isOther = ['WO', 'OFF', 'NA', 'BLANK'].includes(shiftType);

    let initialMode = 'SHIFT';
    if (isLeave) initialMode = 'LEAVE';
    else if (isOther) initialMode = 'OTHER';

    setEditingCell({
      emp,
      day,
      empIndex,
      dayIndex,
      mode: initialMode,
      shiftLabel: day.shiftType === 'SHIFT' && day.shiftLabel ? day.shiftLabel : '10 AM - 7 PM',
      useCustomTime: false,
      customStart: day.shiftStartTime ? day.shiftStartTime.slice(0, 5) : '10:00',
      customEnd: day.shiftEndTime ? day.shiftEndTime.slice(0, 5) : '19:00',
      leaveType: isLeave ? (shiftType === 'HDL' ? 'HD' : shiftType) : 'CL',
      otherType: isOther ? (shiftType === 'OFF' ? 'WO' : shiftType) : 'WO'
    });
  };

  const handleSaveCellOverride = async () => {
    if (!editingCell) return;
    setIsSavingCell(true);
    try {
      const payload = {
        rosterEmployeeName: editingCell.emp.rosterEmployeeName,
        employeeId: editingCell.emp.matchedEmployeeId || editingCell.emp.id,
        date: editingCell.day.date,
      };

      if (editingCell.mode === 'SHIFT') {
        payload.shiftType = 'SHIFT';
        if (editingCell.useCustomTime) {
          payload.shiftStartTime = `${editingCell.customStart}:00`;
          payload.shiftEndTime = `${editingCell.customEnd}:00`;
          payload.shiftLabel = `${formatTo12Hr(editingCell.customStart)} - ${formatTo12Hr(editingCell.customEnd)}`;
        } else {
          payload.shiftLabel = editingCell.shiftLabel;
        }
      } else if (editingCell.mode === 'LEAVE') {
        payload.shiftType = editingCell.leaveType;
        payload.shiftLabel = editingCell.leaveType;
      } else {
        payload.shiftType = editingCell.otherType;
        payload.shiftLabel = editingCell.otherType === 'BLANK' ? null : editingCell.otherType;
      }

      const res = await rosterService.overrideCell(jobId, payload);
      const resData = res?.data || res;

      if (resData?.parsedRoster) {
        setPreviewData((prev) => ({
          ...prev,
          parsedRoster: resData.parsedRoster,
          diffSummary: resData.diffSummary || prev.diffSummary
        }));
      }

      toast.success(
        `Updated ${editingCell.emp.rosterEmployeeName} on ${editingCell.day.date} (${payload.shiftLabel || payload.shiftType})`
      );
      setEditingCell(null);
    } catch (err) {
      console.error('Failed to override cell:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to update shift/leave cell.');
    } finally {
      setIsSavingCell(false);
    }
  };

  useEffect(() => {
    if (!previewData && jobId) {
      fetchPreview();
    }
  }, [jobId]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await rosterService.getPreview(jobId);
      setPreviewData(response?.data || response);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load roster preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAmbiguity = (mapping) => {
    setSelectedAmbiguousMapping(mapping);
    setSelectedEmployeeId(mapping.alternativeMatches?.[0]?.employeeId || '');
    setShowAmbiguityModal(true);
  };

  const handleConfirmResolution = async () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee to map.');
      return;
    }

    try {
      setResolvingAmbiguity(true);
      await rosterService.resolveAmbiguity(selectedAmbiguousMapping.id, selectedEmployeeId);
      toast.success('Employee mapping resolved successfully.');
      setShowAmbiguityModal(false);
      // Re-fetch preview to refresh states
      await fetchPreview();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to resolve employee mapping.');
    } finally {
      setResolvingAmbiguity(false);
    }
  };

  const handleAiAutoResolve = async () => {
    try {
      setIsAiResolving(true);
      const res = await rosterService.aiAutoResolve(jobId);
      if (res.success) {
        toast.success(res.message || 'AI successfully automated employee resolutions!');
        await fetchPreview();
      }
    } catch (err) {
      console.error('AI auto-resolve error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to auto-resolve mappings with AI.');
    } finally {
      setIsAiResolving(false);
    }
  };

  const handleConfirmImport = async () => {
    const unresolvedAmbiguous =
      previewData.matchingResult?.ambiguous?.filter((m) => !m.resolvedAt && m.isAmbiguous) || [];

    if (unresolvedAmbiguous.length > 0) {
      toast.error(
        `Action required: Please resolve ${unresolvedAmbiguous.length} ambiguous employee mapping(s) before importing.`
      );
      return;
    }

    const matchedCount = previewData.matchingResult?.matchedCount || 0;
    const monthName = getMonthName(previewData.parsedRoster?.selectedMonth);
    const year = previewData.parsedRoster?.selectedYear;

    const leavesCount = previewData.diffSummary?.leavesDetected || 0;

    if (
      !window.confirm(
        `Confirm Monthly Roster Import?\n\n` +
          `• Target Period: ${monthName} ${year}\n` +
          `• Matched Employees: ${matchedCount}\n` +
          `• Shifts Added: ${previewData.diffSummary?.newAssignments || 0}\n` +
          `• Shifts Changed: ${previewData.diffSummary?.changedAssignments || 0}\n` +
          `• Leaves Auto-Synced: ${leavesCount}\n\n` +
          `Shift schedules and planned leaves will be automatically updated.\n` +
          `Emergency/ad-hoc leaves occurring outside this roster will follow the regular manual request workflow.`
      )
    ) {
      return;
    }

    try {
      setIsConfirming(true);
      const response = await rosterService.confirmImport(jobId);

      if (response.success) {
        toast.success('Roster synchronized successfully with HRMS!');
        navigate('/roster/history', {
          state: { importResult: response.data }
        });
      }
    } catch (err) {
      console.error('Confirm error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to confirm roster import.');
    } finally {
      setIsConfirming(false);
    }
  };

  const getMonthName = (month) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || month;
  };

  const getShiftTypeBadge = (day) => {
    const shiftType = (day.shiftType || '').toUpperCase();
    switch (shiftType) {
      case 'SHIFT':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/90',
          label: day.shiftLabel || 'Shift'
        };
      case 'WO':
      case 'OFF':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold hover:bg-slate-200/90',
          label: 'WO'
        };
      case 'CL':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold hover:bg-amber-100/90',
          label: 'CL'
        };
      case 'PL':
      case 'EL':
      case 'AL':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold hover:bg-emerald-100/90',
          label: 'PL'
        };
      case 'SL':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold hover:bg-rose-100/90',
          label: 'SL'
        };
      case 'HD':
      case 'HDL':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-300 font-semibold hover:bg-purple-100/90',
          label: 'HD'
        };
      case 'LOP':
      case 'LWP':
        return {
          bg: 'bg-slate-200 text-slate-800 border-slate-400 font-semibold hover:bg-slate-300',
          label: 'LOP'
        };
      case 'ML':
        return {
          bg: 'bg-pink-50 text-pink-700 border-pink-300 font-semibold hover:bg-pink-100/90',
          label: 'ML'
        };
      case 'PTL':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-300 font-semibold hover:bg-cyan-100/90',
          label: 'PTL'
        };
      case 'HL':
      case 'HOLIDAY':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-300 font-semibold hover:bg-orange-100/90',
          label: 'HL'
        };
      case 'NA':
        return {
          bg: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200/70',
          label: 'NA'
        };
      case 'BLANK':
        return {
          bg: 'bg-slate-50/50 text-gray-300 border-dashed border-gray-200 hover:bg-slate-100 hover:text-gray-500',
          label: '—'
        };
      default:
        return {
          bg: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
          label: day.originalValue || day.shiftLabel || '?'
        };
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    if (!previewData?.parsedRoster?.employees) return [];

    let list = previewData.parsedRoster.employees;
    const mappings = previewData.matchingResult?.mappings || [];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (emp) =>
          emp.rosterEmployeeName.toLowerCase().includes(q) ||
          (emp.designation && emp.designation.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter((emp) => {
        const mapping = mappings.find((m) => m.rosterEmployeeName === emp.rosterEmployeeName);
        if (statusFilter === 'MATCHED') return mapping && mapping.matchedEmployeeId && !mapping.isAmbiguous;
        if (statusFilter === 'AMBIGUOUS') return mapping && mapping.isAmbiguous && !mapping.resolvedAt;
        if (statusFilter === 'UNMATCHED') return !mapping || !mapping.matchedEmployeeId;
        if (statusFilter === 'MISMATCH') return emp.hasWorkingDaysDiscrepancy;
        if (statusFilter === 'CHANGED') return emp.dailyAssignments.some((d) => d.diffStatus === 'CHANGED');
        if (statusFilter === 'NEW') return emp.dailyAssignments.some((d) => d.diffStatus === 'NEW');
        return true;
      });
    }

    return list;
  }, [previewData, searchQuery, statusFilter]);

  // Paginated employees
  const paginatedEmployees = useMemo(() => {
    if (pageSize === -1) return filteredEmployees;
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredEmployees.length / pageSize);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading roster preview...</p>
      </div>
    );
  }

  if (error || !previewData) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Alert variant="error">{error || 'No preview data available.'}</Alert>
        <div>
          <Button onClick={() => navigate('/roster/history')} icon={ChevronLeft}>
            Back to Roster History
          </Button>
        </div>
      </div>
    );
  }

  const { parsedRoster, matchingResult, validation, diffSummary = {} } = previewData;
  const unresolvedAmbiguous =
    matchingResult?.ambiguous?.filter((m) => !m.resolvedAt && m.isAmbiguous) || [];

  return (
    <div className="max-w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            onClick={() => navigate('/roster/history')}
          >
            Back
          </Button>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>Roster Synchronization Preview</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-brand-600" />
              {getMonthName(parsedRoster.selectedMonth)} {parsedRoster.selectedYear} Roster
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              File: <span className="font-semibold text-slate-700">{parsedRoster.filename}</span> •{' '}
              {parsedRoster.totalEmployees} employees detected • {parsedRoster.daysInMonth} calendar days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            icon={RefreshCw}
            onClick={fetchPreview}
            title="Refresh preview data"
          >
            Refresh
          </Button>
          {unresolvedAmbiguous.length > 0 && (
            <Button
              variant="primary"
              size="md"
              icon={Sparkles}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              onClick={handleAiAutoResolve}
              disabled={isAiResolving}
              isLoading={isAiResolving}
            >
              {isAiResolving ? 'Resolving with AI...' : '✨ AI Auto-Resolve'}
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            icon={CheckCircle2}
            onClick={handleConfirmImport}
            disabled={unresolvedAmbiguous.length > 0 || isConfirming}
            isLoading={isConfirming}
          >
            {isConfirming ? 'Synchronizing...' : 'Confirm & Apply Roster'}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        {/* Total Employees */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Staff</p>
          <p className="text-xl font-black text-slate-900 mt-1">{matchingResult.totalRosterEmployees}</p>
        </div>

        {/* Matched */}
        <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-xs bg-emerald-50/30">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Matched</p>
          <p className="text-xl font-black text-emerald-800 mt-1">{matchingResult.matchedCount}</p>
        </div>

        {/* Ambiguous */}
        <div
          className={`border rounded-xl p-3 shadow-xs ${
            unresolvedAmbiguous.length > 0
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/50'
              : 'bg-white border-slate-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Ambiguous</p>
          <p className="text-xl font-black text-amber-800 mt-1">{matchingResult.ambiguousCount || 0}</p>
        </div>

        {/* Unmatched */}
        <div className="bg-white border border-rose-200 rounded-xl p-3 shadow-xs bg-rose-50/30">
          <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Unmatched</p>
          <p className="text-xl font-black text-rose-800 mt-1">{matchingResult.unmatchedCount || 0}</p>
        </div>

        {/* Shifts Added (New) */}
        <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-xs bg-blue-50/30">
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Shifts Added</p>
          <p className="text-xl font-black text-blue-800 mt-1">{diffSummary.newAssignments || 0}</p>
        </div>

        {/* Shifts Changed */}
        <div className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs bg-indigo-50/30">
          <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Shifts Changed</p>
          <p className="text-xl font-black text-indigo-800 mt-1">{diffSummary.changedAssignments || 0}</p>
        </div>

        {/* Leaves Auto-Synced */}
        <div className="bg-white border border-purple-200 rounded-xl p-3 shadow-xs bg-purple-50/30">
          <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Leaves Detected</p>
          <p className="text-xl font-black text-purple-800 mt-1">{diffSummary.leavesDetected || 0}</p>
        </div>

        {/* Unchanged */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unchanged</p>
          <p className="text-xl font-black text-slate-700 mt-1">{diffSummary.unchangedAssignments || 0}</p>
        </div>

        {/* Working Days Discrepancies */}
        <div
          className={`border rounded-xl p-3 shadow-xs ${
            diffSummary.workingDaysDiscrepancies > 0
              ? 'bg-amber-50 border-amber-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Discrepancy</p>
          <p className="text-xl font-black text-amber-900 mt-1">
            {diffSummary.workingDaysDiscrepancies || 0}
          </p>
        </div>
      </div>

      {/* Auto Synchronization Info Box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Automatic System Synchronization:</span> Upon confirming this import, shift schedules and planned leaves (CL, PL, SL, Half-Day, LOP, etc.) will be automatically updated across all matched employees. Any emergency or ad-hoc leaves arising outside this roster will continue to be requested and approved manually as needed.
        </div>
      </div>

      {/* Action Required: Ambiguities Banner */}
      {unresolvedAmbiguous.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-amber-900 text-sm">
                    Action Required: {unresolvedAmbiguous.length} Ambiguous Employee Mapping(s)
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Multiple active HRMS employees share similar names with the roster entries. You can manually select matches or let AI auto-disambiguate them.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Sparkles}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 self-start sm:self-auto shadow-xs"
                  onClick={handleAiAutoResolve}
                  disabled={isAiResolving}
                  isLoading={isAiResolving}
                >
                  {isAiResolving ? 'AI Resolving...' : '✨ Automate with AI'}
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {unresolvedAmbiguous.map((amb) => (
                  <div
                    key={amb.id}
                    className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {amb.roster_employee_name || amb.rosterEmployeeName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {amb.roster_designation || amb.rosterDesignation || 'No designation'}
                      </p>
                      <span className="text-[10px] text-amber-700 font-medium">
                        {amb.alternativeMatches?.length || amb.alternative_matches?.length || 0} candidate
                        matches
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="text-xs shrink-0"
                      onClick={() => handleResolveAmbiguity(amb)}
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {validation.warnings && validation.warnings.length > 0 && (
        <Alert variant="warning">
          <div className="font-bold text-xs uppercase tracking-wider mb-1">Roster Consistency Notes:</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {validation.warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {validation.warnings.length > 5 && (
              <li>...and {validation.warnings.length - 5} more notes</li>
            )}
          </ul>
        </Alert>
      )}

      {/* Calendar Grid & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search employee or designation..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              >
                <option value="ALL">All Employees ({parsedRoster.employees.length})</option>
                <option value="MATCHED">Matched Only ({matchingResult.matchedCount})</option>
                <option value="AMBIGUOUS">Ambiguous ({matchingResult.ambiguousCount || 0})</option>
                <option value="UNMATCHED">Unmatched ({matchingResult.unmatchedCount || 0})</option>
                <option value="MISMATCH">
                  Working Days Mismatch ({diffSummary.workingDaysDiscrepancies || 0})
                </option>
                <option value="CHANGED">Has Changed Shifts</option>
                <option value="NEW">Has New Shifts</option>
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={-1}>All</option>
              </select>
            </div>

            <span>
              Showing {filteredEmployees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {pageSize === -1
                ? filteredEmployees.length
                : Math.min(currentPage * pageSize, filteredEmployees.length)}{' '}
              of {filteredEmployees.length}
            </span>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronLeft}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 h-7 w-7"
                />
                <span className="font-semibold text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronRight}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 h-7 w-7"
                />
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/30 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
          <span className="font-bold text-slate-700">Legend:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Shift
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> WO (Weekly Off)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> CL (Casual Leave)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> HD (Holiday)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ● New Shift
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> ▲ Changed Shift
          </span>
        </div>

        {/* Scrollable Calendar Table */}
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-20 shadow-2xs">
              <tr>
                <th className="sticky left-0 bg-slate-100 px-3 py-2.5 font-bold border-r border-b border-slate-200 min-w-[200px] z-30">
                  Employee / HRMS Match
                </th>
                <th className="px-3 py-2.5 font-bold border-r border-b border-slate-200 min-w-[140px]">
                  Designation
                </th>
                {parsedRoster.dayColumns.map((day) => (
                  <th
                    key={day.dayNumber}
                    className={`px-2 py-2 text-center border-r border-b border-slate-200 min-w-[70px] ${
                      day.weekday === 'Sun' ? 'bg-red-50/50' : day.weekday === 'Sat' ? 'bg-slate-50/80' : ''
                    }`}
                  >
                    <div className="font-black text-slate-800">{day.dayNumber}</div>
                    <div className="text-[10px] font-medium text-slate-500 uppercase">{day.weekday}</div>
                  </th>
                ))}
                <th className="sticky right-0 bg-slate-100 px-3 py-2.5 text-center font-bold border-l border-b border-slate-200 min-w-[110px] z-30">
                  Working Days
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={parsedRoster.dayColumns.length + 3}
                    className="p-8 text-center text-slate-500"
                  >
                    No employee rows match the current search or filter.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, empIdx) => {
                  const mapping = matchingResult.mappings?.find(
                    (m) => m.rosterEmployeeName === emp.rosterEmployeeName
                  );
                  const isAmbiguous = mapping?.isAmbiguous && !mapping?.resolvedAt;
                  const isUnmatched = !mapping || !mapping.matchedEmployeeId;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Employee Name Column */}
                      <td className="sticky left-0 bg-white px-3 py-2.5 border-r border-slate-200 z-10 shadow-2xs">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-slate-900 text-xs truncate" title={emp.rosterEmployeeName}>
                            {emp.rosterEmployeeName}
                          </p>
                          {isAmbiguous ? (
                            <Badge variant="warning" size="xs">
                              Ambiguous
                            </Badge>
                          ) : isUnmatched ? (
                            <Badge variant="danger" size="xs">
                              Unmatched
                            </Badge>
                          ) : (
                            <Badge variant="success" size="xs">
                              Matched
                            </Badge>
                          )}
                        </div>
                        {mapping?.matchedEmployeeName && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            ➔ {mapping.matchedEmployeeName}{' '}
                            {mapping.matchedEmployeeCode && `(${mapping.matchedEmployeeCode})`}
                          </p>
                        )}
                      </td>

                      {/* Designation */}
                      <td className="px-3 py-2.5 border-r border-slate-200 text-slate-600 text-xs">
                        <p className="truncate max-w-[140px]" title={emp.designation || '—'}>
                          {emp.designation || '—'}
                        </p>
                      </td>

                      {/* Day Columns */}
                      {emp.dailyAssignments.map((day, idx) => {
                        const style = getShiftTypeBadge(day);
                        const isNew = day.diffStatus === 'NEW';
                        const isChanged = day.diffStatus === 'CHANGED';
                        const isOverridden = day.isOverridden;

                        return (
                          <td
                            key={idx}
                            onClick={() => handleOpenCellEditor(emp, day, empIdx, idx)}
                            className={`p-1 text-center border-r border-slate-100 cursor-pointer select-none transition-all group relative hover:bg-brand-50/40 ${
                              day.weekday === 'Sun' ? 'bg-red-50/20' : ''
                            }`}
                            title={`Click to edit shift timing or assign leave for ${emp.rosterEmployeeName} on ${day.date}`}
                          >
                            <div
                              className={`text-[10px] px-1 py-1 rounded border leading-tight relative font-medium transition-all group-hover:scale-105 group-hover:shadow-xs group-hover:ring-1 group-hover:ring-brand-400 ${style.bg} ${
                                isChanged ? 'ring-1 ring-amber-400' : ''
                              } ${isOverridden ? 'ring-2 ring-purple-500 font-bold' : ''}`}
                            >
                              {isNew && (
                                <span
                                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white"
                                  title="New Shift Assignment"
                                />
                              )}
                              {isChanged && (
                                <span
                                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white"
                                  title="Changed Assignment"
                                />
                              )}
                              {isOverridden && (
                                <span
                                  className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-purple-600 border border-white"
                                  title="Manually Overridden"
                                />
                              )}
                              <span className="block truncate">{style.label}</span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Working Days Column */}
                      <td className="sticky right-0 bg-white px-3 py-2 text-center border-l border-slate-200 z-10 shadow-2xs">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-black text-xs ${
                              emp.hasWorkingDaysDiscrepancy ? 'text-amber-700' : 'text-slate-800'
                            }`}
                          >
                            {emp.calculatedWorkingDays}
                          </span>
                          {emp.declaredWorkingDays > 0 && emp.hasWorkingDaysDiscrepancy && (
                            <span className="text-[10px] text-amber-600 font-semibold" title="Declared in spreadsheet">
                              (≠ {emp.declaredWorkingDays})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ambiguity Resolution Modal */}
      <Modal
        isOpen={showAmbiguityModal}
        onClose={() => setShowAmbiguityModal(false)}
        title="Resolve Ambiguous Employee Mapping"
        maxWidth="max-w-xl"
      >
        {selectedAmbiguousMapping && (
          <div className="space-y-4 text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Spreadsheet Entry:
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {selectedAmbiguousMapping.roster_employee_name ||
                  selectedAmbiguousMapping.rosterEmployeeName}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Designation in Roster:{' '}
                <span className="font-medium text-slate-800">
                  {selectedAmbiguousMapping.roster_designation ||
                    selectedAmbiguousMapping.rosterDesignation ||
                    'Not specified'}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Select Matching HRMS Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full py-2 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Choose matching employee --</option>
                {/* Suggested Alternatives */}
                {(
                  selectedAmbiguousMapping.alternativeMatches ||
                  selectedAmbiguousMapping.alternative_matches ||
                  []
                ).map((alt) => (
                  <option key={alt.employeeId} value={alt.employeeId}>
                    ★ {alt.fullName} ({alt.employeeCode}) — {alt.designation || 'Staff'} [
                    {(alt.confidence * 100).toFixed(0)}% Match]
                  </option>
                ))}
                {/* Full Active Employee List Fallback */}
                {previewData.matchingResult?.hrmsEmployees && (
                  <optgroup label="All Active HRMS Employees">
                    {previewData.matchingResult.hrmsEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode}) — {emp.designation || 'Staff'}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAmbiguityModal(false)}
                disabled={resolvingAmbiguity}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmResolution}
                disabled={!selectedEmployeeId || resolvingAmbiguity}
                isLoading={resolvingAmbiguity}
              >
                Confirm Mapping
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Cell Modal (Shift Timing & Leave Management) */}
      <Modal
        isOpen={!!editingCell}
        onClose={() => setEditingCell(null)}
        title="Edit Shift or Leave Assignment"
        subtitle={
          editingCell
            ? `${editingCell.emp.rosterEmployeeName} • ${editingCell.day.date} (${editingCell.day.weekday})`
            : ''
        }
        maxWidth="max-w-xl"
      >
        {editingCell && (
          <div className="space-y-5">
            {/* Context Header Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current Scheduled Value</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-black text-slate-800 text-sm">
                    {editingCell.day.shiftLabel || editingCell.day.shiftType}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({editingCell.day.originalValue || editingCell.day.shiftType})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500 font-medium">Employee Match</p>
                <p className="text-xs font-bold text-slate-700">
                  {matchingResult.mappings?.find(m => m.rosterEmployeeName === editingCell.emp.rosterEmployeeName)?.matchedEmployeeName || 'Auto-mapping'}
                </p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setEditingCell(prev => ({ ...prev, mode: 'SHIFT' }))}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  editingCell.mode === 'SHIFT'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Shift Timing
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(prev => ({ ...prev, mode: 'LEAVE' }))}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  editingCell.mode === 'LEAVE'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                Add Leave (Bucket Sync)
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(prev => ({ ...prev, mode: 'OTHER' }))}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  editingCell.mode === 'OTHER'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Week Off / Clear</span>
              </button>
            </div>

            {/* Mode 1: SHIFT */}
            {editingCell.mode === 'SHIFT' && (
              <div className="space-y-4">
                {/* Day Shifts Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      Day Shifts (10:00 AM – 09:00 PM)
                    </label>
                    <span className="text-[11px] text-slate-500">Starts 10:00 AM</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: '10 AM - 7 PM', desc: '10:00 AM – 07:00 PM (9 hrs standard)', badge: 'Standard' },
                      { label: '10 AM - 6 PM', desc: '10:00 AM – 06:00 PM (8 hrs)', badge: '8 hrs' },
                      { label: '10 AM - 9 PM', desc: '10:00 AM – 09:00 PM (11 hrs full day)', badge: 'Full Day' },
                      { label: '11 AM - 8 PM', desc: '11:00 AM – 08:00 PM (9 hrs)', badge: 'Mid-Day' },
                      { label: '12 PM - 9 PM', desc: '12:00 PM – 09:00 PM (9 hrs)', badge: 'Closing' },
                      { label: '10 AM - 4 PM', desc: '10:00 AM – 04:00 PM (6 hrs short)', badge: '6 hrs' },
                    ].map((preset) => {
                      const isSelected = !editingCell.useCustomTime && editingCell.shiftLabel === preset.label;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setEditingCell(prev => ({
                              ...prev,
                              shiftLabel: preset.label,
                              useCustomTime: false
                            }))
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-xs">{preset.label}</p>
                            <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded font-medium">
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Night Shift Section */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    Night Shift (10:00 PM – 04:00 AM)
                  </label>
                  <div>
                    {(() => {
                      const isSelected = !editingCell.useCustomTime && (editingCell.shiftLabel === '10 PM - 4 AM' || editingCell.shiftLabel === '10:00 PM - 04:00 AM');
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingCell(prev => ({
                              ...prev,
                              shiftLabel: '10 PM - 4 AM',
                              customStart: '22:00',
                              customEnd: '04:00',
                              useCustomTime: false
                            }))
                          }
                          className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 ring-2 ring-indigo-500/30 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-900 text-amber-300 flex items-center justify-center font-black">
                              🌙
                            </div>
                            <div>
                              <p className="font-bold text-xs">10 PM - 4 AM (Night Shift)</p>
                              <p className="text-[10px] text-slate-500">10:00 PM – 04:00 AM • 6 hours Overnight</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Overnight Shift
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Custom Shift Toggle & Inputs */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">Custom Time Selection</span>
                    <button
                      type="button"
                      onClick={() => setEditingCell(prev => ({ ...prev, useCustomTime: !prev.useCustomTime }))}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700"
                    >
                      {editingCell.useCustomTime ? 'Use Standard Presets' : 'Enter Custom Hours'}
                    </button>
                  </div>

                  {editingCell.useCustomTime && (
                    <div className="space-y-3 p-3 bg-blue-50/40 rounded-xl border border-blue-100">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Start Time (e.g. 10:00 AM)
                          </label>
                          <input
                            type="time"
                            value={editingCell.customStart}
                            onChange={(e) => setEditingCell(prev => ({ ...prev, customStart: e.target.value }))}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            End Time (e.g. 09:00 PM)
                          </label>
                          <input
                            type="time"
                            value={editingCell.customEnd}
                            onChange={(e) => setEditingCell(prev => ({ ...prev, customEnd: e.target.value }))}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingCell(prev => ({ ...prev, customStart: '22:00', customEnd: '04:00' }))}
                          className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                        >
                          🌙 Quick Set Night Shift (22:00 - 04:00)
                        </button>
                        <div className="text-xs text-blue-900 font-bold">
                          {formatTo12Hr(editingCell.customStart)} - {formatTo12Hr(editingCell.customEnd)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: LEAVE */}
            {editingCell.mode === 'LEAVE' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Automatic Leave Bucket Deduction
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Selecting a leave type creates an official approved leave record for this date and automatically minuses/deducts from the candidate's remaining leave bucket days.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { code: 'CL', label: 'Casual Leave', desc: '12.0 days quota' },
                    { code: 'PL', label: 'Planned / Privilege Leave', desc: '15.0 days quota' },
                    { code: 'SL', label: 'Sick Leave', desc: '10.0 days quota' },
                    { code: 'HD', label: 'Half Day (HDL)', desc: '0.5 day deduction' },
                    { code: 'LOP', label: 'Loss of Pay (LOP)', desc: 'Unpaid leave' },
                    { code: 'ML', label: 'Maternity Leave', desc: '180.0 days quota' },
                    { code: 'PTL', label: 'Paternity Leave', desc: '15.0 days quota' },
                    { code: 'HL', label: 'Holiday (HL)', desc: 'Company holiday' },
                  ].map((lt) => {
                    const isSelected = editingCell.leaveType === lt.code;
                    return (
                      <button
                        key={lt.code}
                        type="button"
                        onClick={() => setEditingCell(prev => ({ ...prev, leaveType: lt.code }))}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/90 text-amber-900 ring-2 ring-amber-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white mb-1">
                          {lt.code}
                        </span>
                        <p className="font-bold text-xs leading-tight">{lt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{lt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 3: OTHER / WEEK OFF */}
            {editingCell.mode === 'OTHER' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Select week-off or clear the day assignment for this employee:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: 'WO', label: 'Week Off (WO)', desc: 'Standard non-working day' },
                    { code: 'NA', label: 'Not Applicable (NA)', desc: 'Not scheduled / ineligible' },
                    { code: 'BLANK', label: 'Clear (—)', desc: 'Remove assignment' },
                  ].map((item) => {
                    const isSelected = editingCell.otherType === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setEditingCell(prev => ({ ...prev, otherType: item.code }))}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-slate-800 bg-slate-100 text-slate-900 ring-2 ring-slate-800/20 font-bold'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-bold text-xs">{item.label}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingCell(null)}
                disabled={isSavingCell}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                onClick={handleSaveCellOverride}
                disabled={isSavingCell}
                isLoading={isSavingCell}
              >
                Save & Update Schedule
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
