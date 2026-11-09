import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { ExamTimetableHeading } from '@/components/Shared/ExamTimetableHeading';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, Edit2, Download, Eye, X, Send, Archive } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { DateInput } from '@/components/ui/date-input';

const TIME_SLOTS = {
  morning: { label: 'Morning (8:00 AM – 11:00 AM)', start: '08:00', end: '11:00' },
  afternoon: { label: 'Afternoon (11:30 AM – 2:30 PM)', start: '11:30', end: '14:30' },
  evening: { label: 'Evening (3:00 PM – 5:00 PM)', start: '15:00', end: '17:00' },
};

type Slot = keyof typeof TIME_SLOTS;

interface SessionData {
  course_codes: string[];
  venue: string;
}

interface FormState {
  day_number: string;
  exam_date: string;
  sessions: Record<Slot, SessionData>;
}

const emptySessions = (): Record<Slot, SessionData> => ({
  morning: { course_codes: [], venue: '' },
  afternoon: { course_codes: [], venue: '' },
  evening: { course_codes: [], venue: '' },
});

// Today's date in Nigeria as YYYY-MM-DD, to compare with semester dates
const todayLagos = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
// "Day 3" -> 3
const dayNumberOf = (label: string) => parseInt(String(label).replace(/\D+/g, ''), 10) || 0;

type SetState = 'draft' | 'live' | 'archived' | 'unpublished';

