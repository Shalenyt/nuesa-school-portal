import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calendar, Edit2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const TIME_SLOTS = {
  morning: { label: 'Morning (8:00 – 11:00)', start: '08:00', end: '11:00' },
  afternoon: { label: 'Afternoon (11:30 – 14:30)', start: '11:30', end: '14:30' },
  evening: { label: 'Evening (15:00 – 17:00)', start: '15:00', end: '17:00' },
};

export default function AdminExamTimetable() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    day_label: '', exam_date: '', time_slot: 'morning',
    start_time: '08:00', end_time: '11:00',
    course_code: '', venue: '',
  });

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    const { data } = await (supabase as any)
      .from('exam_timetables')
      .select('*')
      .order('exam_date', { ascending: true })
      .order('time_slot', { ascending: true });
    setEntries(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ day_label: '', exam_date: '', time_slot: 'morning', start_time: '08:00', end_time: '11:00', course_code: '', venue: '' });
    setEditingId(null);
    setIsCreating(false);
  };

  const handleTimeSlotChange = (slot: string) => {
    const s = TIME_SLOTS[slot as keyof typeof TIME_SLOTS];
    setForm(p => ({ ...p, time_slot: slot, start_time: s.start, end_time: s.end }));
  };

  const saveEntry = async () => {
    if (!form.day_label || !form.exam_date || !form.course_code) {
      toast({ title: 'Error', description: 'Day, date and course code are required.', variant: 'destructive' });
      return;
    }
    const payload = { ...form, created_by: profile?.id };

    if (editingId) {
      const { created_by, ...updatePayload } = payload;
      const { error } = await (supabase as any).from('exam_timetables').update(updatePayload).eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated', description: 'Entry updated.' });
    } else {
      const { error } = await (supabase as any).from('exam_timetables').insert([payload]);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Created', description: 'Entry added.' });
    }
    resetForm();
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    await (supabase as any).from('exam_timetables').delete().eq('id', id);
    toast({ title: 'Deleted' });
    fetchEntries();
  };

  const startEdit = (e: any) => {
    setForm({
      day_label: e.day_label, exam_date: e.exam_date, time_slot: e.time_slot,
      start_time: e.start_time, end_time: e.end_time, course_code: e.course_code, venue: e.venue || '',
    });
    setEditingId(e.id);
    setIsCreating(true);
  };

  // Group entries by day
  const grouped = entries.reduce((acc: any, e: any) => {
    const key = `${e.day_label} – ${new Date(e.exam_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    if (!acc[key]) acc[key] = { morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Exam Timetable</h1>
            <p className="text-muted-foreground">Manage examination schedule</p>
          </div>
          <Button onClick={() => { resetForm(); setIsCreating(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Entry
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader><CardTitle>{editingId ? 'Edit Entry' : 'Add Entry'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>Day Label</Label>
                  <Input placeholder="e.g. Day 1" value={form.day_label} onChange={e => setForm(p => ({ ...p, day_label: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Time Slot</Label>
                  <Select value={form.time_slot} onValueChange={handleTimeSlotChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="z-[9999]">
                      {Object.entries(TIME_SLOTS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Course Code</Label>
                  <Input placeholder="e.g. CIE411" value={form.course_code} onChange={e => setForm(p => ({ ...p, course_code: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Venue</Label>
                  <Input placeholder="e.g. TETFD" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEntry}>{editingId ? 'Update' : 'Add'}</Button>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No exam timetable entries yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border p-2 text-left min-w-[180px]">Day &amp; Date</th>
                  <th className="border p-2 text-left min-w-[200px]">Morning (8:00–11:00)</th>
                  <th className="border p-2 text-left min-w-[200px]">Afternoon (11:30–14:30)</th>
                  <th className="border p-2 text-left min-w-[200px]">Evening (15:00–17:00)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([dayKey, slots]: [string, any]) => (
                  <tr key={dayKey} className="border-b hover:bg-muted/50">
                    <td className="border p-2 font-medium">{dayKey}</td>
                    {['morning', 'afternoon', 'evening'].map(slot => (
                      <td key={slot} className="border p-2">
                        {slots[slot]?.length > 0 ? (
                          <div className="space-y-1">
                            {slots[slot].map((e: any) => (
                              <div key={e.id} className="flex items-start justify-between gap-1">
                                <div>
                                  <span className="font-semibold">{e.course_code}</span>
                                  {e.venue && <span className="text-muted-foreground text-xs ml-1">({e.venue})</span>}
                                </div>
                                <div className="flex gap-0.5 shrink-0">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(e)}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteEntry(e.id)}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
