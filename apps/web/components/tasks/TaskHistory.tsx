import type { TaskStateTransitionRow } from 'database';
import styles from './tasks.module.css';

const ACTOR_TYPE_LABELS: Record<TaskStateTransitionRow['actor_type'], string> = {
  human: 'Humano',
  agent: 'Agente',
  system: 'Sistema',
};

/**
 * Estrutura inicial do histórico: lista task_state_transitions em ordem
 * cronológica reversa. Não resolve nomes de profile/agent a partir do id
 * (fica para uma próxima iteração) — mostra apenas o tipo de ator.
 */
export function TaskHistory({ history }: { history: TaskStateTransitionRow[] }) {
  if (history.length === 0) {
    return <p className={styles.note}>Nenhuma transição de estado registrada ainda para esta tarefa.</p>;
  }

  return (
    <ul className={styles.list}>
      {history.map((entry) => (
        <li key={entry.id} className={styles.listItem}>
          <strong>{entry.from_state ?? '—'}</strong> → <strong>{entry.to_state}</strong>
          <br />
          {new Date(entry.created_at).toLocaleString('pt-BR')} · {ACTOR_TYPE_LABELS[entry.actor_type]}
          {entry.reason ? <> · {entry.reason}</> : null}
        </li>
      ))}
    </ul>
  );
}
