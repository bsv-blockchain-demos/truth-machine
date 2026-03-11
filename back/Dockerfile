# Stage 1: Build the application
FROM node:22-alpine3.23 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run the application
FROM node:22-alpine3.23
RUN apk --no-cache upgrade
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev
EXPOSE 3030
USER node
CMD ["node", "./dist/index.js"]
