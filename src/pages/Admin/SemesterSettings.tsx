import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Calendar, Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { PromoteStudents } from '@/components/Admin/PromoteStudents';

type Term = 'FIRST' | 'SECOND';

interface Semester {
  id: string;
  name: string;
  session: string | null;
  term: Term | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const TERM_LABEL: Record<Term, string> = { FIRST: 'First Semester', SECOND: 'Second Semester' };
const semesterName = (session: string, term: Term) => `${session} ${TERM_LABEL[term]}`;
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString();

/** "2026/2027" style, consecutive years */
const validSession = (s: string) => {
  const m = s.match(/^(\d{4})\/(\d{4})$/);
  return !!m && Number(m[2]) === Number(m[1]) + 1;
};

/** Returns an error message, or null when the dates are fine */
function checkDates(
  first: { start: string; end: string } | null,
  second: { start: string; end: string } | null,
): string | null {
  for (const [label, d] of [['First semester', first], ['Second semester', second]] as const) {
    if (!d) continue;
    if (!d.start || !d.end) return `${label}: fill in both dates.`;
    if (d.start >= d.end) return `${label}: the resumption date must be before the vacation date.`;
  }
  if (first && second && second.start <= first.end) {
    return 'The second semester must resume after the first semester goes on vacation.';
  }
  return null;
}

function nextSessionName(sessions: string[]) {
  const years = sessions.map((s) => Number(s.slice(0, 4))).filter(Boolean);
  const start = years.length ? Math.max(...years) + 1 : new Date().getFullYear();
  return `${start}/${start + 1}`;
}

export default function SemesterSettings() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ session: '', firstStart: '', firstEnd: '', secondStart: '', secondEnd: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editDates, setEditDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const init = async () => {
      try { await supabase.rpc('auto_manage_semester_lifecycle'); } catch (e) { console.error(e); }
      fetchSemesters();
    };
    init();
  }, []);

  const fetchSemesters = async () => {
    const { data } = await (supabase as any)
      .from('semester_config')
      .select('*')
      .order('start_date', { ascending: false });
    setSemesters(data || []);
    setLoading(false);
  };

  // Group semesters into sessions, newest first
  const sessions = useMemo(() => {
    const map = new Map<string, Semester[]>();
    for (const s of semesters) {
      const key = s.session || 'Other';
      map.set(key, [...(map.get(key) || []), s]);
    }
    return [...map.entries()]
      .map(([session, list]) => ({
        session,
        first: list.find((s) => s.term === 'FIRST') || null,
        second: list.find((s) => s.term === 'SECOND') || null,
        other: list.filter((s) => !s.term),
      }))
      .sort((a, b) => b.session.localeCompare(a.session));
  }, [semesters]);

  // Suggest the session after the newest one
  useEffect(() => {
    if (!loading && !form.session) {
      setForm((f) => ({ ...f, session: nextSessionName(sessions.map((s) => s.session).filter(validSession)) }));
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const createSession = async () => {
    const session = form.session.trim();
    if (!validSession(session)) {
      toast({ title: 'Check the session', description: 'Write it like 2027/2028 (two consecutive years).', variant: 'destructive' });
      return;
    }
    if (sessions.some((s) => s.session === session)) {
      toast({ title: 'Session exists', description: `${session} is already set up. Edit its dates below.`, variant: 'destructive' });
      return;
    }
    const error = checkDates(
      { start: form.firstStart, end: form.firstEnd },
      { start: form.secondStart, end: form.secondEnd },
    );
    if (error) { toast({ title: 'Check the dates', description: error, variant: 'destructive' }); return; }

    const { error: dbError } = await (supabase as any).from('semester_config').insert([
      { name: semesterName(session, 'FIRST'), session, term: 'FIRST', start_date: form.firstStart, end_date: form.firstEnd },
      { name: semesterName(session, 'SECOND'), session, term: 'SECOND', start_date: form.secondStart, end_date: form.secondEnd },
    ]);
    if (dbError) { toast({ title: 'Error', description: dbError.message, variant: 'destructive' }); return; }
    toast({ title: 'Session created', description: `${session} with first and second semesters.` });
    setForm({ session: '', firstStart: '', firstEnd: '', secondStart: '', secondEnd: '' });
    fetchSemesters();
  };

  const setCurrent = async (s: Semester) => {
    // Only one semester can be active; the database switches the others off.
    const { error } = await (supabase as any)
      .from('semester_config')
      .update({ is_active: !s.is_active })
      .eq('id', s.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: s.is_active ? 'Semester switched off' : 'Current semester set', description: s.name });
    fetchSemesters();
  };

  const startEdit = (s: Semester) => {
    setEditing(s.id);
    setEditDates({ start: s.start_date, end: s.end_date });
  };

  const saveEdit = async (s: Semester) => {
    const group = sessions.find((g) => g.session === (s.session || 'Other'));
    const updated = { start: editDates.start, end: editDates.end };
    const first = s.term === 'FIRST' ? updated : group?.first ? { start: group.first.start_date, end: group.first.end_date } : null;
    const second = s.term === 'SECOND' ? updated : group?.second ? { start: group.second.start_date, end: group.second.end_date } : null;
    const error = s.term ? checkDates(first, second) : checkDates(updated, null);
    if (error) { toast({ title: 'Check the dates', description: error, variant: 'destructive' }); return; }

    const { error: dbError } = await (supabase as any)
      .from('semester_config')
      .update({ start_date: editDates.start, end_date: editDates.end })
      .eq('id', s.id);
    if (dbError) { toast({ title: 'Error', description: dbError.message, variant: 'destructive' }); return; }
    toast({ title: 'Dates updated', description: s.name });
    setEditing(null);
    fetchSemesters();
  };

  const deleteSession = async (ids: string[]) => {
    const { error } = await (supabase as any).from('semester_config').delete().in('id', ids);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    fetchSemesters();
  };

  const renderSemester = (s: Semester | null, term: Term, session: string) => {
    if (!s) {
      return (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {TERM_LABEL[term]} not set up for {session}.
        </div>
      );
    }
    const isEditing = editing === s.id;
    return (
      <div className={`rounded-lg border p-3 space-y-3 ${s.is_active ? 'border-primary bg-primary/5' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{s.term ? TERM_LABEL[s.term] : s.name}</span>
          {s.is_active && <Badge>Current semester</Badge>}
        </div>

        {isEditing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Resumption</Label>
              <Input type="date" value={editDates.start} onChange={(e) => setEditDates((d) => ({ ...d, start: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vacation</Label>
              <Input type="date" value={editDates.end} onChange={(e) => setEditDates((d) => ({ ...d, end: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{fmt(s.start_date)}</span>
            <span>→</span>
            <span>{fmt(s.end_date)}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch checked={s.is_active} onCheckedChange={() => setCurrent(s)} />
          <Label className="text-sm">{s.is_active ? 'Current' : 'Make current'}</Label>
          <div className="ml-auto flex gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={() => saveEdit(s)}><Save className="h-4 w-4 mr-1" />Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startEdit(s)}><Pencil className="h-4 w-4 mr-1" />Edit dates</Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Sessions</h1>
          <p className="text-muted-foreground">Set up sessions, choose the current semester and change resumption and vacation dates</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Add Academic Session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label>Session</Label>
              <Input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="e.g. 2027/2028" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-3">
                <p className="font-medium text-sm">First Semester</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Resumption</Label>
                    <Input type="date" value={form.firstStart} onChange={(e) => setForm({ ...form, firstStart: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vacation</Label>
                    <Input type="date" value={form.firstEnd} onChange={(e) => setForm({ ...form, firstEnd: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <p className="font-medium text-sm">Second Semester</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Resumption</Label>
                    <Input type="date" value={form.secondStart} onChange={(e) => setForm({ ...form, secondStart: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vacation</Label>
                    <Input type="date" value={form.secondEnd} onChange={(e) => setForm({ ...form, secondEnd: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={createSession}><Plus className="h-4 w-4 mr-2" /> Create Session</Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions.map((g) => {
              const all = [g.first, g.second, ...g.other].filter(Boolean) as Semester[];
              const isCurrent = all.some((s) => s.is_active);
              return (
                <Card key={g.session} className={isCurrent ? 'border-primary' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {g.session === 'Other' ? 'Other semesters' : `${g.session} Session`}
                      </span>
                      <span className="flex items-center gap-2">
                        {isCurrent && <Badge>Current session</Badge>}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={`Delete ${g.session}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {g.session === 'Other' ? 'these semesters' : `the ${g.session} session`}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes {all.length === 1 ? 'its semester' : `its ${all.length} semesters`} from the calendar. Courses, results and students are not affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSession(all.map((s) => s.id))} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {g.session === 'Other' ? (
                      g.other.map((s) => <div key={s.id}>{renderSemester(s, 'FIRST', g.session)}</div>)
                    ) : (
                      <>
                        {renderSemester(g.first, 'FIRST', g.session)}
                        {renderSemester(g.second, 'SECOND', g.session)}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <PromoteStudents />
      </div>
    </DashboardLayout>
  );
}
