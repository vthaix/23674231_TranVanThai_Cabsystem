FROM node:20-alpine

WORKDIR /backend

COPY services/driver-service/package*.json ./services/driver-service/

RUN cd services/driver-service && npm install --omit=dev

COPY services/driver-service ./services/driver-service
COPY shared ./shared

WORKDIR /backend/services/driver-service

EXPOSE 3002

CMD ["node", "src/index.js"]
