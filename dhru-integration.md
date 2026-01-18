# DHRU Fusion (DHRU/GSM Theme) Integration

## Variáveis de ambiente (Vercel)

Defina estas variáveis no projeto:

- `DHRU_URL=https://dhmfserver.com/public`
- `DHRU_USERNAME=supracell47@gmail.com`
- `DHRU_API_KEY=***` (já existe no ambiente, não versionar)
- `DHRU_TIMEOUT_MS=10000`

## Endpoint interno

- `POST /api/dhru`

## Rotas a manter/remover (limite Vercel Hobby)

Para ficar dentro do limite de Serverless Functions no plano Hobby:

- **Manter:** apenas `api/dhru.js` (endpoint `/api/dhru`).
- **Remover:** quaisquer rotas antigas em `api/dhru/*` e `api/gsm/*` (incluindo testes/diagnósticos).

## Formato do body

Sempre envie JSON com o campo `action`:

```json
{
  "action": "services"
}
```

Você pode enviar parâmetros adicionais junto com o `action` (ou dentro de `params`).

## Exemplos

### Teste de conectividade

**Request**

```bash
curl -s -X POST "https://<seu-dominio>/api/dhru" \
  -H "Content-Type: application/json" \
  -d '{"action":"test"}'
```

**Response (exemplo)**

```json
{
  "ok": true,
  "status": 200,
  "endpointUsed": "https://dhmfserver.com/public/api/index.php",
  "bodyPreview": "{\"balance\":\"10.00\"}",
  "error": null
}
```

### Saldo

**Request**

```bash
curl -s -X POST "https://<seu-dominio>/api/dhru" \
  -H "Content-Type: application/json" \
  -d '{"action":"balance"}'
```

**Response (exemplo)**

```json
{
  "ok": true,
  "status": 200,
  "balance": "10.00",
  "currency": "USD",
  "error": null,
  "rawPreview": "{\"balance\":\"10.00\",\"currency\":\"USD\"}"
}
```

### Serviços

**Request**

```bash
curl -s -X POST "https://<seu-dominio>/api/dhru" \
  -H "Content-Type: application/json" \
  -d '{"action":"services"}'
```

**Response (exemplo)**

```json
{
  "ok": true,
  "status": 200,
  "services": [
    {
      "serviceId": "123",
      "name": "Unlock Service",
      "price": "5.00",
      "time": "1-3 Days",
      "min": 1,
      "max": 1,
      "active": true,
      "category": "iPhone"
    }
  ],
  "error": null,
  "rawPreview": "{...}"
}
```

### Criar pedido

**Request**

```bash
curl -s -X POST "https://<seu-dominio>/api/dhru" \
  -H "Content-Type: application/json" \
  -d '{"action":"order","serviceId":"123","imeiOrSn":"012345678901234"}'
```

**Response (exemplo)**

```json
{
  "ok": true,
  "status": 200,
  "orderId": "987654",
  "message": "Order placed",
  "error": null,
  "rawPreview": "{...}"
}
```

### Status do pedido

**Request**

```bash
curl -s -X POST "https://<seu-dominio>/api/dhru" \
  -H "Content-Type: application/json" \
  -d '{"action":"status","orderId":"987654"}'
```

**Response (exemplo)**

```json
{
  "ok": true,
  "status": 200,
  "orderId": "987654",
  "providerStatus": "Completed",
  "error": null,
  "rawPreview": "{...}"
}
```

### Ações genéricas (qualquer action do DHRU)

**Request**

```bash
curl -s -X POST "https://<seu-dominio>/api/dhru" \
  -H "Content-Type: application/json" \
  -d '{"action":"<action_dhru>","params":{"foo":"bar"}}'
```

**Response (exemplo)**

```json
{
  "ok": true,
  "status": 200,
  "action": "<action_dhru>",
  "data": {},
  "error": null,
  "rawPreview": "{...}"
}
```
