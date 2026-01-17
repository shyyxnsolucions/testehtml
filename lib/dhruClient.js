const DEFAULT_TIMEOUT_MS = 10000;
const MAX_PREVIEW_LENGTH = 1000;

const USER_FIELD_CANDIDATES = ['username', 'user', 'email'];
const KEY_FIELD_CANDIDATES = ['apiaccesskey', 'api_key', 'apikey', 'key'];

let cachedEndpoint = null;
let cachedFieldMap = null;

function getTimeoutMs() {
  const parsed = Number.parseInt(process.env.DHRU_TIMEOUT_MS, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
}

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

function redactSecrets(text, secrets) {
  if (!text) return '';
  let safe = text;
  for (const secret of secrets) {
    if (!secret) continue;
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safe = safe.replace(new RegExp(escaped, 'g'), '***');
  }
  return safe;
}

function safePreview(text, secrets = []) {
  return redactSecrets(text, secrets).slice(0, MAX_PREVIEW_LENGTH);
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, '');
}

function buildEndpointCandidates(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  return ['/api/index.php', '/api/index', '/api'].map(
    (path) => `${normalized}${path}`
  );
}

async function postForm(url, payload, timeoutMs) {
  const { signal, timeout } = buildTimeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
      signal,
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function getDhruConfig() {
  const baseUrl = process.env.DHRU_BASE_URL;
  const username = process.env.DHRU_USER;
  const apiKey = process.env.DHRU_API_KEY;
  const timeoutMs = getTimeoutMs();

  if (!baseUrl || !username || !apiKey) {
    const missing = [];
    if (!baseUrl) missing.push('DHRU_BASE_URL');
    if (!username) missing.push('DHRU_USER');
    if (!apiKey) missing.push('DHRU_API_KEY');
    const error = new Error(`Missing required DHRU envs: ${missing.join(', ')}`);
    error.code = 'DHRU_ENV_MISSING';
    throw error;
  }

  return {
    baseUrl,
    username,
    apiKey,
    timeoutMs,
  };
}

async function detectEndpoint({ baseUrl, username, apiKey, timeoutMs }) {
  if (cachedEndpoint) {
    return cachedEndpoint;
  }

  const payload = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action: 'accountinfo',
  });

  const candidates = buildEndpointCandidates(baseUrl);
  let lastError = null;

  for (const endpoint of candidates) {
    try {
      const { response } = await postForm(endpoint, payload, timeoutMs);
      if (response.status !== 404) {
        cachedEndpoint = endpoint;
        return endpoint;
      }
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error('No DHRU endpoint responded (all returned 404)');
  error.code = 'DHRU_ENDPOINT_NOT_FOUND';
  error.cause = lastError || undefined;
  throw error;
}

function buildFieldMapCandidates() {
  const userFields = [...USER_FIELD_CANDIDATES];
  const keyFields = [...KEY_FIELD_CANDIDATES];

  if (cachedFieldMap) {
    const { userField, keyField } = cachedFieldMap;
    if (userField && !userFields.includes(userField)) {
      userFields.unshift(userField);
    } else if (userField) {
      userFields.splice(userFields.indexOf(userField), 1);
      userFields.unshift(userField);
    }
    if (keyField && !keyFields.includes(keyField)) {
      keyFields.unshift(keyField);
    } else if (keyField) {
      keyFields.splice(keyFields.indexOf(keyField), 1);
      keyFields.unshift(keyField);
    }
  }

  return { userFields, keyFields };
}

async function requestWithFieldMap({
  endpoint,
  action,
  params,
  username,
  apiKey,
  timeoutMs,
}) {
  const { userFields, keyFields } = buildFieldMapCandidates();
  let firstNon404 = null;
  let lastError = null;

  for (const userField of userFields) {
    for (const keyField of keyFields) {
      const payload = new URLSearchParams({
        [userField]: username,
        [keyField]: apiKey,
        action,
        ...params,
      });

      try {
        const { response, text } = await postForm(endpoint, payload, timeoutMs);
        const result = {
          response,
          text,
          fieldMapUsed: { userField, keyField },
        };

        if (response.ok) {
          cachedFieldMap = { userField, keyField };
          return result;
        }

        if (response.status !== 404 && !firstNon404) {
          firstNon404 = result;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (firstNon404) {
    return firstNon404;
  }

  if (lastError) {
    const error = new Error('Failed to reach DHRU endpoint');
    error.code = 'DHRU_REQUEST_FAILED';
    error.cause = lastError;
    throw error;
  }

  const error = new Error('DHRU request failed (no response)');
  error.code = 'DHRU_REQUEST_FAILED';
  throw error;
}

async function dhruRequest({ actionCandidates, params }) {
  const { baseUrl, username, apiKey, timeoutMs } = getDhruConfig();
  const endpoint = await detectEndpoint({ baseUrl, username, apiKey, timeoutMs });

  let fallbackResult = null;

  for (const action of actionCandidates) {
    const result = await requestWithFieldMap({
      endpoint,
      action,
      params,
      username,
      apiKey,
      timeoutMs,
    });

    const responseWithMeta = {
      ...result,
      endpointUsed: endpoint,
      actionUsed: action,
    };

    if (result.response?.ok) {
      return responseWithMeta;
    }

    if (!fallbackResult) {
      fallbackResult = responseWithMeta;
    }
  }

  if (fallbackResult) {
    return fallbackResult;
  }

  const error = new Error('DHRU request failed (no usable response)');
  error.code = 'DHRU_REQUEST_FAILED';
  throw error;
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

module.exports = {
  dhruRequest,
  getDhruConfig,
  safePreview,
  parseJson,
};
