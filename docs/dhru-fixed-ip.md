# DHRU Fusion + IP fixo (Vercel)

## Por que o IP muda na Vercel?

A Vercel executa suas rotas `/api` como **Serverless Functions** em uma infraestrutura distribuída. Cada execução pode sair por diferentes datacenters e pools de NAT, então o **IP de saída não é estável**. Isso é esperado em arquiteturas serverless e muda conforme escala, região e disponibilidade.

## Existe IP fixo na Vercel (Hobby/Pro)?

Não. Em **Hobby** e **Pro**, a Vercel **não oferece IP fixo de saída** para Serverless Functions. Há opções enterprise como **Vercel Secure Compute** e integrações de rede avançadas (dependendo do contrato), mas para a maioria dos projetos o IP de saída é dinâmico.

## Melhor arquitetura com IP fixo

### Opção A (recomendada): VPS com IP fixo como gateway

- Você cria um VPS com IP fixo (DigitalOcean, Hetzner, AWS EC2, Vultr, etc.).
- Configura um **mini proxy** no VPS que chama a API DHRU.
- Seu Next.js chama o VPS (IP fixo), e o DHRU só precisa liberar o IP do VPS.

**Vantagens:** controle total, custo baixo, previsível.  
**Desvantagens:** você mantém um servidor.

### Opção B: serviço de proxy com IP fixo

- Alguns serviços oferecem **egress IP fixo** (ex.: Cloudflare, ProxyMesh, ScrapingBee, etc.).
- Você chama o serviço e ele chama a API DHRU.

**Vantagens:** menos manutenção.  
**Desvantagens:** custo mensal e limites de uso.

---

# Código pronto

## 1) Endpoint no Next.js (chama o VPS)

Crie um arquivo em `pages/api/dhru-proxy.js` (ou em `app/api/dhru-proxy/route.js` no App Router) com este conteúdo:

```js
// examples/nextjs/api/dhru-proxy.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const proxyUrl = process.env.DHRU_PROXY_URL; // ex: https://proxy.seudominio.com/dhru
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
```

**Body esperado (exemplo):**

```json
{
  "action": "getbalance",
  "params": {}
}
```

---

## 2) Mini servidor no VPS (Node/Express)

Este servidor recebe JSON do seu Next.js, converte para `application/x-www-form-urlencoded` e chama a API DHRU.

```js
// examples/vps-proxy/server.js
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

  const baseUrl = process.env.DHRU_BASE_URL; // ex: https://dhmfserver.com/public
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
```

---

## 3) Opcional: Nginx reverso no VPS

```nginx
# examples/vps-proxy/nginx.conf
server {
  listen 80;
  server_name proxy.seudominio.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

# Passo a passo (didático)

## 1) Criar VPS (exemplo com Ubuntu)

1. Crie um VPS (Ubuntu 22.04 LTS).  
2. Anote o IP fixo público.

## 2) Acessar VPS e instalar Node

```bash
ssh root@SEU_IP
```

```bash
apt update
apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
```

## 3) Criar usuário e pasta da aplicação

```bash
adduser proxy
usermod -aG sudo proxy
su - proxy
mkdir -p ~/dhru-proxy
cd ~/dhru-proxy
```

## 4) Subir o código do proxy

Crie `server.js` com o conteúdo acima e `package.json`:

```json
{
  "name": "dhru-proxy",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.3"
  }
}
```

Instale dependências:

```bash
npm install
```

## 5) Variáveis de ambiente

Crie `.env` no VPS:

```bash
cat <<'EOF' > .env
PORT=3000
DHRU_BASE_URL=https://dhmfserver.com/public
DHRU_USER=seu-email@dominio.com
DHRU_API_KEY=sua-chave
DHRU_PROXY_TOKEN=seu-token-supersecreto
