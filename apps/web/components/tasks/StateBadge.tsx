import type { TaskState } from 'database';
import { getTaskStateCategory, TASK_STATE_LABELS } from '../../lib/tasks/state';
import styles from './tasks.module.css';

const CATEGORY_CLASS: Record<ReturnType<typeof getTaskStateCategory>, string | undefined> = {
  neutral: styles.badgeNeutral,
  progress: styles.badgeProgress,
  pending: styles.badgePending,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
};

export function StateBadge({ state }: { state: TaskState }) {
  const categoryClass = CATEGORY_CLASS[getTaskStateCategory(state)] ?? '';

  return <span className={`${styles.badge ?? ''} ${categoryClass}`}>{TASK_STATE_LABELS[state]}</span>;
}
