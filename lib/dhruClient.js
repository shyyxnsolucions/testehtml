const DEFAULT_TIMEOUT_MS = 10000;
const MAX_PREVIEW_LENGTH = 1000;

let cachedEndpoint = null;

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

function isHtmlResponse(text) {
  if (!text) return false;
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function safePreview(text, secrets = []) {
  if (isHtmlResponse(text)) {
    return '[HTML response omitted]';
  }
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

async function detectEndpoint({ baseUrl, username, apiKey, timeoutMs, action, params }) {
  if (cachedEndpoint) {
    return cachedEndpoint;
  }

  const payload = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action,
    ...params,
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

async function dhruRequest(action, params = {}) {
  const { baseUrl, username, apiKey, timeoutMs } = getDhruConfig();
  const endpoint = await detectEndpoint({
    baseUrl,
    username,
    apiKey,
    timeoutMs,
    action,
    params,
  });

  const payload = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action,
    ...params,
  });

  const { response, text } = await postForm(endpoint, payload, timeoutMs);

  return {
    response,
    text,
    endpointUsed: endpoint,
    actionUsed: action,
  };
}

function parseJson(text) {
  if (!text) return null;
  if (isHtmlResponse(text)) return null;
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
