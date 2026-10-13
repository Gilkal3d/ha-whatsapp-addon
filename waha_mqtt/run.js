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
    hook_events: "message.received",
    api_key: "",
    engine: "WEBJS",
  };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync("/data/options.json", "utf8")) };
  } catch (err) {
    console.warn(`[addon] options.json ausente, usando padrões: ${err.message}`);
    return defaults;
  }
}

function linkSessionToData() {
  // Persiste a sessão do WhatsApp em /data (sobrevive a update do add-on)
  const dataDir = "/data/waha";
  const appDir = "/app/.waha";
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(appDir)) {
      const stat = fs.lstatSync(appDir);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        // Primeira execução antiga com dados locais: move pra /data
        for (const entry of fs.readdirSync(appDir)) {
          fs.renameSync(path.join(appDir, entry), path.join(dataDir, entry));
        }
        fs.rmdirSync(appDir);
      } else {
        fs.unlinkSync(appDir);
      }
    }
    fs.symlinkSync(dataDir, appDir, "dir");
  } catch (err) {
    console.warn(`[addon] não foi possível vincular sessão a /data: ${err.message}`);
  }
}

const options = loadOptions();
linkSessionToData();

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
  WHATSAPP_HOOK_URL: "http://127.0.0.1:9090/webhook",
  WHATSAPP_HOOK_EVENTS: options.hook_events,
  WHATSAPP_DEFAULT_ENGINE: options.engine,
  WHATSAPP_STORE_ENGINE: "JsonWebStore",
  WHATSAPP_AUTO_RESTART: "true",
};
if (options.api_key) env.WHATSAPP_APIKEY = options.api_key;

// O entrypoint do WAHA roda `node dist/main` com caminho relativo,
// então o cwd precisa ser /app (o WORKDIR original da imagem WAHA).
const waha = spawn("/entrypoint.sh", [], { env, stdio: "inherit", cwd: "/app" });

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
