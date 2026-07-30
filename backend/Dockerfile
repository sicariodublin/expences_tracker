FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./backend/

RUN mkdir -p backend/uploads && chown -R node:node /app

USER node

EXPOSE 5000
CMD ["node", "backend/server.js"]
