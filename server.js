require('dotenv').config();
const path = require('path');
const express = require('express');
const apiRoutes = require('./server/api');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/gsm-test', async (req, res) => {
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

    if (!response.ok) {
      return res.status(500).json({
        error: 'Falha ao consultar GSM IMEI.',
        detail: `Status ${response.status}`,
      });
    }

    return res.type('text/plain').send(text);
  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao conectar ao GSM IMEI.',
      detail: 'Não foi possível completar a requisição.',
    });
  }
});

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname)));

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.listen(port, () => {
  console.log(`Servidor ativo em http://localhost:${port}`);
});
