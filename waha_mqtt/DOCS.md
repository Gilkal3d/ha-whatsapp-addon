# WhatsApp Web (WAHA) + MQTT

Mantém uma sessão do **WhatsApp Web** dentro do Supervisor e publica cada mensagem
recebida num tópico MQTT do Home Assistant — para disparar triggers/automações
filtrando um contato específico.

## Primeiros passos

1. Na aba **Configuração**, preencha host/usuário/senha do broker MQTT
   (add-on Mosquitto do HA) e **Salvar**.
2. **Iniciar** o add-on.
3. Abra o **Ingress** (botão "ABRIR WEB UI" na barra superior) — o dashboard do
   WAHA aparece dentro da UI do HA. Escaneie o QR:
   no celular: WhatsApp → Aparelhos conectados → Conectar aparelho.
4. Crie a automação (aba **Informação** deste add-on tem o modelo pronto).

## Entidades automáticas (MQTT Discovery)

O add-on cria **3 entidades sozinhas** no HA ao instalar/atualizar — sem YAML:

| Entidade | O que faz |
|---|---|
| `sensor.whatsapp_status` | ON/OFF (Conectado/Desconectado) da sessão do WAHA |
| `text.whatsapp_filtro` | Campo pra digitar o ID/telefone do remetente gatilho |
| `switch.whatsapp_pulso` | Interruptor de pulso: liga quando chega mensagem do contato filtrado e desliga sozinho |

**Uso:** abra `text.whatsapp_filtro` e digite o ID do contato (por exemplo
`993503114` ou o LID `117192595091647` — veja os logs). Aceita vários
separados por vírgula. Quando aquele contato escrever, `switch.whatsapp_pulso`
liga por `pulse_seconds` (padrão 10s) com os atributos `de`, `texto` e `em`.
Dispare qualquer automação pelo estado do interruptor.

## Filtrando um contato

O payload publicado é:

```json
{"from":"5511999999999@s.whatsapp.net","chat":"...","body":"oi","fromMe":false,"timestamp":1712345678}
```

Use `trigger.payload_json.from` na condição da automação para ativar somente
quando **aquele contato** escrever.

## Dicas

- Sessão persistente em `/data/waha` (sobrevive a updates).
- Logs de tudo (WAHA + bridge MQTT) na aba **Logs**.
- Se o QR expirar, refaça o pareamento pelo celular.
- Troque de número apagando o conteúdo de `/data/waha` (Samba/SSH).
