const { dhruRequest, getDhruConfig, safePreview, parseJson } = require('../lib/dhruClient');

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
    const result = await dhruRequest('balance');
    const parsed = parseJson(result.text);
    const errorMessage = parsed?.error || parsed?.message || parsed?.msg || null;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: result.response.ok,
      status: result.response.status,
      endpointUsed: result.endpointUsed,
      bodyPreview: safePreview(result.text, [config.apiKey, config.username]),
      error: errorMessage,
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      endpointUsed: null,
      error: 'Erro ao testar DHRU.',
      bodyPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
