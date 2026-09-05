import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { auditActionClass, auditActionLabel } from '@/lib/audit';
import { ShieldCheck, RefreshCw, Search } from 'lucide-react';

interface AuditRow {
  id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_label: string | null;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  success: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export default function AuditLogs() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [resource, setResource] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (action !== 'all') query = query.eq('action', action);
      if (resource !== 'all') query = query.eq('resource_type', resource);
      if (fromDate) query = query.gte('created_at', new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(
          `actor_name.ilike.${term},resource_label.ilike.${term},description.ilike.${term},resource_type.ilike.${term}`
        );
      }

      const { data, count, error: err } = await query;
      if (err) throw err;
      setRows((data ?? []) as unknown as AuditRow[]);
      setTotal(count ?? 0);
    } catch (err) {
      console.error(err);
      setError('Could not load the activity trail. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, resource, fromDate, toDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const resourceOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.resource_type));
    return Array.from(set).sort();
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Audit Logs
            </h1>
            <p className="text-muted-foreground text-sm">
              Every important action on the portal, newest first. Entries can never be edited or removed.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search person, record or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search audit log"
              />
            </div>
            <Select value={action} onValueChange={(v) => { setPage(0); setAction(v); }}>
              <SelectTrigger aria-label="Filter by action"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {['create', 'update', 'delete', 'approve', 'reject', 'role_change', 'publish', 'verify', 'upload', 'status_change', 'assign', 'login', 'logout'].map((a) => (
                  <SelectItem key={a} value={a}>{auditActionLabel(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resource} onValueChange={(v) => { setPage(0); setResource(v); }}>
              <SelectTrigger aria-label="Filter by record type"><SelectValue placeholder="Record type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All records</SelectItem>
                {resourceOptions.map((r) => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={fromDate} onChange={(e) => { setPage(0); setFromDate(e.target.value); }} aria-label="From date" />
              <Input type="date" value={toDate} onChange={(e) => { setPage(0); setToDate(e.target.value); }} aria-label="To date" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No activity matches these filters yet.
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      onClick={() => setSelected(row)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex flex-wrap items-center gap-x-3 gap-y-1"
                    >
                      <Badge variant="outline" className={auditActionClass(row.action)}>
                        {auditActionLabel(row.action)}
                      </Badge>
                      <span className="font-medium text-sm">{row.resource_type.replace(/_/g, ' ')}</span>
                      {row.resource_label && (
                        <span className="text-sm text-muted-foreground truncate max-w-[16rem]">{row.resource_label}</span>
                      )}
                      {!row.success && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Failed</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                        {row.actor_name ?? 'System'} · {new Date(row.created_at).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{total} entries</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? auditActionLabel(selected.action) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Detail label="Performed by" value={`${selected.actor_name ?? 'System'}${selected.actor_role ? ` (${selected.actor_role === 'teacher' ? 'Lecturer' : selected.actor_role})` : ''}`} />
              <Detail label="Record type" value={selected.resource_type.replace(/_/g, ' ')} />
              {selected.resource_label && <Detail label="Record" value={selected.resource_label} />}
              {selected.description && <Detail label="Details" value={selected.description} />}
              <Detail label="Outcome" value={selected.success ? 'Successful' : 'Failed'} />
              <Detail label="When" value={new Date(selected.created_at).toLocaleString()} />
              {selected.old_values && (
                <div>
                  <p className="text-muted-foreground mb-1">Before</p>
                  <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto">{JSON.stringify(selected.old_values, null, 2)}</pre>
                </div>
              )}
              {selected.new_values && (
                <div>
                  <p className="text-muted-foreground mb-1">After</p>
                  <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto">{JSON.stringify(selected.new_values, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[7.5rem]">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}
