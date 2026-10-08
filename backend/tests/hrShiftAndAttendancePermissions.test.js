import assert from 'assert';
import { employeeService } from '../src/services/employeeService.js';
import { attendanceService } from '../src/services/attendanceService.js';
import { employeeRepository } from '../src/repositories/employeeRepository.js';
import { attendanceRepository } from '../src/repositories/attendanceRepository.js';

console.log('====================================================');
console.log('🧪 Running HR Shift Timing & Attendance Permission Tests');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  const hrUser = {
    id: 'user-hr-1',
    employeeId: 'emp-hr-1',
    roleName: 'HR',
    email: 'hr@tasknera.com',
  };

  const adminUser = {
    id: 'user-admin-1',
    employeeId: 'emp-admin-1',
    roleName: 'ADMIN',
    email: 'admin@tasknera.com',
  };

  const targetEmpOther = {
    id: 'emp-other-1',
    userId: 'user-other-1',
    firstName: 'Alice',
    lastName: 'Smith',
    shiftTiming: '09:00 AM - 05:00 PM',
  };

  const targetEmpHR = {
    id: 'emp-hr-1',
    userId: 'user-hr-1',
    firstName: 'Jane',
    lastName: 'HR',
    shiftTiming: '10:00 AM - 06:00 PM',
  };

  // --- 1. Employee Shift Timing Permissions ---
  console.log('--- 1. Employee Shift Timing Permissions ---');

  await test('HR can update shift timing of other employees', async () => {
    const origFindById = employeeRepository.findById;
    const origUpdate = employeeRepository.update;
    let updatedShift = null;

    employeeRepository.findById = async (id) => {
      if (id === targetEmpOther.id) return { ...targetEmpOther };
      return null;
    };
    employeeRepository.update = async (id, data) => {
      updatedShift = data.shiftTiming;
      return { ...targetEmpOther, ...data };
    };

    try {
      const res = await employeeService.updateEmployee(
        targetEmpOther.id,
        { shiftTiming: '11:00 AM - 07:00 PM' },
        hrUser
      );
      assert.strictEqual(updatedShift, '11:00 AM - 07:00 PM');
    } finally {
      employeeRepository.findById = origFindById;
      employeeRepository.update = origUpdate;
    }
  });

  await test('HR CANNOT update her own shift timing (rejects with 403)', async () => {
    const origFindById = employeeRepository.findById;
    const origUpdate = employeeRepository.update;

    employeeRepository.findById = async (id) => {
      if (id === targetEmpHR.id) return { ...targetEmpHR };
      return null;
    };
    employeeRepository.update = async (id, data) => data;

    try {
      let threw = false;
      try {
        await employeeService.updateEmployee(
          targetEmpHR.id,
          { shiftTiming: '09:00 AM - 05:00 PM' },
          hrUser
        );
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403);
        assert(err.message.includes('HR is not authorized to modify her own shift timing'));
      }
      assert.strictEqual(threw, true, 'Expected 403 Forbidden to be thrown');
    } finally {
      employeeRepository.findById = origFindById;
      employeeRepository.update = origUpdate;
    }
  });

  await test('Admin CAN update HR shift timing', async () => {
    const origFindById = employeeRepository.findById;
    const origUpdate = employeeRepository.update;
    let updatedShift = null;

    employeeRepository.findById = async (id) => {
      if (id === targetEmpHR.id) return { ...targetEmpHR };
      return null;
    };
    employeeRepository.update = async (id, data) => {
      updatedShift = data.shiftTiming;
      return { ...targetEmpHR, ...data };
    };

    try {
      const res = await employeeService.updateEmployee(
        targetEmpHR.id,
        { shiftTiming: '08:00 AM - 04:00 PM' },
        adminUser
      );
      assert.strictEqual(updatedShift, '08:00 AM - 04:00 PM');
    } finally {
      employeeRepository.findById = origFindById;
      employeeRepository.update = origUpdate;
    }
  });

  // --- 2. Attendance Regularize / Edit Timing Permissions ---
  console.log('\n--- 2. Attendance Regularize / Timing Adjustment Permissions ---');

  const attendanceRecOther = {
    id: 'att-other-1',
    employeeId: 'emp-other-1',
    attendanceDate: '2026-10-01',
    status: 'PRESENT',
    totalHours: 8,
    employee: { id: 'emp-other-1', userId: 'user-other-1' },
  };

  const attendanceRecHR = {
    id: 'att-hr-1',
    employeeId: 'emp-hr-1',
    attendanceDate: '2026-10-01',
    status: 'LATE',
    totalHours: 7,
    employee: { id: 'emp-hr-1', userId: 'user-hr-1' },
  };

  await test('HR can regularize / adjust timing of other employees', async () => {
    const origFindById = attendanceRepository.findById;
    const origUpdate = attendanceRepository.update;
    const origEmployeeFindById = employeeRepository.findById;
    let updatedPayload = null;

    attendanceRepository.findById = async (id) => {
      if (id === attendanceRecOther.id) return { ...attendanceRecOther };
      return null;
    };
    attendanceRepository.update = async (id, data) => {
      updatedPayload = data;
      return { ...attendanceRecOther, ...data };
    };
    employeeRepository.findById = async () => ({ shiftTiming: '09:00 AM - 05:00 PM' });

    try {
      await attendanceService.regularize(hrUser, attendanceRecOther.id, {
        checkIn: new Date().toISOString(),
        regularizationReason: 'Corrected punch',
      });
      assert(updatedPayload !== null);
      assert.strictEqual(updatedPayload.regularizedBy, hrUser.id);
    } finally {
      attendanceRepository.findById = origFindById;
      attendanceRepository.update = origUpdate;
      employeeRepository.findById = origEmployeeFindById;
    }
  });

  await test('HR CANNOT regularize / adjust her own attendance (rejects with 403)', async () => {
    const origFindById = attendanceRepository.findById;
    const origUpdate = attendanceRepository.update;

    attendanceRepository.findById = async (id) => {
      if (id === attendanceRecHR.id) return { ...attendanceRecHR };
      return null;
    };
    attendanceRepository.update = async (id, data) => data;

    try {
      let threw = false;
      try {
        await attendanceService.regularize(hrUser, attendanceRecHR.id, {
          checkIn: new Date().toISOString(),
          regularizationReason: 'Self adjustment attempt',
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403);
        assert(err.message.includes('HR is not authorized to edit or regularize her own attendance'));
      }
      assert.strictEqual(threw, true, 'Expected 403 Forbidden to be thrown');
    } finally {
      attendanceRepository.findById = origFindById;
      attendanceRepository.update = origUpdate;
    }
  });

  await test('Admin CAN regularize / adjust HR attendance records', async () => {
    const origFindById = attendanceRepository.findById;
    const origUpdate = attendanceRepository.update;
    const origEmployeeFindById = employeeRepository.findById;
    let updatedPayload = null;

    attendanceRepository.findById = async (id) => {
      if (id === attendanceRecHR.id) return { ...attendanceRecHR };
      return null;
    };
    attendanceRepository.update = async (id, data) => {
      updatedPayload = data;
      return { ...attendanceRecHR, ...data };
    };
    employeeRepository.findById = async () => ({ shiftTiming: '10:00 AM - 06:00 PM' });

    try {
      await attendanceService.regularize(adminUser, attendanceRecHR.id, {
        checkIn: new Date().toISOString(),
        regularizationReason: 'Admin corrected HR punch',
      });
      assert(updatedPayload !== null);
      assert.strictEqual(updatedPayload.regularizedBy, adminUser.id);
    } finally {
      attendanceRepository.findById = origFindById;
      attendanceRepository.update = origUpdate;
      employeeRepository.findById = origEmployeeFindById;
    }
  });

  // --- 3. Attendance Shift Remarks Permissions ---
  console.log('\n--- 3. Attendance Shift Remarks Permissions ---');

  await test('HR can add shift remarks for other employees', async () => {
    const origFindById = attendanceRepository.findById;
    const origUpdate = attendanceRepository.update;
    let updatedPayload = null;

    attendanceRepository.findById = async (id) => {
      if (id === attendanceRecOther.id) return { ...attendanceRecOther };
      return null;
    };
    attendanceRepository.update = async (id, data) => {
      updatedPayload = data;
      return { ...attendanceRecOther, ...data };
    };

    try {
      await attendanceService.addShiftRemark(hrUser, attendanceRecOther.id, {
        remarkType: 'OT',
        comments: 'Approved overtime',
      });
      assert(updatedPayload !== null);
      assert.strictEqual(updatedPayload.regularizedBy, hrUser.id);
    } finally {
      attendanceRepository.findById = origFindById;
      attendanceRepository.update = origUpdate;
    }
  });

  await test('HR CANNOT add shift remarks on her own attendance (rejects with 403)', async () => {
    const origFindById = attendanceRepository.findById;
    const origUpdate = attendanceRepository.update;

    attendanceRepository.findById = async (id) => {
      if (id === attendanceRecHR.id) return { ...attendanceRecHR };
      return null;
    };
    attendanceRepository.update = async (id, data) => data;

    try {
      let threw = false;
      try {
        await attendanceService.addShiftRemark(hrUser, attendanceRecHR.id, {
          remarkType: 'OT',
          comments: 'Self OT claim',
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403);
        assert(err.message.includes('HR is not authorized to edit or modify remarks on her own attendance'));
      }
      assert.strictEqual(threw, true, 'Expected 403 Forbidden to be thrown');
    } finally {
      attendanceRepository.findById = origFindById;
      attendanceRepository.update = origUpdate;
    }
  });

  await test('Admin CAN add shift remarks on HR attendance records', async () => {
    const origFindById = attendanceRepository.findById;
    const origUpdate = attendanceRepository.update;
    let updatedPayload = null;

    attendanceRepository.findById = async (id) => {
      if (id === attendanceRecHR.id) return { ...attendanceRecHR };
      return null;
    };
    attendanceRepository.update = async (id, data) => {
      updatedPayload = data;
      return { ...attendanceRecHR, ...data };
    };

    try {
      await attendanceService.addShiftRemark(adminUser, attendanceRecHR.id, {
        remarkType: 'OT',
        comments: 'Admin verified HR overtime',
      });
      assert(updatedPayload !== null);
      assert.strictEqual(updatedPayload.regularizedBy, adminUser.id);
    } finally {
      attendanceRepository.findById = origFindById;
      attendanceRepository.update = origUpdate;
    }
  });

  console.log('\n====================================================');
  console.log(`Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
