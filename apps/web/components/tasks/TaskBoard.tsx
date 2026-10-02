import type { ProjectRow, TaskRow } from 'database';
import { TASK_STATE_LABELS, TASK_STATE_ORDER } from '../../lib/tasks/state';
import { TaskCard } from './TaskCard';
import styles from './tasks.module.css';

export function TaskBoard({ tasks, projectsById }: { tasks: TaskRow[]; projectsById: Map<string, ProjectRow> }) {
  const tasksByState = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const column = tasksByState.get(task.state) ?? [];
    column.push(task);
    tasksByState.set(task.state, column);
  }

  return (
    <div className={styles.board}>
      {TASK_STATE_ORDER.map((state) => {
        const columnTasks = tasksByState.get(state) ?? [];

        return (
          <div key={state} className={styles.column}>
            <div className={styles.columnHeader}>
              <span>{TASK_STATE_LABELS[state]}</span>
              <span className={styles.columnCount}>{columnTasks.length}</span>
            </div>
            {columnTasks.length === 0 ? (
              <p className={styles.columnEmpty}>Sem tarefas</p>
            ) : (
              columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} project={projectsById.get(task.project_id)} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
