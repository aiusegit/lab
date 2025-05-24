# agui-proxy/Dockerfile

# Builder stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci # Using npm ci as per target convention
COPY . .
RUN npm run build # Or specific build command for AG-UI proxy

# Runner stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE ${PORT:-3001} # Keeping 3001 for consistency with existing setup
CMD ["node", "dist/main.js"] # Assuming main.js is the entry point
