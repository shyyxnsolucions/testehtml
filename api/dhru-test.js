const { dhruRequest, getDhruConfig, safePreview } = require('../lib/dhruClient');

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

  try {
    const result = await dhruRequest({
      actionCandidates: ['accountinfo', 'balance'],
      params: {},
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: result.response.ok,
      status: result.response.status,
      endpointUsed: result.endpointUsed,
      fieldMapUsed: result.fieldMapUsed,
      bodyPreview: safePreview(result.text, [config.apiKey, config.username]),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      endpointUsed: null,
      fieldMapUsed: null,
      bodyPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
