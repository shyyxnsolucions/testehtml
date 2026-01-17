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
  return safeText.slice(0, 400);
}

async function runAttempt({ name, url, method, headers, body, apiKey }) {
  const attempt = {
    name,
    url,
    status: null,
    ok: false,
    bodyPreview: '',
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

    const text = await response.text();
    attempt.bodyPreview = sanitizePreview(text, apiKey);
  } catch (error) {
    attempt.bodyPreview = sanitizePreview(
      `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      apiKey
    );
  }

  return attempt;
}

function isApiAccessBlocked(attempt) {
  if (attempt.status !== 403) return false;
  return /page does not exist|error 404|<html|<style|\.fof/i.test(
    attempt.bodyPreview || ''
  );
}

function detectConclusion(attempts, resolvedApiEndpoint) {
  if (attempts.some((attempt) => attempt.status >= 200 && attempt.status < 400)) {
    return 'REGISTERED_LIKELY';
  }

  if (attempts.some((attempt) => isApiAccessBlocked(attempt))) {
    return 'API_ACCESS_ENDPOINT_BLOCKED_OR_NOT_AVAILABLE';
  }

  if (!resolvedApiEndpoint) {
    return 'API_ENDPOINT_NOT_FOUND';
  }

  return 'UNKNOWN';
}

function detectRecommendedMode(conclusion) {
  if (conclusion === 'REGISTERED_LIKELY') {
    return 'API_REAL';
  }
  return 'WIDGET_BACKEND_INTEGRATION';
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

  if (resolvedApiEndpoint) {
    const actions = ['balance', 'accountinfo', 'me', 'userinfo'];

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
        if (attempt.status >= 200 && attempt.status < 400) {
          break;
        }
      }

      if (attempts.some((attempt) => attempt.status >= 200 && attempt.status < 400)) {
        break;
      }
    }
  }

  const conclusion = detectConclusion(attempts, resolvedApiEndpoint);
  const recommendedMode = detectRecommendedMode(conclusion);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    baseUrl,
    resolvedApiEndpoint,
    attempts: attempts.map((attempt) => ({
      name: attempt.name,
      url: attempt.url,
      status: attempt.status,
      ok: attempt.ok,
      bodyPreview: attempt.bodyPreview,
    })),
    conclusion,
    recommendedMode,
    timestamp: new Date().toISOString(),
  });
};
