# Dockerfile for AG-UI Proxy Server

# ---- Builder Stage ----
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
# Assuming these files are in the 'agui-proxy' directory context
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build process (assuming a TypeScript project)
# If it's plain JavaScript, this step might not be needed or different.
RUN npm run build

# ---- Runner Stage ----
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for production install
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the built application from the builder stage
# This assumes the build output is in a 'dist' folder.
COPY --from=builder /app/dist ./dist

# Expose the application port (defaulting to 3001 if PORT env var is not set)
# AGUI_PROXY_URL was set to http://localhost:3001 in .env files
EXPOSE ${PORT:-3001}

# Command to run the application
# Adjust if the entry point is different, e.g., dist/proxy.js
CMD ["node", "dist/main.js"]

# Comments:
# - Uses multi-stage build for a smaller final image.
# - Builder stage installs all dependencies and builds the TypeScript source.
# - Runner stage installs only production dependencies and copies built assets.
# - Assumes the AG-UI Proxy entry point is `dist/main.js`.
# - Port is exposed via PORT environment variable, defaulting to 3001 (common for this proxy).
# - This Dockerfile should be placed in the root of the AG-UI Proxy project.
# - If the project structure or build process differs, adjustments will be needed.
