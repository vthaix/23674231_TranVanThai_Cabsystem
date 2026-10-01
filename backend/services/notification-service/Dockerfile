FROM node:20-alpine

WORKDIR /backend

COPY services/notification-service/package*.json ./services/notification-service/

RUN cd services/notification-service && npm install --omit=dev

COPY services/notification-service ./services/notification-service
COPY shared ./shared

WORKDIR /backend/services/notification-service

EXPOSE 3006

CMD ["node", "src/index.js"]
