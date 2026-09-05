import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, categoryLabel, statusMeta, priorityMeta } from '@/lib/support';
import { logAudit } from '@/lib/audit';
import { LifeBuoy, Search, Send, RefreshCw } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: number;
  user_id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  last_activity_at: string;
  profiles?: { full_name: string; student_id: string | null } | null;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  is_internal: boolean;
  created_at: string;
}

interface Staff { id: string; full_name: string; role: string }

export default function AdminSupport() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [category, setCategory] = useState('all');
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, staffRes] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('*, profiles!support_tickets_user_id_fkey(full_name, student_id)')
        .order('last_activity_at', { ascending: false })
        .limit(300),
      supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'teacher']).eq('status', 'approved'),
    ]);
    if (error) toast({ title: 'Could not load tickets', variant: 'destructive' });
    setTickets((data ?? []) as unknown as Ticket[]);
    setStaff((staffRes.data ?? []) as Staff[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openTicket = async (ticket: Ticket) => {
    setActive(ticket);
    setMessages([]);
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('id, message, sender_id, sender_role, is_internal, created_at')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
  };

  const updateTicket = async (patch: Partial<Ticket>, label: string) => {
    if (!active) return;
    const previous = { status: active.status, priority: active.priority, assigned_to: active.assigned_to };
    const { error } = await supabase
      .from('support_tickets')
      .update({ ...patch, last_activity_at: new Date().toISOString() })
      .eq('id', active.id);
    if (error) {
      toast({ title: 'Update failed', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    const updated = { ...active, ...patch } as Ticket;
    setActive(updated);
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    logAudit({
      action: patch.assigned_to !== undefined ? 'assign' : 'status_change',
      resourceType: 'support_ticket',
      resourceId: active.id,
      resourceLabel: `#${active.ticket_number} ${active.subject}`,
      description: label,
      oldValues: previous,
      newValues: patch as Record<string, unknown>,
    });
    toast({ title: label });
  };

  const sendReply = async () => {
    if (!active || !profile || !reply.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: active.id,
        sender_id: profile.id,
        sender_role: profile.role,
        message: reply.trim(),
        is_internal: internal,
      })
      .select('id, message, sender_id, sender_role, is_internal, created_at')
      .single();
    if (!error && data) {
      await supabase.from('support_tickets').update({ last_activity_at: new Date().toISOString() }).eq('id', active.id);
      setMessages((prev) => [...prev, data as Message]);
      setReply('');
    } else {
      toast({ title: 'Message not sent', variant: 'destructive' });
    }
    setSending(false);
  };

  const filtered = tickets.filter((t) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term ||
      t.subject.toLowerCase().includes(term) ||
      String(t.ticket_number).includes(term) ||
      (t.profiles?.full_name ?? '').toLowerCase().includes(term) ||
      (t.profiles?.student_id ?? '').toLowerCase().includes(term);
    return matchesSearch &&
      (status === 'all' || t.status === status) &&
      (priority === 'all' || t.priority === priority) &&
      (category === 'all' || t.category === category);
  });

  const counts = TICKET_STATUSES.map((s) => ({ ...s, count: tickets.filter((t) => t.status === s.value).length }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-primary" /> Support Centre
            </h1>
            <p className="text-muted-foreground text-sm">Track, assign and resolve requests from students and lecturers.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {counts.map((c) => (
            <Card key={c.value}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />{c.label}
                </div>
                <p className="text-2xl font-bold">{c.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Tickets</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search ticket, name or Matric NO" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tickets" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {TICKET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger aria-label="Filter by priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {TICKET_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Filter by category"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {TICKET_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No tickets match these filters.</div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((t) => {
                  const s = statusMeta(t.status);
                  return (
                    <li key={t.id}>
                      <button onClick={() => openTicket(t)} className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">#{t.ticket_number}</span>
                          <span className="font-medium truncate">{t.subject}</span>
                          <Badge variant="outline" className={s.badge}>
                            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${s.dot}`} />{s.label}
                          </Badge>
                          <Badge variant="outline" className={priorityMeta(t.priority).badge}>{priorityMeta(t.priority).label}</Badge>
                          <span className="ml-auto text-xs text-muted-foreground">{new Date(t.last_activity_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {categoryLabel(t.category)} · {t.profiles?.full_name ?? 'Unknown'}{t.profiles?.student_id ? ` (${t.profiles.student_id})` : ''}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-6">{active ? `#${active.ticket_number} — ${active.subject}` : ''}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                From {active.profiles?.full_name ?? 'Unknown'}{active.profiles?.student_id ? ` (${active.profiles.student_id})` : ''} · {categoryLabel(active.category)} · opened {new Date(active.created_at).toLocaleString()}
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <Select value={active.status} onValueChange={(v) => updateTicket({ status: v }, `Status set to ${statusMeta(v).label}`)}>
                  <SelectTrigger aria-label="Change status"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={active.priority} onValueChange={(v) => updateTicket({ priority: v }, `Priority set to ${priorityMeta(v).label}`)}>
                  <SelectTrigger aria-label="Change priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={active.assigned_to ?? 'unassigned'} onValueChange={(v) => updateTicket({ assigned_to: v === 'unassigned' ? null : v }, 'Ticket assignment updated')}>
                  <SelectTrigger aria-label="Assign ticket"><SelectValue placeholder="Assign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}{s.role === 'teacher' ? ' (Lecturer)' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm whitespace-pre-wrap bg-muted rounded-md p-3">{active.description}</p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-md p-2.5 text-sm border ${m.is_internal ? 'bg-yellow-500/5 border-yellow-500/30' : m.sender_role === 'student' ? 'bg-muted border-transparent' : 'bg-primary/5 border-primary/20'}`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {m.is_internal ? 'Internal note · ' : ''}
                      {m.sender_role === 'student' ? 'Student' : m.sender_role === 'teacher' ? 'Lecturer' : 'Admin'} · {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch id="internal" checked={internal} onCheckedChange={setInternal} />
                  <Label htmlFor="internal" className="text-xs text-muted-foreground">Internal note (not shown to the student)</Label>
                </div>
                <div className="flex gap-2">
                  <Textarea rows={2} placeholder="Write a response" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Response" />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon" aria-label="Send response">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
