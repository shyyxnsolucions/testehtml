const express = require('express');
const GsmImeiClient = require('./gsmImeiClient');
const config = require('./gsm-imei.config');
const storage = require('./storage');
const { validateServiceId, validateImeiOrSn, normalizeInput } = require('./validation');

const router = express.Router();
const client = new GsmImeiClient(config);

const filterServices = (services) => {
  const { allowList, blockList } = config.servicesFilter;
  let filtered = [...services];

  if (allowList.length) {
    filtered = filtered.filter((service) =>
      allowList.includes(String(service.serviceid || service.id))
    );
  }

  if (blockList.length) {
    filtered = filtered.filter(
      (service) => !blockList.includes(String(service.serviceid || service.id))
    );
  }

  return filtered;
};

const applyProfitMargin = (services) => {
  const margin = config.pricing.profitMarginPercent;
  if (!margin) return services;

  return services.map((service) => {
    const updated = { ...service };
    ['price', 'charge', 'cost'].forEach((field) => {
      if (typeof updated[field] === 'number') {
        updated[field] = Number(
          (updated[field] * (1 + margin / 100)).toFixed(2)
        );
      }
    });
    return updated;
  });
};

router.get('/services', async (req, res) => {
  const cached = storage.getCachedServices();
  if (cached) {
    return res.json({ services: cached, cached: true });
  }

  if (!config.endpoints.listServices) {
    return res.json({
      services: cached || [],
      cached: false,
      stub: true,
      message:
        'Endpoint de listagem não configurado. Atualize GSM_IMEI_ENDPOINT_LIST_SERVICES.',
    });
  }

  try {
    const data = await client.postForm(config.endpoints.listServices, {
      action: 'list',
    });

    const services = Array.isArray(data?.services)
      ? data.services
      : Array.isArray(data)
      ? data
      : [];

    const filtered = applyProfitMargin(filterServices(services));
    storage.setCachedServices(filtered, config.cache.servicesTtlSeconds);

    return res.json({ services: filtered, cached: false });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'Falha ao obter serviços.',
      details: error.details || error.message,
    });
  }
});

router.get('/gsm-test', async (req, res) => {
  const baseUrl = config.baseUrl;
  const apiKey = config.apiKey;

  if (!baseUrl) {
    return res.status(500).json({ error: 'GSM_IMEI_BASE_URL não configurado.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GSM_IMEI_API_KEY não configurado.' });
  }

  const url = new URL('/widget/getServicedetailsIMEI', baseUrl).toString();
  const payload = new URLSearchParams({
    serviceid: 'TEST',
    chosen: '1',
    charge: '0',
  });

  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      data = rawText;
    }

    return res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      response: data,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao chamar GSM IMEI.',
      details: error.message,
    });
  }
});

router.get('/services/:id', async (req, res) => {
  const serviceId = normalizeInput(req.params.id);
  if (!validateServiceId(serviceId)) {
    return res.status(400).json({ error: 'serviceId inválido.' });
  }

  try {
    const payload = {
      serviceid: serviceId,
      ...config.serviceDetailsFields,
    };

    const data = await client.postForm(config.endpoints.serviceDetailsIMEI, payload, {
      contentType: 'application/x-www-form-urlencoded',
    });

    return res.json({ serviceId, details: data });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'Falha ao obter detalhes do serviço.',
      details: error.details || error.message,
    });
  }
});

router.post('/orders', async (req, res) => {
  const serviceId = normalizeInput(req.body.serviceId);
  const input = normalizeInput(req.body.imei || req.body.sn || '');
  const validation = validateImeiOrSn(input);

  if (!validateServiceId(serviceId)) {
    return res.status(400).json({ error: 'serviceId inválido.' });
  }

  if (!validation.ok) {
    return res.status(400).json({ error: validation.reason });
  }

  const fields = {
    [config.placeOrderFields.serviceIdField]: serviceId,
    ...config.placeOrderFields.extraFields,
  };

  if (validation.type === 'imei') {
    fields[config.placeOrderFields.imeiField] = validation.value;
  } else {
    fields[config.placeOrderFields.snField] = validation.value;
  }

  if (req.body.additionalFields && typeof req.body.additionalFields === 'object') {
    Object.assign(fields, req.body.additionalFields);
  }

  try {
    const data = await client.postForm(config.endpoints.placeOrderIMEI, fields, {
      contentType: 'application/x-www-form-urlencoded',
    });

    const orderId = data?.orderid || data?.id || data?.order_id || data?.order;
    const orderRecord = {
      id: orderId || `local-${Date.now()}`,
      serviceId,
      input: validation.value,
      status: data?.status || 'submitted',
      raw: data,
      createdAt: new Date().toISOString(),
    };

    storage.addOrder(orderRecord);

    return res.json({ success: true, order: orderRecord });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'Falha ao criar pedido.',
      details: error.details || error.message,
    });
  }
});

router.get('/orders', (req, res) => {
  return res.json({ orders: storage.getOrders() });
});

router.get('/orders/:id', async (req, res) => {
  const orderId = normalizeInput(req.params.id);
  if (!orderId) {
    return res.status(400).json({ error: 'orderId inválido.' });
  }

  if (!config.endpoints.orderStatus) {
    const order = storage.findOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado (stub).' });
    }
    return res.json({ order, stub: true });
  }

  try {
    const data = await client.postForm(config.endpoints.orderStatus, { orderid: orderId });
    return res.json({ orderId, status: data });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'Falha ao obter status do pedido.',
      details: error.details || error.message,
    });
  }
});

module.exports = router;
