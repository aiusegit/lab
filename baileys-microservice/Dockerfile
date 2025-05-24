# Dockerfile for Standalone Baileys WhatsApp Service

# ---- Builder Stage ----
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies using npm ci for consistency with lock file
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Run the build process (e.g., TypeScript to JavaScript)
RUN npm run build

# ---- Runner Stage ----
FROM node:18-alpine
WORKDIR /app

# Install OS dependencies required by Baileys
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    gcompat \
    libwebp

# Copy built application, node_modules, and package.json from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Define the session file path that will be used by the application
# This will be used by the application if process.env.SESSION_FILE_PATH is read.
ENV SESSION_FILE_PATH=/app/whatsapp_sessions/baileys_auth_state

# Create the session directory and set permissions for the 'node' user.
# The 'node' user is provided by the official Node.js Docker images.
# Ensure this path matches the one used in baileysManager.ts (via process.env.SESSION_FILE_PATH)
RUN mkdir -p ${SESSION_FILE_PATH} && \
    chown -R node:node ${SESSION_FILE_PATH} && \
    chown -R node:node /app

# Switch to the non-root 'node' user
USER node

# Expose the port the application will run on
# Defaulting to 3002 if PORT environment variable is not set at runtime
EXPOSE ${PORT:-3002}

# Command to run the application
CMD ["node", "dist/server.js"]

# Comments:
# - Uses multi-stage build for a smaller final image.
# - Builder stage installs all dependencies using 'npm ci' and builds the TypeScript source.
# - Runner stage installs OS dependencies for Baileys.
# - Copies necessary artifacts (dist, node_modules, package.json) from the builder.
# - Creates and sets permissions for the session directory for the 'node' user.
# - Runs the application as the 'node' user for better security.
# - Assumes SESSION_FILE_PATH in .env will be './baileys_session_store' or similar relative path.
#   The Dockerfile sets up /app/baileys_session_store for this.
#   The application code (baileysManager.ts) should use process.env.SESSION_FILE_PATH
#   which will resolve to this path inside the container if the env var is set to the relative path
#   or an absolute path like /app/baileys_session_store.
#   If SESSION_FILE_PATH is not set in .env for Docker, the default in baileysManager.ts will be used.
#   It's good practice to ensure the Docker ENV SESSION_DIR_PATH aligns with app's expectation.
#   For this setup, if .env's SESSION_FILE_PATH is './baileys_session_store', it works as /app/baileys_session_store.
