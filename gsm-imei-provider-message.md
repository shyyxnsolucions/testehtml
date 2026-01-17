# GSM-IMEI Provider Message (PT/EN)

## Português (pronto para WhatsApp/email)

Olá! Estamos tentando ativar a API do GSM-IMEI e recebemos uma API key, porém o endpoint `/api` continua retornando **403 "Page does not exist"**. Os endpoints `/widget/*` respondem 200 OK, mas o campo **API IP** não aparece no painel.

**Provas (diagnóstico técnico):**
- GET `/api` → 403 (Page does not exist)
- GET `/api/` → 403 (Page does not exist)
- GET `/api/index.php` → 403 (Page does not exist)
- POST `/api` (action=balance, api_key, Authorization Bearer) → 403
- POST `/api/index.php` (action=balance, api_key, Authorization Bearer) → 403
- POST `/widget/getServicedetailsIMEI` → 200 OK

Você pode conferir o diagnóstico completo aqui:
`https://<meu-dominio>/api/gsm-provider-diagnostic`

**Pedido objetivo:**
1) Qual é o endpoint oficial correto da API para revendedores?
2) A autenticação é via `api_key + action` (DHRU) ou `Authorization: Bearer`?
3) O campo **API IP** exige whitelist de IP fixo? Se sim, como liberar (Vercel usa IP dinâmico) ou aceitar sem IP?
4) Se for necessário IP fixo, vocês precisam do IP de um VPS para liberar? Confirma?

Obrigado!

---

## English (ready to copy/paste)

Hello! We are trying to enable GSM-IMEI API access and received an API key, but the `/api` endpoint still returns **403 "Page does not exist"**. The `/widget/*` endpoints return 200 OK, but the **API IP** field never appears in the panel.

**Evidence (technical diagnostic):**
- GET `/api` → 403 (Page does not exist)
- GET `/api/` → 403 (Page does not exist)
- GET `/api/index.php` → 403 (Page does not exist)
- POST `/api` (action=balance, api_key, Authorization Bearer) → 403
- POST `/api/index.php` (action=balance, api_key, Authorization Bearer) → 403
- POST `/widget/getServicedetailsIMEI` → 200 OK

Full diagnostic endpoint:
`https://<meu-dominio>/api/gsm-provider-diagnostic`

**Questions / request:**
1) What is the official reseller API endpoint?
2) Does the API expect `api_key + action` (DHRU style) or `Authorization: Bearer`?
3) Does **API IP** require a fixed IP whitelist? If yes, how can we whitelist (Vercel uses dynamic IPs) or allow without IP?
4) If fixed IP is required, do you need a VPS IP to whitelist? Please confirm.

Thank you!
