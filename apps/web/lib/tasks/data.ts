import {
  getProject,
  getTask,
  getTaskVersion,
  listProjectsByIds,
  listTaskDependencies,
  listTaskHistory,
  listTasks,
  listTasksByIds,
  type ProjectRow,
  type TaskDependencyRow,
  type TaskRow,
  type TaskStateTransitionRow,
  type TaskVersionRow,
} from 'database';
import { getServerSupabaseClient } from '../supabase/server';

export interface TaskBoardData {
  tasks: TaskRow[];
  projectsById: Map<string, ProjectRow>;
}

export async function getTaskBoardData(): Promise<TaskBoardData> {
  const supabase = await getServerSupabaseClient();
  const tasks = await listTasks(supabase);

  const projectIds = [...new Set(tasks.map((task) => task.project_id))];
  const projects = await listProjectsByIds(supabase, projectIds);

  return { tasks, projectsById: new Map(projects.map((project) => [project.id, project])) };
}

export interface TaskDetailData {
  task: TaskRow;
  project: ProjectRow | null;
  version: TaskVersionRow | null;
  dependencies: TaskDependencyRow[];
  dependsOnTasksById: Map<string, TaskRow>;
  history: TaskStateTransitionRow[];
}

export async function getTaskDetailData(taskId: string): Promise<TaskDetailData | null> {
  const supabase = await getServerSupabaseClient();
  const task = await getTask(supabase, taskId);

  if (!task) {
    return null;
  }

  const [project, version, dependencies, history] = await Promise.all([
    getProject(supabase, task.project_id),
    task.current_version_id ? getTaskVersion(supabase, task.current_version_id) : Promise.resolve(null),
    listTaskDependencies(supabase, taskId),
    listTaskHistory(supabase, taskId),
  ]);

  const dependsOnTasks = await listTasksByIds(
    supabase,
    dependencies.map((dependency) => dependency.depends_on_task_id),
  );

  return {
    task,
    project,
    version,
    dependencies,
    dependsOnTasksById: new Map(dependsOnTasks.map((dependency) => [dependency.id, dependency])),
    history,
  };
}
