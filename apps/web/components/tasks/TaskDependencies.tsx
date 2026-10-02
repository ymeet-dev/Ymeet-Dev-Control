import Link from 'next/link';
import type { TaskDependencyRow, TaskRow } from 'database';
import styles from './tasks.module.css';

const DEPENDENCY_TYPE_LABELS: Record<TaskDependencyRow['dependency_type'], string> = {
  blocks: 'Bloqueia',
  relates_to: 'Relaciona-se com',
};

export function TaskDependencies({
  dependencies,
  dependsOnTasksById,
}: {
  dependencies: TaskDependencyRow[];
  dependsOnTasksById: Map<string, TaskRow>;
}) {
  if (dependencies.length === 0) {
    return <p className={styles.note}>Esta tarefa não tem dependências registradas.</p>;
  }

  return (
    <ul className={styles.list}>
      {dependencies.map((dependency) => {
        const dependsOnTask = dependsOnTasksById.get(dependency.depends_on_task_id);

        return (
          <li key={dependency.id} className={styles.listItem}>
            {DEPENDENCY_TYPE_LABELS[dependency.dependency_type]}:{' '}
            {dependsOnTask ? (
              <Link href={`/tasks/${dependsOnTask.id}`}>{dependsOnTask.title}</Link>
            ) : (
              <span>tarefa {dependency.depends_on_task_id} (não encontrada)</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
