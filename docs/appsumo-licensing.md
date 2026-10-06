# TaskNera HRMS — AppSumo Licensing API v2 Integration Guide

## 1. Executive Summary

This document outlines the end-to-end integration of the **AppSumo Licensing API v2** into TaskNera HRMS. The integration supports:
- **Instant Webhook Sync**: Real-time webhook ingestion for lifecycle actions (`purchase`, `activate`, `upgrade`, `downgrade`, `deactivate`, `migrate`).
- **OAuth 2.0 OpenID Activation**: Seamless, single-use authorization code exchange redirecting customers directly into TaskNera HRMS onboarding or existing organization linking.
- **Enterprise Security**: Raw-body HMAC-SHA256 signature validation, 10-minute replay window prevention, timing-safe string comparison, and token-bucket client rate limiting.
- **Strict Tier Quotas**: Real-time entitlement enforcement gating employee headcount based on active license tiers (Tier 1: 15, Tier 2: 50, Tier 3: 250).
- **Data Protection & Continuity**: Zero tenant data loss on downgrade or deactivation, with `prev_license_key` tracking across license migrations.
- **SuperAdmin Audit Console**: Integrated search, status tracking, and immutable event auditing directly within TaskNera Admin Settings.

---

## 2. Architecture & System Flow

```
+-----------------------------------------------------------------------------------+
|                                 AppSumo Platform                                  |
+-----------------------------------------------------------------------------------+
        |                                                            |
        | 1. Webhook Notification                                    | 2. Customer Click
        |    (purchase, activate, upgrade, etc.)                     |    "Redeem" / "Activate"
        v                                                            v
+-------------------------------+                       +---------------------------+
|  TaskNera Backend API         |                       | TaskNera Frontend (Vite)  |
|  POST /api/v1/appsumo/webhook |                       | GET /appsumo/activate     |
+-------------------------------+                       +---------------------------+
        |                                                            |
        | Verify HMAC & Timestamp                                    | Exchange code for token
        | Process Lifecycle Event                                    v
        v                                               +---------------------------+
+-------------------------------+                       | Backend OAuth Endpoint    |
| PostgreSQL Database           |                       | POST /api/v1/appsumo/     |
| - appsumo_licenses            |                       |      oauth/exchange       |
| - appsumo_license_events      |                       +---------------------------+
+-------------------------------+                                    |
        ^                                                            | Fetch license details
        |                                                            | & link to Organization
        +------------------------------------------------------------+
```

### 2.1 The Two Operational Workflows

1. **Webhook-Driven Synchronization (Background Sync)**:
   - When a customer purchases or modifies a tier on AppSumo, AppSumo sends an authenticated POST request to `POST /api/v1/appsumo/webhook`.
   - The payload contains event metadata (`action`, `license_key`, `tier`, `license_status`, `invoice_item_uuid`, `prev_license_key`, etc.).
   - The backend records the event in `appsumo_license_events`, inserts/updates `appsumo_licenses`, and adjusts organization quotas.

2. **Customer Onboarding / Activation (Interactive Flow)**:
   - The customer clicks "Activate" on AppSumo, which redirects their browser to `GET /appsumo/activate?code=AUTHORIZATION_CODE`.
   - The TaskNera frontend captures the `code`, prompts the user to log in or create an account/organization, and calls `POST /api/v1/appsumo/oauth/exchange`.
   - The backend queries AppSumo's `/openid/token/` and `/openid/license_key/` endpoints, retrieves the verified `license_key`, and links it to the authenticated user's organization.

---

## 3. Tier & Feature Entitlements

TaskNera defines three centralized lifetime tiers as mapped in `backend/src/config/appsumoTiers.js`:

| Tier | Plan Name | Active Employee Limit | Storage Quota | Features Included |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | Starter LTD | **15 Employees** | 5 GB | Core HRMS, Employee Directory, Punch In/Out, Leave Approvals, Attendance Tracking |
| **Tier 2** | Growth LTD | **50 Employees** | 20 GB | Everything in Tier 1 + Shift Scheduling, Asset Tracking, Expense Reimbursements |
| **Tier 3** | Enterprise LTD | **250 Employees** | 100 GB | Everything in Tier 2 + Advanced Analytics, Custom Roles, Priority Support |

