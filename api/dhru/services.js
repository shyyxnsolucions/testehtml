const { dhruRequest, getDhruConfig, parseJson, safePreview } = require('../../lib/dhruClient');

function normalizeService(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  return {
    serviceId: entry.serviceid ?? entry.service_id ?? entry.id ?? entry.serviceId ?? null,
    name: entry.servicename ?? entry.name ?? entry.service_name ?? null,
    price: entry.price ?? entry.cost ?? entry.rate ?? entry.amount ?? null,
    time: entry.time ?? entry.processingtime ?? entry.processing_time ?? null,
    min: entry.min ?? entry.min_qty ?? entry.minimum ?? null,
    max: entry.max ?? entry.max_qty ?? entry.maximum ?? null,
    active: entry.active ?? entry.status ?? entry.is_active ?? null,
    category: entry.category ?? entry.group ?? entry.category_name ?? null,
  };
}

function extractServiceList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.services)) return payload.services;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.service_list)) return payload.service_list;
  return [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let config;
  try {
    config = getDhruConfig();
  } catch (error) {
    return res.status(500).json({
      error: 'Configuração DHRU ausente.',
      detail: error.message,
    });
  }

  try {
    const result = await dhruRequest('services');

    const parsed = parseJson(result.text);
    const list = extractServiceList(parsed);
    const services = list.map(normalizeService).filter(Boolean);
    const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: result.response.ok,
      status: result.response.status,
      services,
      error: errorMessage,
      rawPreview: safePreview(result.text, [config.apiKey, config.username]),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      services: [],
      error: 'Erro ao consultar serviços DHRU.',
      rawPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
