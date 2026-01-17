const { dhruRequest, getDhruConfig, parseJson, safePreview } = require('../../lib/dhruClient');

function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }

  return null;
}

function isValidValue(value, min = 3, max = 60) {
  if (!value) return false;
  const length = String(value).trim().length;
  return length >= min && length <= max;
}

function extractOrderDetails(payload) {
  if (!payload) return { orderId: null, message: null, status: null };

  const orderId =
    payload.orderid ??
    payload.order_id ??
    payload.orderId ??
    payload?.order?.id ??
    null;

  const message = payload.message ?? payload.msg ?? payload.error ?? null;
  const status = payload.status ?? payload.result ?? null;

  return { orderId, message, status };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let config;
  try {
    config = getDhruConfig();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      status: 500,
      error: 'Configuração DHRU ausente.',
      detail: error.message,
    });
  }

  const payload = parseRequestBody(req);
  const serviceId = payload?.serviceId ?? payload?.serviceid ?? null;
  const imeiOrSn = payload?.imeiOrSn ?? payload?.imei ?? payload?.sn ?? null;

  if (!isValidValue(serviceId) || !isValidValue(imeiOrSn, 5, 80)) {
    return res.status(400).json({
      ok: false,
      status: 400,
      error: 'Parâmetros inválidos. Informe serviceId e imeiOrSn válidos.',
    });
  }

  const serviceIdValue = String(serviceId).trim();
  const imeiValue = String(imeiOrSn).trim();

  const paramCandidates = [
    { serviceid: serviceIdValue, imei: imeiValue },
    { service_id: serviceIdValue, imei: imeiValue },
    { serviceid: serviceIdValue, imei_custom: imeiValue },
    { service_id: serviceIdValue, imei_custom: imeiValue },
  ];

  try {
    let result = null;
    for (const params of paramCandidates) {
      const attempt = await dhruRequest('placeorder', params);

      if (!result) {
        result = attempt;
      }

      if (attempt.response?.ok) {
        result = attempt;
        break;
      }
    }

    const parsed = parseJson(result?.text || '');
    const { orderId, message } = extractOrderDetails(parsed);
    const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: result?.response?.ok || false,
      status: result?.response?.status || 500,
      orderId,
      message,
      error: errorMessage,
      rawPreview: safePreview(result?.text || '', [config.apiKey, config.username]),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      orderId: null,
      message: null,
      error: 'Erro ao criar pedido DHRU.',
      rawPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
