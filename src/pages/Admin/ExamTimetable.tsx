import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Calendar, Edit2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const TIME_SLOTS = {
  morning: { label: 'Morning (8:00 AM – 11:00 AM)', start: '08:00', end: '11:00' },
  afternoon: { label: 'Afternoon (11:30 AM – 2:30 PM)', start: '11:30', end: '14:30' },
  evening: { label: 'Evening (3:00 PM – 5:00 PM)', start: '15:00', end: '17:00' },
};

const FRIDAY_PRAYER_LABEL = 'FRIDAY PRAYER';

export default function AdminExamTimetable() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
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

  // Check if a date is Friday
  const isFriday = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr).getDay() === 5;
  };

  // Check if afternoon is disabled (Friday)
  const isAfternoonDisabled = form.time_slot === 'afternoon' && isFriday(form.exam_date);

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
    const dateObj = new Date(e.exam_date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const key = `${e.day_label}|${dayName}|${dateFormatted}`;
    if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  const renderSlotCell = (items: any[], slotType: string, dateStr: string) => {
    // Friday afternoon = FRIDAY PRAYER
    if (slotType === 'afternoon' && new Date(dateStr).getDay() === 5) {
      return (
        <td className="border border-border p-2 text-center" colSpan={2}>
          <span className="font-bold text-muted-foreground">FRIDAY PRAYER</span>
        </td>
      );
    }

    if (items.length === 0) {
      return (
        <>
          <td className="border border-border p-2 text-center text-muted-foreground text-xs">—</td>
          <td className="border border-border p-2 text-center text-muted-foreground text-xs">—</td>
        </>
      );
    }

    return (
      <>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between gap-1">
                <span className="font-bold text-sm">{e.course_code}</span>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => startEdit(e)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
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
        </td>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (
              <div key={e.id} className="text-sm text-muted-foreground">
                {e.venue || '—'}
              </div>
            ))}
          </div>
        </td>
      </>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-1 border-b border-border pb-4">
          <h1 className="text-lg font-bold uppercase tracking-tight">
            {settings?.school_name || 'University'}
          </h1>
          <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
          <p className="text-sm font-bold uppercase">
            Adjusted Final Examination Timetable
          </p>
          <p className="text-xs text-muted-foreground uppercase">
            First Semester 2025/2026 Academic Session
          </p>
        </div>

        <div className="flex justify-end">
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
                  <Input type="date" value={form.exam_date} onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, exam_date: val }));
                    // If Friday and afternoon selected, warn
                    if (new Date(val).getDay() === 5 && form.time_slot === 'afternoon') {
                      toast({ title: 'Note', description: 'Friday afternoon is reserved for Friday Prayer.' });
                      setForm(p => ({ ...p, exam_date: val, time_slot: 'morning', start_time: '08:00', end_time: '11:00' }));
                    }
                  }} />
                </div>
                <div className="space-y-1">
                  <Label>Time Slot</Label>
                  <Select value={form.time_slot} onValueChange={handleTimeSlotChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="z-[9999]">
                      {Object.entries(TIME_SLOTS).map(([k, v]) => (
                        <SelectItem
                          key={k}
                          value={k}
                          disabled={k === 'afternoon' && isFriday(form.exam_date)}
                        >
                          {v.label}
                          {k === 'afternoon' && isFriday(form.exam_date) ? ' (Friday Prayer)' : ''}
                        </SelectItem>
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
                  <Input placeholder="e.g. TETFD E, F, G, H" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
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
                  <th className="border border-primary-foreground/30 p-2 text-center font-bold" rowSpan={2}>
                    DAY & DATE
                  </th>
                  <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>
                    MORNING (8:00 – 11:00)
                  </th>
                  <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>
                    AFTERNOON (11:30 – 2:30)
                  </th>
                  <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>
                    EVENING (3:00 – 5:00)
                  </th>
                </tr>
                <tr className="bg-primary/90 text-primary-foreground text-xs">
                  <th className="border border-primary-foreground/30 p-1 text-center">COURSE CODE</th>
                  <th className="border border-primary-foreground/30 p-1 text-center">VENUE</th>
                  <th className="border border-primary-foreground/30 p-1 text-center">COURSE CODE</th>
                  <th className="border border-primary-foreground/30 p-1 text-center">VENUE</th>
                  <th className="border border-primary-foreground/30 p-1 text-center">COURSE CODE</th>
                  <th className="border border-primary-foreground/30 p-1 text-center">VENUE</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([dayKey, slots]: [string, any]) => {
                  const [dayLabel, dayName, dateFormatted] = dayKey.split('|');
                  return (
                    <tr key={dayKey} className="border-b hover:bg-muted/50">
                      <td className="border border-border p-2 font-bold text-center min-w-[120px]">
                        <div className="text-sm">{dayLabel.toUpperCase()}</div>
                        <div className="text-xs font-semibold">{dayName}</div>
                        <div className="text-xs text-muted-foreground">{dateFormatted}</div>
                      </td>
                      {renderSlotCell(slots.morning, 'morning', slots.date)}
                      {renderSlotCell(slots.afternoon, 'afternoon', slots.date)}
                      {renderSlotCell(slots.evening, 'evening', slots.date)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
