-- Ymeet Dev Control — Fase 1
-- Mudança de estado das tarefas pela interface.
--
-- Decisão de arquitetura (ver auditoria de segurança da Fase 1, fase de
-- "mudança de estado das tarefas"): a validação do grafo de transições e o
-- registro do histórico não podem depender de qual caminho de escrita foi
-- usado (RPC, Server Action ou um UPDATE direto via API). A única garantia que
-- vale para todos os caminhos é uma trigger na própria tabela `tasks`, porque
-- não existe nenhuma forma de mudar `tasks.state` em Postgres que não seja uma
-- instrução UPDATE sobre essa tabela — e a trigger dispara para qualquer uma.
-- Por isso toda a validação nova entra dentro da trigger `enforce_task_approval_gate`
-- já existente (extensão aditiva, sem alterar o comportamento já em produção
-- para APPROVED/PUBLISHED), e não dentro da função `transition_task_state`
-- (que é só uma conveniência de API, sem privilégio nenhum).

-- ---------------------------------------------------------------------------
-- task_state_transition_rules — grafo estático de transições permitidas.
-- A saída de BLOCKED é a única transição dinâmica (validada contra o histórico
-- em task_state_transitions, não contra esta tabela) e por isso BLOCKED nunca
-- aparece aqui como origem.
-- ---------------------------------------------------------------------------
create table public.task_state_transition_rules (
  from_state text not null
    check (from_state in (
      'BACKLOG', 'QUEUED', 'IN_DEV', 'IN_AUDIT', 'IN_QA', 'PENDING_APPROVAL',
      'APPROVED', 'READY_TO_PUBLISH', 'PUBLISHED', 'CHANGES_REQUESTED',
      'BLOCKED', 'CANCELLED', 'REJECTED'
    )),
  to_state text not null
    check (to_state in (
      'BACKLOG', 'QUEUED', 'IN_DEV', 'IN_AUDIT', 'IN_QA', 'PENDING_APPROVAL',
      'APPROVED', 'READY_TO_PUBLISH', 'PUBLISHED', 'CHANGES_REQUESTED',
      'BLOCKED', 'CANCELLED', 'REJECTED'
    )),
  primary key (from_state, to_state)
);

insert into public.task_state_transition_rules (from_state, to_state) values
  ('BACKLOG', 'QUEUED'),
  ('QUEUED', 'IN_DEV'),
  ('IN_DEV', 'IN_AUDIT'),
  ('IN_AUDIT', 'IN_QA'),
  ('IN_QA', 'PENDING_APPROVAL'),
  ('PENDING_APPROVAL', 'APPROVED'),
  ('APPROVED', 'READY_TO_PUBLISH'),
  ('READY_TO_PUBLISH', 'PUBLISHED'),
  ('IN_AUDIT', 'CHANGES_REQUESTED'),
  ('IN_QA', 'CHANGES_REQUESTED'),
  ('CHANGES_REQUESTED', 'IN_DEV'),
  ('PENDING_APPROVAL', 'REJECTED'),
  ('IN_AUDIT', 'REJECTED'),
  ('IN_QA', 'REJECTED'),
  ('BACKLOG', 'BLOCKED'),
  ('QUEUED', 'BLOCKED'),
  ('IN_DEV', 'BLOCKED'),
  ('IN_AUDIT', 'BLOCKED'),
  ('IN_QA', 'BLOCKED'),
  ('PENDING_APPROVAL', 'BLOCKED'),
  ('READY_TO_PUBLISH', 'BLOCKED'),
  ('CHANGES_REQUESTED', 'BLOCKED'),
  ('BACKLOG', 'CANCELLED'),
  ('QUEUED', 'CANCELLED'),
  ('IN_DEV', 'CANCELLED'),
  ('IN_AUDIT', 'CANCELLED'),
  ('IN_QA', 'CANCELLED'),
  ('PENDING_APPROVAL', 'CANCELLED'),
  ('APPROVED', 'CANCELLED'),
  ('READY_TO_PUBLISH', 'CANCELLED'),
  ('CHANGES_REQUESTED', 'CANCELLED');

alter table public.task_state_transition_rules enable row level security;

create policy task_state_transition_rules_select on public.task_state_transition_rules
  for select using (public.has_profile());

-- Sem policy de insert/update/delete: a RLS nega por padrão. O revoke abaixo é
-- redundante com isso de propósito (defesa em profundidade) — só uma migration
-- (rodada fora dos papéis da aplicação) pode alterar o grafo.
revoke insert, update, delete on public.task_state_transition_rules from authenticated, anon;

-- ---------------------------------------------------------------------------
-- task_state_transitions — a partir de agora só a trigger grava aqui.
-- Fecha o bypass simétrico: sem isso, qualquer papel com insert direto poderia
-- fabricar uma linha de histórico sem nenhuma mudança real de tasks.state.
-- ---------------------------------------------------------------------------
drop policy if exists task_state_transitions_insert on public.task_state_transitions;
revoke insert, update, delete on public.task_state_transitions from authenticated, anon;

