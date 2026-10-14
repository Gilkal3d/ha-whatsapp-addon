# Changelog

## 1.1.1

- **Corrige Monitor de Eventos preso em CONNECTING... / API 401**: com `api_key`
  vazio, o WAHA agora roda **sem exigir chave** (antes era gerada uma chave
  aleatória que o painel não conhecia — nada conectava)
- `api_key` preenchida continua protegendo a API normalmente

## 1.1.0

- Adiciona opção `base_url` (`WAHA_BASE_URL`/`WAHA_PUBLIC_URL`) — corrige o
  dashboard apontando pra `127.0.0.1:3000` em vez do endereço do HA
- Persistência oficial da sessão via `WAHA_LOCAL_STORE_BASE_DIR=/data/sessions`
  (mantém o vínculo legado `/app/.waha` para compatibilidade)
- Mídia persistida em `/data/files` (`WHATSAPP_FILES_FOLDER`)
- `WAHA_PRINT_QR=True`: QR também sai nos logs como fallback de escaneamento
- Log de diagnóstico no startup (engine, eventos, base_url)
- Bridge ignora apenas `message`/`message.any` (evento legado `message.received`
  é normalizado para `message` pelo run.js)

## 1.0.4

- Build multi-arch via buildx (manifesto amd64 + arm64 numa tag só)
- `cwd /app` no spawn do entrypoint (o WAHA usa caminho relativo)
- API key gerada uma vez e persistida em `/data/waha-api.key`
- Opções de dashboard (`dashboard_user`/`dashboard_password`)
- Normalização de `hook_events` legado

## 1.0.0

- Versão inicial: WAHA + bridge MQTT em um único add-on
- Dashboard via Ingress (dentro da UI do HA) e porta 3000
- Traduções: en, pt-BR
