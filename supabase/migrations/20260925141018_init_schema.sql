-- Ymeet Dev Control — Fase 1
-- Schema inicial: profiles, projects, agents, tasks, task_versions, task_dependencies,
-- task_state_transitions, executions, reviews, approvals, logs, configurations.

create extension if not exists "pgcrypto";

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('admin', 'pm', 'developer', 'approver', 'viewer')),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  repository_url text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  owner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- agents — catálogo de papéis do pipeline (MEYLA, PM, DEV, AUDIT, QA)
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code in ('MEYLA', 'PM', 'DEV', 'AUDIT', 'QA')),
  name text not null,
  description text,
  type text not null default 'human'
    check (type in ('human', 'ai')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  state text not null default 'BACKLOG'
    check (state in (
      'BACKLOG', 'QUEUED', 'IN_DEV', 'IN_AUDIT', 'IN_QA', 'PENDING_APPROVAL',
      'APPROVED', 'READY_TO_PUBLISH', 'PUBLISHED', 'CHANGES_REQUESTED',
      'BLOCKED', 'CANCELLED', 'REJECTED'
    )),
  priority integer not null default 0,
  current_version_id uuid,
  assigned_agent_id uuid references public.agents (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_state_idx on public.tasks (state);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- task_versions
-- ---------------------------------------------------------------------------
create table public.task_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  version_number integer not null,
  spec jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (task_id, version_number)
);

create index task_versions_task_id_idx on public.task_versions (task_id);

alter table public.tasks
  add constraint tasks_current_version_id_fkey
  foreign key (current_version_id) references public.task_versions (id);

-- ---------------------------------------------------------------------------
-- task_dependencies
-- ---------------------------------------------------------------------------
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  dependency_type text not null default 'blocks'
    check (dependency_type in ('blocks', 'relates_to')),
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index task_dependencies_task_id_idx on public.task_dependencies (task_id);
create index task_dependencies_depends_on_task_id_idx
  on public.task_dependencies (depends_on_task_id);

-- ---------------------------------------------------------------------------
-- task_state_transitions — histórico append-only de mudança de estado
-- ---------------------------------------------------------------------------
create table public.task_state_transitions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_state text,
  to_state text not null,
  actor_type text not null
    check (actor_type in ('human', 'agent', 'system')),
  actor_profile_id uuid references public.profiles (id),
  actor_agent_id uuid references public.agents (id),
  reason text,
  created_at timestamptz not null default now(),
  check (
    (actor_type = 'system' and actor_profile_id is null and actor_agent_id is null)
    or (actor_type = 'human' and actor_profile_id is not null and actor_agent_id is null)
    or (actor_type = 'agent' and actor_agent_id is not null and actor_profile_id is null)
  )
);

create index task_state_transitions_task_id_idx on public.task_state_transitions (task_id);

-- ---------------------------------------------------------------------------
-- executions — uma execução de um agente sobre uma versão de tarefa
-- ---------------------------------------------------------------------------
create table public.executions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  task_version_id uuid not null references public.task_versions (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  branch_name text,
  commit_sha text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index executions_task_id_idx on public.executions (task_id);
create index executions_task_version_id_idx on public.executions (task_version_id);

-- ---------------------------------------------------------------------------
-- reviews — resultado de AUDIT/QA sobre uma execução
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  review_type text not null
    check (review_type in ('audit', 'qa')),
  reviewer_agent_id uuid references public.agents (id),
  reviewer_profile_id uuid references public.profiles (id),
  result text not null
    check (result in ('approved', 'changes_requested', 'rejected')),
  comments text,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (reviewer_agent_id is not null or reviewer_profile_id is not null)
);

create index reviews_execution_id_idx on public.reviews (execution_id);
create index reviews_task_id_idx on public.reviews (task_id);

-- ---------------------------------------------------------------------------
-- approvals — gate humano obrigatório
-- ---------------------------------------------------------------------------
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  approval_type text not null
    check (approval_type in ('task_approval', 'publish_approval', 'destructive_op')),
  requested_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'rejected')),
  decision_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create index approvals_task_id_idx on public.approvals (task_id);

-- ---------------------------------------------------------------------------
-- logs — auditoria genérica de todo o sistema
-- ---------------------------------------------------------------------------
create table public.logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  actor_type text not null
    check (actor_type in ('human', 'agent', 'system')),
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index logs_entity_idx on public.logs (entity_type, entity_id);
create index logs_created_at_idx on public.logs (created_at);

-- ---------------------------------------------------------------------------
-- configurations
-- ---------------------------------------------------------------------------
create table public.configurations (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global'
    check (scope in ('global', 'project')),
  project_id uuid references public.projects (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'global' and project_id is null)
    or (scope = 'project' and project_id is not null)
  )
);

-- unique(scope, project_id, key) nao funciona para linhas globais: em Postgres,
-- NULL nunca e igual a NULL em constraints UNIQUE, entao project_id=null nunca colidia.
-- Indices parciais tratam scope global e scope por projeto separadamente.
create unique index configurations_global_key_idx
  on public.configurations (key)
  where scope = 'global' and project_id is null;

create unique index configurations_project_key_idx
  on public.configurations (project_id, key)
  where scope = 'project' and project_id is not null;

create trigger set_configurations_updated_at
  before update on public.configurations
  for each row execute function public.set_updated_at();
