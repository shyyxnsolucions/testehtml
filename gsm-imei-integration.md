# Integração GSM IMEI (gsm-imei.com)

Este projeto implementa uma camada segura no backend para consumir os endpoints `widget` do gsm-imei.com. Todo o frontend chama **apenas** os endpoints internos do site.

## Arquitetura

- **Frontend**: páginas HTML que consomem `/api/*`.
- **Backend**: `server.js` (Express) + cliente `server/gsmImeiClient.js`.
- **Configuração central**: `server/gsm-imei.config.js`.
- **Cache**: memória + arquivo `data/gsm-imei-cache.json` (fallback).

## Endpoints internos

- `GET /api/services` → lista serviços (com cache e margem aplicada).
- `GET /api/services/:id` → chama `getServicedetailsIMEI`.
- `POST /api/orders` → chama `placeorderimei`.
- `GET /api/orders/:id` → status (stub se não configurado).
- `GET /api/orders` → histórico local (arquivo).

## Configuração .env

Crie um `.env` a partir do `.env.example`:

```
GSM_IMEI_API_KEY=
GSM_IMEI_BASE_URL=https://gsm-imei.com
GSM_IMEI_AUTH_MODE=api_key
GSM_IMEI_AUTH_PLACEMENT=authorization_bearer
GSM_IMEI_SESSION_COOKIE=
GSM_IMEI_ENDPOINT_LIST_SERVICES=
GSM_IMEI_ENDPOINT_ORDER_STATUS=
GSM_IMEI_ENDPOINT_ORDER_HISTORY=
GSM_IMEI_FIELD_SERVICE_ID=serviceid
GSM_IMEI_FIELD_IMEI=imei
GSM_IMEI_FIELD_SN=sn
GSM_IMEI_CONTENT_TYPE=application/x-www-form-urlencoded
PROFIT_MARGIN_PERCENT=30
SERVICES_CACHE_TTL_SECONDS=3600
GSM_IMEI_SERVICE_ALLOWLIST=
GSM_IMEI_SERVICE_BLOCKLIST=
PORT=3000
```

### Auth modes

- **api_key** (preferencial)
  - `authorization_bearer`: `Authorization: Bearer <KEY>`
  - `x_api_key`: `X-API-KEY: <KEY>`
  - `body_api_key`: envia `api_key=<KEY>` no body.
- **session_cookie** (fallback temporário)
  - Define `GSM_IMEI_SESSION_COOKIE` para testes. Não automatiza login.

## Onde trocar endpoints quando descobrir no Network

Edite `server/gsm-imei.config.js` ou defina via `.env`:

- `GSM_IMEI_ENDPOINT_LIST_SERVICES`: endpoint real de listagem (`/widget/...`).
- `GSM_IMEI_ENDPOINT_ORDER_STATUS`: endpoint de status/pedidos (`/widget/...`).
- `GSM_IMEI_ENDPOINT_ORDER_HISTORY`: endpoint de histórico (se existir).

> Sem esses endpoints, as rotas `/api/services` e `/api/orders/:id` retornam **stub**.

## Mapeamento atual (obrigatório)

- **Detalhes do serviço**
  - `POST /widget/getServicedetailsIMEI`
  - Body: `serviceid`, `chosen=1`, `charge=0`, campos vazios opcionais.

- **Criar pedido**
  - `POST /widget/placeorderimei`
  - Body: campos do formulário (`serviceid`, `imei`/`sn`, campos extras vazios).

## Campos do pedido

Se o nome do campo do IMEI ou serviceid for diferente, ajuste:

- `GSM_IMEI_FIELD_SERVICE_ID`
- `GSM_IMEI_FIELD_IMEI`
- `GSM_IMEI_FIELD_SN`

## Cache

- TTL em `SERVICES_CACHE_TTL_SECONDS`.
- Margem aplicada em `PROFIT_MARGIN_PERCENT`.
- Allowlist/Blocklist via `GSM_IMEI_SERVICE_ALLOWLIST` e `GSM_IMEI_SERVICE_BLOCKLIST`.

## Rodar local

```bash
npm install
npm run dev
```

Abra:
- `http://localhost:3000/services.html`
- `http://localhost:3000/order.html`
- `http://localhost:3000/history.html`

## Checklist de testes

1. `GET /api/services` retorna lista (ou stub configurável).
2. `GET /api/services/:id` chama `getServicedetailsIMEI`.
3. `POST /api/orders` cria pedido via `placeorderimei`.
4. `GET /api/orders/:id` retorna status (ou stub configurável).
