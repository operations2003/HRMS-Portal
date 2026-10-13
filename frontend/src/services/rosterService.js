import { shiftService } from './shiftService.js';

// Fully decommissioned bulk roster import - delegate to Date-wise Shift Management
export const rosterService = {
  ...shiftService,
  async getAssignments(params = {}) {
    return shiftService.getEmployeeShifts(params);
  },
  async updateAssignment(data) {
    return shiftService.assignShifts({
      employeeId: data.employeeId,
      dates: [data.date],
      shiftType: data.shiftType,
      shiftLabel: data.shiftLabel,
      shiftStartTime: data.shiftStartTime,
      shiftEndTime: data.shiftEndTime,
      notes: data.notes || '',
    });
  },
};

export default rosterService;
