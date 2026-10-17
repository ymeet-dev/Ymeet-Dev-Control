-- Ymeet Dev Control — Fase 1
-- Fluxo de aprovações: fecha a lacuna identificada na auditoria (risco
-- MÉDIO) de que as regras "uma nova solicitação deve nascer pending" e
-- "approved/rejected bloqueiam nova solicitação do mesmo tipo" só
-- existiam na camada de aplicação (packages/database/src/approvalRules.ts,
-- getRequestableApprovalType) — um client autenticado como admin/pm,
-- chamando a API do Supabase direto (sem passar pela Server Action),
-- conseguiria contornar as duas.
--
-- Esta migration NÃO substitui nem enfraquece a migration anterior
-- (20261016150000_approvals_pending_unique_index.sql): o índice único
-- parcial continua sendo a garantia mais simples e correta para "no
-- máximo uma pending por (task_id, approval_type)" — não repetida aqui.
-- O que esta migration adiciona é o que um índice único não consegue
-- expressar: regras que dependem do VALOR da decisão sendo inserida/
-- atualizada e de olhar OUTRAS linhas da mesma combinação (task_id,
-- approval_type). As duas proteções se complementam: o índice garante
-- unicidade de forma barata e atômica para o caso mais simples (pending
-- duplicada); a trigger abaixo cobre os casos que exigem lógica
-- condicional entre linhas.
--
-- Nenhuma mudança em RLS, grants ou na máquina de estados de tasks.

-- ---------------------------------------------------------------------------
-- Pré-condições: dados existentes incompatíveis com as regras novas.
-- A pré-condição de "pending duplicada" já foi tratada na migration
-- anterior (e, uma vez aplicada, o próprio índice único já garante que
-- isso nunca mais ocorre) — não repetida aqui. As duas abaixo são novas,
-- específicas das regras que esta migration introduz. Nenhuma delas apaga,
-- altera ou consolida dado nenhum — só abortam com uma mensagem clara.
-- ---------------------------------------------------------------------------

do $$
declare
  v_dup_final integer;
  v_mixed integer;
begin
  -- (1) Mais de uma decisão final (approved/rejected) já registrada para a
  -- mesma (task_id, approval_type). A regra nova impede isso para qualquer
  -- inserção futura, mas dados assim já existentes merecem revisão manual
  -- antes de travar o comportamento daqui para frente.
  select count(*) into v_dup_final
  from (
    select task_id, approval_type
    from public.approvals
    where decision in ('approved', 'rejected')
    group by task_id, approval_type
    having count(*) > 1
  ) as duplicates;

  if v_dup_final > 0 then
    raise exception
      'Existem % combinacoes de (task_id, approval_type) com mais de uma decisao final (approved/rejected) ja registrada. Revise manualmente antes de aplicar esta migration.',
      v_dup_final;
  end if;

  -- (2) Uma solicitação pending coexistindo com uma decisão final já
  -- registrada para a mesma (task_id, approval_type) — exatamente o que a
  -- regra nova (Seção B) passa a impedir dali para frente.
  select count(*) into v_mixed
  from (
    select distinct a.task_id, a.approval_type
    from public.approvals a
    where a.decision = 'pending'
      and exists (
        select 1 from public.approvals b
        where b.task_id = a.task_id
          and b.approval_type = a.approval_type
          and b.decision in ('approved', 'rejected')
      )
  ) as mixed;

  if v_mixed > 0 then
    raise exception
      'Existem % combinacoes de (task_id, approval_type) com uma solicitacao pending coexistindo com uma decisao final ja registrada. Revise manualmente antes de aplicar esta migration.',
      v_mixed;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- enforce_approval_lifecycle — protege no banco o que a aplicação já
-- impunha, para que a garantia não dependa de quem chama passar pela
-- Server Action.
--
-- SECURITY DEFINER só para poder ler outras linhas de approvals de forma
-- confiável, independente da RLS do chamador — mesmo padrão já usado por
-- enforce_task_approval_gate (em tasks). RLS de approvals continua
-- intacta e continua sendo quem decide QUEM pode tentar a operação
-- (approvals_insert / approvals_update_decision, inalteradas); esta
-- trigger só decide O QUE é permitido uma vez que a RLS já deixou passar.
-- search_path fixo e toda referência qualificada por schema evitam
-- hijacking. EXECUTE revogado de PUBLIC abaixo, por padrão defensivo —
-- esta função só é chamada implicitamente pela trigger, nunca via RPC.
--
-- Trava de concorrência: pg_advisory_xact_lock, com chave derivada de
-- (task_id, approval_type) via hashtextextended, tomada no início da
-- trigger, antes de qualquer SELECT de verificação. Isso serializa, para a
-- MESMA combinação (task_id, approval_type), toda inserção nova e toda
-- decisão (UPDATE de pending para approved/rejected) entre si: uma segunda
-- transação concorrente para a mesma combinação bloqueia nessa chamada até
-- a primeira confirmar ou desfazer, e só então faz sua própria checagem —
-- vendo, nesse momento, o estado já definitivo (commitado). Isso fecha a
-- corrida descrita na tarefa: sem essa trava, um SELECT simples antes do
-- INSERT poderia não ver uma decisão sendo confirmada por outra transação
-- ao mesmo tempo (MVCC só revela o que já foi commitado no instante da
-- consulta, não o que está "em andamento" em outra transação). A trava é
-- por transação (pg_advisory_xact_lock) — libera sozinha no commit/
-- rollback, sem risco de ficar presa.
--
-- Risco de deadlock: cada transação que passa por aqui toma no máximo UMA
-- trava consultiva, sempre antes de qualquer outra operação própria desta
-- trigger, e nunca em conjunto com nenhuma trava de linha de outra tabela
-- nesta mesma trigger — não há ordem cruzada de travas que possa formar um
-- ciclo. Duas transações só podem colidir exatamente nesta trava, uma de
-- cada vez, nunca uma esperando a outra em travas diferentes.
create function public.enforce_approval_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint;
  v_final_exists boolean;
begin
  v_lock_key := hashtextextended(new.task_id::text || ':' || new.approval_type, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  if tg_op = 'INSERT' then
    if new.decision <> 'pending' then
      raise exception
        'aprovacao_deve_iniciar_pending: uma nova solicitacao de aprovacao deve comecar com decision = pending'
        using errcode = 'YM001';
    end if;

    select exists (
      select 1 from public.approvals
      where task_id = new.task_id
        and approval_type = new.approval_type
        and decision in ('approved', 'rejected')
    ) into v_final_exists;

    if v_final_exists then
      raise exception
        'aprovacao_final_ja_existe: ja existe uma decisao final (approved ou rejected) para este tipo de aprovacao nesta tarefa'
        using errcode = 'YM002';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.decision in ('approved', 'rejected') and new.decision is distinct from old.decision then
      raise exception
        'aprovacao_decisao_final_imutavel: uma decisao final (approved ou rejected) nao pode ser alterada'
        using errcode = 'YM003';
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_approval_lifecycle() from public;

create trigger approvals_enforce_lifecycle
  before insert or update on public.approvals
  for each row execute function public.enforce_approval_lifecycle();
