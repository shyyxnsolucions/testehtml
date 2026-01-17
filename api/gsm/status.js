const DEFAULT_TIMEOUT_MS = 10000;

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeout };
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

async function postDhru({ baseUrl, username, apiKey, action, params }) {
  const url = new URL('/api/index.php', baseUrl);
  const payload = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action,
    ...params,
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
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
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

  const body = req.method === 'POST' ? await readJsonBody(req) : {};
  const requestUrl = new URL(req.url || '', 'http://localhost');
  const orderId =
    body.order_id ||
    body.orderId ||
    requestUrl.searchParams.get('order_id') ||
    requestUrl.searchParams.get('orderId');

  if (!orderId) {
    return res.status(400).json({
      error: 'Parâmetro order_id obrigatório.',
    });
  }

  try {
    const { response, text } = await postDhru({
      baseUrl,
      username,
      apiKey,
      action: 'orderstatus',
      params: {
        order_id: String(orderId),
      },
    });

    const json = parseJson(text);
    const status = json?.status ?? json?.result ?? (response.ok ? 'success' : 'error');
    const message = json?.message ?? json?.msg ?? null;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      order_id: orderId,
      status,
      message,
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      order_id: orderId,
      status: 'error',
      message: error?.message || 'Erro ao consultar status.',
    });
  }
};
