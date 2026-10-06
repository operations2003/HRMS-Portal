import assert from 'assert';
import crypto from 'crypto';
import {
  APP_SUMO_TIERS,
  getAppSumoTierConfig,
  getTierEmployeeLimit,
  getTierDepartmentLimit,
  isFeatureEnabledForTier,
} from '../src/config/appsumoTiers.js';
import {
  verifyAppSumoWebhook,
  computeAppSumoSignature,
} from '../src/utils/appsumoSecurity.js';
import { appsumoService } from '../src/services/appsumoService.js';
import { appsumoRepository } from '../src/repositories/appsumoRepository.js';
import { appsumoClient } from '../src/services/appsumoClient.js';
import { pool } from '../src/config/db.js';

console.log('====================================================');
console.log('🧪 Running AppSumo Licensing API v2 Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
      return;
    } catch (err) {
      const isNetworkError =
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('timeout') ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('ECONNRESET');

      if (attempt < retries && isNetworkError) {
        console.warn(`     Retrying '${name}' due to transient network latency...`);
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failedTests++;
      return;
    }
  }
}

async function runAllTests() {
  const TEST_SECRET = 'test_appsumo_secret_key_12345';

  // =========================================================================
  // 1. AppSumo Tier Configuration & Limits
  // =========================================================================
  console.log('\n--- 1. Tier Configuration & Quotas ---');

  await test('Tier 1 has 15 employees and 5 departments limit', () => {
    const tier1 = getAppSumoTierConfig(1);
    assert.strictEqual(tier1.tier, 1);
    assert.strictEqual(tier1.maxEmployees, 15);
    assert.strictEqual(tier1.maxDepartments, 5);
    assert.strictEqual(getTierEmployeeLimit(1), 15);
    assert.strictEqual(getTierDepartmentLimit(1), 5);
  });

  await test('Tier 2 has 50 employees and 15 departments limit', () => {
    const tier2 = getAppSumoTierConfig(2);
    assert.strictEqual(tier2.tier, 2);
    assert.strictEqual(tier2.maxEmployees, 50);
    assert.strictEqual(tier2.maxDepartments, 15);
    assert.strictEqual(getTierEmployeeLimit(2), 50);
    assert.strictEqual(getTierDepartmentLimit(2), 15);
  });

  await test('Tier 3 has 250 employees and enterprise quota', () => {
    const tier3 = getAppSumoTierConfig(3);
    assert.strictEqual(tier3.tier, 3);
    assert.strictEqual(tier3.maxEmployees, 250);
    assert.strictEqual(tier3.maxDepartments, 999);
    assert.strictEqual(getTierEmployeeLimit(3), 250);
    assert.strictEqual(getTierDepartmentLimit(3), 999);
  });

  await test('Fallback: unknown tier defaults safely to Tier 1', () => {
    const fallback = getAppSumoTierConfig(999);
    assert.strictEqual(fallback.tier, 1);
    assert.strictEqual(fallback.maxEmployees, 15);
  });

  await test('Feature flag gating per tier', () => {
    assert.strictEqual(isFeatureEnabledForTier(1, 'performanceManagement'), false);
    assert.strictEqual(isFeatureEnabledForTier(2, 'performanceManagement'), true);
    assert.strictEqual(isFeatureEnabledForTier(3, 'customApprovalWorkflows'), true);
  });

  // =========================================================================
  // 2. Webhook Security: HMAC SHA-256 & Replay Protection
  // =========================================================================
  console.log('\n--- 2. Webhook HMAC-SHA256 Security & Replay Protection ---');

  await test('Valid HMAC signature matches and passes verification', () => {
    const rawBody = JSON.stringify({
      license_key: 'test-license-valid-01',
      event: 'purchase',
      tier: 1,
    });
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, nowTimestamp, TEST_SECRET);

    const result = verifyAppSumoWebhook({
      rawBody,
      signature,
      timestamp: nowTimestamp,
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.error, undefined);
  });

  await test('Valid HMAC signature with sha256= prefix passes verification', () => {
    const rawBody = JSON.stringify({
      license_key: 'test-license-valid-02',
      event: 'activate',
      tier: 2,
    });
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const signature = 'sha256=' + computeAppSumoSignature(rawBody, nowTimestamp, TEST_SECRET);

    const result = verifyAppSumoWebhook({
      rawBody,
      signature,
      timestamp: nowTimestamp,
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.valid, true);
  });

  await test('Tampered body fails signature verification', () => {
    const rawBody = JSON.stringify({ license_key: 'original-key', event: 'purchase' });
    const tamperedBody = JSON.stringify({ license_key: 'tampered-key', event: 'purchase' });
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, nowTimestamp, TEST_SECRET);

    const result = verifyAppSumoWebhook({
      rawBody: tamperedBody,
      signature,
      timestamp: nowTimestamp,
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Invalid HMAC signature'));
  });

  await test('Missing signature header is rejected', () => {
    const result = verifyAppSumoWebhook({
      rawBody: '{}',
      signature: null,
      timestamp: Date.now(),
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Missing or empty X-Appsumo-Signature'));
  });

  await test('Missing secret key is rejected', () => {
    const result = verifyAppSumoWebhook({
      rawBody: '{}',
      signature: 'dummy-sig',
      timestamp: Date.now(),
      secretKey: '',
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('APPSUMO_API_KEY is not configured'));
  });

  await test('Expired timestamp (> 600s) is rejected by replay attack protection', () => {
    const rawBody = JSON.stringify({ license_key: 'old-event' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 700; // 700 seconds in past
    const signature = computeAppSumoSignature(rawBody, oldTimestamp, TEST_SECRET);

    const result = verifyAppSumoWebhook({
      rawBody,
      signature,
      timestamp: oldTimestamp,
      secretKey: TEST_SECRET,
      toleranceSeconds: 600,
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('out of tolerance') || result.error.includes('expired'));
  });

  // =========================================================================
  // 3. OAuth Helper & Single-Use Code Handling
  // =========================================================================
  console.log('\n--- 3. OAuth Client URL & Validation ---');

  await test('OAuth authorize URL contains required parameters', () => {
    const authUrl = appsumoClient.getOAuthAuthorizeUrl({
      state: 'xyz_state_token',
      redirectUri: 'https://tasknera.com/appsumo/activate',
    });

    assert.ok(authUrl.includes('https://appsumo.com/openid/authorize/'));
    assert.ok(authUrl.includes('state=xyz_state_token'));
    assert.ok(authUrl.includes('response_type=code'));
    assert.ok(authUrl.includes('client_id='));
  });

  await test('exchangeCodeForLicense rejects empty or missing code with 400', async () => {
    try {
      await appsumoService.exchangeCodeForLicense('');
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('authorization code is required'));
    }
  });

  // =========================================================================
  // 4. Webhook Processing & Lifecycle Events (Database Integrated)
  // =========================================================================
  console.log('\n--- 4. Webhook Event Processing & Lifecycle ---');

  const testLicenseKey = `test-key-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const upgradedLicenseKey = `test-key-upgraded-${Date.now()}`;

  await test('Test Event (test: true): acknowledges with HTTP 200 and records test event', async () => {
    const testPingPayload = {
      license_key: `ping-${Date.now()}`,
      event: 'purchase',
      license_status: 'inactive',
      event_timestamp: Date.now(),
      created_at: Math.floor(Date.now() / 1000),
      tier: 1,
      test: true,
      extra: { reason: 'Partner portal ping' },
    };

    const rawBody = JSON.stringify(testPingPayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, timestamp, TEST_SECRET);

    const result = await appsumoService.processWebhookEvent({
      payload: testPingPayload,
      rawBody,
      headers: {
        'x-appsumo-signature': signature,
        'x-appsumo-timestamp': String(timestamp),
      },
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.event, 'purchase');
    assert.strictEqual(result.success, true);
  });

  await test('Purchase Event: stores license with inactive status and tier 1', async () => {
    const purchasePayload = {
      license_key: testLicenseKey,
      event: 'purchase',
      license_status: 'inactive',
      event_timestamp: Date.now(),
      created_at: Math.floor(Date.now() / 1000),
      tier: 1,
      test: false,
    };

    const rawBody = JSON.stringify(purchasePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, timestamp, TEST_SECRET);

    const result = await appsumoService.processWebhookEvent({
      payload: purchasePayload,
      rawBody,
      headers: {
        'x-appsumo-signature': signature,
        'x-appsumo-timestamp': String(timestamp),
      },
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.event, 'purchase');
    assert.strictEqual(result.success, true);

    const stored = await appsumoRepository.findByLicenseKey(testLicenseKey);
    assert.ok(stored);
    assert.strictEqual(stored.licenseKey, testLicenseKey);
    assert.strictEqual(stored.tier, 1);
    assert.strictEqual(stored.status, 'inactive');
  });

  await test('Activate Event: marks license active even when AppSumo sends license_status: inactive', async () => {
    // Note: AppSumo Partner Guide states AppSumo sends license_status = "inactive" during activate!
    const activatePayload = {
      license_key: testLicenseKey,
      event: 'activate',
      license_status: 'inactive',
      event_timestamp: Date.now() + 10,
      tier: 1,
      test: false,
    };

    const rawBody = JSON.stringify(activatePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, timestamp, TEST_SECRET);

    const result = await appsumoService.processWebhookEvent({
      payload: activatePayload,
      rawBody,
      headers: {
        'x-appsumo-signature': signature,
        'x-appsumo-timestamp': String(timestamp),
      },
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.event, 'activate');
    assert.strictEqual(result.success, true);

    const stored = await appsumoRepository.findByLicenseKey(testLicenseKey);
    assert.strictEqual(stored.status, 'active');
  });

  await test('Link License to Organization & Query Entitlement', async () => {
    const linked = await appsumoService.linkLicenseToOrganization({
      licenseKey: testLicenseKey,
      organizationId: 'org-1',
    });

    assert.strictEqual(linked.organizationId, 'org-1');
    assert.strictEqual(linked.status, 'active');

    const entitlement = await appsumoService.getOrganizationEntitlement('org-1');
    assert.strictEqual(entitlement.hasAppSumo, true);
    assert.strictEqual(entitlement.isEntitled, true);
    assert.strictEqual(entitlement.tier, 1);
    assert.strictEqual(entitlement.maxEmployees, 15);
    assert.strictEqual(entitlement.maxDepartments, 5);
  });

  await test('Upgrade Event: AppSumo provides new license_key & prev_license_key; links org and updates tier', async () => {
    const upgradePayload = {
      license_key: upgradedLicenseKey,
      prev_license_key: testLicenseKey,
      event: 'upgrade',
      tier: 3,
      event_timestamp: Date.now() + 20,
      test: false,
    };

    const rawBody = JSON.stringify(upgradePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, timestamp, TEST_SECRET);

    const result = await appsumoService.processWebhookEvent({
      payload: upgradePayload,
      rawBody,
      headers: {
        'x-appsumo-signature': signature,
        'x-appsumo-timestamp': String(timestamp),
      },
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.event, 'upgrade');
    assert.strictEqual(result.success, true);

    // Old license should be deactivated/replaced
    const oldLicense = await appsumoRepository.findByLicenseKey(testLicenseKey);
    assert.strictEqual(oldLicense.status, 'deactivated');

    // New license should be active with tier 3 and linked to org-1
    const newLicense = await appsumoRepository.findByLicenseKey(upgradedLicenseKey);
    assert.strictEqual(newLicense.status, 'active');
    assert.strictEqual(newLicense.tier, 3);
    assert.strictEqual(newLicense.organizationId, 'org-1');

    // Entitlement should now reflect tier 3 (250 employees, 999 departments)
    const entitlement = await appsumoService.getOrganizationEntitlement('org-1');
    assert.strictEqual(entitlement.tier, 3);
    assert.strictEqual(entitlement.maxEmployees, 250);
    assert.strictEqual(entitlement.maxDepartments, 999);
  });

  await test('Deactivate Event: deactivates entitlement WITHOUT deleting org or customer data', async () => {
    const deactivatePayload = {
      license_key: upgradedLicenseKey,
      event: 'deactivate',
      license_status: 'active', // AppSumo sends active until HTTP 200
      event_timestamp: Date.now() + 30,
      test: false,
    };

    const rawBody = JSON.stringify(deactivatePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, timestamp, TEST_SECRET);

    const result = await appsumoService.processWebhookEvent({
      payload: deactivatePayload,
      rawBody,
      headers: {
        'x-appsumo-signature': signature,
        'x-appsumo-timestamp': String(timestamp),
      },
      secretKey: TEST_SECRET,
    });

    assert.strictEqual(result.event, 'deactivate');
    assert.strictEqual(result.success, true);

    const stored = await appsumoRepository.findByLicenseKey(upgradedLicenseKey);
    assert.strictEqual(stored.status, 'deactivated');

    // Entitlement is not active, but org and license record still exist
    const entitlement = await appsumoService.getOrganizationEntitlement('org-1');
    assert.strictEqual(entitlement.isEntitled, false);
    assert.strictEqual(entitlement.status, 'deactivated');
  });

  await test('Duplicate Event Idempotency: re-sending event with identical timestamp returns HTTP 200 without error', async () => {
    const timestampMs = Date.now() + 50;
    const eventPayload = {
      license_key: `idempotent-${Date.now()}`,
      event: 'purchase',
      tier: 1,
      event_timestamp: timestampMs,
    };

    const rawBody = JSON.stringify(eventPayload);
    const tsSec = Math.floor(Date.now() / 1000);
    const signature = computeAppSumoSignature(rawBody, tsSec, TEST_SECRET);

    // First call
    const res1 = await appsumoService.processWebhookEvent({
      payload: eventPayload,
      rawBody,
      headers: { 'x-appsumo-signature': signature, 'x-appsumo-timestamp': String(tsSec) },
      secretKey: TEST_SECRET,
    });
    assert.strictEqual(res1.success, true);

    // Second call with same event_timestamp
    const res2 = await appsumoService.processWebhookEvent({
      payload: eventPayload,
      rawBody,
      headers: { 'x-appsumo-signature': signature, 'x-appsumo-timestamp': String(tsSec) },
      secretKey: TEST_SECRET,
    });
    assert.strictEqual(res2.success, true);
  });

  // Cleanup test artifacts from DB
  try {
    await pool.query("DELETE FROM appsumo_license_events WHERE license_key LIKE 'test-%' OR license_key LIKE 'ping-%' OR license_key LIKE 'idempotent-%'");
    await pool.query("DELETE FROM appsumo_licenses WHERE license_key LIKE 'test-%' OR license_key LIKE 'ping-%' OR license_key LIKE 'idempotent-%'");
  } catch (cleanErr) {
    console.warn('Test cleanup warning:', cleanErr.message);
  }

  // Summary
  console.log('\n====================================================');
  console.log(`Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

