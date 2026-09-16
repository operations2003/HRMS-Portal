import React, { useState } from 'react';
import {
  Laptop,
  Mail,
  KeyRound,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Copy,
  Check,
  Cpu,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';

const SYSTEM_OPTIONS = [
  'HRMS Portal',
  'Corporate Slack',
  'GitHub Enterprise',
  'Google Workspace / 365',
  'VPN & Zero Trust Access',
  'AWS Cloud Console',
  'Jira & Confluence',
];

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending Provisioning' },
  { value: 'IN_PROGRESS', label: 'In Progress (Hardware/Accounts Ordered)' },
  { value: 'COMPLETED', label: 'Completed & Verified' },
  { value: 'BLOCKED', label: 'Blocked / Missing Information' },
];

export const ItSetupTracker = ({
  candidateId,
  itSetup = {},
  canManage = false,
  onItSetupUpdated,
}) => {
  const { showSuccess, showError } = useToast();
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [workEmail, setWorkEmail] = useState(itSetup.workEmail || '');
  const [emailProvisioned, setEmailProvisioned] = useState(!!itSetup.emailProvisioned);
  const [hardwareAssigned, setHardwareAssigned] = useState(!!itSetup.hardwareAssigned);
  const [laptopModel, setLaptopModel] = useState(itSetup.laptopModel || '');
  const [assetTag, setAssetTag] = useState(itSetup.assetTag || '');
  const [status, setStatus] = useState(itSetup.status || 'PENDING');
  const [notes, setNotes] = useState(itSetup.notes || '');
  const [selectedSystems, setSelectedSystems] = useState(
    Array.isArray(itSetup.systemAccess) ? itSetup.systemAccess : ['HRMS Portal']
  );

  const handleCopyEmail = (email) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEdit = () => {
    setWorkEmail(itSetup.workEmail || '');
    setEmailProvisioned(!!itSetup.emailProvisioned);
    setHardwareAssigned(!!itSetup.hardwareAssigned);
    setLaptopModel(itSetup.laptopModel || '');
    setAssetTag(itSetup.assetTag || '');
    setStatus(itSetup.status || 'PENDING');
    setNotes(itSetup.notes || '');
    setSelectedSystems(Array.isArray(itSetup.systemAccess) ? itSetup.systemAccess : ['HRMS Portal']);
    setIsEditModalOpen(true);
  };

  const toggleSystem = (sys) => {
    if (selectedSystems.includes(sys)) {
      setSelectedSystems(selectedSystems.filter((s) => s !== sys));
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        workEmail,
        emailProvisioned,
        hardwareAssigned,
        laptopModel,
        assetTag,
        status,
        notes,
        systemAccess: selectedSystems,
      };

      const updated = await onboardingService.updateItSetup(candidateId, payload);
      showSuccess('IT provisioning setup updated successfully.');
      setIsEditModalOpen(false);

      if (onItSetupUpdated) {
        onItSetupUpdated(updated);
      }
    } catch (err) {
      showError(err.message || 'Failed to update IT setup.');
    } finally {
      setSaving(false);
    }
  };

  const isCompleted = itSetup.status === 'COMPLETED';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-purple-50/20 dark:from-slate-800/40 dark:to-purple-950/10">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-600" />
            IT & Digital Access Provisioning Tracker
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor workstation readiness, corporate credentials, and system licenses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={
              itSetup.status === 'COMPLETED'
                ? 'success'
                : itSetup.status === 'IN_PROGRESS'
                ? 'info'
                : 'warning'
            }
          >
            {itSetup.status || 'PENDING'}
          </Badge>

          {canManage && (
            <Button variant="secondary" size="sm" icon={Edit} onClick={handleOpenEdit}>
              Update IT Setup
            </Button>
          )}
        </div>
      </div>

      {/* Grid of 3 Status Pillars */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Corporate Email */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              {itSetup.emailProvisioned ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Provisioned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" /> Pending
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Corporate Email
            </h4>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 break-all">
              {itSetup.workEmail || 'Not provisioned yet'}
            </p>
          </div>

          {itSetup.workEmail && (
            <button
              type="button"
              onClick={() => handleCopyEmail(itSetup.workEmail)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy Email Address'}
            </button>
          )}
        </div>

        {/* 2. Hardware / Workstation */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
                <Laptop className="w-5 h-5" />
              </div>
              {itSetup.hardwareAssigned ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Assigned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" /> Unassigned
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Assigned Workstation
            </h4>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
              {itSetup.laptopModel || 'Equipment not yet assigned'}
            </p>
            {itSetup.assetTag && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Asset: {itSetup.assetTag}
              </p>
            )}
          </div>

          {itSetup.notes && (
            <p className="mt-3 text-xs text-slate-400 truncate" title={itSetup.notes}>
              {itSetup.notes}
            </p>
          )}
        </div>

        {/* 3. System Access */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {Array.isArray(itSetup.systemAccess) ? itSetup.systemAccess.length : 1} Systems
              </span>
            </div>

            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              System Access Granted
            </h4>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Array.isArray(itSetup.systemAccess) && itSetup.systemAccess.length > 0 ? (
                itSetup.systemAccess.map((sys) => (
                  <span
                    key={sys}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200"
                  >
                    <Check className="w-3 h-3 text-emerald-500" />
                    {sys}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">Default access pending</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Provisioning Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          title="Update IT Provisioning State"
          subtitle="Configure corporate email, assign hardware tags, and grant platform licenses."
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Work Email Address"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="name@tasknera.com"
              />
              <Select
                label="Provisioning Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Laptop / Workstation Model"
                value={laptopModel}
                onChange={(e) => setLaptopModel(e.target.value)}
                placeholder="e.g. MacBook Pro 16 M3 / Dell XPS 15"
              />
              <Input
                label="Hardware Asset Tag / Serial"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g. TAG-2026-9042"
              />
            </div>

            {/* Checkbox toggles */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailProvisioned}
                  onChange={(e) => setEmailProvisioned(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Mark Corporate Email as Active & Provisioned
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hardwareAssigned}
                  onChange={(e) => setHardwareAssigned(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Workstation Imaged & Physically Assigned to Candidate
                </span>
              </label>
            </div>

            {/* System Access checkboxes */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Provision System Accounts & Licenses
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SYSTEM_OPTIONS.map((sys) => {
                  const checked = selectedSystems.includes(sys);
                  return (
                    <label
                      key={sys}
                      className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                        checked
                          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSystem(sys)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{sys}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Input
              label="Logistics & Setup Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Courier tracking # or 2FA handover notes"
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Save IT Setup
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ItSetupTracker;
