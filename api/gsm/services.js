const DEFAULT_TIMEOUT_MS = 10000;

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

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function normalizeService(item) {
  if (!item || typeof item !== 'object') return null;
  const serviceId = item.service_id ?? item.serviceid ?? item.ServiceID ?? item.SERVICEID;
  const serviceName =
    item.service_name ??
    item.servicename ??
    item.ServiceName ??
    item.SERVICENAME;
  const price = item.price ?? item.Price ?? item.Credit ?? item.credit;
  const deliveryTime =
    item.delivery_time ??
    item.time ??
    item.Time ??
    item.deliverytime ??
    item.DeliveryTime;
  const min = item.min ?? item.Min ?? item.minimum;
  const max = item.max ?? item.Max ?? item.maximum;

  return {
    service_id: serviceId ?? null,
    service_name: serviceName ?? null,
    price: price ?? null,
    delivery_time: deliveryTime ?? null,
    min: min ?? null,
    max: max ?? null,
  };
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
    const { text } = await postDhru({
      baseUrl,
      username,
      apiKey,
      action: 'services',
    });

    const json = parseJson(text);
    const list =
      json?.services ||
      json?.service ||
      json?.data?.services ||
      json?.data ||
      [];

    const services = Array.isArray(list)
      ? list.map(normalizeService).filter(Boolean)
      : [];

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ services });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Falha ao buscar serviços.',
    });
  }
};
