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

### Makefile Commands

A `Makefile` is provided at the project root to manage common Docker Compose operations:

- `make help`: Display all available commands and their descriptions.
- `make up` or `make start`: Start all services (NestJS backend, Baileys microservice, SurrealDB) in detached mode. Builds images if they don't exist or if Dockerfiles changed.
- `make down` or `make stop`: Stop and remove all running services.
- `make down-v`: Stop and remove services AND their Docker volumes (e.g., SurrealDB data, Baileys session files - USE WITH CAUTION).
- `make restart`: Restart all services.
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
1. Run `make up` to start the environment.
2. Check logs with `make logs` or `make logs-baileys` (for QR code).
3. Develop and test.
4. Run `make down` when finished.

(Add other sections to your README as needed: Features, Deployment, API Documentation, etc.)
