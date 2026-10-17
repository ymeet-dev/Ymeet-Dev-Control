-- Ymeet Dev Control — Fase 1
-- Fluxo de aprovações: garante no banco que não existam duas aprovações
-- `pending` para a mesma combinação (task_id, approval_type).
--
-- A camada de aplicação (packages/database/src/approvalRules.ts,
-- getRequestableApprovalType) já decide se uma nova solicitação é válida
-- antes de tentar o INSERT, mas essa decisão depende de um SELECT anterior
-- — duas requisições concorrentes podem ambas ler "não existe pending"
-- antes de qualquer uma delas confirmar o INSERT, resultando em duas
-- linhas pending para o mesmo (task_id, approval_type). Só o banco pode
-- impedir isso de forma confiável.
--
-- Índice único parcial: aplica-se só a linhas com decision = 'pending' —
-- 'approved'/'rejected' são histórico imutável e não colidem da mesma
-- forma entre si. Uma segunda tentativa de INSERT que violar isso falha
-- com o erro 23505 do Postgres; o nome da constraint
-- ("approvals_one_pending_per_task_type") é usado em
-- packages/database/src/approvalErrors.ts para reconhecer especificamente
-- essa violação (não qualquer 23505) e dar uma mensagem clara, sem expor o
-- erro bruto do banco.
--
-- Pré-condição: se já existir alguma duplicata pending hoje, a migration
-- falha explicitamente, sem apagar, consolidar ou alterar nenhuma linha —
-- quem aplicar precisa resolver manualmente antes de tentar de novo.
-- Nenhuma mudança em RLS, grants, triggers ou na máquina de estados.

do $$
declare
  v_duplicate_count integer;
begin
  select count(*) into v_duplicate_count
  from (
    select task_id, approval_type
    from public.approvals
    where decision = 'pending'
    group by task_id, approval_type
    having count(*) > 1
  ) as duplicates;

  if v_duplicate_count > 0 then
    raise exception
      'Existem % combinacoes de (task_id, approval_type) com mais de uma aprovacao pending. Resolva manualmente antes de aplicar approvals_one_pending_per_task_type.',
      v_duplicate_count;
  end if;
end;
$$;

create unique index approvals_one_pending_per_task_type
  on public.approvals (task_id, approval_type)
  where decision = 'pending';
