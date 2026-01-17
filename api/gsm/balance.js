const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RAW_LENGTH = 1000;

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

function truncateRaw(value) {
  if (!value) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, MAX_RAW_LENGTH);
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

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
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
      action: 'balance',
    });

    const json = parseJson(text);
    const balance = json?.balance ?? json?.data?.balance ?? null;
    const currency = json?.currency ?? json?.data?.currency ?? null;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      balance,
      currency,
      raw: json || truncateRaw(text),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      balance: null,
      currency: null,
      raw: truncateRaw(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`
      ),
    });
  }
};
