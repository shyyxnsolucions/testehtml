# DHRU Fusion (DHRU/GSM Theme) Integration

## Variáveis de ambiente (Vercel)

Defina estas variáveis no projeto:

- `DHRU_BASE_URL=https://dhmfserver.com/public`
- `DHRU_USER=supracell47@gmail.com`
- `DHRU_API_KEY=***` (já existe no ambiente, não versionar)
- `DHRU_TIMEOUT_MS=10000`

## Endpoints internos

- `GET /api/dhru/test`
- `GET /api/dhru/balance`
- `GET /api/dhru/services`
- `POST /api/dhru/order`
- `GET /api/dhru/status?orderId=...`

## Exemplos

### Teste de conectividade

**Request**

```bash
curl -s "https://<seu-dominio>/api/dhru/test"
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
curl -s "https://<seu-dominio>/api/dhru/balance"
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
curl -s "https://<seu-dominio>/api/dhru/services"
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
curl -s -X POST "https://<seu-dominio>/api/dhru/order" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"123","imeiOrSn":"012345678901234"}'
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
curl -s "https://<seu-dominio>/api/dhru/status?orderId=987654"
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
