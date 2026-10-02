FROM node:20-alpine

WORKDIR /backend

COPY services/identity-service/package*.json ./services/identity-service/

RUN cd services/identity-service && npm install --omit=dev

COPY services/identity-service ./services/identity-service
COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /backend/services/identity-service

EXPOSE 3000

CMD ["node", "src/index.js"]
