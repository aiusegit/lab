# Requisitos do Sistema

## Visão Geral
- Sistema web multitenant, escalável e seguro, priorizando frameworks JavaScript/TypeScript.
- Banco de dados: **SurrealDB** (multi-model: documento, grafo, chave-valor, vetor, séries temporais).
- Interação agente-usuário: **AG-UI Protocol** via **CopilotKit**.
- Backend: **NestJS** (TypeScript) com arquitetura hexagonal, APIs REST/WebSocket.
- Frontend: **Astro** com **SvelteKit**, **TailwindCSS**, **WebRTC/WebSockets**.
- Segurança: **SPIRE**, **OPA**, mTLS via **Kuma**, SurrealDB JWT.
- Observabilidade: **Grafana**, **Prometheus**, **Tempo**, **Loki** com métricas NestJS/AG-UI.
- Integrações: **GeminiKit**, **Baileys** (WhatsApp), **Meta SDKs**, **MCP servers**.
- CI/CD: **Docker Compose**, **Makefile** com linting JS e backups SurrealDB.
- Configurações: Todas as variáveis de ambiente centralizadas em `.env`, carregadas via dotenv.
- Protocolos: **AG-UI** (agente-usuário), **MCP** (contexto de IA), **A2A** (agente-agente).

### Aplicações Principais
- **Plataforma SaaS Multitenant:** A plataforma é projetada para hospedar múltiplas aplicações de software como serviço (apps).
- **Primeira Aplicação: CRM (Customer Relationship Management):**
    - **Objetivo:** Fornecer uma solução completa para gestão de relacionamento com o cliente, integrada com ferramentas de comunicação.
    - **Funcionalidades Base:**
        - Gestão de Contatos (leads, clientes).
        - Gestão de Empresas/Contas.
        - Gestão de Negócios/Oportunidades.
        - Gestão de Tarefas e Atividades.
    - **Kanban Board:**
        - Visualização e gestão de negócios/oportunidades através de estágios configuráveis em um quadro Kanban.
        - Funcionalidade de arrastar e soltar para mudança de estágios.
    - **Funil de Vendas:**
        - Definição e acompanhamento de negócios através de múltiplos estágios de um funil de vendas customizável.
    - **Integração com WhatsApp:**
        - Utilização da biblioteca **Baileys** para conexão direta com a plataforma WhatsApp.
        - Capacidade de enviar e receber mensagens, automatizar respostas e rastrear interações com usuários/leads no funil de vendas.
        - Potencial integração com **Chatwoot** como interface de atendimento centralizada para conversas do WhatsApp, conectada ao Baileys e ao CRM.
    - **Tecnologia:**
        - Construído como um módulo principal dentro da arquitetura NestJS existente.
        - Utiliza SurrealDB para persistência de dados, com isolamento multitenant (namespaces e databases dedicados por tenant) para todas as entidades do CRM.

## Requisitos Técnicos
- **Multitenancy**:
    - Isolamento via namespaces/databases no SurrealDB para dados globais da plataforma e para cada tenant.
    - Mecanismos no backend NestJS para provisionamento de tenants e roteamento de requisições para o contexto de banco de dados correto do tenant.
- **Escalabilidade**: Kuma para roteamento, cluster SurrealDB.
- **Segurança**: JWT no SurrealDB, proxy seguro AG-UI, políticas OPA, mTLS.
- **AG-UI**: Suporte a LangGraph.js, CrewAI, Mastra; eventos via WebSockets/SSE.
- **IA**: GeminiKit com SurrealDB vector e MCP servers.
- **Observabilidade**: Métricas customizadas para NestJS, SurrealDB, AG-UI.
- **Configurações**: Centralizadas em `.env` (e.g., SURREALDB_URL, JWT_SECRET).
- **CRM Específico:**
    - Modelagem de dados detalhada no SurrealDB para as entidades do CRM: `contacts`, `companies` (ou `accounts`), `deals` (ou `opportunities`), `tasks`, `kanban_columns`, `sales_funnel_stages` (ou `deal_stages`), `whatsapp_messages`, etc., dentro de cada banco de dados do tenant.
    - APIs RESTful robustas no NestJS para todas as funcionalidades do CRM, incluindo operações CRUD, lógica de Kanban (movimentação de cards, atualização de status) e gestão do funil de vendas.
    - Lógica de negócios para a movimentação de cards no Kanban, transições de estágio no funil e regras de automação associadas.
    - Integração com Baileys para troca de mensagens e Chatwoot (opcional) para interface de atendimento.

## Links de Documentação
- AG-UI: https://docs.ag-ui.com/introduction
- CopilotKit: https://docs.copilotkit.ai/
- SurrealDB: https://surrealdb.com/docs
- NestJS: https://docs.nestjs.com/
- Baileys: https://github.com/WhiskeySockets/Baileys
- Chatwoot: https://www.chatwoot.com/docs
- [Consulte JSON de recursos]
