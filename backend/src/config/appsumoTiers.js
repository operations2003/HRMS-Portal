/**
 * Centralized AppSumo Tier Configuration
 * TaskNera HRMS - AppSumo Licensing API v2 Entitlement Engine
 *
 * NOTE: Edit these limits to adjust plan quotas without touching webhook
 * or license management business logic.
 */

export const APP_SUMO_TIERS = {
  1: {
    tier: 1,
    name: 'TaskNera Starter Tier (AppSumo Tier 1)',
    planCode: 'APPSUMO_TIER_1',
    maxEmployees: 15,
    maxDepartments: 5,
    features: {
      employeeDirectory: true,
      attendanceAndPunches: true,
      leaveManagement: true,
      holidayCalendar: true,
      documentVault: true,
      onboardingWorkflow: true,
      helpdeskTickets: true,
      dailyWorkReports: true,
      tasksAndWork: true,
      performanceManagement: false,
      trainingAndSkills: false,
      exitAndOffboarding: true,
      analyticsReporting: false,
    },
    description: 'Lifetime access for up to 15 employees with core workforce and attendance management.',
  },
  2: {
    tier: 2,
    name: 'TaskNera Growth Tier (AppSumo Tier 2)',
    planCode: 'APPSUMO_TIER_2',
    maxEmployees: 50,
    maxDepartments: 15,
    features: {
      employeeDirectory: true,
      attendanceAndPunches: true,
      leaveManagement: true,
      holidayCalendar: true,
      documentVault: true,
      onboardingWorkflow: true,
      helpdeskTickets: true,
      dailyWorkReports: true,
      tasksAndWork: true,
      performanceManagement: true,
      trainingAndSkills: true,
      exitAndOffboarding: true,
      analyticsReporting: true,
    },
    description: 'Lifetime access for up to 50 employees with performance reviews, training, and analytics.',
  },
  3: {
    tier: 3,
    name: 'TaskNera Enterprise Tier (AppSumo Tier 3)',
    planCode: 'APPSUMO_TIER_3',
    maxEmployees: 250,
    maxDepartments: 999, // Practically unlimited
    features: {
      employeeDirectory: true,
      attendanceAndPunches: true,
      leaveManagement: true,
      holidayCalendar: true,
      documentVault: true,
      onboardingWorkflow: true,
      helpdeskTickets: true,
      dailyWorkReports: true,
      tasksAndWork: true,
      performanceManagement: true,
      trainingAndSkills: true,
      exitAndOffboarding: true,
      analyticsReporting: true,
      customApprovalWorkflows: true,
      prioritySupport: true,
    },
    description: 'Full enterprise lifetime access for up to 250 employees with all HRMS v2 modules.',
  },
};

/**
 * Returns tier configuration for the given tier number.
 * Falls back to Tier 1 if tier is not found or invalid.
 *
 * @param {number|string} tierNumber
 * @returns {object} Tier configuration
 */
export const getAppSumoTierConfig = (tierNumber) => {
  const numericTier = parseInt(tierNumber, 10) || 1;
  return APP_SUMO_TIERS[numericTier] || APP_SUMO_TIERS[1];
};

/**
 * Returns maximum allowed employee count for a given tier.
 *
 * @param {number|string} tierNumber
 * @returns {number}
 */
export const getTierEmployeeLimit = (tierNumber) => {
  const config = getAppSumoTierConfig(tierNumber);
  return config.maxEmployees;
};

/**
 * Returns maximum allowed department count for a given tier.
 *
 * @param {number|string} tierNumber
 * @returns {number}
 */
export const getTierDepartmentLimit = (tierNumber) => {
  const config = getAppSumoTierConfig(tierNumber);
  return config.maxDepartments;
};

/**
 * Checks if a specific feature is enabled in the given tier.
 *
 * @param {number|string} tierNumber
 * @param {string} featureKey
 * @returns {boolean}
 */
export const isFeatureEnabledForTier = (tierNumber, featureKey) => {
  const config = getAppSumoTierConfig(tierNumber);
  return Boolean(config.features && config.features[featureKey]);
};
