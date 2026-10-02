FROM node:20-alpine

WORKDIR /backend

COPY services/customer-service/package*.json ./services/customer-service/

RUN cd services/customer-service && npm install --omit=dev

COPY services/customer-service ./services/customer-service
COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /backend/services/customer-service

EXPOSE 3001

CMD ["node", "src/index.js"]
