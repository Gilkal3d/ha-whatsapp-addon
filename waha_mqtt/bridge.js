/**
 * Bridge: servidor webhook local + publicador MQTT + entities via MQTT Discovery.
 *
 * O WAHA posta eventos em http://127.0.0.1:9090/webhook e daqui sai:
 *  - JSON da mensagem no tópico configurado (mqtt_topic)
 *  - sensor.whatsapp_status  -> ON/OFF (connectivity) conforme a sessão do WAHA
 *  - text.whatsapp_filtro    -> campo pra digitar o ID/telefone do remetente
 *  - switch.whatsapp_pulso   -> pulso (ON por N segundos) quando chega mensagem
 *                               do remetente do filtro
 *
 * As 3 entidades são criadas automaticamente no HA via MQTT Discovery
 * (tópicos "homeassistant/<component>/waha_.../config", retained).
 */
const http = require("http");
const fs = require("fs");
const mqtt = require("mqtt");

const DISCOVERY = "homeassistant";
const BASE = "homeassistant/whatsapp";
const DEVICE = {
  identifiers: ["waha_mqtt_addon"],
  name: "WhatsApp (WAHA)",
  manufacturer: "Gilkal3d",
  model: "WAHA + bridge MQTT",
  sw_version: "1.2.0",
};

const T = {
  statusState: `${BASE}/status/state`,
  statusAttrs: `${BASE}/status/attributes`,
  availability: `${BASE}/availability`,
  filterCmd: `${BASE}/filter/set`,
  filterState: `${BASE}/filter/state`,
  pulseCmd: `${BASE}/pulse/set`,
  pulseState: `${BASE}/pulse/state`,
  pulseAttrs: `${BASE}/pulse/attributes`,
};

const FILTER_FILE = "/data/waha-filter.txt";
const STATUS_POLL_MS = 30000;

let client = null;
let mqttUrl = "";
let topic = `${BASE}/incoming`;
let pulseSeconds = 10;
let wahaUrl = "http://127.0.0.1:3000";
let wahaApiKey = "";
let filterIds = [];
let pulseTimer = null;
let statusOnline = false;
let sessionDetail = "desconhecido";
const stats = { total: 0, lastFrom: "", lastText: "", lastAt: "" };

// ---------------------------------------------------------------- utilidades

function safePublish(t, payload, retain) {
  if (!client || !client.connected) return;
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  client.publish(t, body, { qos: 1, retain: Boolean(retain) }, (err) => {
    if (err) console.error(`[bridge] erro ao publicar em ${t}: ${err.message}`);
  });
}

// ------------------------------------------------------------------- filtro

function loadFilter() {
  try {
    filterIds = fs
      .readFileSync(FILTER_FILE, "utf8")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    filterIds = [];
  }
}

function setFilter(raw) {
  // Aceita um ou mais IDs separados por vírgula/espço
  // (ex.: "117192595091647, 5511993503114").
  filterIds = String(raw || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    fs.writeFileSync(FILTER_FILE, filterIds.join(", "), "utf8");
  } catch (err) {
    console.warn(`[bridge] não persisti o filtro: ${err.message}`);
  }
  safePublish(T.filterState, filterIds.join(", "), true);
  console.log(`[bridge] filtro atualizado: ${filterIds.join(", ") || "(vazio)"}`);
}

function matchesFilter(msg) {
  if (!filterIds.length) return false;
  const hay = `${msg.from || ""} ${msg.chat || ""}`;
  return filterIds.some((id) => hay.includes(id));
}

// --------------------------------------------------------------------- pulso

function triggerPulse(msg) {
  if (pulseTimer) clearTimeout(pulseTimer);
  const em = new Date().toISOString();
  safePublish(T.pulseState, "ON", true);
  safePublish(
    T.pulseAttrs,
    { de: msg.from || "", texto: String(msg.body || "").slice(0, 200), em },
    true
  );
  console.log(`[bridge] PULSO ativado por ${msg.from}: ${String(msg.body || "").slice(0, 80)}`);
  pulseTimer = setTimeout(() => {
    pulseTimer = null;
    safePublish(T.pulseState, "OFF", true);
  }, pulseSeconds * 1000);
}

function clearPulse() {
  if (pulseTimer) clearTimeout(pulseTimer);
  pulseTimer = null;
  safePublish(T.pulseState, "OFF", true);
}

// ------------------------------------------------------------------- status

function setStatus(state, detail) {
  statusOnline = state === "ON";
  if (detail) sessionDetail = detail;
  safePublish(T.statusState, statusOnline ? "ON" : "OFF", true);
  safePublish(
    T.statusAttrs,
    {
      sessao: sessionDetail,
      filtro: filterIds.join(", "),
      mensagens_total: stats.total,
      ultima_de: stats.lastFrom,
      ultima_texto: stats.lastText,
      ultima_em: stats.lastAt,
    },
    true
  );
}

