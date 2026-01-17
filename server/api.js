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

  const requestedAuth = String(
    req.query.auth || process.env.GSM_IMEI_TEST_AUTH_PLACEMENT || 'authorization_bearer'
  );
  const authPlacements =
    requestedAuth === 'auto'
      ? ['authorization_bearer', 'x_api_key', 'body_api_key']
      : [requestedAuth];

  const endpointPath =
    config.endpoints.serviceDetailsIMEI || '/widget/getServicedetailsIMEI';
  const url = new URL(endpointPath, baseUrl).toString();
  const serviceId = normalizeInput(req.query.serviceid || req.query.serviceId || '0');
  const basePayload = {
    ...config.serviceDetailsFields,
    serviceid: serviceId,
  };

  try {
    res.set('Cache-Control', 'no-store');
    let lastResponse = null;

    for (const authPlacement of authPlacements) {
      const payload = new URLSearchParams();
      Object.entries(basePayload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          payload.append(key, String(value));
        }
      });

      const headers = {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (authPlacement === 'authorization_bearer') {
        headers.Authorization = `Bearer ${apiKey}`;
      } else if (authPlacement === 'x_api_key') {
        headers['X-API-KEY'] = apiKey;
      } else if (authPlacement === 'body_api_key') {
        payload.append('api_key', apiKey);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
      });

      lastResponse = response;
      if (response.ok || authPlacements.length === 1) {
        const rawText = await response.text();
        const contentType = response.headers.get('content-type');
        if (contentType) {
          res.set('Content-Type', contentType);
        }
        res.set('X-GSM-Auth-Placement', authPlacement);
        return res.status(response.status).send(rawText);
      }
    }

    if (lastResponse) {
      const rawText = await lastResponse.text();
      const contentType = lastResponse.headers.get('content-type');
      if (contentType) {
        res.set('Content-Type', contentType);
      }
      res.set('X-GSM-Auth-Placement', authPlacements[authPlacements.length - 1]);
      return res.status(lastResponse.status).send(rawText);
    }

    return res.status(502).json({ error: 'Falha ao obter resposta do GSM IMEI.' });
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
