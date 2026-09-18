import React from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { PayslipDocument } from './PayslipDocument.jsx';

export const PayslipViewModal = ({
  isOpen,
  onClose,
  payslip = null,
  record = null,
}) => {
  if (!isOpen) return null;

  // Resolve record & employee data
  const data = record || payslip?.record || {};
  const employee = data.employee || payslip?.employee || {};
  const period = data.period || payslip?.period || {};
  const payslipNumber = payslip?.payslipNumber || payslip?.payslip_number || `PS-${data.id ? data.id.slice(-6) : 'OFFICIAL'}`;

  const normalizedPayslip = payslip ? {
    ...payslip,
    employee_name: payslip.employee_name || payslip.employeeName || employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    employee_code: payslip.employee_code || payslip.employeeCode || employee.employeeCode,
    department_name: payslip.department_name || payslip.department || employee.department,
    designation_title: payslip.designation_title || payslip.designation || employee.designation,
    date_of_joining: payslip.date_of_joining || employee.dateOfJoining,
    period_name: payslip.period_name || period.periodName,
    items: payslip.items || data.items || [],
  } : {
    ...data,
    payslip_number: payslipNumber,
    employee_name: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    employee_code: employee.employeeCode,
    department_name: employee.department,
    designation_title: employee.designation,
    date_of_joining: employee.dateOfJoining,
    period_name: period.periodName,
    items: data.items || [],
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Salary Payslip"
      subtitle={`Official Payslip Ref: ${payslipNumber}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 print:m-0 print:p-0">
        <PayslipDocument payslip={normalizedPayslip} />
        <div className="flex justify-end pt-2 border-t border-slate-100 print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
