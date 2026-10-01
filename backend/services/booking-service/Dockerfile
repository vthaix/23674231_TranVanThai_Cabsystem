FROM node:20-alpine

WORKDIR /backend

COPY services/booking-service/package*.json ./services/booking-service/

RUN cd services/booking-service && npm install --omit=dev

COPY services/booking-service ./services/booking-service
COPY shared ./shared

WORKDIR /backend/services/booking-service

EXPOSE 3003

CMD ["node", "src/index.js"]
