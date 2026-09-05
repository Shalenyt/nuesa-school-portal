/**
 * Shared deadline urgency system.
 * Single source of truth for how deadlines are communicated across the portal
 * (dashboard, assignments, quizzes, payments, notifications).
 */

export type UrgencyLevel =
  | 'comfortable'
  | 'upcoming'
  | 'approaching'
  | 'soon'
  | 'critical'
  | 'overdue';

export interface DeadlineStatus {
  level: UrgencyLevel;
  /** Short accessible text, never colour-only. e.g. "3 days left" */
  label: string;
  /** Category name, e.g. "Due soon" */
  category: string;
  msRemaining: number;
  /** Tailwind classes for a subtle badge */
  badgeClass: string;
  /** Tailwind class for a small status dot */
  dotClass: string;
  /** Tailwind class for a subtle left accent border */
  accentClass: string;
}

const META: Record<UrgencyLevel, { category: string; badge: string; dot: string; accent: string }> = {
  comfortable: {
    category: 'Comfortable',
    badge: 'bg-urgency-comfortable/10 text-urgency-comfortable border-urgency-comfortable/30',
    dot: 'bg-urgency-comfortable',
    accent: 'border-l-urgency-comfortable',
  },
  upcoming: {
    category: 'Upcoming',
    badge: 'bg-urgency-upcoming/10 text-urgency-upcoming border-urgency-upcoming/30',
    dot: 'bg-urgency-upcoming',
    accent: 'border-l-urgency-upcoming',
  },
  approaching: {
    category: 'Approaching',
    badge: 'bg-urgency-approaching/10 text-urgency-approaching border-urgency-approaching/30',
    dot: 'bg-urgency-approaching',
    accent: 'border-l-urgency-approaching',
  },
  soon: {
    category: 'Due soon',
    badge: 'bg-urgency-soon/10 text-urgency-soon border-urgency-soon/30',
    dot: 'bg-urgency-soon',
    accent: 'border-l-urgency-soon',
  },
  critical: {
    category: 'Due today',
    badge: 'bg-urgency-critical/10 text-urgency-critical border-urgency-critical/30',
    dot: 'bg-urgency-critical',
    accent: 'border-l-urgency-critical',
  },
  overdue: {
    category: 'Overdue',
    badge: 'bg-urgency-overdue/10 text-urgency-overdue border-urgency-overdue/40 font-semibold',
    dot: 'bg-urgency-overdue',
    accent: 'border-l-urgency-overdue',
  },
};

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function humanRemaining(ms: number, due: Date, now: Date): string {
  if (ms < 0) {
    const overdueDays = Math.floor(-ms / DAY);
    if (overdueDays >= 1) return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
    const overdueHours = Math.max(1, Math.floor(-ms / HOUR));
    return `Overdue by ${overdueHours} hour${overdueHours === 1 ? '' : 's'}`;
  }
  if (isSameDay(due, now)) return 'Due today';
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.max(1, Math.floor(ms / HOUR));
  return `${hours} hour${hours === 1 ? '' : 's'} left`;
}

export function getDeadlineStatus(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
): DeadlineStatus | null {
  if (!dueDate) return null;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) return null;

  const ms = due.getTime() - now.getTime();

  let level: UrgencyLevel;
  if (ms < 0) level = 'overdue';
  else if (isSameDay(due, now)) level = 'critical';
  else if (ms < DAY) level = 'soon';
  else if (ms < 3 * DAY) level = 'approaching';
  else if (ms <= 7 * DAY) level = 'upcoming';
  else level = 'comfortable';

  const meta = META[level];
  return {
    level,
    category: meta.category,
    label: humanRemaining(ms, due, now),
    msRemaining: ms,
    badgeClass: meta.badge,
    dotClass: meta.dot,
    accentClass: meta.accent,
  };
}

export const URGENCY_LEGEND: { level: UrgencyLevel; short: string; description: string; dotClass: string }[] = [
  { level: 'comfortable', short: 'Comfortable', description: 'More than 7 days left', dotClass: META.comfortable.dot },
  { level: 'upcoming', short: 'Upcoming', description: '3–7 days left', dotClass: META.upcoming.dot },
  { level: 'approaching', short: 'Soon', description: '1–2 days left', dotClass: META.approaching.dot },
  { level: 'soon', short: '<24h', description: 'Less than 24 hours left', dotClass: META.soon.dot },
  { level: 'critical', short: 'Today', description: 'Due today', dotClass: META.critical.dot },
  { level: 'overdue', short: 'Overdue', description: 'Deadline has passed', dotClass: META.overdue.dot },
];

/** Sort helper: soonest / most urgent first, overdue items grouped at the top. */
export function byUrgency<T>(getDue: (item: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const da = new Date(getDue(a) ?? 0).getTime();
    const db = new Date(getDue(b) ?? 0).getTime();
    return da - db;
  };
}
