const http = require('http');
const https = require('https');

function postForm(url, body, headers) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'http:' ? http : https;
    const request = client.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        headers,
      },
      (response) => {
        let data = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode || 500,
            text: data,
          });
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

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
    const payload = new URLSearchParams({
      serviceid: 'TEST',
      chosen: '1',
      charge: '0',
    }).toString();
    const url = new URL(`${baseUrl}/widget/getServicedetailsIMEI`);
    const { status, text } = await postForm(url, payload, {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
      Authorization: `Bearer ${apiKey}`,
    });

    return res.status(status).type('text/plain').send(text);
  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao conectar ao GSM IMEI.',
      detail: 'Não foi possível completar a requisição.',
    });
  }
};
