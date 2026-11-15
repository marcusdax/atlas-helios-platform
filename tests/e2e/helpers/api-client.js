/**
 * E2E API Client Helper
 * Robust HTTP client wrapping native fetch with timeout, json parsing, and error safety.
 */

export class ApiClient {
  constructor(baseUrl = process.env.TEST_API_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  /**
   * Internal request handler with timeout and structured response
   */
  async request(pathOrUrl, options = {}) {
    const url = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
      ? pathOrUrl
      : `${this.baseUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

    const timeoutMs = options.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timer);

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      let data = null;
      let isJson = false;

      if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        try {
          data = JSON.parse(rawText);
          isJson = true;
        } catch {
          data = null;
          isJson = false;
        }
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        rawText,
        isJson,
        url
      };
    } catch (error) {
      clearTimeout(timer);
      return {
        status: 0,
        ok: false,
        headers: {},
        data: null,
        rawText: '',
        isJson: false,
        url,
        networkError: true,
        errorMessage: error.message
      };
    }
  }

  /**
   * GET request
   */
  async get(pathOrUrl, queryParams = {}, options = {}) {
    let url = pathOrUrl;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const qs = new URLSearchParams(queryParams).toString();
      url = `${pathOrUrl}${pathOrUrl.includes('?') ? '&' : '?'}${qs}`;
    }
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(pathOrUrl, body = {}, options = {}) {
    return this.request(pathOrUrl, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put(pathOrUrl, body = {}, options = {}) {
    return this.request(pathOrUrl, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async del(pathOrUrl, options = {}) {
    return this.request(pathOrUrl, { ...options, method: 'DELETE' });
  }
}

// Default export of shared client singleton
export const apiClient = new ApiClient();