### Entitlement Enforcement
- **Headcount Gating**: When creating new employees via `POST /api/v1/employees`, `employeeService.js` queries `getOrganizationEntitlement(organizationId)`. If current active employee count reaches or exceeds `maxEmployees`, the request is rejected with HTTP 403 (`ForbiddenError: Employee limit reached for your active AppSumo tier`).
- **Department Gating**: When creating new departments via `POST /api/v1/departments`, `departmentController.js` queries `getOrganizationEntitlement(organizationId)`. If current department count reaches or exceeds `maxDepartments`, the request is rejected with HTTP 403.
- **Deactivation Handling**: When a license is deactivated or refunded, `status` is set to `deactivated`. Employees and organization records remain completely intact, but additions exceeding the baseline are blocked.

---

## 4. AppSumo Partner Portal Configuration

In the **AppSumo Partner Portal** under your product settings, configure the following endpoints:

| Setting | Production Value | Development / Local Value (via ngrok) |
| :--- | :--- | :--- |
| **Webhook URL** | `https://api.yourdomain.com/api/v1/appsumo/webhook` | `https://<ngrok-id>.ngrok-free.app/api/v1/appsumo/webhook` |
| **OAuth Redirect URI** | `https://app.yourdomain.com/appsumo/activate` | `http://localhost:5173/appsumo/activate` |
| **Authorization Type** | OAuth 2.0 OpenID Connect | OAuth 2.0 OpenID Connect |

---

## 5. Environment Variables & Credentials

Configure the following variables in `backend/.env`:

```env
# ==============================================================================
# APPSUMO LICENSING API V2 CONFIGURATION
# ==============================================================================
APPSUMO_CLIENT_ID=your_appsumo_client_id_here
APPSUMO_CLIENT_SECRET=your_appsumo_client_secret_here
APPSUMO_API_KEY=your_appsumo_hmac_secret_here
APPSUMO_API_BASE_URL=https://appsumo.com
APPSUMO_REDIRECT_URI=https://app.yourdomain.com/appsumo/activate
```

> **Security Note**: Never commit actual API keys or secrets to version control. Ensure `APPSUMO_API_KEY` matches the secret generated in your AppSumo Partner Portal for signing webhooks.

---

## 6. Security & Verification Engine

Located in `backend/src/utils/appsumoSecurity.js`:

1. **HMAC-SHA256 Signature Verification**:
   - Every incoming webhook must include `X-Appsumo-Signature` and `X-Appsumo-Timestamp`.
   - The signature is calculated as: `crypto.createHmac('sha256', APPSUMO_API_KEY).update(rawBody).digest('hex')`.
   - The verification uses `crypto.timingSafeEqual` to thwart timing attacks.

2. **Raw Body Preservation**:
   - Node/Express parses bodies into objects by default. TaskNera backend in `backend/src/app.js` captures `req.rawBody = buf.toString('utf8')` inside `express.json({ verify: ... })` to ensure the exact byte representation is preserved.

3. **Replay Protection**:
   - Timestamps older than 10 minutes (600 seconds) are rejected with HTTP 401.

4. **Token Bucket Rate Limiting**:
   - `backend/src/services/appsumoClient.js` enforces a client-side limit of 20 requests per minute with an exponential backoff retry mechanism to comply with AppSumo rate quotas.

---

## 7. Webhook Event Handling

| Action | AppSumo Trigger | TaskNera Handler Behavior |
| :--- | :--- | :--- |
| `purchase` | Buyer places an order | Creates a pending license record in `appsumo_licenses` with `status: pending_activation`. Logs event. |
| `activate` | Buyer activates license | Sets license `status: active`. **Note**: Even if AppSumo sends `license_status: "inactive"` in payload, TaskNera correctly treats this event as `active` per AppSumo Partner Guide. |
| `upgrade` | Buyer upgrades tier | Reads `prev_license_key`. Migrates organization association and updates `plan_id`, `tier`, and limits without data disruption. |
| `downgrade` | Buyer downgrades tier | Reads `prev_license_key`. Updates tier and quota downwards while preserving tenant and employee records. |
| `deactivate` | Refund or cancellation | Sets `status: deactivated`. Does **NOT** delete organization, employee profiles, or history. |
| `migrate` | Partner product migration | Re-associates license key while preserving tenant workspace. |
| `test=true` | Ping or validation | Validates HMAC signature, responds HTTP 200, but **skips mutating customer data**. |

