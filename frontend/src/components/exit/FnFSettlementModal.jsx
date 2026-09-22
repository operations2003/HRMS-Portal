import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ShieldCheck,
  Send,
  Edit3,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { FnFStatementDocument } from './FnFStatementDocument.jsx';
import { CalculateFnFModal } from './CalculateFnFModal.jsx';
import { DisburseFnFModal } from './DisburseFnFModal.jsx';

export const FnFSettlementModal = ({
  isOpen,
  onClose,
  onSuccess,
  exitRequestId,
  record,
  canManage = false,
}) => {
  const toast = useToast();

  const [fnf, setFnf] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Submodals
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const fetchFnf = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await exitService.getFnf(exitRequestId);
      setFnf(data);
    } catch (err) {
      setError(err.message || 'Failed to load FnF settlement details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && exitRequestId) {
      fetchFnf();
    }
  }, [isOpen, exitRequestId]);

  const handleApproveConfirm = async () => {
    try {
      setIsApproving(true);
      setError(null);
      const updated = await exitService.approveFnf(exitRequestId, {
        notes: 'FnF settlement reviewed and approved by HR/Finance.',
      });
      setFnf(updated);
      setIsApproveConfirmOpen(false);
      toast.success('FnF statement approved successfully! Generated vault document and notified employee.');
      onSuccess?.(updated);
    } catch (err) {
      setError(err.message || 'Failed to approve FnF settlement.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCalculated = (updatedFnf) => {
    setFnf(updatedFnf);
    onSuccess?.(updatedFnf);
  };

  const handleDisbursed = (updatedFnf) => {
    setFnf(updatedFnf);
    onSuccess?.(updatedFnf);
  };

  const empName =
    record?.employee?.fullName ||
    `${record?.employee?.firstName || ''} ${record?.employee?.lastName || ''}`.trim() ||
    record?.employeeName ||
    fnf?.employeeName ||
    'Employee';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Full & Final Settlement — ${empName}`}
        subtitle={`Dossier Ref: ${exitRequestId}`}
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <LoadingSpinner message="Retrieving Full & Final settlement statement..." />
            </div>
          ) : (
            <FnFStatementDocument
              fnf={fnf}
              exitRecord={record}
              canManage={canManage}
              onCalculate={() => setIsCalcOpen(true)}
              onApprove={() => setIsApproveConfirmOpen(true)}
              onDisburse={() => setIsDisburseOpen(true)}
            />
          )}
        </div>
      </Modal>

      {/* Submodal: Calculate / Adjust FnF */}
      {isCalcOpen && (
        <CalculateFnFModal
          isOpen={isCalcOpen}
          onClose={() => setIsCalcOpen(false)}
          exitRequestId={exitRequestId}
          employeeName={empName}
          initialFnf={fnf}
          clearanceRecoveryTotal={parseFloat(record?.clearancesSummary?.totalRecoveryAmount || 0)}
          onCalculated={handleCalculated}
        />
      )}

      {/* Submodal: Disburse FnF Payment */}
      {isDisburseOpen && (
        <DisburseFnFModal
          isOpen={isDisburseOpen}
          onClose={() => setIsDisburseOpen(false)}
          exitRequestId={exitRequestId}
          employeeName={empName}
          netAmount={fnf?.netSettlementAmount || 0}
          onDisbursed={handleDisbursed}
        />
      )}

      {/* Confirmation Dialog: Approve FnF */}
      <ConfirmDialog
        isOpen={isApproveConfirmOpen}
        onClose={() => setIsApproveConfirmOpen(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Full & Final Statement?"
        message={`Are you sure you want to approve the Full & Final settlement of ₹${parseFloat(
          fnf?.netSettlementAmount || 0
        ).toLocaleString('en-IN', { minimumFractionDigits: 2 })} for ${empName}? This will finalize calculations, archive a signed statement in the Document Vault, and alert the employee.`}
        confirmText="Approve Settlement"
        confirmVariant="primary"
        isLoading={isApproving}
      />
    </>
  );
};
