# Changelog

## 1.1.0

- Corrige API key: usa `WAHA_API_KEY`/`WAHA_NO_API_KEY` (antes a variável era ignorada e o dashboard levava 401)
- Corrige evento de webhook: `message` (o WAHA não possui `message.received`)
- Adiciona opção `base_url` (define `WAHA_BASE_URL`/`WAHA_PUBLIC_URL` — corrige dashboard apontando pra 127.0.0.1)
- Persistência correta da sessão em `/data/sessions` (antes `/app/.waha`, que era ignorado)
- QR code também impresso nos logs (`WAHA_PRINT_QR=True`) como fallback
- Log de diagnóstico do add-on no startup

## 1.0.0

- Versão inicial: WAHA + bridge MQTT em um único add-on
- Dashboard via Ingress (dentro da UI do HA) e porta 3000
- Traduções: en, pt-BR
