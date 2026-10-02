FROM node:20-alpine

WORKDIR /app

COPY mocks/mock-payment-provider/package*.json ./
RUN npm install --omit=dev

COPY mocks/mock-payment-provider ./

EXPOSE 4001

CMD ["node", "src/index.js"]
