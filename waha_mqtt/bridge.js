/**
 * Bridge: servidor webhook local + publicador MQTT.
 * O WAHA posta eventos em http://127.0.0.1:9090/webhook
 * e daqui sai um JSON no tópico MQTT configurado.
 */
const http = require("http");
const mqtt = require("mqtt");

let client = null;
let topic = "homeassistant/whatsapp/incoming";

function connect({ mqttHost, mqttPort, mqttUser, mqttPassword, mqttTopic }) {
  topic = mqttTopic || topic;
  const url = `mqtt://${mqttHost}:${mqttPort || 1883}`;
  const opts = {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };
  if (mqttUser) {
    opts.username = mqttUser;
    opts.password = mqttPassword || "";
  }
  client = mqtt.connect(url, opts);
  client.on("connect", () => console.log(`[bridge] MQTT conectado em ${url}`));
  client.on("error", (err) => console.error(`[bridge] MQTT erro: ${err.message}`));
  client.on("offline", () => console.warn("[bridge] MQTT offline, reconectando..."));
}

function publish(obj) {
  if (!client || !client.connected) {
    console.warn("[bridge] MQTT desconectado, mensagem descartada");
    return;
  }
  client.publish(topic, JSON.stringify(obj), { qos: 1 }, (err) => {
    if (err) console.error(`[bridge] erro ao publicar: ${err.message}`);
    else console.log(`[bridge] ${obj.from}: ${String(obj.body).slice(0, 80)}`);
  });
}

function extractMessage(payload) {
  const msg = payload.payload || payload;
  const event = payload.event;
  if (event && !["message", "message.any"].includes(event)) {
    return null;
  }
  const data = msg._data || {};
  const from = msg.from || msg.chatId || data.remoteJid || "";
  const fromMe = Boolean(msg.fromMe ?? data.fromMe);
  if (!from || fromMe) return null;
  return {
    from,
    chat: msg.chatId || from,
    body: msg.body ?? data.body ?? "",
    fromMe,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function start(config) {
  connect(config);

  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
      try {
        const message = extractMessage(JSON.parse(raw || "{}"));
        if (message) publish(message);
      } catch (err) {
        console.warn(`[bridge] payload inválido: ${err.message}`);
      }
    });
  });

  server.listen(9090, "127.0.0.1", () => {
    console.log("[bridge] webhook escutando em 127.0.0.1:9090/webhook");
  });
}

module.exports = { start };