function checkStatus() {
  const headers = {};
  if (wahaApiKey) headers["X-Api-Key"] = wahaApiKey;
  const req = http.get(`${wahaUrl}/api/sessions`, { headers, timeout: 8000 }, (res) => {
    let raw = "";
    res.on("data", (c) => (raw += c));
    res.on("end", () => {
      try {
        const parsed = JSON.parse(raw || "[]");
        const list = Array.isArray(parsed) ? parsed : parsed.sessions || [];
        const working = list.find((s) => s && s.status === "WORKING");
        if (working) setStatus("ON", `${working.name}: WORKING`);
        else if (list.length) setStatus("OFF", list.map((s) => `${s.name}: ${s.status}`).join(", "));
        else setStatus("OFF", "nenhuma sessão");
      } catch {
        setStatus("OFF", "resposta inválida da API do WAHA");
      }
    });
  });
  req.on("timeout", () => req.destroy(new Error("timeout")));
  req.on("error", () => setStatus("OFF", "API do WAHA inacessível"));
}

// ---------------------------------------------------------------- discovery

function publishDiscovery() {
  const availability = {
    availability_topic: T.availability,
    payload_available: "online",
    payload_not_available: "offline",
  };

  const sensor = {
    name: "WhatsApp Status",
    unique_id: "waha_mqtt_status",
    state_topic: T.statusState,
    json_attributes_topic: T.statusAttrs,
    device_class: "connectivity",
    payload_on: "ON",
    payload_off: "OFF",
    ...availability,
    device: DEVICE,
  };

  const text = {
    name: "WhatsApp Filtro",
    unique_id: "waha_mqtt_filtro",
    command_topic: T.filterCmd,
    state_topic: T.filterState,
    icon: "mdi:account-filter",
    ...availability,
    device: DEVICE,
  };

  const sw = {
    name: "WhatsApp Pulso",
    unique_id: "waha_mqtt_pulso",
    command_topic: T.pulseCmd,
    state_topic: T.pulseState,
    json_attributes_topic: T.pulseAttrs,
    payload_on: "ON",
    payload_off: "OFF",
    optimistic: false,
    icon: "mdi:message-alert-processing",
    ...availability,
    device: DEVICE,
  };

  safePublish(`${DISCOVERY}/sensor/waha_status/config`, sensor, true);
  safePublish(`${DISCOVERY}/text/waha_filtro/config`, text, true);
  safePublish(`${DISCOVERY}/switch/waha_pulso/config`, sw, true);
  console.log("[bridge] MQTT Discovery publicado (sensor, text, switch)");
}

// --------------------------------------------------------------------- mqtt

function onMqttMessage(t, payload) {
  const value = payload.toString();
  if (t === "homeassistant/status") {
    // HA (re)iniciou: republica discovery + estado
    if (value === "online") {
      publishDiscovery();
      checkStatus();
    }
    return;
  }
  if (t === T.filterCmd) {
    setFilter(value);
    return;
  }
  if (t === T.pulseCmd) {
    if (value.toUpperCase() === "ON") triggerPulse({ from: "(manual)", body: "pulso manual" });
    else clearPulse();
  }
}

function connect(config) {
  topic = config.mqttTopic || topic;
  pulseSeconds = Math.max(1, parseInt(config.pulseSeconds, 10) || 10);
  wahaUrl = config.wahaUrl || wahaUrl;
  wahaApiKey = config.wahaApiKey || "";
  loadFilter();

  mqttUrl = `mqtt://${config.mqttHost}:${config.mqttPort || 1883}`;
  const opts = {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    // Availability: se o bridge cair, as entities ficam "unavailable"
    will: { topic: T.availability, payload: "offline", retain: true, qos: 1 },
  };
  if (config.mqttUser) {
    opts.username = config.mqttUser;
    opts.password = config.mqttPassword || "";
  }
  client = mqtt.connect(mqttUrl, opts);

  client.on("connect", () => {
    console.log(`[bridge] MQTT conectado em ${mqttUrl}`);
    client.subscribe([T.filterCmd, T.pulseCmd, "homeassistant/status"], { qos: 0 }, (err) => {
      if (err) console.error(`[bridge] erro ao assinar tópicos: ${err.message}`);
    });
    safePublish(T.availability, "online", true);
    publishDiscovery();
    safePublish(T.filterState, filterIds.join(", "), true);
    safePublish(T.pulseState, "OFF", true);
    checkStatus();
    console.log(`[bridge] filtro carregado: ${filterIds.join(", ") || "(vazio)"} | pulso=${pulseSeconds}s`);
  });
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

function handleIncoming(msg) {
  stats.total += 1;
  stats.lastFrom = msg.from;
  stats.lastText = String(msg.body || "").slice(0, 120);
  stats.lastAt = new Date().toISOString();
  // Mensagem chegou => o serviço está vivo mesmo se a API falhar
  setStatus("ON", sessionDetail);
  if (matchesFilter(msg)) triggerPulse(msg);
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
        if (message) {
          publish(message);
          handleIncoming(message);
        }
      } catch (err) {
        console.warn(`[bridge] payload inválido: ${err.message}`);
      }
    });
  });

  server.listen(9090, "127.0.0.1", () => {
    console.log("[bridge] webhook escutando em 127.0.0.1:9090/webhook");
  });

  // Sensores continuam atualizando sem depender de webhook
  setInterval(checkStatus, STATUS_POLL_MS);
}

module.exports = { start };
