import React, { useState, useEffect } from 'react';
import { User, Calendar, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { employeeService } from '../../services/employeeService.js';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const InitiateExitModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDefaultLwdStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [resignationDate, setResignationDate] = useState(getTodayStr());
  const [lastWorkingDay, setLastWorkingDay] = useState(getDefaultLwdStr());
  const [notes, setNotes] = useState('');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      setResignationDate(getTodayStr());
      setLastWorkingDay(getDefaultLwdStr());
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const loadEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      setError(null);
      const res = await employeeService.getAllEmployees();
      const list = Array.isArray(res?.employees)
        ? res.employees
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];

      // Filter only employees eligible for exit (not already Exited, Terminated, or Inactive)
      const eligible = list.filter(
        (e) => !['Exited', 'Terminated', 'Inactive'].includes(e.status)
      );
      setEmployees(eligible);
      if (eligible.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(eligible[0].id);
      }
    } catch (err) {
      setError('Failed to load employee list. Please try again.');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setError('Please select an employee.');
      return;
    }
    if (!resignationDate) {
      setError('Please enter the resignation date.');
      return;
    }
    if (!lastWorkingDay) {
      setError('Please enter the last working day.');
      return;
    }
    if (new Date(lastWorkingDay) < new Date(resignationDate)) {
      setError('Last working day cannot be earlier than resignation date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await exitService.initiateExitChecklist({
        employeeId: selectedEmployeeId,
        resignationDate,
        lastWorkingDay,
        notes: notes.trim(),
      });
      toast.success('Exit process initiated and 5 checklist items generated successfully.');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to initiate exit process.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Initiate Employee Exit Process"
      subtitle="HR & Admin: Select an employee and record their exit dates to automatically generate the exit checklist."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Employee Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
            Select Employee <span className="text-rose-500">*</span>
          </label>
          {isLoadingEmployees ? (
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-500 bg-slate-50">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
              <span>Loading employees...</span>
            </div>
          ) : (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              required
            >
              <option value="" disabled>
                -- Select an Employee --
              </option>
              {employees.map((emp) => {
                const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.fullName;
                const dept = emp.department?.name || emp.department || '';
                return (
                  <option key={emp.id} value={emp.id}>
                    {name} ({emp.employeeCode || emp.empCode || 'EMP'}) {dept ? `— ${dept}` : ''} [{emp.status}]
                  </option>
                );
              })}
            </select>
          )}

          {selectedEmp && (
            <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {selectedEmp.firstName} {selectedEmp.lastName}
                </span>{' '}
                ({selectedEmp.employeeCode || 'EMP'})
              </div>
              <div className="text-slate-500">
                {selectedEmp.designation?.title || selectedEmp.designation || 'Staff'}
              </div>
            </div>
          )}
        </div>

        {/* Resignation Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Resignation Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={resignationDate}
            onChange={(e) => setResignationDate(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            required
          />
          <p className="text-[11px] text-slate-400 mt-1">Date when employee tendered their resignation.</p>
        </div>

        {/* Last Working Day */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Last Working Day <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={lastWorkingDay}
            onChange={(e) => setLastWorkingDay(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            required
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Official agreed final day of employment for handing over responsibilities.
          </p>
        </div>

        {/* Notes (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Initiation Remarks / Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add any internal HR notes or remarks..."
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Auto-generated Checklist Notice */}
        <div className="p-3 bg-brand-50/70 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/40 rounded-xl text-[11px] text-brand-900 dark:text-brand-300">
          <p className="font-semibold mb-1">The following 5 checklist items will be generated automatically:</p>
          <ul className="list-disc list-inside space-y-0.5 text-brand-800 dark:text-brand-300">
            <li>Resignation Approved</li>
            <li>Knowledge Transfer Completed</li>
            <li>Company Assets Returned</li>
            <li>System Access Revoked</li>
            <li>Full & Final Settlement Completed</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            Initiate Exit Process
          </Button>
        </div>
      </form>
    </Modal>
  );
};
