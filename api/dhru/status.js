const { dhruRequest, getDhruConfig, parseJson, safePreview } = require('../../lib/dhruClient');

function isValidValue(value, min = 3, max = 60) {
  if (!value) return false;
  const length = String(value).trim().length;
  return length >= min && length <= max;
}

function extractStatus(payload) {
  if (!payload) return { orderId: null, providerStatus: null, status: null };

  const orderId =
    payload.orderid ??
    payload.order_id ??
    payload.orderId ??
    payload?.order?.id ??
    null;

  const providerStatus =
    payload.status ?? payload.order_status ?? payload.state ?? null;

  const status = payload.result ?? payload.message ?? null;

  return { orderId, providerStatus, status };
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
      ok: false,
      status: 500,
      error: 'Configuração DHRU ausente.',
      detail: error.message,
    });
  }

  const orderIdParam = req.query?.orderId || req.query?.orderid || null;
  if (!isValidValue(orderIdParam)) {
    return res.status(400).json({
      ok: false,
      status: 400,
      error: 'Parâmetro orderId inválido.',
    });
  }

  const orderIdValue = String(orderIdParam).trim();
  const paramCandidates = [
    { orderid: orderIdValue },
    { order_id: orderIdValue },
    { id: orderIdValue },
  ];

  try {
    let result = null;
    for (const params of paramCandidates) {
      const attempt = await dhruRequest('orderstatus', params);

      if (!result) {
        result = attempt;
      }

      if (attempt.response?.ok) {
        result = attempt;
        break;
      }
    }

    const parsed = parseJson(result?.text || '');
    const { orderId, providerStatus } = extractStatus(parsed);
    const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: result?.response?.ok || false,
      status: result?.response?.status || 500,
      orderId: orderId || orderIdValue,
      providerStatus,
      error: errorMessage,
      rawPreview: safePreview(result?.text || '', [config.apiKey, config.username]),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      orderId: orderIdValue,
      providerStatus: null,
      error: 'Erro ao consultar status DHRU.',
      rawPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
