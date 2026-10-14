/**
 * Entrypoint do add-on.
 * 1. Lê as opções da UI do HA (/data/options.json)
 * 2. Sobe o bridge MQTT (recebe webhook do WAHA)
 * 3. Inicia o WAHA apontando o webhook pro bridge interno
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const bridge = require("./bridge");

function loadOptions() {
  const defaults = {
    mqtt_host: "core-mosquitto",
    mqtt_port: 1883,
    mqtt_user: "",
    mqtt_password: "",
    mqtt_topic: "homeassistant/whatsapp/incoming",
    hook_events: "message",
    api_key: "",
    engine: "WEBJS",
    base_url: "",
  };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync("/data/options.json", "utf8")) };
  } catch (err) {
    console.warn(`[addon] options.json ausente, usando padrões: ${err.message}`);
    return defaults;
  }
}

function ensureDataDirs() {
  // Persistência em /data (sobrevive a update do add-on)
  for (const dir of ["/data/sessions", "/data/files"]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn(`[addon] não criei ${dir}: ${err.message}`);
    }
  }
}

const options = loadOptions();
ensureDataDirs();

// --- Bridge MQTT (webhook WAHA -> MQTT) ---
bridge.start({
  mqttHost: options.mqtt_host,
  mqttPort: options.mqtt_port,
  mqttUser: options.mqtt_user,
  mqttPassword: options.mqtt_password,
  mqttTopic: options.mqtt_topic,
});

// --- WAHA ---
const env = {
  ...process.env,
  // Webhook interno (mesmo container)
  WHATSAPP_HOOK_URL: "http://127.0.0.1:9090/webhook",
  WHATSAPP_HOOK_EVENTS: options.hook_events,
  WHATSAPP_DEFAULT_ENGINE: options.engine,
  // Persistência de sessao e arquivos em /data
  WAHA_LOCAL_STORE_BASE_DIR: "/data/sessions",
  WHATSAPP_FILES_FOLDER: "/data/files",
  // QR tambem aparece nos logs (fallback pra escanear)
  WAHA_PRINT_QR: "True",
  WAHA_LOG_LEVEL: "info",
};

// API key: se vazia -> desliga a exigencia de chave (rede local).
// Se preenchida -> exige X-Api-Key em toda chamada a API.
if (options.api_key) {
  env.WAHA_API_KEY = options.api_key;
  env.WAHA_API_KEY_PLAIN = options.api_key;
} else {
  env.WAHA_NO_API_KEY = "True";
  env.WAHA_API_KEY = "";
}

// URL base (ex.: http://10.207.100.79:3000) - usada em media.url, webhook e dashboard
if (options.base_url) {
  env.WAHA_BASE_URL = options.base_url;
  env.WAHA_PUBLIC_URL = options.base_url;
}

console.log(
  `[addon] WAHA iniciando | engine=${options.engine} | eventos=${options.hook_events} | api_key=${options.api_key ? "definida" : "desligada"} | base_url=${options.base_url || "(padrao)"}`
);

const waha = spawn("/entrypoint.sh", [], { env, stdio: "inherit" });

function shutdown(signal) {
  console.log(`[addon] ${signal} recebido, encerrando...`);
  waha.kill(signal);
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

waha.on("exit", (code) => {
  console.log(`[addon] WAHA saiu com código ${code}`);
  process.exit(code ?? 0);
});
