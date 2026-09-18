import React, { useState } from 'react';
import {
  Wallet,
  Send,
  Building,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const DisburseFnFModal = ({
  isOpen,
  onClose,
  exitRequestId,
  employeeName = 'Employee',
  netAmount = 0,
  onDisbursed = null,
}) => {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    paymentMode: 'BANK_TRANSFER',
    disbursementReference: `TXN-${Date.now().toString().slice(-6)}`,
    notes: 'Full and final settlement credited.',
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!exitRequestId) {
      setError('Exit request reference missing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await exitService.disburseFnf(exitRequestId, {
        paymentMode: formData.paymentMode,
        disbursementReference: formData.disbursementReference,
        notes: `${formData.paymentMode} Ref: ${formData.disbursementReference}. ${formData.notes}`,
      });

      toast.success('Full & Final settlement disbursed successfully!');
      onDisbursed?.(result);
      onClose();
    } catch (err) {
      console.error('Disburse FnF error:', err);
      setError(err.message || 'Failed to record settlement disbursement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disburse Full & Final Settlement"
      subtitle={`Record final payment transaction for ${employeeName}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Amount Card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-800 font-medium block">Net Payout to Disburse</span>
            <span className="text-2xl font-extrabold text-emerald-900">
              ₹ {parseFloat(netAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="space-y-3">
          <Select
            label="Payment Mode"
            value={formData.paymentMode}
            onChange={(e) => handleChange('paymentMode', e.target.value)}
            options={[
              { value: 'BANK_TRANSFER', label: 'NEFT / RTGS / IMPS Bank Transfer' },
              { value: 'DIRECT_DEPOSIT', label: 'Automated Direct Deposit' },
              { value: 'CHEQUE', label: 'Physical Company Cheque' },
            ]}
          />

          <Input
            label="Transaction / UTR / Cheque Reference"
            value={formData.disbursementReference}
            onChange={(e) => handleChange('disbursementReference', e.target.value)}
            helperText="Unique bank transaction identifier for audit"
            required
          />

          <Input
            label="Payment Remarks"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Audit remarks or bank narration"
          />
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Important:</strong> Disbursing this settlement marks the exit process as financially cleared.
            Ensure the payment order has been executed by your banking partner before confirming.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            size="sm"
            icon={Send}
            isLoading={isSubmitting}
          >
            Confirm & Disburse Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
