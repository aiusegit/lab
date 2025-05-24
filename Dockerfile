# Dockerfile for NestJS Backend

# ---- Builder Stage ----
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build process
RUN npm run build

# ---- Runner Stage ----
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for production install
COPY package*.json ./

# Install only production dependencies
# This will use the package-lock.json to ensure consistent dependencies
RUN npm install --only=production

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port (defaulting to 3000 if PORT env var is not set)
# The actual port should be set via PORT environment variable at runtime for flexibility
EXPOSE ${PORT:-3000}

# Command to run the application
CMD ["node", "dist/main.js"]

# Comments:
# - Uses multi-stage build to keep the final image size small.
# - Builder stage installs all dependencies, including devDependencies, to build the application.
# - Runner stage installs only production dependencies and copies the built assets.
# - Assumes the NestJS application entry point is `dist/main.js`.
# - Port exposure is made flexible using `PORT` environment variable, defaulting to 3000.
# - This Dockerfile should be placed in the root of the NestJS backend project.
# - If your NestJS app is in a subdirectory, e.g., 'backend/', adjust COPY paths:
#   Builder: COPY ./backend/package*.json ./ ; COPY ./backend/. .
#   Runner: COPY ./backend/package*.json ./ ; COPY --from=builder /app/dist ./dist
