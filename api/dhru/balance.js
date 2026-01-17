const { dhruRequest, getDhruConfig, parseJson, safePreview } = require('../../lib/dhruClient');

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
      error: 'Configuração DHRU ausente.',
      detail: error.message,
    });
  }

  try {
    const result = await dhruRequest('balance');

    const parsed = parseJson(result.text);
    const { balance, currency } = extractBalance(parsed);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      ok: result.response.ok,
      status: result.response.status,
      balance,
      currency,
      error: parsed?.error || parsed?.message || parsed?.msg || null,
      rawPreview: safePreview(result.text, [config.apiKey, config.username]),
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      ok: false,
      status: 500,
      balance: null,
      currency: null,
      error: 'Erro ao consultar saldo DHRU.',
      rawPreview: safePreview(
        `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
        [config.apiKey, config.username]
      ),
    });
  }
};
