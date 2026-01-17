const parseCsv = (value) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

module.exports = {
  baseUrl: process.env.GSM_IMEI_BASE_URL || 'https://gsm-imei.com',
  authMode: process.env.GSM_IMEI_AUTH_MODE || 'api_key',
  authPlacement: process.env.GSM_IMEI_AUTH_PLACEMENT || 'authorization_bearer',
  sessionCookie: process.env.GSM_IMEI_SESSION_COOKIE || '',
  apiKey: process.env.GSM_IMEI_API_KEY || '',
  endpoints: {
    listServices: process.env.GSM_IMEI_ENDPOINT_LIST_SERVICES || '',
    serviceDetailsIMEI: '/widget/getServicedetailsIMEI',
    placeOrderIMEI: '/widget/placeorderimei',
    orderStatus: process.env.GSM_IMEI_ENDPOINT_ORDER_STATUS || '',
    orderHistory: process.env.GSM_IMEI_ENDPOINT_ORDER_HISTORY || '',
  },
  request: {
    contentType:
      process.env.GSM_IMEI_CONTENT_TYPE || 'application/x-www-form-urlencoded',
  },
  cache: {
    servicesTtlSeconds: Number(process.env.SERVICES_CACHE_TTL_SECONDS || 3600),
  },
  pricing: {
    profitMarginPercent: Number(process.env.PROFIT_MARGIN_PERCENT || 0),
  },
  servicesFilter: {
    allowList: parseCsv(process.env.GSM_IMEI_SERVICE_ALLOWLIST),
    blockList: parseCsv(process.env.GSM_IMEI_SERVICE_BLOCKLIST),
  },
  placeOrderFields: {
    serviceIdField: process.env.GSM_IMEI_FIELD_SERVICE_ID || 'serviceid',
    imeiField: process.env.GSM_IMEI_FIELD_IMEI || 'imei',
    snField: process.env.GSM_IMEI_FIELD_SN || 'sn',
    extraFields: {
      cart: '',
      direct: '',
      nommd5id: '',
    },
  },
  serviceDetailsFields: {
    chosen: '1',
    charge: '0',
    cart: '',
    direct: '',
    nommd5id: '',
  },
};