### Idempotency
All events record an `event_id` in `appsumo_license_events`. If duplicate webhook deliveries arrive, TaskNera recognizes the existing `event_id` and immediately returns HTTP 200 `{ success: true, message: "Duplicate event already processed" }`.

---

## 8. Frontend Activation Page (`/appsumo/activate`)

Located in `frontend/src/pages/appsumo/AppSumoActivatePage.jsx`:
- **State Machine**: Supports 9 distinct, responsive states:
  1. `connecting`: Verifying authorization code.
  2. `login_required`: Customer needs to authenticate.
  3. `signup_required`: Customer needs to register a new account/tenant.
  4. `activating`: Associating license to tenant organization.
  5. `success`: Beautiful confirmation modal with tier limits and launch button.
  6. `already_activated`: Clear notification that license is already in use.
  7. `invalid_license`: Rejection notice for unrecognized licenses.
  8. `expired_authorization`: Error if the one-time code has expired.
  9. `error`: General error display with friendly recovery actions.

---

## 9. Admin Management Console

SuperAdmins and Admins can manage AppSumo licenses directly within the TaskNera portal:
- Navigate to **Admin Settings** > **AppSumo Licensing**.
- **Search & Filter**: Filter licenses by license key, invoice UUID, customer email, or organization.
- **Audit Logs**: Inspect raw event logs, delivery timestamps, action types, and IP addresses.
- **Security**: Client secrets and HMAC keys are completely redacted from frontend API responses.

---

## 10. Verification & Test Suite

TaskNera includes an automated test suite verifying all 20 critical security, webhook, and entitlement scenarios.

To run the suite:
```bash
cd backend
npm test
```

Output:
```
====================================================
🧪 Running AppSumo Licensing API v2 Test Suite
====================================================


--- 1. Tier Configuration & Quotas ---
  ✅ PASS: Tier 1 has 15 employees and 5 departments limit
  ✅ PASS: Tier 2 has 50 employees and 15 departments limit
  ✅ PASS: Tier 3 has 250 employees and enterprise quota
  ✅ PASS: Fallback: unknown tier defaults safely to Tier 1
  ✅ PASS: Feature flag gating per tier

--- 2. Webhook HMAC-SHA256 Security & Replay Protection ---
  ✅ PASS: Valid HMAC signature matches and passes verification
  ✅ PASS: Valid HMAC signature with sha256= prefix passes verification
  ✅ PASS: Tampered body fails signature verification
  ✅ PASS: Missing signature header is rejected
  ✅ PASS: Missing secret key is rejected
  ✅ PASS: Expired timestamp (> 600s) is rejected by replay attack protection

--- 3. OAuth Client URL & Validation ---
  ✅ PASS: OAuth authorize URL contains required parameters
  ✅ PASS: exchangeCodeForLicense rejects empty or missing code with 400

--- 4. Webhook Event Processing & Lifecycle ---
  ✅ PASS: Test Event (test: true): acknowledges with HTTP 200 and records test event
  ✅ PASS: Purchase Event: stores license with inactive status and tier 1
  ✅ PASS: Activate Event: marks license active even when AppSumo sends license_status: inactive
  ✅ PASS: Link License to Organization & Query Entitlement
  ✅ PASS: Upgrade Event: AppSumo provides new license_key & prev_license_key; links org and updates tier
  ✅ PASS: Deactivate Event: deactivates entitlement WITHOUT deleting org or customer data
  ✅ PASS: Duplicate Event Idempotency: re-sending event with identical timestamp returns HTTP 200 without error

====================================================
Test Results: 20 PASSED, 0 FAILED
====================================================
```

