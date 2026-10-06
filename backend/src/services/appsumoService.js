import { pool } from '../config/db.js';
import { appsumoRepository } from '../repositories/appsumoRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { verifyAppSumoWebhook } from '../utils/appsumoSecurity.js';
import { getAppSumoTierConfig } from '../config/appsumoTiers.js';
import { appsumoClient } from './appsumoClient.js';

export const appsumoService = {
  /**
   * Process incoming AppSumo webhook with signature verification and transaction isolation.
   *
   * @param {object} params
   * @param {object} params.payload - Parsed JSON body
   * @param {string} params.rawBody - Exact unparsed request body string
   * @param {object} params.headers - HTTP request headers
   * @returns {Promise<{ event: string, success: boolean, message?: string }>}
   */
  async processWebhookEvent({ payload, rawBody, headers, secretKey = config.appsumo.apiKey }) {
    const signature = headers['x-appsumo-signature'] || headers['X-Appsumo-Signature'];
    const timestamp = headers['x-appsumo-timestamp'] || headers['X-Appsumo-Timestamp'];

    // 1. Webhook Signature Verification & Replay Protection
    const verification = verifyAppSumoWebhook({
      rawBody,
      signature,
      timestamp,
      secretKey,
    });

    if (!verification.valid) {
      const error = new Error(`AppSumo Webhook verification failed: ${verification.error}`);
      error.statusCode = 401;
      throw error;
    }

    const {
      license_key: licenseKey,
      prev_license_key: prevLicenseKey,
      event,
      license_status: licenseStatus,
      tier = 1,
      test: isTest = false,
      event_timestamp: eventTimestamp,
      created_at: createdAtFromAppSumo,
      plan_id: partnerPlanName,
      unit_quantity: unitQuantity = 1,
      parent_license_key: parentLicenseKey,
    } = payload;

    const normalizedEvent = (event || '').trim().toLowerCase();

    if (!licenseKey) {
      const error = new Error('Malformed webhook payload: missing license_key.');
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedEvent) {
      const error = new Error('Malformed webhook payload: missing event type.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Test Webhook Handling (e.g. Partner Portal verification ping)
    // IMPORTANT: When test === true, NEVER create real organizations, users, or mutate real quotas!
    if (isTest === true || isTest === 'true') {
      console.log(`[AppSumo Webhook] Received TEST event '${normalizedEvent}' for key: ${licenseKey}`);
      try {
        await appsumoRepository.recordEvent({
          licenseKey,
          prevLicenseKey,
          event: normalizedEvent,
          tier: parseInt(tier, 10) || 1,
          licenseStatus,
          eventTimestamp,
          createdAtFromAppSumo,
          test: true,
          payload,
          processed: true,
        });
      } catch (err) {
        console.warn('[AppSumo Webhook] Non-critical test event log warning:', err.message);
      }

      return {
        event: normalizedEvent,
        success: true,
      };
    }

    // 3. Idempotency Check: Avoid repeating duplicate actions for already-processed events
    if (eventTimestamp) {
      const existing = await appsumoRepository.findDuplicateEvent({
        licenseKey,
        event: normalizedEvent,
        eventTimestamp,
      });

      if (existing) {
        console.log(
          `[AppSumo Webhook] Idempotent duplicate event '${normalizedEvent}' already processed for key: ${licenseKey}. Returning HTTP 200.`
        );
        return {
          event: normalizedEvent,
          success: true,
        };
      }
    }

    // 4. Transactional Event Processing
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tierConfig = getAppSumoTierConfig(tier);

      switch (normalizedEvent) {
        // -------------------------------------------------------------------
        // EVENT: PURCHASE
        // Store the license. At this point, the customer may not have connected
        // their TaskNera account yet, so organization_id can remain null.
        // -------------------------------------------------------------------
        case 'purchase': {
          await appsumoRepository.upsertLicense(
            {
              licenseKey,
              prevLicenseKey,
              tier: parseInt(tier, 10) || 1,
              status: 'inactive', // pending activation
              event: 'purchase',
              partnerPlanName: partnerPlanName || tierConfig.name,
              unitQuantity: parseInt(unitQuantity, 10) || 1,
              parentLicenseKey,
              isTest: false,
              rawDetails: payload,
              lastEventAt: new Date().toISOString(),
            },
            client
          );
          break;
        }

        // -------------------------------------------------------------------
        // EVENT: ACTIVATE
        // IMPORTANT: AppSumo sends license_status = "inactive" during activate!
        // It switches to "active" after we return HTTP 200.
        // We activate the entitlement and associate with organization if found.
        // -------------------------------------------------------------------
        case 'activate': {
          const existingLicense = await appsumoRepository.findByLicenseKey(licenseKey, client);

          await appsumoRepository.upsertLicense(
            {
              licenseKey,
              prevLicenseKey,
              organizationId: existingLicense?.organizationId || null,
              activatedByUserId: existingLicense?.activatedByUserId || null,
              tier: parseInt(tier, 10) || existingLicense?.tier || 1,
              status: 'active',
              event: 'activate',
              partnerPlanName: partnerPlanName || existingLicense?.partnerPlanName || tierConfig.name,
              unitQuantity: parseInt(unitQuantity, 10) || existingLicense?.unitQuantity || 1,
              parentLicenseKey: parentLicenseKey || existingLicense?.parentLicenseKey || null,
              isTest: false,
              rawDetails: payload,
              lastEventAt: new Date().toISOString(),
            },
            client
          );
          break;
        }

        // -------------------------------------------------------------------
        // EVENT: UPGRADE
        // AppSumo generates a NEW license_key and provides prev_license_key.
        // Locate existing entitlement by prev_license_key to preserve organization!
        // -------------------------------------------------------------------
        case 'upgrade': {
          let linkedOrgId = null;
          let linkedUserId = null;

          if (prevLicenseKey) {
            const oldLicense = await appsumoRepository.findByPrevLicenseKey(prevLicenseKey, client);
            if (oldLicense) {
              linkedOrgId = oldLicense.organizationId;
              linkedUserId = oldLicense.activatedByUserId;

              // Mark previous license as replaced
              await appsumoRepository.updateLicense(
                oldLicense.licenseKey,
                {
                  status: 'deactivated',
                  event: 'upgrade_replaced',
                  lastEventAt: new Date().toISOString(),
                },
                client
              );
            }
          }

          await appsumoRepository.upsertLicense(
            {
              licenseKey,
              prevLicenseKey,
              organizationId: linkedOrgId,
              activatedByUserId: linkedUserId,
              tier: parseInt(tier, 10) || 1,
              status: 'active',
              event: 'upgrade',
              partnerPlanName: partnerPlanName || tierConfig.name,
              unitQuantity: parseInt(unitQuantity, 10) || 1,
              parentLicenseKey,
              isTest: false,
              rawDetails: payload,
              lastEventAt: new Date().toISOString(),
            },
            client
          );
          break;
        }

        // -------------------------------------------------------------------
        // EVENT: DOWNGRADE
        // AppSumo generates a NEW license key and provides prev_license_key.
        // Locate existing entitlement and update tier/quotas.
        // -------------------------------------------------------------------
        case 'downgrade': {
          let linkedOrgId = null;
          let linkedUserId = null;

          if (prevLicenseKey) {
            const oldLicense = await appsumoRepository.findByPrevLicenseKey(prevLicenseKey, client);
            if (oldLicense) {
              linkedOrgId = oldLicense.organizationId;
              linkedUserId = oldLicense.activatedByUserId;

              await appsumoRepository.updateLicense(
                oldLicense.licenseKey,
                {
                  status: 'deactivated',
                  event: 'downgrade_replaced',
                  lastEventAt: new Date().toISOString(),
                },
                client
              );
            }
          }

          await appsumoRepository.upsertLicense(
            {
              licenseKey,
              prevLicenseKey,
              organizationId: linkedOrgId,
              activatedByUserId: linkedUserId,
              tier: parseInt(tier, 10) || 1,
              status: 'active',
              event: 'downgrade',
              partnerPlanName: partnerPlanName || tierConfig.name,
              unitQuantity: parseInt(unitQuantity, 10) || 1,
              parentLicenseKey,
              isTest: false,
              rawDetails: payload,
              lastEventAt: new Date().toISOString(),
            },
            client
          );
          break;
        }

        // -------------------------------------------------------------------
        // EVENT: DEACTIVATE
        // IMPORTANT: Webhook can contain license_status = "active". Process
        // based on event === "deactivate".
        // CRITICAL RULE: NEVER delete organization, users, employees, or data!
        // Only set status to 'deactivated'.
        // -------------------------------------------------------------------
        case 'deactivate': {
          const existingLicense = await appsumoRepository.findByLicenseKey(licenseKey, client);

          if (existingLicense) {
            await appsumoRepository.updateLicense(
              licenseKey,
              {
                status: 'deactivated',
                event: 'deactivate',
                rawDetails: payload,
                lastEventAt: new Date().toISOString(),
              },
              client
            );
          } else {
            // Record deactivated record even if not previously known
            await appsumoRepository.upsertLicense(
              {
                licenseKey,
                prevLicenseKey,
                tier: parseInt(tier, 10) || 1,
                status: 'deactivated',
                event: 'deactivate',
                partnerPlanName: partnerPlanName || tierConfig.name,
                unitQuantity: parseInt(unitQuantity, 10) || 1,
                parentLicenseKey,
                isTest: false,
                rawDetails: payload,
                lastEventAt: new Date().toISOString(),
              },
              client
            );
          }
          break;
        }

        // -------------------------------------------------------------------
        // EVENT: MIGRATE
        // Relevant for AppSumo add-ons. Only parent_license_key changes.
        // -------------------------------------------------------------------
        case 'migrate': {
          const existingLicense = await appsumoRepository.findByLicenseKey(licenseKey, client);
          if (existingLicense) {
            await appsumoRepository.updateLicense(
              licenseKey,
              {
                parentLicenseKey: parentLicenseKey || existingLicense.parentLicenseKey,
                event: 'migrate',
                rawDetails: payload,
                lastEventAt: new Date().toISOString(),
              },
              client
            );
          } else {
            await appsumoRepository.upsertLicense(
              {
                licenseKey,
                prevLicenseKey,
                tier: parseInt(tier, 10) || 1,
                status: 'active',
                event: 'migrate',
                parentLicenseKey,
                isTest: false,
                rawDetails: payload,
                lastEventAt: new Date().toISOString(),
              },
              client
            );
          }
          break;
        }

        default: {
          console.warn(`[AppSumo Webhook] Unhandled event type: '${normalizedEvent}' for key: ${licenseKey}`);
          break;
        }
      }

      // Record immutable audit event
      const recordedLicense = await appsumoRepository.findByLicenseKey(licenseKey, client);
      await appsumoRepository.recordEvent(
        {
          licenseId: recordedLicense?.id || null,
          licenseKey,
          prevLicenseKey,
          event: normalizedEvent,
          tier: parseInt(tier, 10) || recordedLicense?.tier || 1,
          licenseStatus: licenseStatus || recordedLicense?.status,
          eventTimestamp,
          createdAtFromAppSumo,
          test: false,
          payload,
          processed: true,
        },
        client
      );

      await client.query('COMMIT');

      return {
        event: normalizedEvent,
        success: true,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[AppSumo Webhook Error] Failed processing '${normalizedEvent}' for ${licenseKey}:`, err);

      // Log failure in events table for auditing
      try {
        await appsumoRepository.recordEvent({
          licenseKey,
          prevLicenseKey,
          event: normalizedEvent,
          tier: parseInt(tier, 10) || 1,
          licenseStatus,
          eventTimestamp,
          createdAtFromAppSumo,
          test: false,
          payload,
          processed: false,
          processingError: err.message,
        });
      } catch {
        // Ignore secondary logging error
      }

      throw err;
    } finally {
      client.release();
    }
  },

  // =========================================================================
  // 5. OAuth Code Exchange & License Linking
  // =========================================================================

  /**
   * Exchanges authorization code received from AppSumo redirect (?code=...)
   * and fetches the associated license details.
   *
   * @param {string} code - Single-use OAuth authorization code
   * @param {string} [redirectUri] - Exact OAuth redirect URI configured in Partner Portal
   * @returns {Promise<object>} License and tier information
   */
  async exchangeCodeForLicense(code, redirectUri) {
    if (!code || typeof code !== 'string') {
      const error = new Error('OAuth authorization code is required.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Exchange code at https://appsumo.com/openid/token/
    const tokenResponse = await appsumoClient.exchangeOAuthCode(code, redirectUri);
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      const error = new Error('AppSumo did not return an access token.');
      error.statusCode = 502;
      throw error;
    }

    // 2. Fetch license key at https://appsumo.com/openid/license_key/?access_token=...
    const licenseInfo = await appsumoClient.fetchLicenseKeyWithAccessToken(accessToken);
    const licenseKey = licenseInfo.license_key;

    if (!licenseKey) {
      const error = new Error('AppSumo did not return a license key for this account.');
      error.statusCode = 502;
      throw error;
    }

    // 3. Find or sync local license record
    let license = await appsumoRepository.findByLicenseKey(licenseKey);

    // If webhook hasn't arrived yet, initialize license record from OAuth response
    if (!license) {
      const tier = parseInt(licenseInfo.tier, 10) || 1;
      const tierConfig = getAppSumoTierConfig(tier);

      license = await appsumoRepository.upsertLicense({
        licenseKey,
        tier,
        status: 'inactive',
        event: 'oauth_connect',
        partnerPlanName: tierConfig.name,
        rawDetails: licenseInfo,
      });
    }

    const tierConfig = getAppSumoTierConfig(license.tier);

    return {
      licenseKey: license.licenseKey,
      tier: license.tier,
      status: license.status,
      isLinked: Boolean(license.organizationId),
      organizationId: license.organizationId,
      organizationName: license.organizationName,
      tierConfig,
    };
  },

  /**
   * Links an AppSumo license to a specific TaskNera organization and user.
   * Activates organization entitlement and applies tier quotas.
   *
   * @param {object} params
   * @param {string} params.licenseKey
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @returns {Promise<object>} Updated license domain object
   */
  async linkLicenseToOrganization({ licenseKey, organizationId, userId }) {
    if (!licenseKey) {
      const error = new Error('licenseKey is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!organizationId) {
      const error = new Error('organizationId is required.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Verify organization exists
    const org = await orgRepository.findById(organizationId);
    if (!org) {
      const error = new Error(`Organization '${organizationId}' does not exist.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Verify user exists if provided
    if (userId) {
      const user = await userRepository.findById(userId);
      if (!user) {
        const error = new Error(`User '${userId}' does not exist.`);
        error.statusCode = 404;
        throw error;
      }
    }

    // 3. Find existing license
    let license = await appsumoRepository.findByLicenseKey(licenseKey);
    if (!license) {
      // Create if webhook hasn't arrived yet
      const tierConfig = getAppSumoTierConfig(1);
      license = await appsumoRepository.upsertLicense({
        licenseKey,
        tier: 1,
        status: 'active',
        event: 'activate',
        partnerPlanName: tierConfig.name,
      });
    }

    // Check if license is already linked to a DIFFERENT organization
    if (license.organizationId && license.organizationId !== organizationId) {
      const error = new Error(
        `This AppSumo license is already linked to organization '${license.organizationName || license.organizationId}'.`
      );
      error.statusCode = 409;
      throw error;
    }

    // 4. Update license record: link and activate
    const updated = await appsumoRepository.updateLicense(licenseKey, {
      organizationId,
      activatedByUserId: userId || license.activatedByUserId,
      status: 'active',
      event: 'activate',
      lastEventAt: new Date().toISOString(),
    });

    const tierConfig = getAppSumoTierConfig(updated.tier);

    return {
      ...updated,
      tierConfig,
    };
  },

  /**
   * Returns active AppSumo entitlement & quotas for an organization.
   *
   * @param {string} orgId - Organization ID
   * @returns {Promise<object>} Entitlement details
   */
  async getOrganizationEntitlement(orgId) {
    if (!orgId) return null;

    const license = await appsumoRepository.findByOrganizationId(orgId);
    if (!license) {
      // Organization has no AppSumo entitlement (standard/unrestricted mode)
      return {
        hasAppSumo: false,
        isEntitled: false,
        tier: null,
        status: 'none',
        maxEmployees: Infinity,
        maxDepartments: Infinity,
      };
    }

    const isEntitled = license.status === 'active';
    const tierConfig = getAppSumoTierConfig(license.tier);

    return {
      hasAppSumo: true,
      isEntitled,
      licenseKey: license.licenseKey,
      tier: license.tier,
      status: license.status,
      planName: tierConfig.name,
      maxEmployees: tierConfig.maxEmployees,
      maxDepartments: tierConfig.maxDepartments,
      features: tierConfig.features,
      tierConfig,
      lastEventAt: license.lastEventAt,
    };
  },

  /**
   * Find license by key with events (for Admin/Support console)
   */
  async getLicenseDetails(licenseKey) {
    const license = await appsumoRepository.findByLicenseKey(licenseKey);
    if (!license) {
      const error = new Error(`AppSumo license '${licenseKey}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const events = await appsumoRepository.findEventsByLicenseKey(licenseKey);
    const tierConfig = getAppSumoTierConfig(license.tier);

    return {
      license,
      tierConfig,
      events,
    };
  },

  /**
   * List all licenses with filtering (for SuperAdmin/Admin console)
   */
  async listAllLicenses(query = {}) {
    return appsumoRepository.findAllLicenses(query);
  },
};
