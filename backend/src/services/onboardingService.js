import { newHireRepository } from '../repositories/newHireRepository.js';
import { documentRepository } from '../repositories/documentRepository.js';

const READINESS_KEYS = [
  'itSetup',
  'workstationReady',
  'welcomeKitDispatched',
  'idCardGenerated',
  'orientationScheduled',
];

export const onboardingService = {
  /**
   * List new hires with filtering & pagination
   */
  async getNewHires(filter, pagination) {
    return newHireRepository.findAll({ ...filter, ...pagination });
  },

  /**
   * Get single new hire details including attached documents
   */
  async getNewHireById(id) {
    const newHire = await newHireRepository.findById(id);
    if (!newHire) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Fetch attached documents from Document Vault
    const documents = await documentRepository.findByOwner('NEW_HIRE', id);
    return {
      ...newHire,
      documents,
    };
  },

  /**
   * Transition: NEW_HIRE -> ONBOARDING
   */
  async initiateOnboarding(id) {
    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (existing.lifecycleState === 'CONVERTED_TO_EMPLOYEE') {
      const err = new Error('Candidate is already converted to an active Employee.');
      err.statusCode = 400;
      throw err;
    }

    const updated = await newHireRepository.updateLifecycleState(id, {
      lifecycleState: 'ONBOARDING',
      onboardingStatus: 'IN_PROGRESS',
      bgvStatus: existing.bgvStatus === 'PENDING' ? 'INITIATED' : existing.bgvStatus,
    });

    return updated;
  },

  /**
   * Update Readiness Tracker Checklist & Recalculate Completion Percentage
   */
  async updateReadinessTracker(id, updates) {
    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const currentTracker = existing.readinessTracker || {};
    const merged = { ...currentTracker };

    for (const key of READINESS_KEYS) {
      if (typeof updates[key] === 'boolean') {
        merged[key] = updates[key];
      }
    }

    // Recalculate completion percentage
    const completedCount = READINESS_KEYS.filter((k) => merged[k] === true).length;
    merged.completionPercentage = Math.round((completedCount / READINESS_KEYS.length) * 100);

    // If 100% and BGV clear, onboarding can be marked READY_FOR_JOINING
    let newOnboardingStatus = existing.onboardingStatus;
    if (merged.completionPercentage === 100 && existing.onboardingStatus === 'IN_PROGRESS') {
      newOnboardingStatus = 'READY_FOR_JOINING';
    }

    await newHireRepository.updateLifecycleState(id, {
      onboardingStatus: newOnboardingStatus,
    });

    return newHireRepository.updateReadinessTracker(id, merged);
  },

  /**
   * Update Background Verification (BGV) Status
   */
  async updateBgvStatus(id, bgvStatus) {
    const allowed = ['PENDING', 'INITIATED', 'IN_PROGRESS', 'CLEAR', 'RED_FLAG', 'WAIVED'];
    const normalized = (bgvStatus || '').toUpperCase().trim();
    if (!allowed.includes(normalized)) {
      const err = new Error(`Invalid BGV status '${bgvStatus}'. Allowed: ${allowed.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return newHireRepository.updateLifecycleState(id, { bgvStatus: normalized });
  },

  /**
   * Transition: ONBOARDING -> EMPLOYEE
   * Atomically converts new hire into an active employee
   */
  async convertToEmployee(id, employeeOverrides = {}) {
    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (existing.lifecycleState === 'CONVERTED_TO_EMPLOYEE') {
      const err = new Error(`Candidate is already converted to Employee (ID: ${existing.employeeId}).`);
      err.statusCode = 400;
      throw err;
    }

    if (existing.bgvStatus === 'RED_FLAG') {
      const err = new Error('Cannot convert candidate to Employee: BGV status is flagged RED_FLAG.');
      err.statusCode = 400;
      throw err;
    }

    // Execute atomic conversion in repository
    const result = await newHireRepository.convertToEmployee(id, employeeOverrides);
    const updatedNewHire = await newHireRepository.findById(id);

    return {
      message: `Candidate ${existing.fullName} converted to Employee ${result.employeeCode} successfully.`,
      employeeId: result.employeeId,
      employeeCode: result.employeeCode,
      employee: result.employee,
      newHire: updatedNewHire,
    };
  },
};

