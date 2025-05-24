# Makefile for Local Development Automation

.PHONY: help up down down-v restart logs logs-nestjs logs-baileys logs-surrealdb ps config build build-nestjs build-baileys clean prune-docker shell-nestjs shell-baileys shell-surrealdb default

# Variables (service names from docker-compose.yml)
NESTJS_SERVICE_NAME := nestjs_backend
BAILEYS_SERVICE_NAME := baileys_microservice
SURREALDB_SERVICE_NAME := surrealdb

help: ## Display this help screen
	@echo "Makefile for Local Development Automation"
	@echo "----------------------------------------"
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Environment Management
up: ## Start all services in detached mode (builds images if necessary)
	@echo "Starting all services via Docker Compose (detached, auto-build)..."
	docker-compose up -d --remove-orphans --build

start: up ## Alias for 'up'

down: ## Stop and remove all services
	@echo "Stopping all services via Docker Compose..."
	docker-compose down

stop: down ## Alias for 'down'

down-v: ## Stop and remove all services and their volumes (USE WITH CAUTION!)
	@echo "Stopping all services and removing volumes via Docker Compose..."
	docker-compose down -v

restart: ## Restart all services
	@echo "Restarting all services..."
	$(MAKE) down
	$(MAKE) up

# Logs
logs: ## Follow logs for all services
	docker-compose logs -f --tail=100

logs-nestjs: ## Follow logs for the NestJS backend service
	docker-compose logs -f --tail=100 $(NESTJS_SERVICE_NAME)

logs-baileys: ## Follow logs for the Baileys microservice
	docker-compose logs -f --tail=100 $(BAILEYS_SERVICE_NAME)

logs-surrealdb: ## Follow logs for the SurrealDB service
	docker-compose logs -f --tail=100 $(SURREALDB_SERVICE_NAME)

# Status & Info
ps: ## Show status of running Docker Compose services
	docker-compose ps

config: ## Validate and view the effective Docker Compose configuration
	docker-compose config

# Build Management
build: ## Force a rebuild of all service images without cache
	@echo "Forcing rebuild of all service images without cache..."
	docker-compose build --no-cache

build-nestjs: ## Rebuild the NestJS backend service image without cache
	@echo "Rebuilding NestJS backend service image without cache..."
	docker-compose build --no-cache $(NESTJS_SERVICE_NAME)

build-baileys: ## Rebuild the Baileys microservice image without cache
	@echo "Rebuilding Baileys microservice image without cache..."
	docker-compose build --no-cache $(BAILEYS_SERVICE_NAME)

# Utility/Cleaning
clean: ## Stop containers, remove named volumes from compose, and prune builder/dangling images
	@echo "Cleaning up Docker Compose environment (containers, volumes from compose, builder cache, dangling images)..."
	$(MAKE) down-v
	docker builder prune -af
	docker image prune -af

prune-docker: ## WARNING! Remove ALL unused Docker data (containers, networks, images, build cache, VOLUMES)
	@echo "WARNING! This will remove all unused Docker data, including volumes not defined in docker-compose.yml."
	@read -p "Are you sure you want to continue? (y/N) " -n 1 -r REPLY; 	echo ; 	if [[ $$REPLY =~ ^[Yy]$$ ]]; then 		docker system prune -af --volumes; 		echo "Docker system pruned."; 	else 		echo "Prune cancelled."; 	fi

# Shell Access
shell-nestjs: ## Get a shell into the running NestJS backend container
	docker-compose exec $(NESTJS_SERVICE_NAME) /bin/sh

shell-baileys: ## Get a shell into the running Baileys microservice container
	docker-compose exec $(BAILEYS_SERVICE_NAME) /bin/sh

shell-surrealdb: ## Connect to SurrealDB SQL console in the container (saas_platform.tenants_db)
	@echo "Connecting to SurrealDB instance: ws://localhost:8000, User: root, Pass: root, NS: saas_platform, DB: tenants_db"
	docker-compose exec $(SURREALDB_SERVICE_NAME) /surreal sql -e ws://localhost:8000 -u root -p root --db tenants_db --ns saas_platform --pretty

# Default target
default: help
