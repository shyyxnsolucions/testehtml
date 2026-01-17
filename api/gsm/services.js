const DEFAULT_TIMEOUT_MS = 15000;

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractServices(data) {
  if (Array.isArray(data?.services)) {
    return data.services;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

function mapService(service) {
  return {
    service_id: String(service.serviceid || service.id || ''),
    service_name: service.servicename || service.name || service.service_name || '',
    price: service.price ?? service.charge ?? service.cost ?? null,
    delivery_time: service.delivery_time || service.time || service.delivery || '',
    category: service.category || service.group || service.type || '',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const baseUrl = process.env.GSM_IMEI_BASE_URL;
  const apiKey = process.env.GSM_IMEI_API_KEY;
  const listEndpoint = process.env.GSM_IMEI_ENDPOINT_LIST_SERVICES;

  if (!baseUrl || !apiKey) {
    return res.status(500).json({
      error: 'Configuração ausente para GSM IMEI.',
      detail: 'Verifique as variáveis de ambiente necessárias.',
    });
  }

  if (!listEndpoint) {
    return res.status(500).json({
      error: 'Endpoint de listagem não configurado.',
      detail: 'Defina GSM_IMEI_ENDPOINT_LIST_SERVICES na Vercel.',
    });
  }

  const url = new URL(listEndpoint, baseUrl);
  const payload = new URLSearchParams({ action: 'list' });

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
    const data = parseJson(text);

    if (!response.ok) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(response.status).json({
        error: 'Falha ao obter serviços.',
        status: response.status,
        bodyPreview: text.slice(0, 5000),
      });
    }

    const services = extractServices(data || text).map(mapService);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ services });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Erro ao conectar ao GSM IMEI.',
      name: error?.name || 'Error',
      message: error?.message || 'Unknown error',
    });
  }
};
