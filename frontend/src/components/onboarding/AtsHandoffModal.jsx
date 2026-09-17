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

export const AtsHandoffModal = ({ isOpen, onClose, onHandoffSuccess }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentName, setDepartmentName] = useState('Engineering');
  const [designationTitle, setDesignationTitle] = useState('Software Engineer');
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
          <Input
            label="Department"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            placeholder="Engineering"
          />
          <Input
            label="Designation / Role"
            value={designationTitle}
            onChange={(e) => setDesignationTitle(e.target.value)}
            placeholder="Senior Product Designer"
          />
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
