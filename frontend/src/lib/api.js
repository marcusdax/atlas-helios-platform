/**
 * One API client for the whole app.
 *
 * Every response from the backend is either `{ data, meta }` or an error
 * envelope carrying a stable `code`. Unwrapping that in one place is what keeps
 * a page from inventing its own error handling and getting it subtly wrong.
 */

const BASE = process.env.REACT_APP_API_URL || '/api';
const TOKEN_KEY = 'atlas.access_token';

export class ApiError extends Error {
  constructor(message, { code, status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Copy for the codes the API can return, so pages do not each write their own. */
const MESSAGES = {
  VALIDATION_ERROR: 'Some fields need attention.',
  NOT_FOUND: 'That record no longer exists.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  RADAR_UNAVAILABLE: 'The radar feed is temporarily unavailable.',
  ALERTS_UNAVAILABLE: 'The weather alert feed is temporarily unavailable.',
  ESTIMATE_LOCKED: 'This estimate has been sent and can no longer be repriced.',
  ALREADY_SENT: 'This estimate has already been sent.',
  CRM_NOT_CONFIGURED: 'No CRM is connected yet.',
  INTERNAL_ERROR: 'Something went wrong on our side.'
};

export const messageFor = (error) =>
  MESSAGES[error?.code] || error?.message || 'Something went wrong.';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode: the session simply does not persist */ }
};

async function request(path, { method = 'GET', body, signal, headers = {} } = {}) {
  const token = getToken();

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body instanceof FormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (error) {
    if (signal?.aborted) throw new ApiError('aborted', { code: 'ABORTED' });
    throw new ApiError('Could not reach the server.', { code: 'NETWORK' });
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed (${response.status})`, {
      code: payload?.code,
      status: response.status,
      details: payload?.details
    });
  }
  return payload;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
};

export const api = {
  request,

  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: (signal) => request('/auth/me', { signal }),
    logout: () => request('/auth/logout', { method: 'POST' })
  },

  properties: {
    list: (params, signal) => request(`/properties${qs(params)}`, { signal }),
    get: (id, signal) => request(`/properties/${id}`, { signal }),
    create: (body) => request('/properties', { method: 'POST', body }),
    update: (id, body) => request(`/properties/${id}`, { method: 'PUT', body }),
    search: (params, signal) => request(`/properties/search${qs(params)}`, { signal })
  },

  storms: {
    list: (params, signal) => request(`/storms${qs(params)}`, { signal }),
    get: (id, signal) => request(`/storms/${id}`, { signal }),
    regions: (signal) => request('/storms/regions', { signal }),
    track: (body) => request('/storms/track', { method: 'POST', body }),
    exposedProperties: (id, params, signal) => request(`/storms/${id}/properties${qs(params)}`, { signal })
  },

  assessments: {
    history: (params, signal) => request(`/assessments/history${qs(params)}`, { signal }),
    get: (id, signal) => request(`/assessments/${id}`, { signal }),
    // FormData so inspection photos ride along with the request.
    start: (formData) => request('/assessments', { method: 'POST', body: formData }),
    review: (id, body) => request(`/assessments/${id}`, { method: 'PUT', body })
  },

  leads: {
    list: (params, signal) => request(`/leads${qs(params)}`, { signal }),
    get: (id, signal) => request(`/leads/${id}`, { signal }),
    create: (body) => request('/leads', { method: 'POST', body }),
    update: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
    exportCsv: (body) => request('/leads/export', { method: 'POST', body })
  },

  estimates: {
    list: (params, signal) => request(`/estimates${qs(params)}`, { signal }),
    get: (id, signal) => request(`/estimates/${id}`, { signal }),
    create: (body) => request('/estimates', { method: 'POST', body }),
    update: (id, body) => request(`/estimates/${id}`, { method: 'PUT', body }),
    send: (id, body) => request(`/estimates/${id}/send`, { method: 'POST', body })
  },

  radar: {
    config: (signal) => request('/radar/config', { signal }),
    frames: (params, signal) => request(`/radar/frames${qs(params)}`, { signal }),
    alerts: (params, signal) => request(`/radar/alerts${qs(params)}`, { signal }),
    exposure: (params, signal) => request(`/radar/exposure${qs(params)}`, { signal })
  }
};

export default api;
