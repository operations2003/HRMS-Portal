import React, { useState, useEffect } from 'react';
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
  Download,
  Upload,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { rosterService } from '../../services/rosterService';
import { useToast } from '../../context/ToastContext';

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

  useEffect(() => {
    if (!previewData && jobId) {
      fetchPreview();
    }
  }, [jobId]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const response = await rosterService.getPreview(jobId);
      setPreviewData(response.data);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.message || 'Failed to load roster preview.');
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
      toast.error('Please select an employee.');
      return;
    }

    try {
      setResolvingAmbiguity(true);
      await rosterService.resolveAmbiguity(selectedAmbiguousMapping.id, selectedEmployeeId);
      toast.success('Employee mapping resolved successfully.');
      setShowAmbiguityModal(false);
      
      // Refresh preview
      await fetchPreview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve mapping.');
    } finally {
      setResolvingAmbiguity(false);
    }
  };

  const handleConfirmImport = async () => {
    // Check for unresolved ambiguities
    const unresolvedAmbiguous = previewData.matchingResult?.ambiguous?.filter(
      m => !m.resolvedAt
    ) || [];

    if (unresolvedAmbiguous.length > 0) {
      toast.error(`Please resolve ${unresolvedAmbiguous.length} ambiguous employee mapping(s) before confirming.`);
      return;
    }

    if (!window.confirm(
      `Are you sure you want to import this roster?\n\n` +
      `This will create/update ${previewData.matchingResult.matchedCount} employee schedules for ` +
      `${getMonthName(previewData.parsedRoster.selectedMonth)} ${previewData.parsedRoster.selectedYear}.`
    )) {
      return;
    }

    try {
      setIsConfirming(true);
      const response = await rosterService.confirmImport(jobId);
      
      if (response.success) {
        toast.success('Roster imported and synchronized successfully!');
        navigate('/roster/history', {
          state: { importResult: response.data }
        });
      }
    } catch (err) {
      console.error('Confirm error:', err);
      toast.error(err.response?.data?.message || 'Failed to confirm roster import.');
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

  const getShiftTypeColor = (shiftType) => {
    switch (shiftType) {
      case 'SHIFT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'WO':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'CL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'HD':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'NA':
        return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'BLANK':
        return 'bg-white text-gray-400 border-gray-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="error">{error}</Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/roster/import')}>
            Back to Import
          </Button>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="error">No preview data available.</Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/roster/import')}>
            Back to Import
          </Button>
        </div>
      </div>
    );
  }

  const { parsedRoster, matchingResult, validation } = previewData;
  const unresolvedAmbiguous = matchingResult.ambiguous.filter(m => !m.resolvedAt);

  return (
    <div className="max-w-full mx-auto p-6 space-y-6">
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
              <Calendar className="w-7 h-7 text-brand-600" />
              Roster Preview - {getMonthName(parsedRoster.selectedMonth)} {parsedRoster.selectedYear}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {parsedRoster.filename} • {parsedRoster.totalEmployees} employees • {parsedRoster.daysInMonth} days
            </p>
          </div>
        </div>
        <Button
          onClick={handleConfirmImport}
          disabled={unresolvedAmbiguous.length > 0 || isConfirming}
          isLoading={isConfirming}
          icon={CheckCircle2}
        >
          {isConfirming ? 'Importing...' : 'Confirm & Import'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Employees</p>
              <p className="text-2xl font-bold text-slate-900">{matchingResult.totalRosterEmployees}</p>
            </div>
            <Users className="w-8 h-8 text-slate-400" />
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Matched</p>
              <p className="text-2xl font-bold text-green-900">{matchingResult.matchedCount}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700">Ambiguous</p>
              <p className="text-2xl font-bold text-amber-900">{matchingResult.ambiguousCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Unmatched</p>
              <p className="text-2xl font-bold text-red-900">{matchingResult.unmatchedCount}</p>
            </div>
            <UserX className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Validation Warnings */}
      {validation.warnings && validation.warnings.length > 0 && (
        <Alert variant="warning">
          <div className="font-semibold mb-2">Validation Warnings:</div>
          <ul className="list-disc list-inside text-sm space-y-1">
            {validation.warnings.slice(0, 5).map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
            {validation.warnings.length > 5 && (
              <li>...and {validation.warnings.length - 5} more warnings</li>
            )}
          </ul>
        </Alert>
      )}

      {/* Unresolved Ambiguities Warning */}
      {unresolvedAmbiguous.length > 0 && (
        <Alert variant="error">
          <div className="font-semibold mb-2">
            Action Required: {unresolvedAmbiguous.length} employee mapping(s) need to be resolved
          </div>
          <p className="text-sm">
            Multiple HRMS employees match some roster names. Please review and select the correct employee for each ambiguous entry below.
          </p>
        </Alert>
      )}

      {/* Ambiguous Mappings */}
      {matchingResult.ambiguous && matchingResult.ambiguous.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Ambiguous Employee Mappings ({matchingResult.ambiguous.length})
          </h3>
          <div className="space-y-2">
            {matchingResult.ambiguous.map((mapping) => (
              <div
                key={mapping.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  mapping.resolvedAt
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-300'
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {mapping.rosterEmployeeName}
                    {mapping.rosterDesignation && (
                      <span className="text-sm text-slate-600 ml-2">({mapping.rosterDesignation})</span>
                    )}
                  </p>
                  {mapping.resolvedAt ? (
                    <p className="text-sm text-green-700">
                      ✓ Resolved: Matched to {mapping.matchedEmployeeName}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700">
                      {mapping.alternativeMatches.length} possible matches found
                    </p>
                  )}
                </div>
                {!mapping.resolvedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolveAmbiguity(mapping)}
                    className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  >
                    Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Employees */}
      {matchingResult.unmatched && matchingResult.unmatched.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Unmatched Employees ({matchingResult.unmatched.length})
          </h3>
          <p className="text-sm text-red-700 mb-3">
            These roster entries could not be matched to any HRMS employee and will be skipped.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {matchingResult.unmatched.map((mapping) => (
              <div key={mapping.id} className="p-2 bg-red-50 rounded border border-red-200">
                <p className="text-sm font-medium text-slate-900">{mapping.rosterEmployeeName}</p>
                {mapping.rosterDesignation && (
                  <p className="text-xs text-slate-600">{mapping.rosterDesignation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster Calendar Preview - Show first 5 employees as sample */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-600" />
            Roster Preview (First 5 Employees)
          </h3>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-700 border-r border-slate-200">
                  Employee
                </th>
                {parsedRoster.dayColumns.map((day) => (
                  <th key={day.dayNumber} className="px-2 py-2 text-center font-medium text-slate-600">
                    <div>{day.dayNumber}</div>
                    <div className="text-[10px] text-slate-400">{day.weekday}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-l border-slate-200">
                  Days
                </th>
              </tr>
            </thead>
            <tbody>
              {parsedRoster.employees.slice(0, 5).map((emp) => {
                const mapping = matchingResult.mappings.find(
                  m => m.rosterEmployeeName === emp.rosterEmployeeName
                );
                
                return (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="sticky left-0 bg-white px-3 py-2 border-r border-slate-200">
                      <div className="font-medium text-slate-900 text-xs">{emp.rosterEmployeeName}</div>
                      {mapping && (
                        <div className="text-[10px] text-slate-500">
                          {mapping.matchedEmployeeName || 'Unmatched'}
                        </div>
                      )}
                    </td>
                    {emp.dailyAssignments.map((day, idx) => (
                      <td key={idx} className="px-1 py-1 text-center">
                        {day.shiftType !== 'BLANK' && (
                          <div
                            className={`text-[10px] px-1 py-1 rounded border ${getShiftTypeColor(day.shiftType)}`}
                            title={day.originalValue}
                          >
                            {day.shiftType === 'SHIFT'
                              ? day.shiftLabel
                              : day.shiftType}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center border-l border-slate-200">
                      <span className={emp.hasWorkingDaysDiscrepancy ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                        {emp.calculatedWorkingDays}
                        {emp.declaredWorkingDays > 0 && emp.hasWorkingDaysDiscrepancy && (
                          <span className="text-[10px] block text-red-500">
                            (≠{emp.declaredWorkingDays})
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {parsedRoster.employees.length > 5 && (
            <p className="text-center text-sm text-slate-500 mt-4">
              ...and {parsedRoster.employees.length - 5} more employees
            </p>
          )}
        </div>
      </div>

      {/* Ambiguity Resolution Modal */}
      <Modal
        isOpen={showAmbiguityModal}
        onClose={() => setShowAmbiguityModal(false)}
        title="Resolve Employee Mapping"
        maxWidth="max-w-2xl"
      >
        {selectedAmbiguousMapping && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-semibold text-amber-900">Roster Employee:</p>
              <p className="text-lg">{selectedAmbiguousMapping.rosterEmployeeName}</p>
              {selectedAmbiguousMapping.rosterDesignation && (
                <p className="text-sm text-amber-700">Designation: {selectedAmbiguousMapping.rosterDesignation}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Matching HRMS Employee: <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
              >
                <option value="">-- Select Employee --</option>
                {selectedAmbiguousMapping.alternativeMatches?.map((alt) => (
                  <option key={alt.employeeId} value={alt.employeeId}>
                    {alt.fullName}
                    {alt.designation && ` (${alt.designation})`}
                    {' - '}Confidence: {(alt.confidence * 100).toFixed(0)}%
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAmbiguityModal(false)}
                disabled={resolvingAmbiguity}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmResolution}
                disabled={!selectedEmployeeId || resolvingAmbiguity}
                isLoading={resolvingAmbiguity}
              >
                Confirm Selection
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
