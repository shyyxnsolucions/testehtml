const DEFAULT_TIMEOUT_MS = 10000;
const MAX_PREVIEW_LENGTH = 1000;

function redactSecrets(text, secrets) {
  if (!text) return '';
  let safe = text;
  for (const secret of secrets) {
    if (!secret) continue;
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safe = safe.replace(new RegExp(escaped, 'g'), '***');
  }
  return safe.slice(0, MAX_PREVIEW_LENGTH);
}

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

async function postDhru({ baseUrl, username, apiKey, action }) {
  const url = new URL('/api/index.php', baseUrl);
  const payload = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action,
  });

  const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const baseUrl = process.env.GSM_IMEI_BASE_URL;
  const username = process.env.GSM_IMEI_API_USERNAME;
  const apiKey = process.env.GSM_IMEI_API_KEY;

  const missing = [
    !baseUrl ? 'GSM_IMEI_BASE_URL' : null,
    !username ? 'GSM_IMEI_API_USERNAME' : null,
    !apiKey ? 'GSM_IMEI_API_KEY' : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return res.status(500).json({
      error: 'Configuração ausente para GSM IMEI.',
      detail: `Verifique as variáveis de ambiente necessárias: ${missing.join(
        ', '
      )}.`,
    });
  }

  try {
    const { response, text } = await postDhru({
      baseUrl,
      username,
      apiKey,
      action: 'accountinfo',
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      status: response.status,
      ok: response.ok,
      bodyPreview: redactSecrets(text, [apiKey, username]),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      status: 500,
      ok: false,
      bodyPreview: redactSecrets(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [apiKey, username]
      ),
    });
  }
};
