import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StateBadge } from '../../../components/tasks/StateBadge';
import { PriorityBadge } from '../../../components/tasks/PriorityBadge';
import { TaskDependencies } from '../../../components/tasks/TaskDependencies';
import { TaskHistory } from '../../../components/tasks/TaskHistory';
import styles from '../../../components/tasks/tasks.module.css';
import { getTaskDetailData } from '../../../lib/tasks/data';

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const data = await getTaskDetailData(id);

  if (!data) {
    notFound();
  }

  const { task, project, version, dependencies, dependsOnTasksById, history } = data;

  return (
    <>
      <p>
        <Link href="/tasks">&larr; Voltar ao painel</Link>
      </p>

      <h1>{task.title}</h1>
      <p>
        <StateBadge state={task.state} /> <PriorityBadge priority={task.priority} />
      </p>

      <div className={styles.section}>
        <div className={styles.metaGrid}>
          <div>
            <span className={styles.metaLabel}>Projeto</span>
            {project ? project.name : 'Não encontrado'}
          </div>
          <div>
            <span className={styles.metaLabel}>Estado</span>
            {task.state}
          </div>
          <div>
            <span className={styles.metaLabel}>Prioridade</span>
            {task.priority}
          </div>
          <div>
            <span className={styles.metaLabel}>Criada em</span>
            {new Date(task.created_at).toLocaleString('pt-BR')}
          </div>
          <div>
            <span className={styles.metaLabel}>Atualizada em</span>
            {new Date(task.updated_at).toLocaleString('pt-BR')}
          </div>
          <div>
            <span className={styles.metaLabel}>Risco / autonomia</span>
            <span className={styles.note}>Não disponível no schema atual (Fase 1)</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Especificação (versão atual)</h2>
        {task.current_version_id === null ? (
          <p className={styles.note}>Nenhuma versão registrada ainda para esta tarefa.</p>
        ) : version ? (
          <>
            <p className={styles.note}>
              Não há um campo dedicado de &quot;descrição&quot; no schema — o conteúdo abaixo é o{' '}
              <code>spec</code> (JSON livre) da versão {version.version_number}.
            </p>
            <pre className={styles.spec}>{JSON.stringify(version.spec, null, 2)}</pre>
          </>
        ) : (
          <p className={styles.note}>Versão referenciada não encontrada.</p>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Dependências</h2>
        <TaskDependencies dependencies={dependencies} dependsOnTasksById={dependsOnTasksById} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico</h2>
        <TaskHistory history={history} />
      </div>
    </>
  );
}
