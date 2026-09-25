# Ymeet Dev Control

Plataforma de orquestração de desenvolvimento assistido por agentes de IA.

## Objetivo

Permitir que ideias e tarefas de desenvolvimento sejam organizadas, executadas, auditadas e testadas por um fluxo controlado de agentes.

## Fluxo

MEYLA → PM → QUEUE → DEV → AUDIT → QA → APPROVAL → READY TO PUBLISH

## Estrutura

- `apps/web` — aplicação web (Next.js + TypeScript)
- `packages/database` — camada de banco de dados (client Supabase)
- `packages/shared` — código compartilhado
- `packages/types` — tipos compartilhados
- `services/orchestrator` — orquestrador do sistema (máquina de estados e fila)
- `docs` — documentação (ver `docs/architecture` para a arquitetura aprovada)
- `supabase` — configuração e migrações do Supabase
- `scripts` — scripts auxiliares

## Desenvolvimento

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## Status

Projeto em implementação — Fase 1 (base do projeto).
