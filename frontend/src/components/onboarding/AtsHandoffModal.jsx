import React, { useState } from 'react';
import {
  Send,
  Building2,
  Calendar,
  IndianRupee,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';

const STANDARD_DEPARTMENTS = [
  'Operations',
  'HR',
  'Talent Acquisition',
  'Learning & Development',
  'IT',
  'Business Development',
];

const STANDARD_DESIGNATIONS = [
  'Operations Team Leader',
  'HR Executive',
  'Operations Executive',
  'Talent Acquisition Intern',
  'Talent Acquisition Specialist',
  'HR Intern',
  'IT Executive',
  'IT Intern',
  'BDM Support',
  'BDM Executive',
  'Talent Acquisition Head',
  'Operations Head',
  'Account Executive',
  'Talent Acquisition Team Leader',
];

export const AtsHandoffModal = ({ isOpen, onClose, onHandoffSuccess }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentName, setDepartmentName] = useState('Operations');
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [designationTitle, setDesignationTitle] = useState('Operations Executive');
  const [isCustomDesig, setIsCustomDesig] = useState(false);
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [salary, setSalary] = useState('1200000');
  const [location, setLocation] = useState('Bangalore / Hybrid');
  const [atsCandidateId, setAtsCandidateId] = useState(`cand_ats_${Date.now().toString().slice(-6)}`);

  const handleSimulateHandoff = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !dateOfJoining) {
      showError('Please complete all required candidate details.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        orgId: user?.orgId || 'org-1',
        atsCandidateId: atsCandidateId || `cand_ats_${Date.now()}`,
        atsJobId: 'job_ats_2026',
        firstName,
        lastName,
        email,
        phone,
        departmentName,
        designationTitle,
        dateOfJoining,
        location,
        salary: salary ? Number(salary) : 1200000,
        offerDocuments: [
          {
            title: `Signed Offer Letter - ${firstName} ${lastName}`,
            fileUrl: '/uploads/onboarding_documents/sample_offer.pdf',
            category: 'OFFER',
            documentType: 'OFFER_LETTER',
            fileSize: 184000,
            mimeType: 'application/pdf',
          },
        ],
      };

      const result = await onboardingService.triggerAtsHandoff(payload, `idem_${payload.atsCandidateId}`);
      showSuccess(`Candidate ${firstName} ${lastName} successfully ingested from ATS!`);

      if (onHandoffSuccess) {
        onHandoffSuccess(result.data);
      }
      onClose();
    } catch (err) {
      showError(err.message || 'ATS handoff failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ATS Handoff Simulator / Candidate Intake"
      subtitle="Receive and ingest an offer-accepted candidate from ATS Portal 2 into Onboarding."
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSimulateHandoff} className="space-y-4">
        <div className="p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 text-brand-900 dark:text-brand-200 text-xs flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            This API endpoint (`POST /api/v1/onboarding/ats-handoff`) implements idempotency headers,
            checks for duplicates against active employees & new hires, and persists offer documents.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Eleanor"
            required
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Vance"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Candidate Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="candidate@example.com"
            required
          />
          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 987 6543"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Department
            </label>
            {!isCustomDept ? (
              <select
                value={departmentName}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomDept(true);
                    setDepartmentName('');
                  } else {
                    setDepartmentName(e.target.value);
                  }
                }}
                className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              >
                {STANDARD_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                <option value="__custom__" className="font-semibold text-brand-600 bg-brand-50">
                  + Add Custom Department...
                </option>
              </select>
            ) : (
              <div className="flex gap-1.5">
                <Input
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="Enter custom department"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCustomDept(false);
                    setDepartmentName('Operations');
                  }}
                  className="shrink-0 text-xs"
                >
                  Presets
                </Button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Designation / Role
            </label>
            {!isCustomDesig ? (
              <select
                value={designationTitle}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomDesig(true);
                    setDesignationTitle('');
                  } else {
                    setDesignationTitle(e.target.value);
                  }
                }}
                className="block w-full rounded-lg border text-sm py-2.5 px-3.5 bg-white border-slate-300 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              >
                {STANDARD_DESIGNATIONS.map((desig) => (
                  <option key={desig} value={desig}>
                    {desig}
                  </option>
                ))}
                <option value="__custom__" className="font-semibold text-brand-600 bg-brand-50">
                  + Add Custom Designation...
                </option>
              </select>
            ) : (
              <div className="flex gap-1.5">
                <Input
                  value={designationTitle}
                  onChange={(e) => setDesignationTitle(e.target.value)}
                  placeholder="Enter custom designation"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCustomDesig(false);
                    setDesignationTitle('Operations Executive');
                  }}
                  className="shrink-0 text-xs"
                >
                  Presets
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Joining Date"
            type="date"
            value={dateOfJoining}
            onChange={(e) => setDateOfJoining(e.target.value)}
            required
          />
          <Input
            label="Annual Salary (₹)"
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="1200000"
          />
          <Input
            label="Work Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Bangalore / Hybrid / Remote"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={Send}>
            Ingest ATS Candidate
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AtsHandoffModal;