-- ---------------------------------------------------------------------------
-- enforce_task_approval_gate — estendida (aditivamente, mesma trigger já em
-- produção) para validar o grafo completo de transições, a saída de BLOCKED,
-- o motivo obrigatório e o papel do solicitante para BLOCKED/CANCELLED/REJECTED,
-- o novo gate de REJECTED a partir de PENDING_APPROVAL, e para gravar o
-- histórico na mesma transação do UPDATE. Os blocos de APPROVED e PUBLISHED já
-- existiam e mantêm exatamente a mesma lógica de antes — só passaram a viver
-- dentro do bloco comum "o estado mudou" em vez de repetir essa condição cada
-- um. Nenhuma regressão: qualquer UPDATE que já era aceito ou rejeitado antes
-- continua sendo aceito ou rejeitado da mesma forma.
--
-- Continua SECURITY DEFINER (como já era) só para poder ler approvals /
-- task_state_transitions / task_state_transition_rules de forma confiável,
-- independente da RLS do chamador, e gravar o histórico sem que a aplicação
-- precise de permissão de escrita nessa tabela. search_path fixo evita
-- hijacking; a identidade usada em toda decisão é sempre a real (auth.uid()
-- via current_profile_role()), nunca a do papel elevado da função.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_task_approval_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_reason text;
  v_blocked_origin text;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'BACKLOG' then
      raise exception 'transicao invalida: uma nova tarefa deve iniciar em BACKLOG';
    end if;
    return new;
  end if;

  if old.state is distinct from new.state then
    v_role := public.current_profile_role();

    -- O motivo chega por uma variável de configuração de transação
    -- (set_config(..., is_local => true), definida por transition_task_state),
    -- nunca por uma coluna de tasks nem por nada fornecido pelo navegador após
    -- a validação. Quem não passar por ali — nem setar essa config manualmente
    -- com um valor válido — simplesmente não tem motivo registrado, e cai no
    -- bloco de "motivo obrigatório" abaixo quando o destino exige motivo.
    v_reason := nullif(trim(coalesce(current_setting('app.task_transition_reason', true), '')), '');

    if old.state = 'BLOCKED' then
      select from_state into v_blocked_origin
        from public.task_state_transitions
        where task_id = new.id and to_state = 'BLOCKED'
        order by created_at desc
        limit 1;

      if v_blocked_origin is null or new.state <> v_blocked_origin then
        raise exception
          'transicao invalida: a saida de BLOCKED so e permitida para o estado de origem registrado no historico (%)',
          coalesce(v_blocked_origin, 'desconhecido');
      end if;
    else
      if not exists (
        select 1 from public.task_state_transition_rules
        where from_state = old.state and to_state = new.state
      ) then
        raise exception 'transicao invalida: % -> % nao e permitida', old.state, new.state;
      end if;
    end if;

    if new.state in ('BLOCKED', 'CANCELLED', 'REJECTED') then
      if v_reason is null then
        raise exception 'transicao para % exige motivo', new.state;
      end if;

      if coalesce(v_role, '') not in ('admin', 'pm') then
        raise exception 'apenas admin ou pm podem solicitar transicao para %', new.state;
      end if;
    end if;

    if new.state = 'APPROVED' then
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

    if new.state = 'PUBLISHED' then
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

    if new.state = 'REJECTED' and old.state = 'PENDING_APPROVAL' then
      if not exists (
        select 1 from public.approvals
        where task_id = new.id
          and approval_type = 'task_approval'
          and decision = 'rejected'
      ) then
        raise exception
          'transicao para REJECTED a partir de PENDING_APPROVAL exige approvals.task_approval rejeitado';
      end if;
    end if;

    insert into public.task_state_transitions
      (task_id, from_state, to_state, actor_type, actor_profile_id, reason)
    values
      (new.id, old.state, new.state, 'human', auth.uid(), v_reason);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- transition_task_state — função de conveniência para a aplicação.
--
-- Propositalmente SEM security definer (SECURITY INVOKER, o padrão): o UPDATE
-- abaixo roda com o privilégio do próprio chamador, sujeito à mesma policy
-- tasks_update de sempre (admin/pm/developer) — exatamente como um UPDATE
-- direto via API ficaria. Toda a validação de negócio real está na trigger
-- acima, que dispara igualmente para esta função ou para um UPDATE direto por
-- qualquer outro caminho. Esta função não é, por si só, a proteção contra
-- atalho — ela só evita que a aplicação precise montar o UPDATE manualmente e
-- dá um ponto único para traduzir erros.
-- ---------------------------------------------------------------------------
create function public.transition_task_state(
  p_task_id uuid,
  p_to_state text,
  p_reason text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_task public.tasks;
  v_reason text;
begin
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  perform set_config('app.task_transition_reason', coalesce(v_reason, ''), true);

  update public.tasks
    set state = p_to_state
    where id = p_task_id
    returning * into v_task;

  if not found then
    raise exception 'tarefa nao encontrada ou sem permissao para executar esta transicao';
  end if;

  return v_task;
end;
$$;

revoke all on function public.transition_task_state(uuid, text, text) from public;
grant execute on function public.transition_task_state(uuid, text, text) to authenticated;
