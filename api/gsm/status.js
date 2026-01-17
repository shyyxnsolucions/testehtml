const DEFAULT_TIMEOUT_MS = 15000;

function parseJson(text) {
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
  const apiKey = process.env.GSM_IMEI_API_KEY;
  const statusEndpoint = process.env.GSM_IMEI_ENDPOINT_ORDER_STATUS;

  if (!baseUrl || !apiKey) {
    return res.status(500).json({
      error: 'Configuração ausente para GSM IMEI.',
      detail: 'Verifique as variáveis de ambiente necessárias.',
    });
  }

  if (!statusEndpoint) {
    return res.status(500).json({
      error: 'Endpoint de status não configurado.',
      detail: 'Defina GSM_IMEI_ENDPOINT_ORDER_STATUS na Vercel.',
    });
  }

  const requestUrl = new URL(req.url || '', 'http://localhost');
  const orderId = requestUrl.searchParams.get('order_id');

  if (!orderId) {
    return res.status(400).json({
      error: 'Parâmetro order_id obrigatório.',
    });
  }

  const payload = new URLSearchParams({ orderid: String(orderId) });
  const url = new URL(statusEndpoint, baseUrl);

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
        error: 'Falha ao consultar status.',
        status: response.status,
        bodyPreview: text.slice(0, 5000),
      });
    }

    const status = data.status || data.result || data.state || 'unknown';
    const message = data.message || data.msg || 'Status recebido.';

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      order_id: String(orderId),
      status,
      message,
      raw: data,
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
