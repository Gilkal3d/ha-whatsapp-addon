# Escolhe a tag do WAHA pela arquitetura do build (BuildKit define TARGETARCH):
#   amd64 -> devlikeapro/waha:latest (imagem oficial x86_64)
#   arm64 -> devlikeapro/waha:arm    (imagem oficial ARM64)
# Build manual em ARM: passe --build-arg TARGETARCH=arm64
ARG TARGETARCH=amd64

FROM devlikeapro/waha:latest AS stage-amd64
FROM devlikeapro/waha:arm AS stage-arm64

# Seletor de estágio por arquitetura
FROM stage-${TARGETARCH}

# Bridge MQTT (Node, mesma runtime do WAHA — sem Python extra)
WORKDIR /opt/addon
COPY package.json ./
RUN npm install --omit=dev

COPY run.js bridge.js ./

# O entrypoint do WAHA roda `node dist/main` (caminho RELATIVO),
# então o WORKDIR precisa voltar a ser /app, como na imagem oficial.
WORKDIR /app

# Mantém o tini do WAHA como PID 1 e roda nosso entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/opt/addon/run.js"]
