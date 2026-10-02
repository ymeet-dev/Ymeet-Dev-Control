import styles from './tasks.module.css';

/**
 * O schema não define faixas/labels de prioridade (é um integer livre em
 * tasks.priority) — exibimos o valor bruto para não inventar uma escala.
 */
export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={styles.priority} title="Prioridade (tasks.priority)">
      P{priority}
    </span>
  );
}
