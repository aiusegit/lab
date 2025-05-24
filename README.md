# Project Title (Replace with actual project title)

(Add a brief description of your project here)

## Local Development Setup

This project uses Docker Compose and a Makefile to simplify local development.

### Prerequisites
- Docker installed and running.
- Docker Compose installed.
- `make` command available.
- Create a `.env` file in the project root (see `.env.example`).
- Create a `.env` file in `./baileys-microservice/` (see `./baileys-microservice/.env.example`).
  Ensure API keys match between these files as per comments in `.env.example`.
- **`package-lock.json` / `pnpm-lock.yaml`:**
  - For services built with Docker using `npm ci` (like the NestJS backend, if it were using `npm ci`), ensure `package-lock.json` is committed.
  - The `baileys-microservice` now uses `pnpm`. Use the `make setup-baileys-pnpm` command to generate/update `pnpm-lock.yaml` and stage it. This file **must** be committed. If you encounter `pnpm install --frozen-lockfile` errors during Docker builds for this service, run `make setup-baileys-pnpm` and commit the changes.
- If developing the `baileys-microservice` directly, use `pnpm` commands (e.g., `pnpm install`, `pnpm add <package>`) within the `./baileys-microservice` directory.

### Makefile Commands

A `Makefile` is provided at the project root to manage common Docker Compose operations:

- `make help`: Display all available commands and their descriptions.
- `make up` or `make start`: Start all services (NestJS backend, Baileys microservice, SurrealDB) in detached mode. Builds images if they don't exist or if Dockerfiles changed.
- `make down` or `make stop`: Stop and remove all running services.
- `make down-v`: Stop and remove services AND their Docker volumes (e.g., SurrealDB data, Baileys session files - USE WITH CAUTION).
- `make restart`: Restart all services.
- `make setup-baileys-pnpm`: Specifically prepares the `./baileys-microservice` for `pnpm` development. It cleans old npm artifacts, runs `pnpm install` to generate/update `pnpm-lock.yaml`, and stages `package.json` and `pnpm-lock.yaml` for you to review and commit. Essential after pulling changes to this service or if build issues occur.
- `make logs`: Follow logs for all services.
- `make logs-nestjs`: Follow logs for the NestJS backend.
- `make logs-baileys`: Follow logs for the Baileys microservice.
- `make logs-surrealdb`: Follow logs for the SurrealDB service.
- `make ps`: Show the status of running services.
- `make config`: Validate and display the Docker Compose configuration.
- `make build`: Force a rebuild of all service images without using cache.
- `make build-nestjs`: Force rebuild of the NestJS backend image.
- `make build-baileys`: Force rebuild of the Baileys microservice image.
- `make clean`: Stop and remove services/volumes (as in `down-v`), and prune Docker builder cache and dangling images.
- `make prune-docker`: **WARNING!** Aggressively prunes all unused Docker system data (containers, networks, images, build cache, AND VOLUMES not just from this project). Use with extreme caution.
- `make shell-nestjs`: Open a shell (`/bin/sh`) inside the running NestJS backend container.
- `make shell-baileys`: Open a shell (`/bin/sh`) inside the running Baileys microservice container.
- `make shell-surrealdb`: Connect to the SurrealDB SQL console inside its container.

**Typical Workflow:**
1. If you've pulled changes related to `baileys-microservice` or suspect lockfile issues, run `make setup-baileys-pnpm` and commit any changes to `pnpm-lock.yaml`.
2. Run `make up` to start the environment.
2. Check logs with `make logs` or `make logs-baileys` (for QR code).
3. Develop and test.
4. Run `make down` when finished.

(Add other sections to your README as needed: Features, Deployment, API Documentation, etc.)
