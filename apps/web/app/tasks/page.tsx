import Link from 'next/link';
import { TaskBoard } from '../../components/tasks/TaskBoard';
import { getCurrentUser } from '../../lib/auth/get-current-user';
import { hasRole } from '../../lib/auth/permissions';
import { getTaskBoardData } from '../../lib/tasks/data';

export default async function TasksPage() {
  const [{ tasks, projectsById }, currentUser] = await Promise.all([getTaskBoardData(), getCurrentUser()]);

  return (
    <>
      <h1>Painel de Tarefas</h1>
      <p>
        {tasks.length} tarefa{tasks.length === 1 ? '' : 's'}, organizadas por estado.
        {hasRole(currentUser?.role, ['admin', 'pm']) ? (
          <>
            {' · '}
            <Link href="/tasks/new">Nova tarefa</Link>
          </>
        ) : null}
      </p>
      <TaskBoard tasks={tasks} projectsById={projectsById} />
    </>
  );
}
