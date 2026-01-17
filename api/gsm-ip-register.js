const DEFAULT_TIMEOUT_MS = 10000;

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

async function probeApiEndpoint(baseUrl) {
  const candidates = ['/api', '/api/', '/api/index.php'];

  for (const candidate of candidates) {
    const url = new URL(candidate, baseUrl).toString();
    try {
      const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
      const response = await fetch(url, {
        method: 'HEAD',
        signal,
      });
      clearTimeout(timeout);

      if (response.status !== 404) {
        return url;
      }
    } catch (error) {
      // ignore probe errors and keep trying
    }

    try {
      const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
      const response = await fetch(url, {
        method: 'GET',
        signal,
      });
      clearTimeout(timeout);

      if (response.status !== 404) {
        return url;
      }
    } catch (error) {
      // ignore probe errors and keep trying
    }
  }

  return null;
}

function sanitizePreview(text, apiKey) {
  if (!text) return '';
  if (!apiKey) return text.slice(0, 1000);
  const escapedKey = apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const redacted = text.replace(new RegExp(escapedKey, 'g'), '[redacted]');
  return redacted.slice(0, 1000);
}

async function runAttempt({ name, url, options, apiKey }) {
  const attempt = {
    name,
    url,
    status: null,
    ok: false,
    bodyPreview: '',
    error: null,
  };

  try {
    const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeout);

    attempt.status = response.status;
    attempt.ok = response.ok;

    const text = await response.text();
    attempt.bodyPreview = sanitizePreview(text, apiKey);
  } catch (error) {
    attempt.error = {
      name: error?.name || 'Error',
      message: error?.message || 'Unknown error',
    };
  }

  return attempt;
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
    const formBody = (body) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Vercel Serverless',
      },
      body: new URLSearchParams(body),
    });

    attempts.push(
      await runAttempt({
        name: 'api_key_body_balance',
        url: resolvedApiEndpoint,
        apiKey,
        options: formBody({ api_key: apiKey, action: 'balance' }),
      })
    );

    if (!attempts[attempts.length - 1].ok) {
      attempts.push(
        await runAttempt({
          name: 'x_api_key_header_balance',
          url: resolvedApiEndpoint,
          apiKey,
          options: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Vercel Serverless',
              'X-API-KEY': apiKey,
            },
            body: new URLSearchParams({ action: 'balance' }),
          },
        })
      );
    }

    if (!attempts[attempts.length - 1].ok) {
      attempts.push(
        await runAttempt({
          name: 'authorization_bearer_balance',
          url: resolvedApiEndpoint,
          apiKey,
          options: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Vercel Serverless',
              Authorization: `Bearer ${apiKey}`,
            },
            body: new URLSearchParams({ action: 'balance' }),
          },
        })
      );
    }
  }

  if (!attempts.length || !attempts[attempts.length - 1].ok) {
    attempts.push(
      await runAttempt({
        name: 'widget_service_details',
        url: new URL('/widget/getServicedetailsIMEI', baseUrl).toString(),
        apiKey,
        options: {
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
        },
      })
    );
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    resolvedApiEndpoint,
    attempts,
    timestamp: new Date().toISOString(),
  });
};
