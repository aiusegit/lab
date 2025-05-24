# baileys-microservice/Dockerfile

# Builder stage
FROM node:22-alpine AS builder
RUN npm install -g pnpm # Install pnpm globally
WORKDIR /app

COPY package.json ./
# Copy pnpm-lock.yaml if it exists. The install command below handles its absence initially.
COPY pnpm-lock.yaml* ./ 

# Install dependencies using pnpm.
# --frozen-lockfile is similar to npm ci.
# Falls back to 'pnpm install' if lockfile is missing/problematic (useful for initial setup by user).
RUN if [ -f pnpm-lock.yaml ]; then echo "pnpm-lock.yaml found, running pnpm install --frozen-lockfile." && pnpm install --frozen-lockfile; else echo "pnpm-lock.yaml not found, running pnpm install." && pnpm install; fi

COPY . .
# Assuming 'build' script in package.json is like "tsc -p ." or similar
RUN pnpm run build 

# Runner stage
FROM node:22-alpine
RUN npm install -g pnpm # Install pnpm globally in runner too

# Install OS dependencies for Baileys
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont gcompat libwebp

WORKDIR /app

# Copy essential files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# Copy pnpm-lock.yaml to ensure prod install is consistent
COPY --from=builder /app/pnpm-lock.yaml* ./ 

# Install only production dependencies using pnpm
# This creates a clean node_modules folder in the runner
RUN if [ -f pnpm-lock.yaml ]; then echo "pnpm-lock.yaml found in runner, running pnpm install --prod --frozen-lockfile." && pnpm install --prod --frozen-lockfile; else echo "pnpm-lock.yaml not found in runner, running pnpm install --prod." && pnpm install --prod; fi

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create session directory and ensure /app is writable by appuser
ENV SESSION_FILE_PATH=/app/whatsapp_sessions/baileys_auth_state
RUN mkdir -p $SESSION_FILE_PATH && chown -R appuser:appgroup /app

USER appuser

EXPOSE ${PORT:-3002}
CMD ["node", "dist/server.js"]
