const DEFAULT_TIMEOUT_MS = 10000;
const API_CANDIDATES = ['/api', '/api/', '/api/index.php', '/api/v1', '/api/v1/'];

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

async function probeApiEndpoint(baseUrl) {
  for (const candidate of API_CANDIDATES) {
    const url = new URL(candidate, baseUrl).toString();

    for (const method of ['HEAD', 'GET']) {
      try {
        const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
        const response = await fetch(url, { method, signal });
        clearTimeout(timeout);

        if (response.status !== 404) {
          return url;
        }
      } catch (error) {
        // ignore probe errors and keep trying
      }
    }
  }

  return null;
}

function sanitizePreview(text, apiKey) {
  if (!text) return '';
  let safeText = text;
  if (apiKey) {
    const escapedKey = apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safeText = safeText.replace(new RegExp(escapedKey, 'g'), '***');
  }
  return safeText.slice(0, 2000);
}

function extractHeaders(response) {
  const headerNames = [
    'content-type',
    'content-length',
    'server',
    'date',
    'cache-control',
  ];
  const headers = {};
  for (const name of headerNames) {
    const value = response.headers.get(name);
    if (value) {
      headers[name] = value;
    }
  }
  return headers;
}

function buildErrorPayload(error) {
  if (!error) return null;
  const payload = {
    name: error?.name || 'Error',
    message: error?.message || 'Unknown error',
  };
  if (error?.cause) {
    payload.cause = {
      name: error.cause?.name || 'Error',
      message: error.cause?.message || 'Unknown error',
    };
  }
  return payload;
}

async function runAttempt({ name, url, method, headers, body, apiKey }) {
  const attempt = {
    name,
    url,
    method,
    status: null,
    ok: false,
    headers: {},
    bodyPreview: '',
    error: null,
  };

  try {
    const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal,
    });
    clearTimeout(timeout);

    attempt.status = response.status;
    attempt.ok = response.ok;
    attempt.headers = extractHeaders(response);

    const text = await response.text();
    attempt.bodyPreview = sanitizePreview(text, apiKey);
  } catch (error) {
    attempt.error = buildErrorPayload(error);
  }

  return attempt;
}

function isHtmlResponse(attempt) {
  const contentType = attempt.headers?.['content-type']?.toLowerCase() || '';
  const preview = attempt.bodyPreview?.toLowerCase() || '';
  return (
    contentType.includes('text/html') ||
    preview.includes('<html') ||
    preview.includes('<!doctype html') ||
    preview.includes('/widget')
  );
}

function isRegisteredLikely(attempt) {
  if (attempt.status === null) return false;
  if (attempt.status < 200 || attempt.status >= 400) return false;
  return !isHtmlResponse(attempt);
}

function detectConclusion(attempts, resolvedApiEndpoint) {
  if (!resolvedApiEndpoint) {
    return 'API_ENDPOINT_NOT_FOUND';
  }

  if (attempts.some((attempt) => isRegisteredLikely(attempt))) {
    return 'REGISTERED_LIKELY';
  }

  const blocked = attempts.some((attempt) =>
    /invalid ip|ip not allowed/i.test(attempt.bodyPreview || '')
  );
  if (blocked) return 'BLOCKED_BY_IP';

  const authFailed = attempts.some((attempt) =>
    /invalid key|unauthorized/i.test(attempt.bodyPreview || '')
  );
  if (authFailed) return 'AUTH_FAILED';

  return 'UNKNOWN';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const baseUrl = process.env.GSM_IMEI_BASE_URL;
  const apiKey = process.env.GSM_IMEI_API_KEY;

  if (!baseUrl || !apiKey) {
    return res.status(500).json({
      error: 'Configuração ausente para GSM IMEI.',
      detail: 'Verifique as variáveis de ambiente necessárias.',
    });
  }

  const resolvedApiEndpoint = await probeApiEndpoint(baseUrl);
  const attempts = [];
  const actions = ['balance', 'accountinfo', 'me', 'userinfo'];
  let registeredLikely = false;

  if (resolvedApiEndpoint) {
    for (const action of actions) {
      const attemptConfigs = [
        {
          name: `api_key_body_${action}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Vercel Serverless',
          },
          body: new URLSearchParams({ action, api_key: apiKey }),
        },
        {
          name: `apikey_body_${action}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Vercel Serverless',
          },
          body: new URLSearchParams({ action, apikey: apiKey }),
        },
        {
          name: `apiaccesskey_body_${action}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Vercel Serverless',
          },
          body: new URLSearchParams({ action, apiaccesskey: apiKey }),
        },
        {
          name: `key_body_${action}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Vercel Serverless',
          },
          body: new URLSearchParams({ action, key: apiKey }),
        },
        {
          name: `x_api_key_header_${action}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Vercel Serverless',
            'X-API-KEY': apiKey,
          },
          body: new URLSearchParams({ action }),
        },
        {
          name: `authorization_bearer_${action}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Vercel Serverless',
            Authorization: `Bearer ${apiKey}`,
          },
          body: new URLSearchParams({ action }),
        },
      ];

      for (const config of attemptConfigs) {
        const attempt = await runAttempt({
          name: config.name,
          url: resolvedApiEndpoint,
          method: 'POST',
          headers: config.headers,
          body: config.body,
          apiKey,
        });
        attempts.push(attempt);
        if (isRegisteredLikely(attempt)) {
          registeredLikely = true;
          break;
        }
      }

      if (registeredLikely) {
        break;
      }
    }
  }

  if (!registeredLikely) {
    attempts.push(
      await runAttempt({
        name: 'widget_service_details',
        url: new URL('/widget/getServicedetailsIMEI', baseUrl).toString(),
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Vercel Serverless',
          Authorization: `Bearer ${apiKey}`,
        },
        body: new URLSearchParams({
          serviceid: 'TEST',
          chosen: '1',
          charge: '0',
        }),
        apiKey,
      })
    );
  }

  const conclusion = detectConclusion(attempts, resolvedApiEndpoint);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    baseUrl,
    resolvedApiEndpoint,
    attempts,
    conclusion,
    timestamp: new Date().toISOString(),
  });
};
