import { useEffect, useState, useMemo, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, Edit2, Download, Eye, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const TIME_SLOTS = {
  morning: { label: 'Morning (8:00 AM – 11:00 AM)', start: '08:00', end: '11:00' },
  afternoon: { label: 'Afternoon (11:30 AM – 2:30 PM)', start: '11:30', end: '14:30' },
  evening: { label: 'Evening (3:00 PM – 5:00 PM)', start: '15:00', end: '17:00' },
};

interface SessionData {
  course_codes: string[];
  venue: string;
}

interface FormState {
  day_label: string;
  exam_date: string;
  sessions: {
    morning: SessionData;
    afternoon: SessionData;
    evening: SessionData;
  };
}

const emptyForm: FormState = {
  day_label: '', exam_date: '',
  sessions: {
    morning: { course_codes: [], venue: '' },
    afternoon: { course_codes: [], venue: '' },
    evening: { course_codes: [], venue: '' },
  },
};

export default function AdminExamTimetable() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [activeSemester, setActiveSemester] = useState<any>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const timetableRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>({ ...emptyForm });

  useEffect(() => {
    fetchEntries();
    fetchSemester();
    fetchCoursesAndFilters();
    fetchHistory();
  }, []);

  const fetchSemester = async () => {
    // Auto-manage semester lifecycle on load
    try { await supabase.rpc('auto_manage_semester_lifecycle'); } catch (e) { console.error(e); }
    const { data } = await supabase.from('semester_config').select('*').eq('is_active', true).maybeSingle();
    setActiveSemester(data);
  };

  const fetchCoursesAndFilters = async () => {
    const [coursesRes, deptsRes, levelsRes] = await Promise.all([
      supabase.from('courses').select('id, name, description, credit_unit, semester, academic_year, subjects(id, name, code), classes(id, name)').order('name'),
      supabase.from('subjects').select('id, name, code').order('name'),
      supabase.from('classes').select('id, name').order('name'),
    ]);
    setAllCourses(coursesRes.data || []);
    setDepartments(deptsRes.data || []);
    setLevels(levelsRes.data || []);
  };

  const fetchEntries = async () => {
    const { data } = await (supabase as any).from('exam_timetables').select('*').order('exam_date', { ascending: true }).order('time_slot', { ascending: true });
    setEntries(data || []);
    setLoading(false);
  };

  const fetchHistory = async () => {
    const { data } = await (supabase as any).from('timetable_history').select('*').order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const courseOptions = useMemo(() => {
    let filtered = allCourses;
    if (filterDept) filtered = filtered.filter((c: any) => c.subjects?.id === filterDept);
    if (filterLevel) filtered = filtered.filter((c: any) => c.classes?.id === filterLevel);
    return filtered.map((c: any) => ({
      value: c.name || c.id,
      label: `${c.name || ''}${c.description ? ' – ' + c.description : ''}`,
      description: `${c.subjects?.name || ''} • ${c.classes?.name || ''} • ${c.credit_unit || 0} units`,
    }));
  }, [allCourses, filterDept, filterLevel]);

  const deptOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))];
  const levelOptions = [{ value: '', label: 'All Levels' }, ...levels.map((l: any) => ({ value: l.id, label: l.name }))];

  const semesterLabel = activeSemester ? `${activeSemester.name} Academic Session` : 'Academic Session';

  const resetForm = () => {
    setForm({ ...emptyForm, sessions: { morning: { course_codes: [], venue: '' }, afternoon: { course_codes: [], venue: '' }, evening: { course_codes: [], venue: '' } } });
    setEditingId(null);
    setEditingSlot(null);
    setIsCreating(false);
  };

  const isFriday = (dateStr: string) => dateStr ? new Date(dateStr).getDay() === 5 : false;

  const addCourseToSession = (slot: 'morning' | 'afternoon' | 'evening', code: string) => {
    if (!code) return;
    if (form.sessions[slot].course_codes.includes(code)) {
      toast({ title: 'Duplicate', description: 'This course is already added to this session.', variant: 'destructive' });
      return;
    }
    setForm(p => ({
      ...p,
      sessions: {
        ...p.sessions,
        [slot]: { ...p.sessions[slot], course_codes: [...p.sessions[slot].course_codes, code] },
      },
    }));
  };

  const removeCourseFromSession = (slot: 'morning' | 'afternoon' | 'evening', code: string) => {
    setForm(p => ({
      ...p,
      sessions: {
        ...p.sessions,
        [slot]: { ...p.sessions[slot], course_codes: p.sessions[slot].course_codes.filter(c => c !== code) },
      },
    }));
  };

  const setSessionVenue = (slot: 'morning' | 'afternoon' | 'evening', venue: string) => {
    setForm(p => ({
      ...p,
      sessions: {
        ...p.sessions,
        [slot]: { ...p.sessions[slot], venue },
      },
    }));
  };

  const saveEntry = async () => {
    if (!form.day_label || !form.exam_date) {
      toast({ title: 'Error', description: 'Day label and date are required.', variant: 'destructive' });
      return;
    }

    const totalCourses = Object.values(form.sessions).reduce((sum, s) => sum + s.course_codes.length, 0);
    if (totalCourses === 0) {
      toast({ title: 'Error', description: 'Add at least one course to any session.', variant: 'destructive' });
      return;
    }

    // If editing a single entry, update it
    if (editingId && editingSlot) {
      const session = form.sessions[editingSlot as keyof typeof form.sessions];
      if (session.course_codes.length === 1) {
        const slot = TIME_SLOTS[editingSlot as keyof typeof TIME_SLOTS];
        const { error } = await (supabase as any).from('exam_timetables').update({
          day_label: form.day_label, exam_date: form.exam_date, time_slot: editingSlot,
          start_time: slot.start, end_time: slot.end, course_code: session.course_codes[0],
          venue: session.venue,
        }).eq('id', editingId);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
        toast({ title: 'Updated', description: 'Entry updated.' });
        resetForm();
        fetchEntries();
        return;
      }
    }

    // Save each session's courses as separate entries
    for (const [slotKey, session] of Object.entries(form.sessions)) {
      if (session.course_codes.length === 0) continue;
      const slot = TIME_SLOTS[slotKey as keyof typeof TIME_SLOTS];

      for (const code of session.course_codes) {
        const payload = {
          day_label: form.day_label, exam_date: form.exam_date, time_slot: slotKey,
          start_time: slot.start, end_time: slot.end, course_code: code,
          venue: session.venue, created_by: profile?.id,
        };

        const { error } = await (supabase as any).from('exam_timetables').insert([payload]);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

        try {
          await supabase.functions.invoke('exam-notifications', {
            body: { type: 'exam_created', course_code: code, exam_date: form.exam_date, time_slot: slotKey, venue: session.venue, start_time: slot.start, end_time: slot.end },
          });
        } catch (e) { console.error('Notification error:', e); }
      }
    }

    toast({ title: 'Created', description: `${totalCourses} entries added.` });
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
      day_label: e.day_label, exam_date: e.exam_date,
      sessions: {
        morning: { course_codes: e.time_slot === 'morning' ? [e.course_code] : [], venue: e.time_slot === 'morning' ? (e.venue || '') : '' },
        afternoon: { course_codes: e.time_slot === 'afternoon' ? [e.course_code] : [], venue: e.time_slot === 'afternoon' ? (e.venue || '') : '' },
        evening: { course_codes: e.time_slot === 'evening' ? [e.course_code] : [], venue: e.time_slot === 'evening' ? (e.venue || '') : '' },
      },
    });
    setEditingId(e.id);
    setEditingSlot(e.time_slot);
    setIsCreating(true);
  };

  const saveTimetableHistory = async () => {
    if (!activeSemester || entries.length === 0) {
      toast({ title: 'Error', description: 'No timetable data or active semester.', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('timetable_history').insert([{
      semester: activeSemester.name, session: activeSemester.name,
      timetable_data: entries, created_by: profile?.id,
    }]);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Saved', description: 'Timetable archived to history.' });
    fetchHistory();
  };

  const downloadPDF = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  };

  const grouped = entries.reduce((acc: any, e: any) => {
    const dateObj = new Date(e.exam_date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const key = `${e.day_label}|${dayName}|${dateFormatted}`;
    if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  const renderSlotCell = (items: any[], slotType: string, dateStr: string, readonly = false) => {
    if (slotType === 'afternoon' && new Date(dateStr).getDay() === 5) {
      return (<td className="border border-border p-2 text-center" colSpan={2}><span className="font-bold text-muted-foreground">FRIDAY PRAYER</span></td>);
    }
    if (items.length === 0) {
      return (<><td className="border border-border p-2 text-center text-muted-foreground text-xs">—</td><td className="border border-border p-2 text-center text-muted-foreground text-xs">—</td></>);
    }
    return (
      <>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (
              <div key={e.id || e.course_code} className="flex items-center justify-between gap-1">
                <span className="font-bold text-sm">{e.course_code}</span>
                {!readonly && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => startEdit(e)}><Edit2 className="h-3 w-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-5 w-5 p-0"><Trash2 className="h-3 w-3 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete this entry?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteEntry(e.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        </td>
        <td className="border border-border p-2">
          <div className="space-y-1">
            {items.map((e: any) => (<div key={e.id || e.course_code} className="text-sm text-muted-foreground">{e.venue || '—'}</div>))}
          </div>
        </td>
      </>
    );
  };

  const renderTimetableTable = (data: Record<string, any>, readonly = false) => (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-primary text-primary-foreground">
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" rowSpan={2}>DAY & DATE</th>
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>MORNING (8:00 – 11:00)</th>
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>AFTERNOON (11:30 – 2:30)</th>
          <th className="border border-primary-foreground/30 p-2 text-center font-bold" colSpan={2}>EVENING (3:00 – 5:00)</th>
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
        {Object.entries(data).map(([dayKey, slots]: [string, any]) => {
          const [dayLabel, dayName, dateFormatted] = dayKey.split('|');
          return (
            <tr key={dayKey} className="border-b hover:bg-muted/50">
              <td className="border border-border p-2 font-bold text-center min-w-[120px]">
                <div className="text-sm">{dayLabel.toUpperCase()}</div>
                <div className="text-xs font-semibold">{dayName}</div>
                <div className="text-xs text-muted-foreground">{dateFormatted}</div>
              </td>
              {renderSlotCell(slots.morning, 'morning', slots.date, readonly)}
              {renderSlotCell(slots.afternoon, 'afternoon', slots.date, readonly)}
              {renderSlotCell(slots.evening, 'evening', slots.date, readonly)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const groupHistoryData = (data: any[]) => {
    return data.reduce((acc: any, e: any) => {
      const dateObj = new Date(e.exam_date);
      const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
      const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const key = `${e.day_label}|${dayName}|${dateFormatted}`;
      if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
      acc[key][e.time_slot]?.push(e);
      return acc;
    }, {});
  };

  const filteredHistory = history.filter(h => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return h.semester?.toLowerCase().includes(q) || h.session?.toLowerCase().includes(q);
  });

  // Get all selected course codes across all sessions (for filtering dropdown)
  const allSelectedCodes = [
    ...form.sessions.morning.course_codes,
    ...form.sessions.afternoon.course_codes,
    ...form.sessions.evening.course_codes,
  ];

  const renderSessionForm = (slot: 'morning' | 'afternoon' | 'evening', label: string) => {
    const isDisabled = slot === 'afternoon' && isFriday(form.exam_date);
    const session = form.sessions[slot];
    const availableOptions = courseOptions.filter(o => !allSelectedCodes.includes(o.value));

    if (isDisabled) {
      return (
        <div className="p-3 rounded-lg border bg-muted/30">
          <Label className="font-semibold text-sm">{label}</Label>
          <p className="text-sm text-muted-foreground mt-1">Reserved for Friday Prayer</p>
        </div>
      );
    }

    return (
      <div className="p-3 rounded-lg border space-y-3">
        <Label className="font-semibold text-sm">{label}</Label>
        <SearchableSelect
          options={availableOptions}
          value=""
          onValueChange={(code) => addCourseToSession(slot, code)}
          placeholder="+ Add Course"
          searchPlaceholder="Search by code or name..."
        />
        {session.course_codes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {session.course_codes.map(code => (
              <Badge key={code} variant="secondary" className="text-sm gap-1 pr-1">
                {code}
                <button onClick={() => removeCourseFromSession(slot, code)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Venue</Label>
          <Input placeholder="e.g. TETFD E, F, G, H" value={session.venue} onChange={e => setSessionVenue(slot, e.target.value)} />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={saveTimetableHistory} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Save to History
          </Button>
          <Button variant="outline" onClick={() => downloadPDF(timetableRef, `Exam-Timetable-${activeSemester?.name || 'current'}.pdf`)} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
          <Button onClick={() => { resetForm(); setIsCreating(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Entry
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader><CardTitle>{editingId ? 'Edit Entry' : 'Add Exam Entries'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Day Label</Label>
                  <Input placeholder="e.g. Day 1" value={form.day_label} onChange={e => setForm(p => ({ ...p, day_label: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} />
                </div>
              </div>

              {/* Department & Level filters */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <SearchableSelect
                  options={deptOptions}
                  value={filterDept}
                  onValueChange={setFilterDept}
                  placeholder="Filter by Department"
                  searchPlaceholder="Search departments..."
                />
                <SearchableSelect
                  options={levelOptions}
                  value={filterLevel}
                  onValueChange={setFilterLevel}
                  placeholder="Filter by Level"
                  searchPlaceholder="Search levels..."
                />
              </div>

              {/* Per-session course selection */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                {renderSessionForm('morning', 'Morning (8:00 – 11:00)')}
                {renderSessionForm('afternoon', 'Afternoon (11:30 – 2:30)')}
                {renderSessionForm('evening', 'Evening (3:00 – 5:00)')}
              </div>

              <div className="flex gap-2">
                <Button onClick={saveEntry} disabled={Object.values(form.sessions).every(s => s.course_codes.length === 0)}>
                  {editingId ? 'Update' : 'Add'}
                </Button>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Timetable */}
        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <Card><CardContent className="text-center py-8"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exam timetable entries yet.</p></CardContent></Card>
        ) : (
          <div ref={timetableRef} className="overflow-x-auto bg-background p-4">
            <div className="text-center space-y-1 mb-4">
              <p className="text-lg font-bold uppercase">{settings?.school_name || 'University'}</p>
              <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
              <p className="text-sm font-bold uppercase">Examination Timetable</p>
              <p className="text-xs text-muted-foreground uppercase">{semesterLabel}</p>
            </div>
            {renderTimetableTable(grouped)}
          </div>
        )}

        {/* Timetable History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Timetable History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search by semester or session..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="max-w-sm"
            />
            {filteredHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archived timetables yet.</p>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <p className="font-semibold">{h.semester}</p>
                      <p className="text-xs text-muted-foreground">Created: {new Date(h.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setPreviewData(h); setPreviewOpen(true); }}>
                        <Eye className="h-4 w-4 mr-1" /> Preview
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this timetable?</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              const { error } = await (supabase as any).from('timetable_history').delete().eq('id', h.id);
                              if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
                              toast({ title: 'Deleted', description: 'Timetable removed from history.' });
                              fetchHistory();
                            }}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Timetable Preview – {previewData?.semester}</DialogTitle>
            </DialogHeader>
            {previewData && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => downloadPDF(previewRef, `Timetable-${previewData.semester}.pdf`)}>
                    <Download className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                </div>
                <div ref={previewRef} className="bg-background p-4">
                  <div className="text-center space-y-1 mb-4">
                    <p className="text-lg font-bold uppercase">{settings?.school_name || 'University'}</p>
                    <p className="text-sm font-bold uppercase">Faculty of Engineering</p>
                    <p className="text-sm font-bold uppercase">Examination Timetable</p>
                    <p className="text-xs text-muted-foreground uppercase">{previewData.semester}</p>
                  </div>
                  <div className="overflow-x-auto">
                    {renderTimetableTable(groupHistoryData(previewData.timetable_data || []), true)}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
