module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const baseUrl = process.env.GSM_IMEI_BASE_URL;
  const apiKey = process.env.GSM_IMEI_API_KEY;

  if (!baseUrl || !apiKey) {
    return res.status(500).json({
      error: 'Configuração ausente para GSM IMEI.',
      detail: 'Verifique as variáveis de ambiente necessárias.',
    });
  }

  try {
    const response = await fetch(`${baseUrl}/widget/getServicedetailsIMEI`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({
        serviceid: 'TEST',
        chosen: '1',
        charge: '0',
      }),
    });

    const text = await response.text();

    return res.status(response.status).type('text/plain').send(text);
  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao conectar ao GSM IMEI.',
      detail: 'Não foi possível completar a requisição.',
    });
  }
};
