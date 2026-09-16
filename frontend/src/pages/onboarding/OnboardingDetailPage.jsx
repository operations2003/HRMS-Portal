import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  UserCheck,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  Code,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { OnboardingChecklist } from '../../components/onboarding/OnboardingChecklist.jsx';
import { DocumentVaultUploader } from '../../components/onboarding/DocumentVaultUploader.jsx';
import { ItSetupTracker } from '../../components/onboarding/ItSetupTracker.jsx';
import { ConvertToEmployeeModal } from '../../components/onboarding/ConvertToEmployeeModal.jsx';

export const OnboardingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [activeTab, setActiveTab] = useState('checklist'); // 'checklist' | 'documents' | 'it' | 'ats'
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Scoped permissions
  const canWrite = hasPermission('onboarding:write') || hasPermission('employee:write');
  const canVerify = hasPermission('onboarding:verify') || hasPermission('document:write') || canWrite;
  const canManageIt = hasPermission('it:write') || canWrite;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [candDetails, status] = await Promise.all([
        onboardingService.getNewHireById(id),
        onboardingService.getOnboardingStatus(id),
      ]);
      setCandidate(candDetails);
      setStatusData(status);
    } catch (err) {
      showError(err.message || 'Failed to load candidate onboarding details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-16 flex justify-center">
        <LoadingSpinner fullPage message="Loading candidate onboarding workspace..." />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="p-12 text-center">
        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
          Candidate record not found.
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/onboarding')}>
          Back to Onboarding Dashboard
        </Button>
      </div>
    );
  }

  const tracker = candidate.readinessTracker || {};
  const completionPercentage = tracker.completionPercentage || 0;
  const isConverted = candidate.lifecycleState === 'CONVERTED_TO_EMPLOYEE';
  const documents = candidate.documents || [];

  return (
    <div className="space-y-6">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Onboarding Pipeline
        </button>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchData}>
            Refresh
          </Button>

          {/* Day-1 Conversion Action */}
          {canWrite && !isConverted && (
            <Button
              variant="success"
              icon={UserCheck}
              onClick={() => setIsConvertModalOpen(true)}
            >
              Approve & Convert to Employee
            </Button>
          )}

          {isConverted && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Converted Employee ({candidate.employeeId || 'Active'})</span>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              {candidate.firstName?.[0]}
              {candidate.lastName?.[0]}
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {candidate.fullName}
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                  ATS: {candidate.atsCandidateId}
                </span>
                {isConverted ? (
                  <Badge variant="success">Active Employee</Badge>
                ) : (
                  <Badge variant="info">{candidate.onboardingStatus}</Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {candidate.department?.name || 'Department Unassigned'}
                </span>
                <span>•</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {candidate.designation?.title || 'Senior Software Engineer'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Day-1 Joining: <strong className="text-slate-800 dark:text-slate-200">{candidate.dateOfJoining}</strong>
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                  {candidate.email}
                </span>
                {candidate.phone && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    {candidate.phone}
                  </span>
                )}
                {candidate.location && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3.5 h-3.5" />
                    {candidate.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Readiness Percentage Circle & Bar */}
          <div className="lg:text-right border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
            <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Overall Day-1 Readiness
              </span>
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {completionPercentage}%
              </span>
            </div>
            <div className="w-full lg:w-48 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completionPercentage === 100
                    ? 'bg-emerald-500'
                    : completionPercentage >= 50
                    ? 'bg-indigo-600'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={`pb-3.5 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'checklist'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Onboarding Checklist & Stages
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3.5 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Document Vault ({documents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('it')}
          className={`pb-3.5 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'it'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Laptop className="w-4 h-4" />
          IT Setup & Access
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ats')}
          className={`pb-3.5 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'ats'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Code className="w-4 h-4" />
          ATS Payload Record
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'checklist' && (
        <OnboardingChecklist
          candidateId={candidate.id}
          checklist={candidate.readinessTracker}
          bgvStatus={candidate.bgvStatus}
          canEdit={canWrite}
          onChecklistUpdated={(updatedTracker) => {
            setCandidate((prev) => ({ ...prev, readinessTracker: updatedTracker }));
          }}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentVaultUploader
          candidateId={candidate.id}
          documents={documents}
          canVerify={canVerify}
          canUpload={canWrite}
          onDocumentsUpdated={fetchData}
        />
      )}

      {activeTab === 'it' && (
        <ItSetupTracker
          candidateId={candidate.id}
          itSetup={candidate.itSetup || {}}
          canManage={canManageIt}
          onItSetupUpdated={(updatedIt) => {
            setCandidate((prev) => ({ ...prev, itSetup: updatedIt }));
            fetchData();
          }}
        />
      )}

      {activeTab === 'ats' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              ATS Hiring Payload Ingestion Data
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Candidate ID: {candidate.atsCandidateId}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Raw payload transmitted by ATS Portal 2 during the candidate handoff event.
          </p>

          <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
            {JSON.stringify(candidate, null, 2)}
          </pre>
        </div>
      )}

      {/* Convert to Employee Modal */}
      {isConvertModalOpen && (
        <ConvertToEmployeeModal
          isOpen={true}
          onClose={() => setIsConvertModalOpen(false)}
          candidate={candidate}
          onConverted={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default OnboardingDetailPage;
