# WhatsApp Web (WAHA) + MQTT — Add-on para Home Assistant

Mantém uma sessão do **WhatsApp Web** dentro do Supervisor e publica cada mensagem
recebida num tópico MQTT. Qualquer automação do HA pode disparar um trigger
filtrando o contato.

```
WhatsApp Web ←celular→ WAHA (add-on) → bridge interno → MQTT → automation.trigger
```

## Instalação

1. Copie esta pasta (`ha-whatsapp-addon`) pra dentro do seu `config` do HA
   (ex.: `/config/waha-addon`) **ou** publique num GitHub e adicione o repositório:
   **Configuração → Integrações → Adicionar repositório de add-on** (URL do repo).
2. **Configuração → Sistema → Add-on store → ⋮ → Recarregar add-on store** (ou
   "Check for updates" se clonou via git local).
3. Instale **"WhatsApp Web (WAHA) + MQTT"** → **Iniciar**.
   - Inclui `icon.png`, `logo.png`, traduções **en/pt-BR**, `DOCS.md`
     (mostrado na página do add-on) e **Ingress** (painel `mdi:whatsapp`
     no menu lateral do HA).

### Configuração (aba "Configuração" do add-on)

| Opção | Padrão | Descrição |
|---|---|---|
| `mqtt_host` | `core-mosquitto` | Broker (add-on Mosquitto do HA) |
| `mqtt_port` | `1883` | Porta do broker |
| `mqtt_user` / `mqtt_password` | vazio | Credenciais do broker |
| `mqtt_topic` | `homeassistant/whatsapp/incoming` | Tópico de saída |
| `hook_events` | `message` | Evento do WAHA que publica |
| `api_key` | vazio | Protege o dashboard WAHA |
| `engine` | `WEBJS` | Engine (WEBJS = WhatsApp Web) |

Se você ainda não tem MQTT: **Configuração → Integrações → Adicionar → Mosquitto
broker**, crie usuário/senha e preencha acima.

## Parear o WhatsApp

1. Na barra do add-on, clique em **ABRIR WEB UI** (Ingress) — o dashboard do WAHA
   abre *dentro* da UI do HA, sem abrir porta. Alternativa direta:
   `http://SEU_HA:3000/dashboard`
2. Session `default` → **Scan QR**
3. No celular: WhatsApp → Aparelhos conectados → Conectar aparelho → escanear

A sessão fica em `/data/waha` e sobrevive a updates/reinícios.

> Nota: o Ingress usa token de URL. Se o dashboard não carregar bem via ingress
> (depende da versão do WAHA), use a porta 3000 direta — ambas estão disponíveis.

## Automations.yaml

Descubra o JID mandando uma mensagem e olhando os logs do add-on
(**Logs** na aba do add-on — procure `bridge]`).

```yaml
- id: whatsapp_contato_especifico
  alias: "WhatsApp - contato específico dispara trigger"
  mode: queued
  trigger:
    - platform: mqtt
      topic: homeassistant/whatsapp/incoming
  condition:
    - condition: template
      value_template: >
        {{ trigger.payload_json.from in [
             '5511999999999@s.whatsapp.net',
             '5511999999999@c.us'
           ] }}
  action:
    - service: automation.trigger
      target:
        entity_id: automation.minha_automacao
```

Payload publicado:

```json
{"from":"5511999999999@s.whatsapp.net","chat":"...","body":"oi","fromMe":false,"timestamp":1712345678}
```

## Solução de problemas

| Problema | Solução |
|---|---|
| Dashboard não abre | Aguarde ~1 min no primeiro start (Chromium subindo) |
| QR expira rápido | Reconecte pelo celular (Aparelhos conectados) |
| Nada publica no MQTT | Confera `mqtt_host/user/password` nos logs do add-on |
| Evento antigo do WAHA | Mude `hook_events` pra `message` |
| Trocar de número | Apague `/data/waha` pelo Samba/SSH e pareie de novo |

## Publicando no GitHub (build automático)

O workflow `.github/workflows/build.yml` builda as imagens `amd64` e `aarch64`
e publica no GHCR a cada push no `main`:

```bash
cd ha-whatsapp-addon
git init
git add .
git commit -m "WhatsApp Web (WAHA) + MQTT add-on v1.0.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ha-whatsapp-addon.git
git push -u origin main
```

Após o primeiro build (Actions → verde):

1. Abra `waha_mqtt/config.yaml` e **descomente** a linha
   `image: ghcr.io/SEU_USUARIO/waha_mqtt` (o Supervisor passa a baixar a
   imagem em vez de buildar localmente) — ou remova o `image` pra manter
   build local.
2. Suba a **tag** (`version:`) a cada mudança, senão o Supervisor não atualiza.
3. No HA: **Integrações → Adicionar repositório de add-on** →
   `https://github.com/SEU_USUARIO/ha-whatsapp-addon` → instalar.

> Para build local (sem GitHub), basta copiar a pasta `ha-whatsapp-addon`
> pro HA — o Supervisor builda do `Dockerfile` direto.

## Avisos

- Automatizar WhatsApp viola os ToS da Meta → use **número secundário**.
- WhatsApp Web precisa do celular **online**; sessão pode expirar e pedir novo QR.
- Imagem base: `devlikeapro/waha:latest` (multi-arch amd64/aarch64).
