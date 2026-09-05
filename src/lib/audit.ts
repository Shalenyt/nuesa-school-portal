import { supabase } from '@/integrations/supabase/client';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'role_change'
  | 'publish'
  | 'verify'
  | 'upload'
  | 'status_change'
  | 'assign';

export interface AuditEntry {
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  description?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  success?: boolean;
  metadata?: Record<string, unknown> | null;
}

const SENSITIVE_KEYS = [
  'password', 'token', 'access_token', 'refresh_token', 'secret',
  'api_key', 'apikey', 'service_role', 'authorization', 'auth',
];

/** Strips credentials and other sensitive fields before anything is persisted. */
function sanitize<T extends Record<string, unknown> | null | undefined>(values: T) {
  if (!values) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Append an entry to the audit trail. Never throws — auditing must not break a
 * user action, failures are only reported to the console.
 */
export async function logAudit(entry: AuditEntry) {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', userId)
      .maybeSingle();

    await supabase.from('audit_logs').insert({
      actor_id: userId,
      actor_name: profile?.full_name ?? null,
      actor_role: profile?.role ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      resource_label: entry.resourceLabel ?? null,
      description: entry.description ?? null,
      old_values: sanitize(entry.oldValues) as never,
      new_values: sanitize(entry.newValues) as never,
      success: entry.success ?? true,
      metadata: sanitize(entry.metadata) as never,
    });
  } catch (err) {
    console.warn('[audit] failed to record entry', err);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  login_failed: 'Sign-in failed',
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  approve: 'Approved',
  reject: 'Rejected',
  role_change: 'Role changed',
  publish: 'Published',
  verify: 'Verified',
  upload: 'Uploaded',
  status_change: 'Status changed',
  assign: 'Assigned',
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, ' ');
}

export function auditActionClass(action: string) {
  switch (action) {
    case 'delete':
    case 'reject':
    case 'login_failed':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'create':
    case 'approve':
    case 'publish':
    case 'verify':
      return 'bg-primary/10 text-primary border-primary/30';
    case 'login':
    case 'logout':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-accent text-accent-foreground border-border';
  }
}
