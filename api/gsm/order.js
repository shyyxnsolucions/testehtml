const DEFAULT_TIMEOUT_MS = 15000;

async function readBody(req) {
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

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }

  return {};
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const body = await readBody(req);
  const serviceId = body.service_id || body.serviceId;
  const imei = body.imei;

  if (!serviceId || !imei) {
    return res.status(400).json({
      error: 'Parâmetros obrigatórios ausentes.',
      detail: 'Informe service_id e imei.',
    });
  }

  const payload = new URLSearchParams({
    serviceid: String(serviceId),
    imei: String(imei),
  });

  const url = new URL('/widget/placeorderimei', baseUrl);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'Vercel Serverless',
      },
      body: payload,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const text = await response.text();
    const data = parseJson(text) || {};

    if (!response.ok) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(response.status).json({
        error: 'Falha ao criar pedido.',
        status: response.status,
        bodyPreview: text.slice(0, 5000),
      });
    }

    const orderId = data.orderid || data.id || data.order_id || data.order;
    const status = data.status || data.result || 'submitted';
    const message = data.message || data.msg || 'Pedido enviado.';

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      order_id: orderId || null,
      status,
      message,
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Erro ao conectar ao GSM IMEI.',
      name: error?.name || 'Error',
      message: error?.message || 'Unknown error',
    });
  }
};
