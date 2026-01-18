import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.post('/dhru', async (req, res) => {
  const proxyToken = req.get('x-proxy-token');
  const expectedToken = process.env.DHRU_PROXY_TOKEN;

  if (!proxyToken || proxyToken !== expectedToken) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  const baseUrl = process.env.DHRU_BASE_URL;
  const username = process.env.DHRU_USER;
  const apiKey = process.env.DHRU_API_KEY;

  if (!baseUrl || !username || !apiKey) {
    return res.status(500).json({ error: 'Configuração DHRU ausente.' });
  }

  const { action, params } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'Campo action é obrigatório.' });
  }

  const form = new URLSearchParams({
    username,
    apiaccesskey: apiKey,
    action,
    ...params,
  });

  try {
    const response = await fetch(`${baseUrl}/api/index.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: 'Falha na resposta do DHRU.',
        status: response.status,
        body: text,
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      json = { raw: text };
    }

    return res.status(200).json(json);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao conectar ao DHRU.' });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Proxy DHRU ativo na porta ${port}`);
});
