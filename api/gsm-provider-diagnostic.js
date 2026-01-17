const DEFAULT_TIMEOUT_MS = 10000;

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

function sanitizeSnippet(text, apiKey) {
  if (!text) return '';
  let safeText = text;
  if (apiKey) {
    const escapedKey = apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safeText = safeText.replace(new RegExp(escapedKey, 'g'), 'REDACTED');
  }
  safeText = safeText.replace(/Bearer\s+[^\s"']+/gi, 'Bearer REDACTED');
  safeText = safeText.replace(/api_key=[^\s&]+/gi, 'api_key=REDACTED');
  return safeText.slice(0, 200);
}

async function runRequest({ name, url, method, headers, body, apiKey }) {
  const result = {
    name,
    url,
    method,
    status: null,
    contentType: null,
    bodySnippet: '',
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

    result.status = response.status;
    result.contentType = response.headers.get('content-type');

    const text = await response.text();
    result.bodySnippet = sanitizeSnippet(text, apiKey);
  } catch (error) {
    result.bodySnippet = sanitizeSnippet(
      `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      apiKey
    );
  }

  return result;
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

  const apiBody = new URLSearchParams({ action: 'balance', api_key: apiKey });
  const apiHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': 'Vercel Serverless',
  };

  const results = [];
  results.push(
    await runRequest({
      name: 'GET_api',
      url: new URL('/api', baseUrl).toString(),
      method: 'GET',
      headers: { 'User-Agent': 'Vercel Serverless' },
      apiKey,
    })
  );
  results.push(
    await runRequest({
      name: 'GET_api_slash',
      url: new URL('/api/', baseUrl).toString(),
      method: 'GET',
      headers: { 'User-Agent': 'Vercel Serverless' },
      apiKey,
    })
  );
  results.push(
    await runRequest({
      name: 'GET_api_index',
      url: new URL('/api/index.php', baseUrl).toString(),
      method: 'GET',
      headers: { 'User-Agent': 'Vercel Serverless' },
      apiKey,
    })
  );
  results.push(
    await runRequest({
      name: 'POST_api_balance',
      url: new URL('/api', baseUrl).toString(),
      method: 'POST',
      headers: apiHeaders,
      body: apiBody,
      apiKey,
    })
  );
  results.push(
    await runRequest({
      name: 'POST_api_index_balance',
      url: new URL('/api/index.php', baseUrl).toString(),
      method: 'POST',
      headers: apiHeaders,
      body: apiBody,
      apiKey,
    })
  );
  results.push(
    await runRequest({
      name: 'POST_widget_service_details',
      url: new URL('/widget/getServicedetailsIMEI', baseUrl).toString(),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'Vercel Serverless',
      },
      body: new URLSearchParams({
        serviceid: 'TEST',
        chosen: '1',
        charge: '0',
      }),
      apiKey,
    })
  );

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    timestamp: new Date().toISOString(),
    baseUrl,
    serverlessProvider: 'vercel',
    results,
  });
};
