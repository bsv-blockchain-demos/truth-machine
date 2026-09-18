# Stage 1: Build the application
FROM node:22-alpine3.23 AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm_config_nodedir=/usr/local npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Stage 2: Run the application
FROM node:22-alpine3.23
RUN apk --no-cache upgrade
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3030
USER node
CMD ["node", "./dist/index.js"]
