FROM node:20-alpine

WORKDIR /backend

COPY services/trip-service/package*.json ./services/trip-service/

RUN cd services/trip-service && npm install --omit=dev

COPY services/trip-service ./services/trip-service
COPY shared ./shared

WORKDIR /backend/services/trip-service

EXPOSE 3004

CMD ["node", "src/index.js"]
