FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY bin/ ./bin/

RUN npm run build

# ------- Production -------
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Storage volume
RUN mkdir -p /data
ENV VISION_NODE_DATA_DIR=/data

EXPOSE 9090
EXPOSE 9091

ENTRYPOINT ["node", "dist/index.js"]
CMD ["start"]
