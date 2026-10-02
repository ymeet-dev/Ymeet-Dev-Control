import Link from 'next/link';
import type { ProjectRow, TaskRow } from 'database';
import { PriorityBadge } from './PriorityBadge';
import styles from './tasks.module.css';

export function TaskCard({ task, project }: { task: TaskRow; project: ProjectRow | undefined }) {
  return (
    <Link href={`/tasks/${task.id}`} className={styles.card}>
      <div className={styles.cardTitle}>{task.title}</div>
      <div className={styles.cardMeta}>
        <span>{project?.name ?? 'Projeto não encontrado'}</span>
        <PriorityBadge priority={task.priority} />
      </div>
    </Link>
  );
}
