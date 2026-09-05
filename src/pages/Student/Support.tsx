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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TICKET_CATEGORIES, categoryLabel, statusMeta, priorityMeta } from '@/lib/support';
import { logAudit } from '@/lib/audit';
import { LifeBuoy, Plus, Send, Search, RefreshCw } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  last_activity_at: string;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  created_at: string;
}

export default function StudentSupport() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('account');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, category, description, status, priority, created_at, last_activity_at')
      .eq('user_id', profile.id)
      .order('last_activity_at', { ascending: false });
    if (error) {
      toast({ title: 'Could not load your requests', description: 'Please try again in a moment.', variant: 'destructive' });
    }
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.id]);

  const openTicket = async (ticket: Ticket) => {
    setActive(ticket);
    setMessages([]);
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('id, message, sender_id, sender_role, created_at')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
  };

  const createTicket = async () => {
    if (!profile || !subject.trim() || !description.trim()) {
      toast({ title: 'Add a subject and a description', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({ user_id: profile.id, subject: subject.trim(), category, description: description.trim() })
      .select('id, ticket_number, subject, category, description, status, priority, created_at, last_activity_at')
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast({ title: 'Could not send your request', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    logAudit({ action: 'create', resourceType: 'support_ticket', resourceId: data.id, resourceLabel: `#${data.ticket_number} ${data.subject}` });
    toast({ title: `Ticket #${data.ticket_number} created`, description: 'We will get back to you here.' });
    setSubject(''); setDescription(''); setCategory('account'); setCreateOpen(false);
    setTickets((prev) => [data as Ticket, ...prev]);
  };

  const sendReply = async () => {
    if (!active || !profile || !reply.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .insert({ ticket_id: active.id, sender_id: profile.id, sender_role: 'student', message: reply.trim() })
      .select('id, message, sender_id, sender_role, created_at')
      .single();
    setSending(false);
    if (error || !data) {
      toast({ title: 'Message not sent', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    setMessages((prev) => [...prev, data as Message]);
    setReply('');
  };

  const filtered = (status: string) => tickets.filter((t) => {
    const matchesStatus =
      status === 'all' ? true :
      status === 'open' ? ['open', 'in_review', 'awaiting_student'].includes(t.status) :
      t.status === status;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term ||
      t.subject.toLowerCase().includes(term) ||
      String(t.ticket_number).includes(term) ||
      categoryLabel(t.category).toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const renderList = (status: string) => {
    const list = filtered(status);
    if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
    if (list.length === 0) return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Nothing here yet. Start a request and it will appear in this list.
      </div>
    );
    return (
      <ul className="space-y-2">
        {list.map((t) => {
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
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(t.last_activity_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{categoryLabel(t.category)}</p>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-primary" /> Support Centre
            </h1>
            <p className="text-muted-foreground text-sm">Raise a request, track its progress and chat with the team.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New request</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New support request</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TICKET_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea rows={5} placeholder="Describe the issue with as much detail as you can" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
                  <Button className="w-full" onClick={createTicket} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Submit request'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search your requests" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search your requests" />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="open">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="in_review">In review</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
              {['open', 'in_review', 'resolved', 'closed', 'all'].map((s) => (
                <TabsContent key={s} value={s} className="mt-4">{renderList(s)}</TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {active ? `#${active.ticket_number} — ${active.subject}` : ''}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={statusMeta(active.status).badge}>{statusMeta(active.status).label}</Badge>
                <Badge variant="outline" className={priorityMeta(active.priority).badge}>{priorityMeta(active.priority).label}</Badge>
                <Badge variant="outline">{categoryLabel(active.category)}</Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap bg-muted rounded-md p-3">{active.description}</p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-md p-2.5 text-sm ${m.sender_role === 'student' ? 'bg-primary/5 border border-primary/20' : 'bg-muted'}`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {m.sender_role === 'student' ? 'You' : m.sender_role === 'teacher' ? 'Lecturer' : 'Support'} · {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {active.status !== 'closed' ? (
                <div className="flex gap-2">
                  <Textarea rows={2} placeholder="Write a reply" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon" aria-label="Send reply">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">This ticket is closed. Start a new request if you still need help.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
