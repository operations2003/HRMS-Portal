import { config } from '../config/index.js';

/**
 * In-memory token-bucket / sliding window rate limiter for AppSumo Licensing API calls.
 * AppSumo official rate limit: 20 requests per minute.
 */
class AppSumoRateLimiter {
  constructor(maxRequestsPerMinute = 20) {
    this.maxRequests = maxRequestsPerMinute;
    this.timestamps = [];
  }

  async acquire() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Evict timestamps older than 1 minute
    this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitTime = Math.max(100, 60000 - (now - oldest));
      console.warn(`[AppSumo Client] Rate limit ceiling (20 req/min) reached. Throttling for ${waitTime}ms.`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new AppSumoRateLimiter(20);

/**
 * AppSumo Licensing API v2 & OAuth Client
 */
export const appsumoClient = {
  /**
   * Internal authenticated HTTP request to AppSumo Licensing API v2
   */
  async request(endpoint, options = {}) {
    const apiKey = config.appsumo.apiKey;
    if (!apiKey) {
      const error = new Error('APPSUMO_API_KEY is not configured on the server.');
      error.statusCode = 500;
      throw error;
    }

    await rateLimiter.acquire();

    const baseUrl = config.appsumo.apiBaseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${baseUrl}${cleanEndpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-AppSumo-Licensing-Key': apiKey,
      ...options.headers,
    };

    const fetchOptions = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body && typeof options.body === 'object') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    if (response.status === 429) {
      const error = new Error('AppSumo Licensing API rate limit reached (20 req/min). Please retry later.');
      error.statusCode = 429;
      throw error;
    }

    if (response.status === 401 || response.status === 403) {
      const error = new Error('AppSumo Licensing API authentication failed. Verify APPSUMO_API_KEY.');
      error.statusCode = response.status;
      throw error;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || data.error || `AppSumo API error: HTTP ${response.status}`);
      error.statusCode = response.status;
      error.details = data;
      throw error;
    }

    return data;
  },

  // =========================================================================
  // 1. AppSumo Licensing API v2 Endpoints
  // =========================================================================

  /**
   * GET /licenses
   */
  async getLicenses(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `licenses?${queryString}` : 'licenses';
    return this.request(endpoint);
  },

  /**
   * GET /licenses/:license_key
   */
  async getLicense(licenseKey) {
    if (!licenseKey) throw new Error('licenseKey is required');
    return this.request(`licenses/${encodeURIComponent(licenseKey)}`);
  },

  /**
   * GET /licenses/events
   */
  async getLicensesEvents(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `licenses/events?${queryString}` : 'licenses/events';
    return this.request(endpoint);
  },

  /**
   * GET /licenses/:license_key/events
   */
  async getLicenseEvents(licenseKey) {
    if (!licenseKey) throw new Error('licenseKey is required');
    return this.request(`licenses/${encodeURIComponent(licenseKey)}/events`);
  },

  /**
   * GET /licenses/:license_key/webhook-responses
   */
  async getLicenseWebhookResponses(licenseKey) {
    if (!licenseKey) throw new Error('licenseKey is required');
    return this.request(`licenses/${encodeURIComponent(licenseKey)}/webhook-responses`);
  },

  /**
   * GET /profile
   */
  async getProfile() {
    return this.request('profile');
  },

  /**
   * PUT /profile
   */
  async updateProfile(profileData) {
    return this.request('profile', { method: 'PUT', body: profileData });
  },

  /**
   * POST /profile/contact
   */
  async createProfileContact(contactData) {
    return this.request('profile/contact', { method: 'POST', body: contactData });
  },

  /**
   * DELETE /profile/contact/:contact_id
   */
  async deleteProfileContact(contactId) {
    return this.request(`profile/contact/${encodeURIComponent(contactId)}`, { method: 'DELETE' });
  },

  // =========================================================================
  // 2. OAuth OpenID Endpoints (Single-Use Code Exchange)
  // =========================================================================

  /**
   * Build the AppSumo OAuth OpenID authorization URL for redirecting users to AppSumo.
   *
   * @param {object} params
   * @param {string} [params.state]
   * @param {string} [params.redirectUri]
   * @returns {string} Authorize URL
   */
  getOAuthAuthorizeUrl({ state, redirectUri } = {}) {
    const authBase = config.appsumo.authBaseUrl || 'https://appsumo.com';
    const clientId = config.appsumo.clientId || '';
    const finalRedirectUri = redirectUri || config.appsumo.redirectUri || '';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: finalRedirectUri,
      response_type: 'code',
      scope: 'openid',
    });

    if (state) {
      params.set('state', state);
    }

    return `${authBase}/openid/authorize/?${params.toString()}`;
  },

  /**
   * Exchange single-use authorization code for AppSumo access token.
   *
   * POST https://appsumo.com/openid/token/
   * Content-Type: application/x-www-form-urlencoded
   */
  async exchangeOAuthCode(code, redirectUri) {
    const clientId = config.appsumo.clientId;
    const clientSecret = config.appsumo.clientSecret;
    const authBase = config.appsumo.authBaseUrl;
    const finalRedirectUri = redirectUri || config.appsumo.redirectUri;

    if (!clientId || !clientSecret) {
      const error = new Error('APPSUMO_CLIENT_ID or APPSUMO_CLIENT_SECRET is missing from server configuration.');
      error.statusCode = 500;
      throw error;
    }

    const tokenUrl = `${authBase}/openid/token/`;

    const bodyParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: finalRedirectUri,
      code: code.trim(),
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: bodyParams.toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data.error_description || data.error || 'Failed to exchange AppSumo authorization code.';
      const error = new Error(message);
      error.statusCode = response.status === 400 ? 400 : 502;
      error.oauthError = data.error;
      throw error;
    }

    return data;
  },

  /**
   * Retrieve license key associated with the AppSumo access token.
   *
   * GET https://appsumo.com/openid/license_key/?access_token=...
   */
  async fetchLicenseKeyWithAccessToken(accessToken) {
    if (!accessToken) throw new Error('accessToken is required');

    const authBase = config.appsumo.authBaseUrl;
    const url = `${authBase}/openid/license_key/?access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data.message || data.error || 'Failed to retrieve license key with AppSumo access token.';
      const error = new Error(message);
      error.statusCode = response.status === 401 ? 401 : 502;
      throw error;
    }

    return data;
  },
};
