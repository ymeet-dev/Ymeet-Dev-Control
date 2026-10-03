import Link from 'next/link';
import { listProjects, listTasks } from 'database';
import { getCurrentUser } from '../../../lib/auth/get-current-user';
import { hasRole } from '../../../lib/auth/permissions';
import { getServerSupabaseClient } from '../../../lib/supabase/server';
import styles from '../../../components/tasks/tasks.module.css';
import { createTaskAction } from './actions';

interface NewTaskPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const { error } = await searchParams;
  const currentUser = await getCurrentUser();

  if (!hasRole(currentUser?.role, ['admin', 'pm'])) {
    return (
      <>
        <p>
          <Link href="/tasks">&larr; Voltar ao painel</Link>
        </p>
        <h1>Nova tarefa</h1>
        <p role="alert" className={styles.errorBanner}>
          Seu papel ({currentUser?.role ?? 'desconhecido'}) não tem permissão para criar tarefas — a policy
          tasks_insert libera apenas admin/pm.
        </p>
      </>
    );
  }

  const supabase = await getServerSupabaseClient();
  const [projects, tasks] = await Promise.all([listProjects(supabase), listTasks(supabase)]);

  return (
    <>
      <p>
        <Link href="/tasks">&larr; Voltar ao painel</Link>
      </p>
      <h1>Nova tarefa</h1>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      {projects.length === 0 ? (
        <p className={styles.note}>Nenhum projeto cadastrado ainda — crie um projeto antes de criar tarefas.</p>
      ) : (
        <form action={createTaskAction} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="project_id">Projeto</label>
            <select id="project_id" name="project_id" required defaultValue="">
              <option value="" disabled>
                Selecione um projeto
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="title">Título</label>
            <input id="title" name="title" type="text" required maxLength={500} />
          </div>

          <div className={styles.field}>
            <label htmlFor="priority">Prioridade</label>
            <input id="priority" name="priority" type="number" defaultValue={0} step={1} />
          </div>

          <p className={styles.note}>Toda tarefa nova começa em Backlog — não é possível escolher outro estado.</p>

          {tasks.length > 0 ? (
            <>
              <div className={styles.field}>
                <label htmlFor="blocks">Bloqueada por (opcional)</label>
                <select id="blocks" name="blocks" multiple size={Math.min(tasks.length, 6)}>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="relates_to">Relaciona-se com (opcional)</label>
                <select id="relates_to" name="relates_to" multiple size={Math.min(tasks.length, 6)}>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className={styles.note}>Nenhuma tarefa existente ainda para definir dependências.</p>
          )}

          <button type="submit">Criar tarefa</button>
        </form>
      )}
    </>
  );
}
