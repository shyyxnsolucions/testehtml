export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const proxyUrl = process.env.DHRU_PROXY_URL;
  const proxyToken = process.env.DHRU_PROXY_TOKEN;

  if (!proxyUrl || !proxyToken) {
    return res.status(500).json({ error: 'Proxy não configurado.' });
  }

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': proxyToken,
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao chamar proxy.' });
  }
}
