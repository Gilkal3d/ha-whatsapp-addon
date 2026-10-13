# Escolhe a tag do WAHA pela arquitetura do build:
#   amd64   -> devlikeapro/waha:latest (imagem oficial x86_64)
#   aarch64 -> devlikeapro/waha:arm    (imagem oficial ARM64)
# O builder do HA passa BUILD_ARCH automaticamente.
ARG BUILD_ARCH=amd64

FROM devlikeapro/waha:latest AS stage-amd64
FROM devlikeapro/waha:arm AS stage-aarch64

# Seletor de estágio por arquitetura
FROM stage-${BUILD_ARCH}

# Bridge MQTT (Node, mesma runtime do WAHA — sem Python extra)
WORKDIR /opt/addon
COPY package.json ./
RUN npm install --omit=dev

COPY run.js bridge.js ./

# Mantém o tini do WAHA como PID 1 e roda nosso entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/opt/addon/run.js"]
