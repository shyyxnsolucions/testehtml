# Integração GSM-IMEI via Widget (Vercel)

## Visão geral

A integração está orientada aos endpoints `/widget/*` do gsm-imei.com porque o endpoint `/api` pode estar bloqueado/WAF e o campo **API IP** do painel pode nunca ser preenchido. O diagnóstico em `/api/gsm-ip-register` serve apenas para confirmar se o acesso ao `/api` é possível, mas o fluxo de produção utiliza **somente** `/widget`.

## Variáveis de ambiente

- `GSM_IMEI_BASE_URL` (ex: `https://gsm-imei.com`)
- `GSM_IMEI_API_KEY` (token usado no header `Authorization: Bearer`)
- `GSM_IMEI_SERVICE_CATALOG_JSON` (catálogo manual de serviços)

Formato esperado para `GSM_IMEI_SERVICE_CATALOG_JSON`:

```json
[
  {
    "id": "123",
    "name": "Service Name",
    "type": "imei",
    "price": 0.07,
    "currency": "USD",
    "min": 1,
    "max": 6
  }
]
```

## Endpoints internos

### Diagnóstico de IP

`GET /api/gsm-ip-register`

Retorna JSON compacto com tentativas de acesso ao `/api` e uma recomendação de modo.

Exemplo de resposta:

```json
{
  "baseUrl": "https://gsm-imei.com",
  "resolvedApiEndpoint": "https://gsm-imei.com/api",
  "attempts": [
    {
      "name": "api_key_body_balance",
      "url": "https://gsm-imei.com/api",
      "status": 403,
      "ok": false,
      "bodyPreview": "Page does not exist"
    }
  ],
  "conclusion": "API_ACCESS_ENDPOINT_BLOCKED_OR_NOT_AVAILABLE",
  "recommendedMode": "WIDGET_BACKEND_INTEGRATION",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Catálogo de serviços

`GET /api/gsm/services`

- Se `GSM_IMEI_SERVICE_CATALOG_JSON` estiver definido, retorna a lista do catálogo.
- Caso contrário, retorna:

```json
{
  "error": "SERVICE_CATALOG_NOT_CONFIGURED",
  "howToFix": "Defina GSM_IMEI_SERVICE_CATALOG_JSON na Vercel com uma lista JSON de serviços."
}
```

### Criar pedido (widget)

`POST /api/gsm/order`

Body (JSON):

```json
{
  "serviceId": "123",
  "imeiList": ["111111111111111", "222222222222222"]
}
```

Resposta:

```json
{
  "ok": true,
  "status": 200,
  "providerBodyPreview": "..."
}
```

### Consultar status (widget)

`GET /api/gsm/status?orderId=<id>`

O backend tenta, com timeout, os endpoints:

- `/widget/orders`
- `/widget/orderstatus`
- `/widget/imeiorders`
- `/widget/getorderstatus`

Se nenhum responder (404), retorna:

```json
{
  "error": "STATUS_ENDPOINT_NOT_FOUND",
  "hint": "GSM-IMEI não expõe status via widget para esta conta. Use painel manual ou ajuste quando houver endpoint real."
}
```

## Observação importante

Mesmo com resposta 200 em `/widget`, o campo **API IP** no painel pode permanecer vazio. Isso é esperado se o `/api` estiver bloqueado. A integração segue funcional via widget.

## Problemas comuns e como diagnosticar

### API não funciona e o IP não registra

1. **Confirme as variáveis de ambiente.** Sem `GSM_IMEI_BASE_URL` e `GSM_IMEI_API_KEY` o backend responde erro 500.
2. **Teste o diagnóstico de IP.** Acesse `GET /api/gsm-ip-register`.
   - Se `conclusion` vier como `API_ACCESS_ENDPOINT_BLOCKED_OR_NOT_AVAILABLE`, o endpoint `/api` está bloqueado (WAF/403) e o IP não será registrado.
   - Se `conclusion` vier como `REGISTERED_LIKELY`, o endpoint `/api` respondeu e o painel deve registrar o IP.
   - Se `conclusion` vier como `UNKNOWN` **e todas as tentativas retornarem 403 com HTML**, isso indica bloqueio/WAF no `/api`. Nesse cenário o painel não registra IP e a integração precisa seguir pelo widget.
3. **Use o fluxo de widget para produção.** Mesmo com o IP vazio, os endpoints `/widget/*` continuam funcionando para pedidos e consultas.

### Catálogo vazio ou lista de serviços não aparece

Configure `GSM_IMEI_SERVICE_CATALOG_JSON` com o catálogo manual. Sem isso, `GET /api/gsm/services` retorna erro indicando a ausência do catálogo.

### Pedido falha com IMEI/SN inválido

O backend valida o input: IMEI precisa ter 14-16 dígitos e passar no check Luhn. Se falhar, ajuste o valor antes de enviar o pedido.
