FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY services/identity-service/package.json services/identity-service/package.json
COPY shared/package.json shared/package.json

RUN npm install --omit=dev

COPY services/identity-service ./services/identity-service
COPY shared ./shared

WORKDIR /app/services/identity-service

EXPOSE 3000

CMD ["node", "src/index.js"]