const { URL } = require('url');

class GsmImeiClient {
  constructor(config, logger = console) {
    this.config = config;
    this.logger = logger;
  }

  buildUrl(path) {
    const base = this.config.baseUrl.replace(/\/$/, '');
    return new URL(path, base).toString();
  }

  buildAuth(headers, body) {
    const { authMode, authPlacement, apiKey, sessionCookie } = this.config;

    if (authMode === 'session_cookie') {
      if (sessionCookie) {
        headers.Cookie = sessionCookie;
      }
      return;
    }

    if (!apiKey) {
      this.logger.warn('GSM IMEI API key is missing; request may fail.');
      return;
    }

    if (authPlacement === 'authorization_bearer') {
      headers.Authorization = `Bearer ${apiKey}`;
      return;
    }

    if (authPlacement === 'x_api_key') {
      headers['X-API-KEY'] = apiKey;
      return;
    }

    if (authPlacement === 'body_api_key') {
      body.api_key = apiKey;
    }
  }

  encodeBody(contentType, body) {
    if (contentType === 'application/json') {
      return JSON.stringify(body);
    }

    if (contentType === 'multipart/form-data') {
      const formData = new FormData();
      Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value);
        }
      });
      return formData;
    }

    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value);
      }
    });
    return params;
  }

  async postForm(path, body, options = {}) {
    const contentType =
      options.contentType || this.config.request.contentType || 'application/x-www-form-urlencoded';
    const url = this.buildUrl(path);

    const headers = {
      Accept: 'application/json, text/plain, */*',
    };

    const payload = { ...body };
    this.buildAuth(headers, payload);

    let requestBody = this.encodeBody(contentType, payload);

    if (contentType !== 'multipart/form-data') {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { raw: text };
    }

    if (!response.ok) {
      const error = new Error('GSM IMEI request failed');
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  }
}

module.exports = GsmImeiClient;
