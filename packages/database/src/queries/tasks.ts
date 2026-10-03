import type { Tables, TaskDependencyType, TaskState, TypedSupabaseClient } from '../types';

export type TaskRow = Tables<'tasks'>;
export type ProjectRow = Tables<'projects'>;
export type TaskVersionRow = Tables<'task_versions'>;
export type TaskDependencyRow = Tables<'task_dependencies'>;
export type TaskStateTransitionRow = Tables<'task_state_transitions'>;

export async function listProjects(supabase: TypedSupabaseClient): Promise<ProjectRow[]> {
  const { data, error } = await supabase.from('projects').select('*').order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Todas as tarefas visíveis para o usuário atual (a policy tasks_select libera
 * leitura para qualquer profile autenticado — não há filtro adicional aqui).
 */
export async function listTasks(supabase: TypedSupabaseClient): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getTask(supabase: TypedSupabaseClient, taskId: string): Promise<TaskRow | null> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function listProjectsByIds(supabase: TypedSupabaseClient, ids: string[]): Promise<ProjectRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('projects').select('*').in('id', ids);

  if (error) throw error;
  return data ?? [];
}

export async function getProject(supabase: TypedSupabaseClient, projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Não existe coluna `description` em `tasks`. O conteúdo mais próximo de uma
 * descrição é o `spec` (JSON livre) da versão atual da tarefa, se houver.
 */
export async function getTaskVersion(
  supabase: TypedSupabaseClient,
  versionId: string,
): Promise<TaskVersionRow | null> {
  const { data, error } = await supabase.from('task_versions').select('*').eq('id', versionId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function listTaskDependencies(
  supabase: TypedSupabaseClient,
  taskId: string,
): Promise<TaskDependencyRow[]> {
  const { data, error } = await supabase.from('task_dependencies').select('*').eq('task_id', taskId);

  if (error) throw error;
  return data ?? [];
}

export async function listTasksByIds(supabase: TypedSupabaseClient, ids: string[]): Promise<TaskRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('tasks').select('*').in('id', ids);

  if (error) throw error;
  return data ?? [];
}

export async function listTaskHistory(
  supabase: TypedSupabaseClient,
  taskId: string,
): Promise<TaskStateTransitionRow[]> {
  const { data, error } = await supabase
    .from('task_state_transitions')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export interface NewTaskInput {
  project_id: string;
  title: string;
  state: TaskState;
  priority: number;
  created_by: string | null;
}

/** Insere a tarefa com o client autenticado — sujeito à policy tasks_insert (admin/pm). */
export async function createTask(supabase: TypedSupabaseClient, input: NewTaskInput): Promise<TaskRow> {
  const { data, error } = await supabase.from('tasks').insert(input).select('*').single();

  if (error) throw error;
  return data;
}

export interface NewTaskDependencyInput {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: TaskDependencyType;
}

/** Sujeito à policy task_dependencies_insert (admin/pm) e ao constraint unique(task_id, depends_on_task_id). */
export async function createTaskDependencies(
  supabase: TypedSupabaseClient,
  rows: NewTaskDependencyInput[],
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await supabase.from('task_dependencies').insert(rows);
  if (error) throw error;
}
