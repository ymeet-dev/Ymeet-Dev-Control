import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllowedNextStates, getBlockedOriginState, requiresTransitionReason } from 'database';
import { StateBadge } from '../../../components/tasks/StateBadge';
import { PriorityBadge } from '../../../components/tasks/PriorityBadge';
import { TaskDependencies } from '../../../components/tasks/TaskDependencies';
import { TaskHistory } from '../../../components/tasks/TaskHistory';
import styles from '../../../components/tasks/tasks.module.css';
import { getTaskDetailData } from '../../../lib/tasks/data';
import { getCurrentUser } from '../../../lib/auth/get-current-user';
import { TASK_STATE_LABELS } from '../../../lib/tasks/state';
import { changeTaskStateAction } from './actions';

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    dependencyError?: string;
    stateUpdated?: string;
    stateError?: string;
  }>;
}

export default async function TaskDetailPage({ params, searchParams }: TaskDetailPageProps) {
  const { id } = await params;
  const { created, dependencyError, stateUpdated, stateError } = await searchParams;
  const [data, currentUser] = await Promise.all([getTaskDetailData(id), getCurrentUser()]);

  if (!data) {
    notFound();
  }

  const { task, project, version, dependencies, dependsOnTasksById, history } = data;

  const blockedOrigin = getBlockedOriginState(history);
  const allowedNextStates = getAllowedNextStates(task.state, currentUser?.role, blockedOrigin);

  return (
    <>
      <p>
        <Link href="/tasks">&larr; Voltar ao painel</Link>
      </p>

      {created === '1' ? <p className={styles.successBanner}>Tarefa criada com sucesso.</p> : null}
      {dependencyError ? (
        <p className={styles.errorBanner}>Tarefa criada, mas houve um erro ao salvar dependências: {dependencyError}</p>
      ) : null}
      {stateUpdated === '1' ? <p className={styles.successBanner}>Estado da tarefa atualizado com sucesso.</p> : null}
      {stateError ? (
        <p role="alert" className={styles.errorBanner}>
          {stateError}
        </p>
      ) : null}

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

      {allowedNextStates.length > 0 ? (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Mudar estado</h2>
          {(task.state === 'PENDING_APPROVAL' || task.state === 'READY_TO_PUBLISH') && (
            <p className={styles.note}>
              Avançar a partir daqui exige uma aprovação já registrada e decidida em <code>approvals</code> por um
              approver ou admin — registrar essa decisão não é a mesma ação que executar esta transição; se a
              aprovação ainda não existir, o servidor rejeita a tentativa.
            </p>
          )}
          <div className={styles.stateActions}>
            {allowedNextStates.map((toState) => (
              <form key={toState} action={changeTaskStateAction} className={styles.stateActionForm}>
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="to_state" value={toState} />
                {requiresTransitionReason(toState) ? (
                  <input
                    name="reason"
                    type="text"
                    required
                    maxLength={500}
                    placeholder={`Motivo para ${TASK_STATE_LABELS[toState]}`}
                    aria-label={`Motivo para ${TASK_STATE_LABELS[toState]}`}
                  />
                ) : null}
                <button type="submit">{TASK_STATE_LABELS[toState]}</button>
              </form>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico</h2>
        <TaskHistory history={history} />
      </div>
    </>
  );
}
