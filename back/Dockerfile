# Stage 1: Build the application
FROM node:latest as builder
WORKDIR /app
COPY package*.json ./
RUN npm install\
  && npm install -g typescript
COPY . .
RUN tsc

# Stage 2: Run the application
FROM node:latest
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm install --production\
  && npm install -g tsx
EXPOSE 3030
CMD ["npm", "run", "dev"]
