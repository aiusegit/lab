# Dockerfile for Baileys WhatsApp Service

# ---- OS Dependencies Stage (Optional, but good for clarity if build needs them) ----
FROM node:18-alpine AS deps
# Install OS dependencies required by Baileys
# Chromium is often needed for Puppeteer which Baileys might use for QR generation or other tasks in some setups,
# though for basic QR in terminal, it might not be strictly necessary.
# gcompat is for glibc compatibility if any Node.js native modules require it.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    gcompat \
    libwebp

# ---- Builder Stage (if the service has a build process, e.g., TypeScript) ----
FROM node:18-alpine AS builder

WORKDIR /app

# Copy OS dependencies from the deps stage (if they were needed for build tools)
# COPY --from=deps /usr/lib /usr/lib
# COPY --from=deps /lib /lib
# For Alpine, apk adds to standard paths, so direct copy isn't always needed unless specific libraries are elsewhere.

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install all dependencies, including devDependencies if needed for build
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build process (e.g., if using TypeScript)
# If it's a plain JavaScript project, this line can be removed.
RUN npm run build

# ---- Runner Stage ----
FROM node:18-alpine

WORKDIR /app

# Install OS dependencies required by Baileys at runtime
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    gcompat \
    libwebp

# Create user and group for running the application to avoid running as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create the directory for WhatsApp session files and set permissions
# This directory path should match where BaileysManagerService saves sessions
RUN mkdir -p /app/whatsapp_sessions/baileys_auth_state && \
    chown -R appuser:appgroup /app/whatsapp_sessions

# Copy package.json and package-lock.json for production install
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the built application from the builder stage
# If no build stage, this would copy source code directly: COPY . .
COPY --from=builder /app/dist ./dist
# If no build stage, and entry is index.js in root:
# COPY index.js .
# COPY src/ ./src/ # if you have other source files

# Change ownership of the app files to the new user
RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Expose any port if the Baileys service itself runs a server (e.g., for health checks or commands)
# For a pure client, this might not be needed.
# EXPOSE 8081

# Command to run the application
# Adjust if entry point is different (e.g., index.js if no build)
CMD ["node", "dist/main.js"]

# Comments:
# - Uses multi-stage build if a build process (e.g., TypeScript to JavaScript) is involved.
#   If it's a plain JS project with entry `index.js`, the builder stage can be simplified or removed.
# - Installs OS dependencies required by Baileys (Chromium, etc.) in the runner stage.
# - Creates a non-root user `appuser` for better security.
# - Creates the session directory `/app/whatsapp_sessions/baileys_auth_state` and sets its ownership.
#   This ensures the Node.js process, running as `appuser`, can write to this directory.
# - Assumes the application entry point is `dist/main.js`. If it's `index.js` at the root and no build step,
#   adjust the COPY and CMD lines accordingly (e.g., `COPY index.js .`, `CMD ["node", "index.js"]`).
# - The `BaileysManagerService` in the NestJS backend was responsible for creating and managing the Baileys client.
#   If this "Baileys WhatsApp Service" is a separate, standalone service that *is* the Baileys client,
#   then this Dockerfile is appropriate for it. If the NestJS backend *itself* is the Baileys client
#   (via BaileysManagerService), then the OS dependencies for Baileys should be added to the NestJS Dockerfile instead,
#   and this separate `baileys-service/Dockerfile` might not be needed unless it serves a different purpose.
#   Given the prompt, I'm assuming this is a distinct service that runs the Baileys client.
#   The session path `/app/whatsapp_sessions/baileys_auth_state` should align with where this service expects to save data.
#   The NestJS `BaileysManagerService` was configured to save at `path.join(process.cwd(), 'whatsapp_sessions')`.
#   If this service is the one running Baileys, its internal logic must use this `/app/whatsapp_sessions` path.
#   If the NestJS app itself runs Baileys, then the NestJS Dockerfile needs the apk adds and directory creation.
#   For this task, I am treating this as a standalone Baileys service.
