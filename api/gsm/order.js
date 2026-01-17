const DEFAULT_TIMEOUT_MS = 10000;

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

function sanitizePreview(text, apiKey) {
  if (!text) return '';
  let safeText = text;
  if (apiKey) {
    const escapedKey = apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safeText = safeText.replace(new RegExp(escapedKey, 'g'), '***');
  }
  return safeText.slice(0, 400);
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

  const body = await readJsonBody(req);
  const serviceId = body.serviceId;
  const imeiList = body.imeiList;

  if (!serviceId || !Array.isArray(imeiList)) {
    return res.status(400).json({
      error: 'Parâmetros obrigatórios ausentes.',
      detail: 'Informe serviceId e imeiList.',
    });
  }

  if (imeiList.length < 1 || imeiList.length > 6) {
    return res.status(400).json({
      error: 'Quantidade de IMEIs inválida.',
      detail: 'imeilist deve conter de 1 a 6 itens.',
    });
  }

  const payload = new URLSearchParams({
    serviceid: String(serviceId),
    imei_custom: imeiList.map(String).join('\n'),
    chosen: '1',
    charge: '0',
  });

  const url = new URL('/widget/placeorderimei', baseUrl);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0',
      },
      body: payload,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const text = await response.text();

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      providerBodyPreview: sanitizePreview(text, apiKey),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      providerBodyPreview: sanitizePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        apiKey
      ),
    });
  }
};
