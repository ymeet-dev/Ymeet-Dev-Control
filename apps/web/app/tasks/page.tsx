import { TaskBoard } from '../../components/tasks/TaskBoard';
import { getTaskBoardData } from '../../lib/tasks/data';

export default async function TasksPage() {
  const { tasks, projectsById } = await getTaskBoardData();

  return (
    <>
      <h1>Painel de Tarefas</h1>
      <p>
        {tasks.length} tarefa{tasks.length === 1 ? '' : 's'}, organizadas por estado.
      </p>
      <TaskBoard tasks={tasks} projectsById={projectsById} />
    </>
  );
}
