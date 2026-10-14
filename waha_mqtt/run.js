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
    dashboard_user: "admin",
    dashboard_password: "",
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

function linkSessionToData() {
  // Persiste a sessão do WAHA em /data (sobrevive a update do add-on).
  // Compat com versões antigas que gravavam em /app/.waha.
  const dataDir = "/data/waha";
  const appDir = "/app/.waha";
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(appDir)) {
      const stat = fs.lstatSync(appDir);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
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
  // Diretório oficial de storage local do WAHA (docs: WAHA_LOCAL_STORE_BASE_DIR)
  for (const dir of [dataDir, "/data/sessions", "/data/files"]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn(`[addon] não criei ${dir}: ${err.message}`);
    }
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

// O WAHA (imagens recentes) rejeita eventos legados como "message.received".
// Converte para o nome atual equivalente antes de exportar para o processo.
const LEGACY_HOOK_EVENTS = { "message.received": "message" };
function normalizeHookEvents(raw) {
  return String(raw || "message")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => LEGACY_HOOK_EVENTS[e] || e)
    .filter((e, i, all) => all.indexOf(e) === i)
    .join(",");
}

// --- WAHA ---
const env = {
  ...process.env,
  WHATSAPP_HOOK_URL: "http://127.0.0.1:9090/webhook",
  WHATSAPP_HOOK_EVENTS: normalizeHookEvents(options.hook_events),
  WHATSAPP_DEFAULT_ENGINE: options.engine,
  WHATSAPP_STORE_ENGINE: "JsonWebStore",
  WHATSAPP_AUTO_RESTART: "true",
  // Persistência de sessão e mídia em /data (sobrevive a update)
  WAHA_LOCAL_STORE_BASE_DIR: "/data/sessions",
  WHATSAPP_FILES_FOLDER: "/data/files",
  // QR também sai nos logs — fallback pra escanear se o painel falhar
  WAHA_PRINT_QR: "True",
  WAHA_LOG_LEVEL: "info",
};

// API key do WAHA:
// - Opção preenchida  -> exige X-Api-Key em toda chamada (dashboard incluído,
//   o painel precisa da chave em Settings > API Key).
// - Opção vazia       -> DESLIGA a exigência. Sem isso o WAHA gera uma chave
//   aleatória sozinho e o dashboard fica em "CONNECTING..." / 401 (Monitor de
//   Eventos não conecta, sessões não aparecem). Adequado para rede local.
if (options.api_key) {
  env.WHATSAPP_API_KEY = options.api_key;
  console.log("[addon] WAHA API key: usando a chave definida na configuração");
} else {
  env.WAHA_API_KEY = "";
  env.WAHA_NO_API_KEY = "True";
  console.log("[addon] WAHA API key: desligada (rede local) — defina a opção 'api_key' pra ativar");
}

// Painel/Swagger: usa as credenciais da opção.
// Sem senha => o WAHA roda sem login e quem chega já está logado no HA (ingress).
if (options.dashboard_password) {
  const user = options.dashboard_user || "admin";
  env.WAHA_DASHBOARD_USERNAME = user;
  env.WAHA_DASHBOARD_PASSWORD = options.dashboard_password;
  env.WHATSAPP_SWAGGER_USERNAME = user;
  env.WHATSAPP_SWAGGER_PASSWORD = options.dashboard_password;
} else {
  env.WAHA_DASHBOARD_USERNAME = options.dashboard_user || "admin";
  env.WAHA_DASHBOARD_PASSWORD = "";
  env.WAHA_DASHBOARD_NO_PASSWORD = "true";
  env.WHATSAPP_SWAGGER_USERNAME = options.dashboard_user || "admin";
  env.WHATSAPP_SWAGGER_PASSWORD = "";
  env.WHATSAPP_SWAGGER_NO_PASSWORD = "true";
}

// URL base pública (ex.: http://10.207.100.79:3000).
// Sem ela o painel/dashboard usa 127.0.0.1:3000 — que do seu navegador
// aponta pro SEU PC, não pro HA (ícones vermelhos / API inacessível).
if (options.base_url) {
  env.WAHA_BASE_URL = options.base_url;
  env.WAHA_PUBLIC_URL = options.base_url;
}

console.log(
  `[addon] WAHA iniciando | engine=${options.engine} | eventos=${env.WHATSAPP_HOOK_EVENTS} | base_url=${options.base_url || "(padrao)"}`
);

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
