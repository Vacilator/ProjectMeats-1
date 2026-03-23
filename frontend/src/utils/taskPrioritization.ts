import { ActionItem } from '../contexts/NotificationsContext';

type Priority = 'urgent' | 'high' | 'normal' | 'low' | string;

export const AT_RISK_VALUE_THRESHOLD = 10000;
export const AT_RISK_DAYS_THRESHOLD = 2;

export function daysUntilDue(dueDate: string | null, now = new Date()): number | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isTaskOverdue(task: Pick<ActionItem, 'due_date' | 'is_overdue'>, now = new Date()): boolean {
  const days = daysUntilDue(task.due_date, now);
  return Boolean(task.is_overdue) || (days !== null && days < 0);
}

export function isAtRiskTask(
  task: Pick<ActionItem, 'due_date' | 'is_overdue' | 'related_po_value'>,
  now = new Date()
): boolean {
  const days = daysUntilDue(task.due_date, now);
  const timeCritical = Boolean(task.is_overdue) || (days !== null && days <= AT_RISK_DAYS_THRESHOLD);
  const highValue = (task.related_po_value ?? 0) >= AT_RISK_VALUE_THRESHOLD;
  return highValue && timeCritical;
}

function priorityBonus(priority: Priority): number {
  switch (priority) {
    case 'urgent':
      return 1.2;
    case 'high':
      return 0.8;
    case 'normal':
      return 0.4;
    case 'low':
      return 0.1;
    default:
      return 0.3;
  }
}

function urgencyFactor(task: Pick<ActionItem, 'due_date' | 'is_overdue'>, now = new Date()): number {
  const days = daysUntilDue(task.due_date, now);
  const overdue = isTaskOverdue(task, now);
  if (overdue) return 3.0;
  if (days === null) return 0.2;
  if (days <= 0) return 2.5; // due today
  if (days === 1) return 2.2;
  if (days <= 2) return 2.0;
  if (days <= 7) return 1.4;
  if (days <= 30) return 1.1;
  return 1.0;
}

function valueFactor(task: Pick<ActionItem, 'related_po_value'>): number {
  const value = Math.max(0, task.related_po_value ?? 0);
  if (value === 0) return 0;

  // Normalize to 0..1 with diminishing returns.
  // log10(100000) = 5, so $100k+ is treated as "max" influence.
  const normalized = Math.min(1, Math.log10(value + 1) / 5);
  return normalized;
}

export function smartTaskScore(
  task: Pick<ActionItem, 'due_date' | 'is_overdue' | 'related_po_value' | 'priority'>,
  now = new Date()
): number {
  const u = urgencyFactor(task, now);
  const v = valueFactor(task);
  const p = priorityBonus(task.priority);

  // Urgency drives the base; value boosts it multiplicatively.
  // This ensures a high-value task that is due soon outranks low-value noise.
  return (u + p) * (1 + v * 1.5) + (isTaskOverdue(task, now) ? 0.25 : 0);
}

export function compareTasksSmart(a: ActionItem, b: ActionItem): number {
  const now = new Date();
  const scoreDiff = smartTaskScore(b, now) - smartTaskScore(a, now);
  if (scoreDiff !== 0) return scoreDiff;

  // Stable tie-breakers: earliest due date first, then title.
  if (a.due_date && b.due_date) {
    const dueDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (dueDiff !== 0) return dueDiff;
  } else if (a.due_date && !b.due_date) {
    return -1;
  } else if (!a.due_date && b.due_date) {
    return 1;
  }

  return (a.title || '').localeCompare(b.title || '');
}
