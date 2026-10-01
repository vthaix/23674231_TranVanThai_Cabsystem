FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY gateway/package.json gateway/package.json
COPY shared/package.json shared/package.json

RUN npm install --omit=dev

COPY gateway ./gateway
COPY shared ./shared

WORKDIR /app/gateway

EXPOSE 8000

CMD ["node", "src/index.js"]