# Stage 1: Build the application
FROM node:22-alpine3.23 AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve static files
FROM node:22-alpine3.23
RUN apk --no-cache upgrade && npm i -g serve@14.2.6
WORKDIR /app
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["serve", "-s", "dist"]
