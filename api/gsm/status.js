const DEFAULT_TIMEOUT_MS = 10000;
const STATUS_CANDIDATES = [
  '/widget/orders',
  '/widget/orderstatus',
  '/widget/imeiorders',
  '/widget/getorderstatus',
];

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
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

async function tryStatusEndpoint({ baseUrl, apiKey, orderId, path }) {
  const url = new URL(path, baseUrl).toString();
  const payload = new URLSearchParams({ orderid: String(orderId) });

  const { signal, timeout } = buildTimeoutSignal(DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0',
      },
      body: payload,
      signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      endpoint: path,
      bodyPreview: sanitizePreview(text, apiKey),
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      status: 0,
      endpoint: path,
      bodyPreview: sanitizePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        apiKey
      ),
    };
  }
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

  const requestUrl = new URL(req.url || '', 'http://localhost');
  const orderId = requestUrl.searchParams.get('orderId') || requestUrl.searchParams.get('order_id');

  if (!orderId) {
    return res.status(400).json({
      error: 'Parâmetro orderId obrigatório.',
    });
  }

  for (const path of STATUS_CANDIDATES) {
    const result = await tryStatusEndpoint({ baseUrl, apiKey, orderId, path });
    if (result.status !== 404) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        ok: result.ok,
        status: result.status,
        endpoint: result.endpoint,
        providerBodyPreview: result.bodyPreview,
      });
    }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({
    error: 'STATUS_ENDPOINT_NOT_FOUND',
    hint:
      'GSM-IMEI não expõe status via widget para esta conta. Use painel manual ou ajuste quando houver endpoint real.',
  });
};
