# Changelog

## 1.2.0

- **Entities automáticas no HA via MQTT Discovery** (criadas sozinhas ao
  instalar/atualizar o add-on, agrupadas no dispositivo "WhatsApp (WAHA)"):
  - `sensor.whatsapp_status` — connectivity ON/OFF da sessão do WAHA
    (poll a cada 30s na API + atualiza ao receber mensagem)
  - `text.whatsapp_filtro` — campo no HA pra digitar o ID/telefone do
    remetente que dispara o pulso (aceita vários separados por vírgula;
    aceita número `5511993503114` ou LID `117192595091647`); persiste em
    `/data/waha-filter.txt` e sobrevive a reinícios
  - `switch.whatsapp_pulso` — interruptor de pulso que liga (ON) quando
    chega mensagem do remetente filtrado e desliga sozinho após
    `pulse_seconds` (atributos: `de`, `texto`, `em`); também aceita
    comando ON/OFF manual
- Availability MQTT (LWT): entities ficam "unavailable" se o bridge cair
- Opção `pulse_seconds` (padrão 10)

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
