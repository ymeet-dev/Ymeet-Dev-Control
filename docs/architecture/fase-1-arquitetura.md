# Arquitetura — Fase 1 (Consolidada)

> Status: aprovada. Base para a implementação em andamento.

## Stack

| Item | Decisão |
|---|---|
| Frontend | Next.js + TypeScript |
| Monorepo | npm workspaces (sem Turborepo/Nx/pnpm) |
| Backend/Orquestrador (Fase 1) | Lógica em `services/orchestrator`, executada via Supabase Edge Functions quando necessário — sem servidor Node persistente |
| Banco | Supabase/Postgres |
| Autenticação | Supabase Auth |
| Autorização | RLS, desde a primeira migration |
| Testes | Vitest |
| Lint/Format | ESLint + Prettier |
| CI/CD | GitHub Actions (lint, typecheck, test, build) |
| Deploy frontend | Netlify (Deploy Previews por PR) |

## Entidades/Tabelas (Fase 1 — a criar)

`profiles`, `projects`, `tasks`, `task_state_transitions`, `task_versions`, `task_dependencies`,
`agents`, `executions`, `reviews`, `approvals`, `logs`, `configurations`.

Padrão de histórico: entidades append-only (`task_versions`, `executions`, `reviews`, `approvals`) são
seu próprio histórico; mudanças de campos mutáveis (`status`, `config`) vão para `logs` ou
`task_state_transitions`.

## Máquina de Estados da Tarefa

```
BACKLOG → QUEUED → IN_DEV → IN_AUDIT → IN_QA → PENDING_APPROVAL → APPROVED → READY_TO_PUBLISH → PUBLISHED
                       ↑         │         │
                       └─── CHANGES_REQUESTED
              (qualquer estado) → BLOCKED / CANCELLED / REJECTED
```

Estados: `BACKLOG`, `QUEUED`, `IN_DEV`, `IN_AUDIT`, `IN_QA`, `PENDING_APPROVAL`, `APPROVED`,
`READY_TO_PUBLISH`, `PUBLISHED`, `CHANGES_REQUESTED`, `BLOCKED`, `CANCELLED`, `REJECTED`.

Regra fixa: `PENDING_APPROVAL → APPROVED/REJECTED` e `READY_TO_PUBLISH → PUBLISHED` sempre exigem
ação humana explícita. Nenhum agente aprova a si mesmo nem publica.

Na Fase 1, `IN_AUDIT` roda apenas checks automáticos básicos (lint, typecheck, testes) — sem agente
AUDIT autônomo — com revisão humana pontual opcional antes de avançar para `IN_QA`.

## Segurança / RLS

- Supabase Auth para humanos; agentes não têm conta de usuário.
- Papéis em `profiles.role` (`admin`, `pm`, `developer`, `approver`, `viewer`), aplicados via RLS.
- RLS habilitado desde a primeira migration, em todas as tabelas.
- Secrets nunca no repositório (`.env.example` documenta variáveis necessárias).
- Soft-delete é o padrão para operações destrutivas; `DELETE` físico só com autorização explícita;
  toda operação destrutiva gera registro em `logs`.

## Git

- `main` protegida, sem push direto; merge só via PR revisado.
- Sem `develop` nesta fase.
- Branch por tarefa: `task/<task-id>-<slug>`.
- Merge exige CI verde (lint, typecheck, test).

## Ambientes

| Ambiente | Frontend | Banco |
|---|---|---|
| Local | `next dev` | Supabase local quando necessário |
| Preview | Netlify Deploy Preview por PR | Projeto Supabase de Staging |
| Staging | Netlify branch deploy dedicado | Projeto Supabase de Staging (dedicado) |
| Production | Netlify production deploy a partir de `main` | Projeto Supabase de Production (dedicado, sem branching) |

## Fluxo de Aprovação

Ação **"Publicar em produção"** no painel, disponível apenas em `READY_TO_PUBLISH`, exigindo
aprovação humana obrigatória (`approvals.approval_type = publish_approval`). Nenhum agente aciona
essa ação.

## Fluxo Futuro dos Agentes

```
MEYLA → PM → FILA → DEV → AUDIT → QA → APROVAÇÃO → PRONTO PARA PUBLICAR
```

Cada estágio corresponde a um registro em `agents` e a uma transição de estado já modelada acima.
Na Fase 1, humanos ocupam manualmente os papéis nas mesmas tabelas — a estrutura não muda quando
cada agente real for plugado.

## Roadmap

- **Fase 1**: base do projeto, schema do banco, máquina de estados, auth, painel básico, checks
  automáticos de AUDIT, CI/CD mínimo, ambientes definidos.
- **Fase 2**: integração do Claude Code como agente DEV.
- **Fase 3**: automação do agente AUDIT.
- **Fase 4**: QA automatizado/agente.
- **Fase 5**: orquestração completa (MEYLA/PM automatizados); aprovação humana final permanece
  obrigatória.
