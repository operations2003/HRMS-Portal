import React, { useState } from 'react';
import {
  UserCheck,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';

const EMPLOYMENT_TYPES = [
  { value: 'Full-Time', label: 'Full-Time Permanent' },
  { value: 'Part-Time', label: 'Part-Time' },
  { value: 'Contract', label: 'Contract / Fixed Term' },
  { value: 'Internship', label: 'Intern' },
];

export const ConvertToEmployeeModal = ({
  isOpen,
  onClose,
  candidate,
  onConverted,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [salary, setSalary] = useState(candidate?.salary || candidate?.compensationRef || '');
  const [dateOfJoining, setDateOfJoining] = useState(candidate?.dateOfJoining || '');
  const [employmentType, setEmploymentType] = useState('Full-Time');

  if (!candidate) return null;

  const isBgvRedFlag = candidate.bgvStatus === 'RED_FLAG';

  const handleConvert = async (e) => {
    e.preventDefault();
    if (isBgvRedFlag) {
      showError('Cannot convert candidate: Background Verification is marked RED FLAG.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        salary: salary ? Number(salary) : undefined,
        dateOfJoining: dateOfJoining || candidate.dateOfJoining,
        employmentType,
      };

      const result = await onboardingService.convertToEmployee(candidate.id, payload);
      showSuccess(
        result.message ||
          `Candidate converted to Employee (${result.employeeCode}) successfully!`
      );

      if (onConverted) {
        onConverted(result);
      }
      onClose();
    } catch (err) {
      showError(err.message || 'Failed to convert candidate to employee.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Day-1 Conversion: Link to Employee Master"
      subtitle={`Officially activate ${candidate.fullName} as a verified employee in HRMS.`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleConvert} className="space-y-4">
        {/* Warning if BGV is RED_FLAG */}
        {isBgvRedFlag ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold text-sm">Background Verification Blocked</p>
              <p className="mt-0.5">
                This candidate's BGV has been marked as <strong>RED_FLAG</strong>. Enterprise HR
                policy prohibits converting red-flagged candidates into the Employee Master.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 text-xs flex items-start gap-3">
            <Sparkles className="w-5 h-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="font-semibold text-sm">Day-1 Profile Activation</p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                This transaction links the new hire to the official Employee Master, generates an
                official Employee Code (`EMP-YYYY-XXXX`), and reassigns all Document Vault records to
                active employee ownership without creating duplicate profiles.
              </p>
            </div>
          </div>
        )}

        {/* Candidate Summary Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Candidate:</span>
            <p className="font-bold text-slate-900 dark:text-white">{candidate.fullName}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Email:</span>
            <p className="font-bold text-slate-900 dark:text-white truncate">{candidate.email}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Department:</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {candidate.department?.name || 'Department Unassigned'}
            </p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Designation:</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {candidate.designation?.title || 'Role Unassigned'}
            </p>
          </div>
        </div>

        {/* Override Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <Input
            label="Annual Compensation ($)"
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="e.g. 120000"
          />
          <Input
            label="Official Joining Date"
            type="date"
            value={dateOfJoining}
            onChange={(e) => setDateOfJoining(e.target.value)}
            required
          />
        </div>

        <Select
          label="Employment Classification"
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}
          options={EMPLOYMENT_TYPES}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            loading={loading}
            disabled={isBgvRedFlag}
            icon={UserCheck}
          >
            Approve & Convert to Employee
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ConvertToEmployeeModal;
