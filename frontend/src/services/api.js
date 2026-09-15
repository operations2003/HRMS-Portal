/**
 * Centralized HTTP Client / API Layer
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = async (endpoint, options = {}) => {
  const token = localStorage.getItem('hrms_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized globally
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      window.dispatchEvent(new CustomEvent('hrms:auth:expired'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || 'An unexpected error occurred.');
      error.status = response.status;
      error.errors = data.errors || [];
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
};

export const http = {
  get: (endpoint, options) => apiClient(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiClient(endpoint, { method: 'POST', body, ...options }),
  put: (endpoint, body, options) => apiClient(endpoint, { method: 'PUT', body, ...options }),
  delete: (endpoint, options) => apiClient(endpoint, { method: 'DELETE', ...options }),
};
