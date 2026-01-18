const { dhruRequest, getDhruConfig, parseJson, safePreview } = require('../lib/dhruClient');

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
  if (Array.isArray(payload.SUCCESS)) return payload.SUCCESS;
  if (Array.isArray(payload.success)) return payload.success;
  if (Array.isArray(payload.Services)) return payload.Services;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.services)) return payload.data.services;
  if (Array.isArray(payload.data?.service_list)) return payload.data.service_list;
  if (Array.isArray(payload.service_list)) return payload.service_list;
  return [];
}

function extractBalance(payload) {
  if (!payload) return { balance: null, currency: null };

  const balance =
    payload.balance ??
    payload.Balance ??
    payload.account_balance ??
    payload?.account_info?.balance ??
    payload?.data?.balance ??
    null;

  const currency =
    payload.currency ??
    payload.Currency ??
    payload?.account_info?.currency ??
    payload?.data?.currency ??
    null;

  return { balance, currency };
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

function normalizeAction(value) {
  if (!value) return null;
  return String(value).trim();
}

function buildParams(payload, excludedKeys = []) {
  const params = {
    ...(payload && typeof payload.params === 'object' ? payload.params : {}),
  };

  if (payload && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'params' || excludedKeys.includes(key)) continue;
      params[key] = value;
    }
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    cleaned[key] = value;
  }

  return cleaned;
}

async function handleServices(res, config) {
  const result = await dhruRequest('services');
  const parsed = parseJson(result.text);
  const list = extractServiceList(parsed);
  const services = list.map(normalizeService).filter(Boolean);
  const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

  return res.status(200).json({
    ok: result.response.ok,
    status: result.response.status,
    services,
    error: errorMessage,
    rawPreview: safePreview(result.text, [config.apiKey, config.username]),
  });
}

async function handleBalance(res, config) {
  const result = await dhruRequest('balance');
  const parsed = parseJson(result.text);
  const { balance, currency } = extractBalance(parsed);

  return res.status(200).json({
    ok: result.response.ok,
    status: result.response.status,
    balance,
    currency,
    error: parsed?.error || parsed?.message || parsed?.msg || null,
    rawPreview: safePreview(result.text, [config.apiKey, config.username]),
  });
}

async function handleOrder(res, config, payload) {
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

  return res.status(200).json({
    ok: result?.response?.ok || false,
    status: result?.response?.status || 500,
    orderId,
    message,
    error: errorMessage,
    rawPreview: safePreview(result?.text || '', [config.apiKey, config.username]),
  });
}

async function handleStatus(res, config, payload) {
  const orderIdParam = payload?.orderId ?? payload?.orderid ?? null;

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

  return res.status(200).json({
    ok: result?.response?.ok || false,
    status: result?.response?.status || 500,
    orderId: orderId || orderIdValue,
    providerStatus,
    error: errorMessage,
    rawPreview: safePreview(result?.text || '', [config.apiKey, config.username]),
  });
}

async function handleTest(res, config) {
  const result = await dhruRequest('balance');
  const parsed = parseJson(result.text);
  const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

  return res.status(200).json({
    ok: result.response.ok,
    status: result.response.status,
    endpointUsed: result.endpointUsed,
    bodyPreview: safePreview(result.text, [config.apiKey, config.username]),
    error: errorMessage,
  });
}

async function handleGeneric(res, config, action, payload) {
  const params = buildParams(payload, ['action']);
  const result = await dhruRequest(action, params);
  const parsed = parseJson(result.text);
  const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

  return res.status(200).json({
    ok: result.response.ok,
    status: result.response.status,
    action: action,
    data: parsed,
    error: errorMessage,
    rawPreview: safePreview(result.text, [config.apiKey, config.username]),
  });
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

  const payload = parseRequestBody(req) || {};
  const actionRaw = normalizeAction(payload.action || payload.Action || payload.acao);

  if (!actionRaw) {
    return res.status(400).json({
      ok: false,
      status: 400,
      error: 'Parâmetro action é obrigatório no body.',
    });
  }

  const actionNormalized = actionRaw.toLowerCase();

  try {
    res.setHeader('Content-Type', 'application/json');

    if (['services', 'service', 'listservices'].includes(actionNormalized)) {
      return await handleServices(res, config);
    }

    if (['balance', 'saldo'].includes(actionNormalized)) {
      return await handleBalance(res, config);
    }

    if (['order', 'placeorder', 'createorder'].includes(actionNormalized)) {
      return await handleOrder(res, config, payload);
    }

    if (['status', 'orderstatus', 'order_status'].includes(actionNormalized)) {
      return await handleStatus(res, config, payload);
    }

    if (['test', 'login', 'ping'].includes(actionNormalized)) {
      return await handleTest(res, config);
    }

    return await handleGeneric(res, config, actionRaw, payload);
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      error: 'Erro ao processar requisição DHRU.',
      rawPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
