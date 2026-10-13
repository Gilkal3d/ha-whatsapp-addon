# Base: imagem oficial do WAHA (já contém Node, Chromium e o dashboard)
FROM devlikeapro/waha:latest

# Bridge MQTT (Node, mesma runtime do WAHA — sem Python extra)
WORKDIR /opt/addon
COPY package.json ./
RUN npm install --omit=dev

COPY run.js bridge.js ./

# Mantém o tini do WAHA como PID 1 e roda nosso entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/opt/addon/run.js"]
