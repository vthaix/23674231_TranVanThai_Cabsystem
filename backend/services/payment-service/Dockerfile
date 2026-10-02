FROM node:20-alpine

WORKDIR /backend

COPY services/payment-service/package*.json ./services/payment-service/

RUN cd services/payment-service && npm install --omit=dev

COPY services/payment-service ./services/payment-service
COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /backend/services/payment-service

EXPOSE 3005

CMD ["node", "src/index.js"]
