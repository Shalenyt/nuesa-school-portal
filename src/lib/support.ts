export const TICKET_CATEGORIES = [
  { value: 'account', label: 'Account' },
  { value: 'payment', label: 'Payment' },
  { value: 'results', label: 'Results' },
  { value: 'course_registration', label: 'Course Registration' },
  { value: 'materials', label: 'Materials' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'complaint', label: 'General Complaint' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Other' },
] as const;

export const TICKET_STATUSES = [
  { value: 'open', label: 'Open', dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { value: 'in_review', label: 'In Review', dot: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  { value: 'awaiting_student', label: 'Awaiting Student', dot: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { value: 'resolved', label: 'Resolved', dot: 'bg-green-600', badge: 'bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30' },
  { value: 'closed', label: 'Closed', dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground border-border' },
] as const;

export const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', badge: 'bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30' },
  { value: 'normal', label: 'Normal', badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  { value: 'high', label: 'High', badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { value: 'urgent', label: 'Urgent', badge: 'bg-destructive/10 text-destructive border-destructive/30' },
] as const;

export const categoryLabel = (value: string) =>
  TICKET_CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const statusMeta = (value: string) =>
  TICKET_STATUSES.find((s) => s.value === value) ?? TICKET_STATUSES[0];

export const priorityMeta = (value: string) =>
  TICKET_PRIORITIES.find((p) => p.value === value) ?? TICKET_PRIORITIES[1];
