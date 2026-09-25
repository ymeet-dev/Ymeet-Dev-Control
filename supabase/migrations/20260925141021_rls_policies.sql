-- Ymeet Dev Control — Fase 1
-- RLS: habilitada em todas as tabelas. Papéis: admin, pm, developer, approver, viewer.

create function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.has_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and coalesce(public.current_profile_role(), '') <> 'admin' then
    raise exception 'apenas admin pode alterar role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select
  using (id = auth.uid() or public.current_profile_role() = 'admin');

create policy profiles_insert_self on public.profiles
  for insert
  with check (id = auth.uid() and role = 'viewer');

create policy profiles_update on public.profiles
  for update
  using (id = auth.uid() or public.current_profile_role() = 'admin')
  with check (id = auth.uid() or public.current_profile_role() = 'admin');

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

create policy projects_select on public.projects
  for select using (public.has_profile());

create policy projects_insert on public.projects
  for insert with check (public.current_profile_role() in ('admin', 'pm'));

create policy projects_update on public.projects
  for update
  using (public.current_profile_role() in ('admin', 'pm'))
  with check (public.current_profile_role() in ('admin', 'pm'));

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------
alter table public.agents enable row level security;

create policy agents_select on public.agents
  for select using (public.has_profile());

create policy agents_insert on public.agents
  for insert with check (public.current_profile_role() in ('admin', 'pm'));

create policy agents_update on public.agents
  for update
  using (public.current_profile_role() in ('admin', 'pm'))
  with check (public.current_profile_role() in ('admin', 'pm'));

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

-- Gate de aprovacao humana no banco (independe do role do ator): a maquina de
-- estados fixa (docs/architecture/fase-1-arquitetura.md) exige que
-- PENDING_APPROVAL -> APPROVED e READY_TO_PUBLISH -> PUBLISHED so ocorram com
-- decisao humana ja registrada em approvals. Bloqueia tanto o atalho de estado
-- (partir de outro estado) quanto a ausencia da aprovacao.
create function public.enforce_task_approval_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'APPROVED' and old.state is distinct from new.state then
    if old.state <> 'PENDING_APPROVAL' then
      raise exception 'transicao invalida: APPROVED so e permitido a partir de PENDING_APPROVAL';
    end if;
    if not exists (
      select 1 from public.approvals
      where task_id = new.id
        and approval_type = 'task_approval'
        and decision = 'approved'
    ) then
      raise exception 'transicao para APPROVED exige approvals.task_approval aprovado';
    end if;
  end if;

  if new.state = 'PUBLISHED' and old.state is distinct from new.state then
    if old.state <> 'READY_TO_PUBLISH' then
      raise exception 'transicao invalida: PUBLISHED so e permitido a partir de READY_TO_PUBLISH';
    end if;
    if not exists (
      select 1 from public.approvals
      where task_id = new.id
        and approval_type = 'publish_approval'
        and decision = 'approved'
    ) then
      raise exception 'transicao para PUBLISHED exige approvals.publish_approval aprovado';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_approval_gate
  before update on public.tasks
  for each row execute function public.enforce_task_approval_gate();

alter table public.tasks enable row level security;

create policy tasks_select on public.tasks
  for select using (public.has_profile());

create policy tasks_insert on public.tasks
  for insert with check (public.current_profile_role() in ('admin', 'pm'));

create policy tasks_update on public.tasks
  for update
  using (public.current_profile_role() in ('admin', 'pm', 'developer'))
  with check (public.current_profile_role() in ('admin', 'pm', 'developer'));

-- ---------------------------------------------------------------------------
-- task_versions (append-only: sem policy de update/delete)
-- ---------------------------------------------------------------------------
alter table public.task_versions enable row level security;

create policy task_versions_select on public.task_versions
  for select using (public.has_profile());

create policy task_versions_insert on public.task_versions
  for insert with check (public.current_profile_role() in ('admin', 'pm', 'developer'));

-- ---------------------------------------------------------------------------
-- task_dependencies
-- ---------------------------------------------------------------------------
alter table public.task_dependencies enable row level security;

create policy task_dependencies_select on public.task_dependencies
  for select using (public.has_profile());

create policy task_dependencies_insert on public.task_dependencies
  for insert with check (public.current_profile_role() in ('admin', 'pm'));

-- ---------------------------------------------------------------------------
-- task_state_transitions (append-only: sem policy de update/delete)
-- ---------------------------------------------------------------------------
alter table public.task_state_transitions enable row level security;

create policy task_state_transitions_select on public.task_state_transitions
  for select using (public.has_profile());

create policy task_state_transitions_insert on public.task_state_transitions
  for insert
  with check (public.current_profile_role() in ('admin', 'pm', 'developer', 'approver'));

-- ---------------------------------------------------------------------------
-- executions
-- ---------------------------------------------------------------------------
alter table public.executions enable row level security;

create policy executions_select on public.executions
  for select using (public.has_profile());

create policy executions_insert on public.executions
  for insert with check (public.current_profile_role() in ('admin', 'pm', 'developer'));

create policy executions_update on public.executions
  for update
  using (public.current_profile_role() in ('admin', 'pm', 'developer'))
  with check (public.current_profile_role() in ('admin', 'pm', 'developer'));

-- ---------------------------------------------------------------------------
-- reviews (append-only: sem policy de update/delete)
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy reviews_select on public.reviews
  for select using (public.has_profile());

create policy reviews_insert on public.reviews
  for insert with check (public.current_profile_role() in ('admin', 'pm', 'developer'));

-- ---------------------------------------------------------------------------
-- approvals — decisão (update) restrita a approver/admin: gate humano obrigatório
-- ---------------------------------------------------------------------------
alter table public.approvals enable row level security;

create policy approvals_select on public.approvals
  for select using (public.has_profile());

create policy approvals_insert on public.approvals
  for insert with check (public.current_profile_role() in ('admin', 'pm'));

create policy approvals_update_decision on public.approvals
  for update
  using (public.current_profile_role() in ('admin', 'approver'))
  with check (public.current_profile_role() in ('admin', 'approver'));

-- ---------------------------------------------------------------------------
-- logs (append-only: sem policy de update/delete)
-- ---------------------------------------------------------------------------
alter table public.logs enable row level security;

create policy logs_select on public.logs
  for select using (public.has_profile());

create policy logs_insert on public.logs
  for insert with check (public.has_profile());

-- ---------------------------------------------------------------------------
-- configurations
-- ---------------------------------------------------------------------------
alter table public.configurations enable row level security;

create policy configurations_select on public.configurations
  for select using (public.has_profile());

create policy configurations_insert on public.configurations
  for insert with check (public.current_profile_role() in ('admin', 'pm'));

create policy configurations_update on public.configurations
  for update
  using (public.current_profile_role() in ('admin', 'pm'))
  with check (public.current_profile_role() in ('admin', 'pm'));
