const http = require('http');
const https = require('https');

function collectResponse(response) {
  return new Promise((resolve) => {
    let data = '';

    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      resolve({
        status: response.statusCode || 500,
        headers: response.headers || {},
        text: data,
      });
    });
  });
}

function requestForm(url, body, headers, timeoutMs = 15000) {
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
        collectResponse(response).then(resolve).catch(reject);
      }
    );

    request.setTimeout(timeoutMs, () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';
      request.destroy(timeoutError);
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function buildErrorPayload(error, upstream) {
  const payload = {
    error: {
      name: error?.name || 'Error',
      message: error?.message || 'Unknown error',
    },
  };

  if (error?.cause) {
    payload.error.cause = String(error.cause);
  }

  if (upstream) {
    payload.upstream = {
      status: upstream.status,
      headers: upstream.headers || {},
      bodyPreview: upstream.text ? upstream.text.slice(0, 5000) : '',
    };
  }

  return payload;
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

  const payload = new URLSearchParams({
    serviceid: 'TEST',
    chosen: '1',
    charge: '0',
  }).toString();

  // Method C (commented): api_key in body
  // const payload = new URLSearchParams({
  //   serviceid: 'TEST',
  //   chosen: '1',
  //   charge: '0',
  //   api_key: apiKey,
  // }).toString();

  const url = new URL(`${baseUrl}/widget/getServicedetailsIMEI`);
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'Vercel Serverless',
    // Method A (default): Authorization header
    Authorization: `Bearer ${apiKey}`,
    // Method B (commented): X-API-KEY header
    // 'X-API-KEY': apiKey,
  };

  try {
    const upstream = await requestForm(url, payload, headers);

    if (upstream.status >= 400) {
      return res.status(upstream.status).json(
        buildErrorPayload(new Error('Upstream request failed'), upstream)
      );
    }

    return res.status(upstream.status).type('text/plain').send(upstream.text);
  } catch (error) {
    return res.status(500).json(buildErrorPayload(error));
  }
};
