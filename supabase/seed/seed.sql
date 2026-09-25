-- Catálogo inicial de agentes do pipeline (Fase 1: todos "human" — humanos ocupam o papel
-- manualmente até a automação real chegar, conforme o roadmap).

insert into public.agents (code, name, description, type, enabled) values
  ('MEYLA', 'MEYLA', 'Intake e triagem de ideias/tarefas', 'human', true),
  ('PM', 'PM', 'Refinamento de escopo e priorização da fila', 'human', true),
  ('DEV', 'DEV', 'Implementação da tarefa', 'human', true),
  ('AUDIT', 'AUDIT', 'Revisão técnica (lint/typecheck/testes)', 'human', true),
  ('QA', 'QA', 'Validação funcional contra os critérios de aceite', 'human', true)
on conflict (code) do nothing;
