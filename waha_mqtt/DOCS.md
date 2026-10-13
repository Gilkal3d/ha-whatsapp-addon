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
