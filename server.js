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

  if (!baseUrl) {
    return res.status(500).json({ error: 'GSM_IMEI_BASE_URL não configurado.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GSM_IMEI_API_KEY não configurado.' });
  }

  const url = new URL('/widget/getServicedetailsIMEI', baseUrl).toString();
  const payload = new URLSearchParams({
    serviceid: 'TEST',
    chosen: '1',
    charge: '0',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

    const rawText = await response.text();
    return res.status(response.status).send(rawText);
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao chamar GSM IMEI.',
      detail: error.message,
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
