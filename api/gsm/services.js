function parseCatalog(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const catalogRaw = process.env.GSM_IMEI_SERVICE_CATALOG_JSON;

  if (!catalogRaw) {
    return res.status(500).json({
      error: 'SERVICE_CATALOG_NOT_CONFIGURED',
      howToFix:
        'Defina GSM_IMEI_SERVICE_CATALOG_JSON na Vercel com uma lista JSON de serviços.',
    });
  }

  const services = parseCatalog(catalogRaw);

  if (!Array.isArray(services)) {
    return res.status(500).json({
      error: 'SERVICE_CATALOG_NOT_CONFIGURED',
      howToFix:
        'Defina GSM_IMEI_SERVICE_CATALOG_JSON na Vercel com uma lista JSON de serviços.',
    });
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ services });
};
