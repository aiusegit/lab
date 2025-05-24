# CRM Application Deployment Guide (Coolify)

This document outlines the deployment setup for the CRM application using Coolify on a self-managed VPS.

## 1. Platform
- **Orchestration:** Coolify (self-hosted)
- **VPS Provider:** User's choice (e.g., DigitalOcean, Linode, Hetzner)
- **Recommended VPS Specs:** Ubuntu 22.04 LTS, 2-4 vCPU, 4-8GB RAM, 50-80GB SSD.

## 2. Deployed Services & Configuration Overview

All services are deployed as Docker containers managed by Coolify. Coolify handles reverse proxying (via Traefik), HTTPS (via Let's Encrypt), and service discovery within its Docker networks.

| Service               | Component            | Deployed Via Coolify As | Key Config / Notes                                                                                                                               |
|-----------------------|----------------------|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| **Database**          | SurrealDB            | Database Service or Docker Image | Persisted data volume managed by Coolify. Master NS: `saas_platform`, DB: `tenants_db`. Credentials set via Coolify secrets/env.             |
| **Backend API**       | NestJS               | Application (Dockerfile)| Git source. Env vars for DB, Baileys Svc URL, AG-UI Proxy URL, JWT, API keys. Public URL via Coolify domain.                                   |
| **WhatsApp Service**  | Baileys Microservice | Application (Dockerfile)| Git source. Env vars for NestJS Webhook URL, API keys, Session Path. Persistent volume for `/app/whatsapp_sessions/baileys_auth_state`.         |
| **Real-time Proxy**   | AG-UI Proxy          | Application (Dockerfile)| Git source. Env vars for Port. Public URL via Coolify domain.                                                                                  |
| **Frontend**          | Astro/SvelteKit      | Application (Buildpack/Static) | Git source. Build commands (`npm run build`), publish dir (`dist`). Env vars for Backend URL, AG-UI Proxy URL. Public URL via Coolify domain. |

## 3. Access URLs (Examples - Replace with actuals after deployment)
- **Frontend:** `https://crm.yourcoolifydomain.com`
- **NestJS API:** `https://api.yourcoolifydomain.com`
- **AG-UI Proxy:** `https://agui.yourcoolifydomain.com` (or `wss://...` if WebSocket based)
- **Baileys Status (if exposed):** `https://baileys-status.yourcoolifydomain.com`

## 4. Environment Variable Management
- All sensitive information (API keys, JWT secrets, DB credentials) is managed as environment variables within Coolify for each service.
- Refer to individual `.env.example` files in service directories for a full list of required variables.

## 5. Baileys WhatsApp Linking
- After the `crm-baileys-service` is deployed, its logs must be checked via the Coolify UI to retrieve the QR code for linking with a WhatsApp account.
- Session data is persisted in a volume managed by Coolify.

## 6. Advanced Security (Future Phase)
- The current MVP deployment relies on HTTPS, SurrealDB's native security, API keys for internal services, and JWTs for user authentication.
- Advanced components like SPIRE, OPA, and Kuma Service Mesh are planned for a future hardening phase. Their integration will require careful network and policy configuration within the Coolify-managed Docker environment.

## 7. Local Development
- A `docker-compose.yml` file is provided in the project root for a consistent local development environment that mirrors the deployed services.