export default function AdminExamTimetable() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickedSemester, setPickedSemester] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [previewData, setPreviewData] = useState<{ title: string; entries: any[] } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const timetableRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>({ day_number: '', exam_date: '', sessions: emptySessions() });

  const today = todayLagos();
  const activeSemester = semesters.find((s) => s.is_active) || null;
  const semesterById = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);

  const stateOf = (set: any): SetState => {
    const sem = semesterById.get(set.semester_id);
    const ended = !sem || today > sem.end_date;
    if (set.status === 'published') return ended || !sem?.is_active ? 'archived' : 'live';
    return ended ? 'unpublished' : 'draft';
  };

  // The timetable being worked on: the one for the current semester, if it hasn't ended
  const currentSet = activeSemester ? sets.find((s) => s.semester_id === activeSemester.id) : null;
  const currentState = currentSet ? stateOf(currentSet) : null;
  const workingSet = currentSet && (currentState === 'draft' || currentState === 'live') ? currentSet : null;
  const activeEnded = activeSemester ? today > activeSemester.end_date : false;

  useEffect(() => { loadAll(); fetchCoursesAndFilters(); }, []);
  useEffect(() => { if (activeSemester && !pickedSemester) setPickedSemester(activeSemester.id); }, [activeSemester]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchEntries(); }, [workingSet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    try { await supabase.rpc('auto_manage_semester_lifecycle'); } catch (e) { console.error(e); }
    const [semRes, setRes, histRes] = await Promise.all([
      supabase.from('semester_config').select('*').order('start_date', { ascending: false }),
      (supabase as any).from('exam_timetable_sets').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('timetable_history').select('*').order('created_at', { ascending: false }),
    ]);
    setSemesters(semRes.data || []);
    setSets(setRes.data || []);
    setHistory(histRes.data || []);
    setLoading(false);
  };

  const fetchCoursesAndFilters = async () => {
    const [coursesRes, deptsRes, levelsRes] = await Promise.all([
      supabase.from('courses').select('id, name, description, credit_unit, semester, subjects(id, name, code), classes(id, name)').order('name'),
      supabase.from('subjects').select('id, name, code').order('name'),
      supabase.from('classes').select('id, name').order('name'),
    ]);
    setAllCourses(coursesRes.data || []);
    setDepartments(deptsRes.data || []);
    setLevels(levelsRes.data || []);
  };

  const fetchEntries = async () => {
    if (!workingSet) { setEntries([]); return; }
    const { data } = await (supabase as any).from('exam_timetables').select('*')
      .eq('set_id', workingSet.id).order('exam_date', { ascending: true }).order('time_slot', { ascending: true });
    setEntries(data || []);
  };

  // Course choices: this semester's courses only, one row per course code.
  // Shared courses (CHM 101 in every department) used to appear once per department.
  const courseOptions = useMemo(() => {
    const term = (activeSemester?.term || '').toUpperCase();
    let filtered = allCourses;
    if (term) filtered = filtered.filter((c: any) => !c.semester || String(c.semester).toUpperCase() === term);
    if (filterDept) filtered = filtered.filter((c: any) => c.subjects?.id === filterDept);
    if (filterLevel) filtered = filtered.filter((c: any) => c.classes?.id === filterLevel);
    const byCode = new Map<string, { c: any; depts: Set<string>; levels: Set<string> }>();
    for (const c of filtered) {
      const code = c.name || c.id;
      const entry = byCode.get(code) || { c, depts: new Set(), levels: new Set() };
      if (c.subjects?.name) entry.depts.add(c.subjects.name);
      if (c.classes?.name) entry.levels.add(c.classes.name);
      byCode.set(code, entry);
    }
    return [...byCode.entries()].map(([code, { c, depts, levels: lv }]) => ({
      value: code,
      label: `${code}${c.description ? ' – ' + c.description : ''}`,
      description: `${depts.size > 1 ? `${depts.size} departments` : [...depts][0] || ''} • ${[...lv].join(', ')} • ${c.credit_unit || 0} units`,
    }));
  }, [allCourses, filterDept, filterLevel, activeSemester?.term]);

  const deptOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))];
  const levelOptions = [{ value: '', label: 'All Levels' }, ...levels.map((l: any) => ({ value: l.id, label: l.name }))];

  // Day numbers already used, with their dates
  const dayDates = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of entries) m.set(dayNumberOf(e.day_label), e.exam_date);
    return m;
  }, [entries]);
  const nextDayNumber = dayDates.size ? Math.max(...dayDates.keys()) + 1 : 1;

  const resetForm = () => {
    setForm({ day_number: '', exam_date: '', sessions: emptySessions() });
    setEditingId(null);
    setEditingSlot(null);
    setIsCreating(false);
  };

  const openNewEntry = () => {
    setEditingId(null);
    setEditingSlot(null);
    setForm({ day_number: String(nextDayNumber), exam_date: '', sessions: emptySessions() });
    setIsCreating(true);
  };

  const setDayNumber = (value: string) => {
    const n = parseInt(value, 10);
    // Adding more exams to a day that already exists keeps that day's date
    setForm((p) => ({ ...p, day_number: value, exam_date: dayDates.get(n) || p.exam_date }));
  };

  const isFriday = (dateStr: string) => dateStr ? new Date(dateStr).getDay() === 5 : false;

  const addCourseToSession = (slot: Slot, code: string) => {
    if (!code) return;
    if (form.sessions[slot].course_codes.includes(code)) {
      toast({ title: 'Duplicate', description: 'This course is already added to this session.', variant: 'destructive' });
      return;
    }
    setForm((p) => ({ ...p, sessions: { ...p.sessions, [slot]: { ...p.sessions[slot], course_codes: [...p.sessions[slot].course_codes, code] } } }));
  };

  const removeCourseFromSession = (slot: Slot, code: string) => {
    setForm((p) => ({ ...p, sessions: { ...p.sessions, [slot]: { ...p.sessions[slot], course_codes: p.sessions[slot].course_codes.filter((c) => c !== code) } } }));
  };

  const setSessionVenue = (slot: Slot, venue: string) => {
    setForm((p) => ({ ...p, sessions: { ...p.sessions, [slot]: { ...p.sessions[slot], venue } } }));
  };

  const notify = async (rows: any[]) => {
    // A few at a time so a long timetable doesn't fire hundreds of requests at once
    for (let i = 0; i < rows.length; i += 5) {
      await Promise.all(rows.slice(i, i + 5).map((r) =>
        supabase.functions.invoke('exam-notifications', {
          body: { type: 'exam_created', course_code: r.course_code, exam_date: r.exam_date, time_slot: r.time_slot, venue: r.venue, start_time: r.start_time, end_time: r.end_time },
        }).catch((e) => console.error('Notification error:', e))
      ));
    }
  };

  const startTimetable = async () => {
    if (!activeSemester || pickedSemester !== activeSemester.id) {
      toast({ title: 'Pick the current semester', description: 'A timetable can only be started for the current semester.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from('exam_timetable_sets').insert({ semester_id: activeSemester.id, created_by: profile?.id });
    setBusy(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Timetable started', description: `Add the exam days for ${activeSemester.name}.` });
    await loadAll();
    setForm({ day_number: '1', exam_date: '', sessions: emptySessions() });
    setIsCreating(true);
  };

  const saveEntry = async () => {
    if (!workingSet || !activeSemester) return;
    const day = parseInt(form.day_number, 10);
    if (!day || day < 1) {
      toast({ title: 'Day needed', description: 'Type the day number, for example 1.', variant: 'destructive' });
      return;
    }
    if (!form.exam_date) {
      toast({ title: 'Date needed', description: 'Pick the exam date for this day.', variant: 'destructive' });
      return;
    }
    if (form.exam_date < activeSemester.start_date || form.exam_date > activeSemester.end_date) {
      toast({ title: 'Date outside the semester', description: `Pick a date between ${fmtDate(activeSemester.start_date)} and ${fmtDate(activeSemester.end_date)}.`, variant: 'destructive' });
      return;
    }
    // One date per day number, and one day number per date
    const editingRow = editingId ? entries.find((e) => e.id === editingId) : null;
    const others = entries.filter((e) => e.id !== editingId);
    const sameDay = others.find((e) => dayNumberOf(e.day_label) === day);
    if (sameDay && sameDay.exam_date !== form.exam_date) {
      toast({ title: `Day ${day} is already on ${fmtDate(sameDay.exam_date)}`, description: 'Use that date or a different day number.', variant: 'destructive' });
      return;
    }
    const sameDate = others.find((e) => e.exam_date === form.exam_date);
    if (sameDate && dayNumberOf(sameDate.day_label) !== day) {
      toast({ title: `${fmtDate(form.exam_date)} is already ${sameDate.day_label}`, description: 'Use that day number or a different date.', variant: 'destructive' });
      return;
    }

    const totalCourses = Object.values(form.sessions).reduce((sum, s) => sum + s.course_codes.length, 0);
    if (totalCourses === 0) {
      toast({ title: 'No courses', description: 'Add at least one course to any session.', variant: 'destructive' });
      return;
    }

    const already = allSelectedCodes.filter((c) => scheduledCodes.has(c));
    if (already.length) {
      toast({ title: 'Already on the timetable', description: `${already.join(', ')} ${already.length === 1 ? 'is' : 'are'} already scheduled on another day.`, variant: 'destructive' });
      return;
    }

    const day_label = `Day ${day}`;
    const live = currentState === 'live';
    setBusy(true);

    if (editingRow && editingSlot) {
      const session = form.sessions[editingSlot];
      if (session.course_codes.length === 1) {
        const slot = TIME_SLOTS[editingSlot];
        const { error } = await (supabase as any).from('exam_timetables').update({
          day_label, exam_date: form.exam_date, time_slot: editingSlot,
          start_time: slot.start, end_time: slot.end, course_code: session.course_codes[0], venue: session.venue,
        }).eq('id', editingRow.id);
        setBusy(false);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
        toast({ title: 'Updated', description: 'Entry updated.' });
        resetForm();
        fetchEntries();
        return;
      }
    }

    const rows = (Object.entries(form.sessions) as [Slot, SessionData][]).flatMap(([slotKey, session]) =>
      session.course_codes.map((code) => ({
        set_id: workingSet.id, day_label, exam_date: form.exam_date, time_slot: slotKey,
        start_time: TIME_SLOTS[slotKey].start, end_time: TIME_SLOTS[slotKey].end,
        course_code: code, venue: session.venue, created_by: profile?.id,
      }))
    );
    const { error } = await (supabase as any).from('exam_timetables').insert(rows);
    if (!error && editingRow) await (supabase as any).from('exam_timetables').delete().eq('id', editingRow.id);
    setBusy(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    // A draft stays quiet; a live timetable tells students about new exams straight away
    if (live) notify(rows);
    toast({ title: `${day_label} saved`, description: `${rows.length} exam${rows.length === 1 ? '' : 's'} added.` });
    resetForm();
    fetchEntries();
  };

  const publish = async () => {
    if (!workingSet) return;
    setBusy(true);
    const { error } = await (supabase as any).from('exam_timetable_sets')
      .update({ status: 'published', published_at: new Date().toISOString() }).eq('id', workingSet.id);
    setBusy(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Semester timetable created', description: 'Students and lecturers can now see it.' });
    notify(entries);
    loadAll();
  };

  const deleteSet = async (set: any) => {
    const { error } = await (supabase as any).from('exam_timetable_sets').delete().eq('id', set.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Timetable deleted' });
    resetForm();
    loadAll();
  };

  const deleteEntry = async (id: string) => {
    await (supabase as any).from('exam_timetables').delete().eq('id', id);
    toast({ title: 'Deleted' });
    fetchEntries();
  };

  const startEdit = (e: any) => {
    const sessions = emptySessions();
    sessions[e.time_slot as Slot] = { course_codes: [e.course_code], venue: e.venue || '' };
    setForm({ day_number: String(dayNumberOf(e.day_label)), exam_date: e.exam_date, sessions });
    setEditingId(e.id);
    setEditingSlot(e.time_slot);
    setIsCreating(true);
  };

  const openPreview = async (set: any) => {
    const { data } = await (supabase as any).from('exam_timetables').select('*')
      .eq('set_id', set.id).order('exam_date').order('time_slot');
    setPreviewData({ title: semesterById.get(set.semester_id)?.name || 'Exam timetable', entries: data || [] });
    setPreviewOpen(true);
  };

  const downloadPDF = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      // Leave the edit and delete buttons out of the downloaded PDF
      ignoreElements: (el) => el.hasAttribute?.('data-pdf-hide'),
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  };

  const groupEntries = (data: any[]) => data.reduce((acc: any, e: any) => {
    const dateObj = new Date(e.exam_date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const key = `${e.day_label}|${dayName}|${dateFormatted}`;
    if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  const grouped = groupEntries(entries);

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
                  <div className="flex gap-0.5 shrink-0" data-pdf-hide>
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

  const renderHeader = (title: string, data: Record<string, any>, ref?: React.RefObject<HTMLDivElement>, readonly = false) => (
    <div ref={ref} className="bg-background p-4">
      <ExamTimetableHeading sessionLabel={title} />
      <div className="overflow-x-auto">{renderTimetableTable(data, readonly)}</div>
    </div>
  );

  const allSelectedCodes = [...form.sessions.morning.course_codes, ...form.sessions.afternoon.course_codes, ...form.sessions.evening.course_codes];
  // Courses already on the timetable (except the entry being edited), so each course is only scheduled once
  const scheduledCodes = new Set(entries.filter((e) => e.id !== editingId).map((e) => e.course_code));

  const renderSessionForm = (slot: Slot, label: string) => {
    const session = form.sessions[slot];
    // Hide courses picked in this form and courses already on another day of the timetable
    const availableOptions = courseOptions.filter((o) => !allSelectedCodes.includes(o.value) && !scheduledCodes.has(o.value));
    if (slot === 'afternoon' && isFriday(form.exam_date)) {
      return (
        <div className="p-3 rounded-lg border bg-muted/30">
          <Label className="font-semibold text-sm">{label}</Label>
          <p className="text-sm text-muted-foreground mt-1">Reserved for Friday Prayer</p>
        </div>
      );
    }
    return (
      <div className="p-3 rounded-lg border space-y-3 min-w-0">
        <Label className="font-semibold text-sm">{label}</Label>
        <SearchableSelect options={availableOptions} value="" onValueChange={(code) => addCourseToSession(slot, code)}
          placeholder="+ Add Course" searchPlaceholder="Type a course code, e.g. CVE 413" />
        {session.course_codes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {session.course_codes.map((code) => (
              <Badge key={code} variant="secondary" className="text-sm gap-1 pr-1">
                {code}
                <button type="button" onClick={() => removeCourseFromSession(slot, code)} className="ml-1 hover:text-destructive" aria-label={`Remove ${code}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Venue</Label>
          <Input placeholder="e.g. TETFD E, F, G, H" value={session.venue} onChange={(e) => setSessionVenue(slot, e.target.value)} />
        </div>
      </div>
    );
  };

  // Past timetables: published ones whose semester ended (or is no longer current), and drafts never published
  const archivedSets = sets.filter((s) => {
    const st = stateOf(s);
    return st === 'archived' || st === 'unpublished';
  }).filter((s) => {
    if (!historySearch) return true;
    return (semesterById.get(s.semester_id)?.name || '').toLowerCase().includes(historySearch.toLowerCase());
  });
  const legacyHistory = history.filter((h) => !historySearch || h.semester?.toLowerCase().includes(historySearch.toLowerCase()));

  const stateBadge = (st: SetState) => ({
    draft: <Badge variant="secondary">Draft</Badge>,
    live: <Badge>Live</Badge>,
    archived: <Badge variant="outline">Archived</Badge>,
    unpublished: <Badge variant="outline">Never published</Badge>,
  })[st];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Timetable</h1>
          <p className="text-muted-foreground">Build the exam timetable for the current semester, then publish it to students and lecturers</p>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : !activeSemester ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            No semester is set as current. Choose one on the <Link to="/admin/semester-settings" className="text-primary underline">Sessions</Link> page first.
          </CardContent></Card>
        ) : !workingSet ? (
          /* Step 1: start a timetable for the current semester */
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Calendar className="h-5 w-5" /> Start a new timetable</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeEnded ? (
                <p className="text-sm text-muted-foreground">
                  {activeSemester.name} ended on {fmtDate(activeSemester.end_date)}. Make the next semester current on the <Link to="/admin/semester-settings" className="text-primary underline">Sessions</Link> page to start its timetable.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Only the current semester, set on the <Link to="/admin/semester-settings" className="text-primary underline">Sessions</Link> page, can have a new timetable.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="space-y-1 min-w-0">
                      <Label>Semester</Label>
                      <Select value={pickedSemester} onValueChange={setPickedSemester}>
                        <SelectTrigger><SelectValue placeholder="Select the current semester" /></SelectTrigger>
                        <SelectContent>
                          {semesters.map((s) => (
                            <SelectItem key={s.id} value={s.id} disabled={!s.is_active}>
                              {s.name}{s.is_active ? ' (current)' : ' (not current)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={startTimetable} disabled={busy || pickedSemester !== activeSemester.id}>
                      <Plus className="h-4 w-4 mr-2" /> Start timetable
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(activeSemester.start_date)} to {fmtDate(activeSemester.end_date)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Step 2: add days, then publish */
          <>
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{activeSemester.name}</h2>
                      {stateBadge(currentState as SetState)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currentState === 'draft'
                        ? 'Not visible to students or lecturers yet. Add each exam day, then press Create semester timetable.'
                        : `Showing to students and lecturers until ${fmtDate(activeSemester.end_date)}. It moves to Past timetables after that.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={openNewEntry} disabled={busy}><Plus className="h-4 w-4 mr-2" /> New entry</Button>
                    {entries.length > 0 && (
                      <Button variant="outline" onClick={() => downloadPDF(timetableRef, `Exam-Timetable-${activeSemester.name}.pdf`)}>
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {isCreating && (
              <Card>
                <CardHeader><CardTitle>{editingId ? 'Edit entry' : `Add exams for Day ${form.day_number || '…'}`}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="exam-day">Day</Label>
                      <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                        <span className="pl-3 pr-1 text-sm text-muted-foreground">Day</span>
                        <Input id="exam-day" type="number" inputMode="numeric" min={1} placeholder="1"
                          value={form.day_number} onChange={(e) => setDayNumber(e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </div>
                      {dayDates.has(parseInt(form.day_number, 10)) && !editingId && (
                        <p className="text-xs text-muted-foreground">Day {form.day_number} already has exams. These will be added to it.</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="exam-date">Date</Label>
                      <DateInput id="exam-date" value={form.exam_date} min={activeSemester.start_date} max={activeSemester.end_date}
                        onChange={(v) => setForm((p) => ({ ...p, exam_date: v }))} />
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                    <SearchableSelect options={deptOptions} value={filterDept} onValueChange={setFilterDept} placeholder="Filter by Department" searchPlaceholder="Search departments..." />
                    <SearchableSelect options={levelOptions} value={filterLevel} onValueChange={setFilterLevel} placeholder="Filter by Level" searchPlaceholder="Search levels..." />
                  </div>

                  <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                    {renderSessionForm('morning', 'Morning (8:00 – 11:00)')}
                    {renderSessionForm('afternoon', 'Afternoon (11:30 – 2:30)')}
                    {renderSessionForm('evening', 'Evening (3:00 – 5:00)')}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveEntry} disabled={busy || allSelectedCodes.length === 0}>{editingId ? 'Update' : 'Add'}</Button>
                    <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {entries.length === 0 ? (
              <Card><CardContent className="text-center py-8"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exam days yet. Press New entry to add Day 1.</p></CardContent></Card>
            ) : (
              renderHeader(`${activeSemester.name} Academic Session`, grouped, timetableRef)
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete this timetable</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete the {activeSemester.name} timetable?</AlertDialogTitle>
                    <AlertDialogDescription>All its days and entries will be removed{currentState === 'live' ? ', and students and lecturers will stop seeing it' : ''}. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSet(workingSet)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {currentState === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" disabled={busy || entries.length === 0}><Send className="h-4 w-4 mr-2" /> Create semester timetable</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Create the {activeSemester.name} timetable?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Students and lecturers will see it on their Exam Timetable page, with their own courses highlighted, and get a notification for each of their exams. It stays up until {fmtDate(activeSemester.end_date)}, then moves to Past timetables. You can still add or change entries after this.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={publish}>Create timetable</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </>
        )}

        {/* Past timetables */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" /> Past timetables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">A timetable moves here by itself when its semester ends. Students and lecturers no longer see it.</p>
            <Input placeholder="Search by semester..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="max-w-sm" />
            {archivedSets.length === 0 && legacyHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past timetables yet.</p>
            ) : (
              <div className="space-y-2">
                {archivedSets.map((s) => {
                  const sem = semesterById.get(s.semester_id);
                  return (
                    <div key={s.id} className="flex flex-col gap-3 p-3 rounded-lg border hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{sem?.name || 'Semester'}</p>
                          {stateBadge(stateOf(s))}
                        </div>
                        {sem && <p className="text-xs text-muted-foreground">{fmtDate(sem.start_date)} to {fmtDate(sem.end_date)}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openPreview(s)}><Eye className="h-4 w-4 mr-1" /> Preview</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete this timetable?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteSet(s)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
                {legacyHistory.map((h: any) => (
                  <div key={h.id} className="flex flex-col gap-3 p-3 rounded-lg border hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{h.semester}</p>
                      <p className="text-xs text-muted-foreground">Saved {fmtDate(h.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setPreviewData({ title: h.semester, entries: h.timetable_data || [] }); setPreviewOpen(true); }}>
                        <Eye className="h-4 w-4 mr-1" /> Preview
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete this timetable?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              const { error } = await (supabase as any).from('timetable_history').delete().eq('id', h.id);
                              if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
                              toast({ title: 'Deleted' });
                              loadAll();
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

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>{previewData?.title}</DialogTitle></DialogHeader>
            {previewData && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => downloadPDF(previewRef, `Exam-Timetable-${previewData.title}.pdf`)}>
                    <Download className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                </div>
                {previewData.entries.length === 0
                  ? <p className="text-sm text-muted-foreground">This timetable has no entries.</p>
                  : renderHeader(`${previewData.title} Academic Session`, groupEntries(previewData.entries), previewRef, true)}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
