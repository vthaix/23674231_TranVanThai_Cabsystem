FROM node:20-alpine

WORKDIR /app

COPY mocks/mock-map-provider/package*.json ./
RUN npm install --omit=dev

COPY mocks/mock-map-provider ./

EXPOSE 4002

CMD ["node", "src/index.js"]
